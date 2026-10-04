import {
  BlobReader,
  configure,
  ZipWriter,
} from '@zip.js/zip.js/lib/zip-core-native.js';
import { MAX_JSON_BACKUP_BYTES } from '@/lib/defaults';
import { characterSchema, comboSchema, gameSchema } from '@/lib/schemas';
import {
  readStagedRecord,
  stagedRecordBatches,
} from '@/lib/storage/backupSessionRepository';
import {
  getCanonicalLocalVideoId,
  sanitizeCanonicalVideoReference,
} from '@/lib/storage/videoReferences';
import { readVideoPayload, videoBlob } from '@/lib/storage/videoRepository';
import { BACKUP_RECORD_FILES, type BackupRecordKind } from './archiveContract';
import {
  archiveManifestSchema,
  archiveVideoSchema,
  separateImage,
} from './archiveFormat';
import { BackupDirectoryBudget, encodeBackupRecord } from './capabilities';
import { chunkedWriter } from './chunkedWriter';
import {
  BACKUP_CHUNK_BYTES,
  type BackupExportProgress,
  type BackupSink,
  type BackupSnapshot,
} from './exportContract';
import { byteStream, recordChunks } from './recordStreams';

async function* archiveRecords(
  snapshot: BackupSnapshot,
  kind: BackupRecordKind,
  includeVideos: boolean,
  signal?: AbortSignal,
): AsyncGenerator<unknown, void> {
  const { sessionId } = snapshot;
  let index = 0;
  switch (kind) {
    case 'games':
      for await (const batch of stagedRecordBatches(sessionId, kind))
        for (const value of batch) {
          signal?.throwIfAborted();
          const record = gameSchema.parse(value);
          yield includeVideos
            ? separateImage(record, `images/g-${index++}.bin`).record
            : record;
        }
      break;
    case 'characters':
      for await (const batch of stagedRecordBatches(sessionId, kind))
        for (const value of batch) {
          signal?.throwIfAborted();
          const record = characterSchema.parse(value);
          if (!(await readStagedRecord(sessionId, 'games', record.gameId)))
            throw new Error('Library contains a character without its game');
          yield includeVideos
            ? separateImage(record, `images/c-${index++}.bin`).record
            : record;
        }
      break;
    case 'combos':
      for await (const batch of stagedRecordBatches(sessionId, kind))
        for (const value of batch) {
          signal?.throwIfAborted();
          const record = comboSchema.parse(value);
          if (
            !(await readStagedRecord(
              sessionId,
              'characters',
              record.characterId,
            ))
          )
            throw new Error('Library contains a combo without its character');
          const videoId = getCanonicalLocalVideoId(record.demoUrl);
          const available = new Set<string>();
          if (
            includeVideos &&
            videoId &&
            (await readStagedRecord(sessionId, 'videos', videoId))
          )
            available.add(videoId);
          yield sanitizeCanonicalVideoReference(record, available);
        }
      break;
    case 'videos':
      for await (const batch of stagedRecordBatches(sessionId, kind))
        for (const video of batch) {
          signal?.throwIfAborted();
          yield archiveVideoSchema.parse({
            id: video.id,
            fileName: video.fileName,
            mimeType: video.mimeType,
            size: video.size,
            path: `videos/v-${index++}.bin`,
          });
        }
      break;
  }
}

/** ZIP64 framing and sequential STORE entries keep media bytes outside the JS working set. */
export async function writeZipBackup(
  snapshot: BackupSnapshot,
  write: BackupSink['write'],
  onProgress?: (progress: BackupExportProgress) => void,
  signal?: AbortSignal,
): Promise<BackupExportProgress> {
  configure({ chunkSize: BACKUP_CHUNK_BYTES });
  const progress: BackupExportProgress = {
    phase: 'preparing',
    current: 0,
    total: snapshot.counts.videos,
    bytesWritten: 0,
  };
  const report = () => onProgress?.({ ...progress });
  const budget = new BackupDirectoryBudget();
  const destination = chunkedWriter(
    write,
    (bytes) => {
      progress.bytesWritten += bytes;
      report();
    },
    signal,
  );
  const zip = new ZipWriter(destination.writable, {
    zip64: true,
    level: 0,
    useWebWorkers: false,
    bufferedWrite: false,
  });
  const add = async (
    path: string,
    source: BlobReader | ReadableStream<Uint8Array>,
  ) => {
    signal?.throwIfAborted();
    budget.add(path, 128);
    await zip.add(path, source, { signal });
  };
  report();
  const manifest = archiveManifestSchema.parse({
    version: 4,
    exported: new Date().toISOString(),
    counts: snapshot.counts,
    settings: snapshot.settings,
  });
  await add(
    'backup.json',
    new BlobReader(new Blob([encodeBackupRecord(manifest)])),
  );
  // Image bytes precede their descriptors; stable snapshot order gives both passes the same paths.
  let index = 0;
  for await (const batch of stagedRecordBatches(snapshot.sessionId, 'games'))
    for (const game of batch) {
      const path = `images/g-${index++}.bin`;
      const { blob } = separateImage(game, path);
      if (blob) await add(path, new BlobReader(blob));
    }
  index = 0;
  for await (const batch of stagedRecordBatches(
    snapshot.sessionId,
    'characters',
  ))
    for (const character of batch) {
      const path = `images/c-${index++}.bin`;
      const { blob } = separateImage(character, path);
      if (blob) await add(path, new BlobReader(blob));
    }
  for (const kind of ['games', 'characters', 'combos', 'videos'] as const)
    await add(
      BACKUP_RECORD_FILES[kind],
      byteStream(
        recordChunks(archiveRecords(snapshot, kind, true, signal), signal),
        signal,
      ),
    );
  progress.phase = 'videos';
  report();
  index = 0;
  for await (const batch of stagedRecordBatches(snapshot.sessionId, 'videos'))
    for (const reference of batch) {
      const video = await readVideoPayload(reference);
      await add(`videos/v-${index++}.bin`, new BlobReader(videoBlob(video)));
      progress.current++;
      report();
    }
  signal?.throwIfAborted();
  progress.phase = 'finalizing';
  report();
  await zip.close();
  await destination.flush();
  return progress;
}

/** JSON remains data-only and bounded for compatibility with whole-document readers. */
export async function writeJsonBackup(
  snapshot: BackupSnapshot,
  write: BackupSink['write'],
  onProgress?: (progress: BackupExportProgress) => void,
  signal?: AbortSignal,
): Promise<BackupExportProgress> {
  const progress: BackupExportProgress = {
    phase: 'finalizing',
    current: 0,
    total: 0,
    bytesWritten: 0,
  };
  const emit = async (bytes: Uint8Array) => {
    if (progress.bytesWritten + bytes.byteLength > MAX_JSON_BACKUP_BYTES)
      throw new Error(
        'This library is too large for JSON. Choose a ZIP backup instead.',
      );
    for (
      let offset = 0;
      offset < bytes.byteLength;
      offset += BACKUP_CHUNK_BYTES
    ) {
      signal?.throwIfAborted();
      const chunk = bytes.subarray(offset, offset + BACKUP_CHUNK_BYTES);
      await write(chunk);
      progress.bytesWritten += chunk.byteLength;
      onProgress?.({ ...progress });
    }
  };
  const text = (value: string) => emit(new TextEncoder().encode(value));
  await text(
    `{"version":1,"exported":${JSON.stringify(new Date().toISOString())}`,
  );
  for (const kind of ['games', 'characters', 'combos'] as const) {
    await text(`,"${kind}":[`);
    let first = true;
    for await (const record of archiveRecords(snapshot, kind, false, signal)) {
      if (!first) await text(',');
      await emit(encodeBackupRecord(record));
      first = false;
    }
    await text(']');
  }
  if (snapshot.settings) {
    await text(',"settings":');
    await emit(encodeBackupRecord(snapshot.settings));
  }
  await text('}');
  return progress;
}
