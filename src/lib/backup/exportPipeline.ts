import { strToU8, Zip, ZipPassThrough } from 'fflate';
import {
  MAX_BACKUP_METADATA_BYTES,
  MAX_BACKUP_VIDEO_BYTES,
  MAX_BACKUP_VIDEO_COUNT,
  MAX_JSON_BACKUP_BYTES,
  MAX_VIDEO_SIZE_BYTES,
  MAX_ZIP_BACKUP_BYTES,
} from '@/lib/defaults';
import { sanitizeCanonicalVideoReference } from '@/lib/storage/videoReferences';
import {
  BACKUP_CHUNK_BYTES,
  type BackupExportProgress,
  type BackupSink,
  type BackupSnapshot,
} from './exportContract';
import type { ResolvedBackupVideo } from './importPipeline';

/** Stream a compatible v3 ZIP without retaining all videos or the whole archive. */
export async function writeZipBackup(
  snapshot: BackupSnapshot,
  readVideo: (id: string) => Promise<ResolvedBackupVideo | undefined>,
  write: BackupSink['write'],
  onProgress?: (progress: BackupExportProgress) => void,
  signal?: AbortSignal,
): Promise<BackupExportProgress> {
  let zip: Zip | undefined;
  try {
    const { records: selection, videoIds } = snapshot;
    signal?.throwIfAborted();
    if (videoIds.length > MAX_BACKUP_VIDEO_COUNT)
      throw new Error(
        `Backups support at most ${MAX_BACKUP_VIDEO_COUNT} videos. Export smaller selections.`,
      );
    const demoVideos: Array<{
      id: string;
      fileName: string;
      mimeType: string;
      path: string;
    }> = [];
    let pending = Promise.resolve();
    let bytesWritten = 0;
    let videoBytes = 0;
    let archiveError: Error | undefined;
    let current = 0;
    let phase: BackupExportProgress['phase'] = 'videos';
    const reportProgress = () =>
      onProgress?.({ phase, current, total: videoIds.length, bytesWritten });
    const check = () => {
      signal?.throwIfAborted();
      if (archiveError) throw archiveError;
    };
    zip = new Zip((error, chunk) => {
      if (error) {
        archiveError = error;
        return;
      }
      pending = pending.then(async () => {
        check();
        for (
          let offset = 0;
          offset < chunk.byteLength;
          offset += BACKUP_CHUNK_BYTES
        ) {
          check();
          const part = chunk.subarray(offset, offset + BACKUP_CHUNK_BYTES);
          if (bytesWritten + part.byteLength > MAX_ZIP_BACKUP_BYTES)
            throw new Error(
              'Backups must fit the 512 MB import limit. Export smaller selections.',
            );
          await write(part);
          bytesWritten += part.byteLength;
        }
      });
    });
    const writeEntry = async (path: string, data: Uint8Array) => {
      check();
      const entry = new ZipPassThrough(path);
      zip?.add(entry);
      await pending;
      for (
        let offset = 0;
        offset < data.byteLength;
        offset += BACKUP_CHUNK_BYTES
      ) {
        check();
        entry.push(
          data.subarray(offset, offset + BACKUP_CHUNK_BYTES),
          offset + BACKUP_CHUNK_BYTES >= data.byteLength,
        );
        await pending;
        reportProgress();
        // Yield to painting, input and cancellation even on fast destinations.
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
      if (data.byteLength === 0) {
        entry.push(new Uint8Array(), true);
        await pending;
      }
    };
    reportProgress();
    for (const id of videoIds) {
      check();
      const video = await readVideo(id);
      if (!video) continue;
      if (video.data.byteLength > MAX_VIDEO_SIZE_BYTES)
        throw new Error(
          `Video "${video.fileName}" exceeds the 50 MB per-video backup limit.`,
        );
      videoBytes += video.data.byteLength;
      if (videoBytes > MAX_BACKUP_VIDEO_BYTES)
        throw new Error(
          'Backup videos exceed the 500 MB limit. Export smaller selections.',
        );
      const extension = /\.[a-z0-9]{1,12}$/i.exec(video.fileName)?.[0] ?? '';
      const descriptor = {
        id,
        fileName: video.fileName,
        mimeType: video.mimeType,
        path: `videos/${encodeURIComponent(id)}${extension}`,
      };
      await writeEntry(descriptor.path, new Uint8Array(video.data));
      demoVideos.push(descriptor);
      current++;
      reportProgress();
    }
    phase = 'finalizing';
    reportProgress();
    const includedVideoIds = new Set(demoVideos.map((video) => video.id));
    const metadata = {
      version: 3,
      exported: new Date().toISOString(),
      ...selection,
      combos: selection.combos.map((combo) =>
        sanitizeCanonicalVideoReference(combo, includedVideoIds),
      ),
      demoVideos,
    };
    const metadataBytes = strToU8(JSON.stringify(metadata, null, 2));
    if (metadataBytes.byteLength > MAX_BACKUP_METADATA_BYTES)
      throw new Error(
        'Backup metadata exceeds the 10 MB limit. Export smaller selections.',
      );
    await writeEntry('backup.json', metadataBytes);
    zip.end();
    await pending;
    check();
    return { phase, current, total: videoIds.length, bytesWritten };
  } catch (error) {
    zip?.terminate();
    throw error;
  }
}
export async function writeJsonBackup(
  records: BackupSnapshot['records'],
  write: BackupSink['write'],
  onProgress?: (progress: BackupExportProgress) => void,
  signal?: AbortSignal,
): Promise<BackupExportProgress> {
  signal?.throwIfAborted();
  const progress: BackupExportProgress = {
    phase: 'finalizing',
    current: 0,
    total: 0,
    bytesWritten: 0,
  };
  onProgress?.({ ...progress });
  const includedVideoIds = new Set<string>();
  const metadata = {
    version: 1,
    exported: new Date().toISOString(),
    ...records,
    combos: records.combos.map((combo) =>
      sanitizeCanonicalVideoReference(combo, includedVideoIds),
    ),
  };
  const bytes = strToU8(JSON.stringify(metadata, null, 2));
  if (bytes.byteLength > MAX_JSON_BACKUP_BYTES)
    throw new Error(
      'Backup JSON exceeds the 100 MB import limit. Export smaller selections.',
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
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  return progress;
}
