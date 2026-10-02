import { strToU8, Zip, ZipPassThrough } from 'fflate';
import {
  BACKUP_CHUNK_BYTES,
  type BackupExportProgress,
  type BackupSink,
} from '@/lib/backup/exportContract';
import {
  type BackupFilter,
  closeBackupSelection,
} from '@/lib/backup/selectionClosure';
import { settingsSchema } from '@/lib/schemas';
import { db } from './database';
import {
  collectLocalVideoIds,
  sanitizeCombosLocalVideos,
} from './videoRepository';

async function loadSelection(filter?: BackupFilter) {
  const [games, characters, combos, settings] = await db.transaction(
    'r',
    [db.games, db.characters, db.combos, db.settings],
    () =>
      Promise.all([
        db.games.toArray(),
        db.characters.toArray(),
        db.combos.toArray(),
        db.settings.get(1),
      ]),
  );
  return {
    ...closeBackupSelection({ games, characters, combos }, filter),
    settings: settings ? settingsSchema.parse(settings) : undefined,
  };
}

/** Stream a compatible v3 ZIP without retaining all videos or the whole archive. */
export async function exportBackupTo(
  sink: BackupSink,
  filter?: BackupFilter,
  onProgress?: (progress: BackupExportProgress) => void,
  signal?: AbortSignal,
): Promise<void> {
  let zip: Zip | undefined;
  try {
    const selection = await loadSelection(filter);
    const availableIds = new Set(
      await db.demoVideos.toCollection().primaryKeys(),
    );
    const videoIds = collectLocalVideoIds(selection.combos).filter((id) =>
      availableIds.has(id),
    );
    if (videoIds.length >= 65535)
      throw new Error(
        'This selection contains too many videos for one ZIP. Export smaller selections.',
      );
    const demoVideos: Array<{
      id: string;
      fileName: string;
      mimeType: string;
      path: string;
    }> = [];
    let pending = Promise.resolve();
    let bytesWritten = 0;
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
          if (bytesWritten + part.byteLength >= 0xffffffff)
            throw new Error(
              'ZIP backups must be smaller than 4 GB. Export smaller selections.',
            );
          await sink.write(part);
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
      const video = await db.demoVideos.get(id);
      if (!video) continue;
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
    const metadata = {
      version: 3,
      exported: new Date().toISOString(),
      ...selection,
      combos: sanitizeCombosLocalVideos(
        selection.combos,
        new Set(demoVideos.map((video) => video.id)),
      ),
      demoVideos,
    };
    await writeEntry('backup.json', strToU8(JSON.stringify(metadata, null, 2)));
    zip.end();
    await pending;
    check();
    await sink.close();
  } catch (error) {
    zip?.terminate();
    await sink.abort();
    throw error;
  }
}
export async function exportBackup(
  includeVideos = false,
  filter?: BackupFilter,
  onProgress?: (current: number, total: number) => void,
): Promise<Blob> {
  if (includeVideos) {
    const parts: Blob[] = [];
    let lastCurrent = -1;
    await exportBackupTo(
      {
        write: (chunk) => {
          parts.push(new Blob([new Uint8Array(chunk)]));
          return Promise.resolve();
        },
        close: () => Promise.resolve(),
        abort: () => {
          parts.length = 0;
          return Promise.resolve();
        },
      },
      filter,
      (progress) => {
        if (progress.current !== lastCurrent) {
          onProgress?.(progress.current, progress.total);
          lastCurrent = progress.current;
        }
      },
    );
    return new Blob(parts, { type: 'application/zip' });
  }
  const selection = await loadSelection(filter);
  return new Blob(
    [
      JSON.stringify(
        {
          version: 1,
          exported: new Date().toISOString(),
          ...selection,
          combos: sanitizeCombosLocalVideos(selection.combos, new Set()),
        },
        null,
        2,
      ),
    ],
    { type: 'application/json' },
  );
}
