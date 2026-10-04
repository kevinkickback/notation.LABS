import {
  BlobReader,
  BlobWriter,
  configure,
  type FileEntry,
  ZipReader,
} from '@zip.js/zip.js/lib/zip-core-native.js';
import type { VideoReference } from '@/lib/backup/archiveContract';
import { BACKUP_RECORD_FILES } from '@/lib/backup/archiveContract';
import {
  archiveCharacterSchema,
  archiveComboSchema,
  archiveGameSchema,
  archiveManifestSchema,
  archiveVideoSchema,
  imageDataUrl,
} from '@/lib/backup/archiveFormat';
import {
  assertSafeSize,
  BACKUP_DIRECTORY_BYTES,
  BACKUP_MANIFEST_BYTES,
  BackupDirectoryBudget,
} from '@/lib/backup/capabilities';
import { storageWarning } from '@/lib/backup/capacity';
import { BACKUP_CHUNK_BYTES } from '@/lib/backup/exportContract';
import { normalizeBackupImport } from '@/lib/backup/importPipeline';
import { ndjsonWriter } from '@/lib/backup/recordStreams';
import { parseComboRecords } from '@/lib/comboParsing';
import { MAX_IMAGE_SIZE_BYTES } from '@/lib/media/images';
import { normalizeGameNotationProfile } from '@/lib/notationProfiles';
import { importDataSchema } from '@/lib/schemas';
import {
  applyBackupImportPlan,
  base64ToArrayBuffer,
  publishBackupSession,
} from './backupImportShared';
import {
  createBackupRecordStager,
  createBackupSession,
  finishBackupSession,
  readStagedRecord,
  stagedRowsBatches,
  withBackupSessionLock,
} from './backupSessionRepository';
import { db } from './database';
import { importJsonBackupUnlocked } from './jsonImport';
import {
  getImportedLocalVideoId,
  sanitizeImportedVideoReference,
} from './videoReferences';
import { createVideoStager, stageVideoPayload } from './videoRepository';

export interface ZipImportProgress {
  phase: 'loading' | 'videos' | 'finalizing' | 'committing';
  current: number;
  total: number | null;
  bytesProcessed?: number;
  warning?: string;
}

class BoundedBlobReader extends BlobReader {
  override readUint8Array(offset: number, length: number) {
    assertSafeSize(offset);
    assertSafeSize(length);
    // zip.js reads its central directory before yielding entries.
    if (length > BACKUP_DIRECTORY_BYTES)
      throw new Error('Backup zip directory exceeds its memory budget');
    return super.readUint8Array(offset, length);
  }
}

async function extractEntry(
  entry: FileEntry,
  target: WritableStream<Uint8Array>,
  signal?: AbortSignal,
  onBytes?: (bytes: number) => void,
): Promise<void> {
  let size = 0;
  const writer = target.getWriter();
  try {
    await entry.getData(
      new WritableStream<Uint8Array>({
        async write(chunk) {
          signal?.throwIfAborted();
          size += chunk.byteLength;
          if (size > entry.uncompressedSize)
            throw new Error(
              'Invalid backup zip: file size does not match its contents',
            );
          await writer.write(chunk);
          onBytes?.(chunk.byteLength);
        },
        async close() {
          if (size !== entry.uncompressedSize)
            throw new Error(
              'Invalid backup zip: file size does not match its contents',
            );
          await writer.close();
        },
        abort(reason) {
          return writer.abort(reason);
        },
      }),
      { checkCrc32: true, signal },
    );
  } catch (error) {
    await writer.abort(error).catch(() => {});
    throw error;
  } finally {
    writer.releaseLock();
  }
}

async function entryBlob(
  entry: FileEntry,
  mimeType: string,
  signal?: AbortSignal,
  onBytes?: (bytes: number) => void,
  source?: Blob,
): Promise<Blob> {
  if (source && entry.compressionMethod === 0 && !entry.encrypted) {
    // zip.js still validates headers, overlap, lengths, and CRC. Its public validated
    // offset then lets a STORE payload share the disk-backed archive instead of
    // creating a temporary Response/Blob for every small attachment.
    await extractEntry(
      entry,
      new WritableStream<Uint8Array>(),
      signal,
      onBytes,
    );
    const offset = entry.localDirectory?.dataOffset;
    if (offset === undefined)
      throw new Error('Backup payload offset is unavailable');
    assertSafeSize(offset);
    assertSafeSize(offset + entry.uncompressedSize);
    if (offset + entry.uncompressedSize > source.size)
      throw new Error('Backup payload is outside the archive');
    return source.slice(offset, offset + entry.uncompressedSize, mimeType);
  }
  const writer = new BlobWriter(mimeType);
  await extractEntry(entry, writer.writable, signal, onBytes);
  return writer.getData();
}

async function boundedEntry(
  entry: FileEntry,
  limit: number,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  if (entry.uncompressedSize > limit)
    throw new Error(
      'Backup metadata exceeds its memory budget. Use the current ZIP format for large libraries.',
    );
  return new Uint8Array(
    await (
      await entryBlob(entry, 'application/octet-stream', signal)
    ).arrayBuffer(),
  );
}

export function importZipBackup(
  file: Blob,
  includeVideos = false,
  includeSettings = false,
  onProgress?: (progress: ZipImportProgress) => void,
  signal?: AbortSignal,
): Promise<void> {
  return withBackupSessionLock(
    () =>
      importZipBackupUnlocked(
        file,
        includeVideos,
        includeSettings,
        onProgress,
        signal,
      ),
    signal,
  );
}

async function importZipBackupUnlocked(
  file: Blob,
  includeVideos: boolean,
  includeSettings: boolean,
  onProgress?: (progress: ZipImportProgress) => void,
  signal?: AbortSignal,
): Promise<void> {
  // Let directory and decoder objects become collectible before the atomic transaction.
  const prepared = await stageZipBackup(
    file,
    includeVideos,
    includeSettings,
    onProgress,
    signal,
  );
  if (!prepared) return; // Legacy formats publish through their compatibility adapter.
  try {
    signal?.throwIfAborted();
    onProgress?.({ ...prepared.progress, phase: 'committing' });
    await publishBackupSession(prepared.sessionId);
  } finally {
    await finishBackupSession(prepared.sessionId);
  }
}

async function stageZipBackup(
  file: Blob,
  includeVideos: boolean,
  includeSettings: boolean,
  onProgress: ((progress: ZipImportProgress) => void) | undefined,
  signal: AbortSignal | undefined,
): Promise<{ sessionId: string; progress: ZipImportProgress } | undefined> {
  signal?.throwIfAborted();
  assertSafeSize(file.size);
  const progress: ZipImportProgress = {
    phase: 'loading',
    current: 0,
    total: null,
    bytesProcessed: 0,
  };
  const report = () => onProgress?.({ ...progress });
  const countBytes = (bytes: number) => {
    progress.bytesProcessed = (progress.bytesProcessed ?? 0) + bytes;
    report();
  };
  report();
  configure({ chunkSize: BACKUP_CHUNK_BYTES });
  const reader = new ZipReader(new BoundedBlobReader(file), {
    strictness: 'strict',
    filenameValidation: 'strict',
    useWebWorkers: false,
  });
  try {
    const entries = new Map<string, FileEntry>();
    const budget = new BackupDirectoryBudget();
    for await (const entry of reader.getEntriesGenerator()) {
      signal?.throwIfAborted();
      assertSafeSize(entry.uncompressedSize);
      assertSafeSize(entry.compressedSize);
      assertSafeSize(entry.offset);
      budget.add(
        entry.filename,
        entry.rawExtraField.byteLength + entry.rawComment.byteLength,
      );
      if (!entry.directory) {
        if (entries.has(entry.filename))
          throw new Error('Ambiguous archive: duplicate filenames');
        entries.set(entry.filename, entry);
      }
    }
    const requiredEntry = (path: string) => {
      const entry = entries.get(path);
      if (!entry) throw new Error(`Invalid backup zip: missing ${path}`);
      return entry;
    };
    const text = new TextDecoder('utf-8', { fatal: true }).decode(
      await boundedEntry(
        requiredEntry('backup.json'),
        BACKUP_MANIFEST_BYTES,
        signal,
      ),
    );
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error('Invalid backup zip: backup.json is not valid JSON');
    }
    const version =
      typeof json === 'object' && json !== null && 'version' in json
        ? json.version
        : undefined;
    if (version !== 4) {
      const parsed = importDataSchema.parse(json);
      if (parsed.version !== 3) {
        await importJsonBackupUnlocked(
          text,
          includeVideos,
          includeSettings,
          onProgress,
          signal,
        );
        return;
      }
      const session = await createBackupSession('import');
      try {
        const videos: VideoReference[] = [];
        const ids = new Set<string>();
        const paths = new Set<string>();
        progress.total = includeVideos ? (parsed.demoVideos?.length ?? 0) : 0;
        progress.phase = 'videos';
        report();
        for (const video of parsed.demoVideos ?? []) {
          signal?.throwIfAborted();
          if (ids.has(video.id))
            throw new Error(`Backup contains duplicate video id "${video.id}"`);
          ids.add(video.id);
          let entry: FileEntry | undefined;
          if (video.path) {
            if (paths.has(video.path))
              throw new Error('Backup contains duplicate video paths');
            paths.add(video.path);
            entry = requiredEntry(video.path);
          }
          if (!includeVideos) continue;
          const data = entry
            ? await entryBlob(entry, video.mimeType, signal, countBytes, file)
            : new Blob([base64ToArrayBuffer(video.dataBase64 ?? '')], {
                type: video.mimeType,
              });
          videos.push(
            await stageVideoPayload(
              {
                id: video.id,
                fileName: video.fileName,
                mimeType: video.mimeType,
                data,
              },
              session.id,
            ),
          );
          progress.current++;
          report();
        }
        signal?.throwIfAborted();
        const plan = normalizeBackupImport(parsed, {
          includeSettings,
          videos,
          sessionId: session.id,
        });
        progress.phase = 'finalizing';
        report();
        await applyBackupImportPlan(plan, {
          signal,
          onCommitting: () => {
            progress.phase = 'committing';
            report();
          },
        });
      } finally {
        await finishBackupSession(session.id);
      }
      return;
    }
    const manifest = archiveManifestSchema.parse(json);
    let stagingBytes = 0;
    for (const [path, entry] of entries) {
      if (path.startsWith('videos/')) {
        if (includeVideos) stagingBytes += entry.uncompressedSize;
      } else
        stagingBytes +=
          entry.uncompressedSize * (path.startsWith('images/') ? 8 / 3 : 2);
    }
    progress.warning = await storageWarning(stagingBytes);
    report();
    const session = await createBackupSession('import');
    let prepared = false;
    try {
      const counts = { games: 0, characters: 0, combos: 0, videos: 0 };
      const usedAssets = new Set<string>();
      const claimAsset = (path: string) => {
        if (usedAssets.has(path))
          throw new Error('Backup contains duplicate asset references');
        usedAssets.add(path);
        return requiredEntry(path);
      };
      await db.backupSessions.update(session.id, {
        settings: includeSettings ? manifest.settings : undefined,
        includeVideos,
      });
      const games = createBackupRecordStager(session.id, 'games');
      await extractEntry(
        requiredEntry(BACKUP_RECORD_FILES.games),
        ndjsonWriter(async (raw) => {
          const { image, ...game } = archiveGameSchema.parse(raw);
          if (image) claimAsset(image.path);
          await games.add(normalizeGameNotationProfile(game), image);
          counts.games++;
        }, signal),
        signal,
        countBytes,
      );
      await games.flush();
      const characters = createBackupRecordStager(session.id, 'characters');
      await extractEntry(
        requiredEntry(BACKUP_RECORD_FILES.characters),
        ndjsonWriter(async (raw) => {
          const { image, ...character } = archiveCharacterSchema.parse(raw);
          if (!(await readStagedRecord(session.id, 'games', character.gameId)))
            throw new Error(
              'Import has referential integrity issues: orphaned character',
            );
          if (image) claimAsset(image.path);
          await characters.add(character, image);
          counts.characters++;
        }, signal),
        signal,
        countBytes,
      );
      await characters.flush();
      for (const kind of ['games', 'characters'] as const) {
        for await (const batch of stagedRowsBatches(session.id, kind))
          for (const row of batch) {
            if (!row.asset) continue;
            const source = row.asset;
            const image = imageDataUrl(
              await boundedEntry(
                requiredEntry(source.path),
                MAX_IMAGE_SIZE_BYTES,
                signal,
              ),
              source.mimeType,
            );
            if (row.kind === 'games') row.value.logoImage = image;
            else if (row.kind === 'characters') row.value.portraitImage = image;
            row.bytes = new TextEncoder().encode(
              JSON.stringify(row.value),
            ).byteLength;
            await db.backupRecords.put(row);
          }
      }
      progress.phase = 'videos';
      progress.total = includeVideos ? manifest.counts.videos : 0;
      report();
      const videos = createBackupRecordStager(session.id, 'videos');
      await extractEntry(
        requiredEntry(BACKUP_RECORD_FILES.videos),
        ndjsonWriter(async (raw) => {
          const video = archiveVideoSchema.parse(raw);
          const entry = claimAsset(video.path);
          if (entry.uncompressedSize !== video.size)
            throw new Error('Backup video size does not match its descriptor');
          const reference = {
            id: video.id,
            fileName: video.fileName,
            mimeType: video.mimeType,
            size: video.size,
            payloadId: '',
          };
          await videos.add(reference, {
            path: video.path,
            mimeType: video.mimeType,
          });
          counts.videos++;
        }, signal),
        signal,
        countBytes,
      );
      await videos.flush();
      if (includeVideos) {
        const media = createVideoStager(session.id, signal);
        for await (const batch of stagedRowsBatches(session.id, 'videos'))
          for (const row of batch) {
            if (row.kind !== 'videos' || !row.asset)
              throw new Error('Backup video descriptor is unavailable');
            const data = await entryBlob(
              requiredEntry(row.asset.path),
              row.value.mimeType,
              signal,
              countBytes,
              file,
            );
            // Release decoded entry headers before metadata validation/publication.
            entries.delete(row.asset.path);
            await media.add({ ...row.value, data }, row);
            progress.current++;
            report();
          }
        await media.flush();
      }
      progress.phase = 'finalizing';
      report();
      const combos = createBackupRecordStager(session.id, 'combos');
      await extractEntry(
        requiredEntry(BACKUP_RECORD_FILES.combos),
        ndjsonWriter(async (raw) => {
          const combo = archiveComboSchema.parse(raw);
          const character = await readStagedRecord(
            session.id,
            'characters',
            combo.characterId,
          );
          const game = character
            ? await readStagedRecord(session.id, 'games', character.gameId)
            : undefined;
          if (!character || !game)
            throw new Error(
              'Import has referential integrity issues: orphaned combo',
            );
          const available = new Set<string>();
          const videoId = getImportedLocalVideoId(combo.demoUrl);
          if (
            includeVideos &&
            videoId &&
            (await readStagedRecord(session.id, 'videos', videoId))
          )
            available.add(videoId);
          const normalized = sanitizeImportedVideoReference(combo, available);
          await combos.add(
            parseComboRecords([normalized], [game], [character])[0],
          );
          counts.combos++;
        }, signal),
        signal,
        countBytes,
      );
      await combos.flush();
      for (const kind of ['games', 'characters', 'combos', 'videos'] as const)
        if (counts[kind] !== manifest.counts[kind])
          throw new Error(`Backup ${kind} count does not match its manifest`);
      entries.clear();
      signal?.throwIfAborted();
      prepared = true;
      return { sessionId: session.id, progress };
    } finally {
      if (!prepared) await finishBackupSession(session.id);
    }
  } finally {
    await reader.close();
  }
}
