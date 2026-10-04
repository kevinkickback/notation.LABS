import type { VideoReference } from '@/lib/backup/archiveContract';
import { storageWarning } from '@/lib/backup/capacity';
import { normalizeBackupImport } from '@/lib/backup/importPipeline';
import { MAX_JSON_BACKUP_BYTES } from '@/lib/defaults';
import { importDataSchema } from '@/lib/schemas';
import {
  applyBackupImportPlan,
  base64ToArrayBuffer,
} from './backupImportShared';
import {
  createBackupSession,
  finishBackupSession,
  withBackupSessionLock,
} from './backupSessionRepository';
import { stageVideoPayload } from './videoRepository';
import type { ZipImportProgress } from './zipImport';

export function importJsonBackup(
  data: string,
  includeVideos = false,
  includeSettings = false,
  onProgress?: (progress: ZipImportProgress) => void,
  signal?: AbortSignal,
): Promise<void> {
  return withBackupSessionLock(
    () =>
      importJsonBackupUnlocked(
        data,
        includeVideos,
        includeSettings,
        onProgress,
        signal,
      ),
    signal,
  );
}

export async function importJsonBackupUnlocked(
  data: string,
  includeVideos: boolean,
  includeSettings: boolean,
  onProgress?: (progress: ZipImportProgress) => void,
  signal?: AbortSignal,
): Promise<void> {
  signal?.throwIfAborted();
  // Check cheap UTF-16 length first, then actual UTF-8 bytes for export/import parity.
  if (
    data.length > MAX_JSON_BACKUP_BYTES ||
    new TextEncoder().encode(data).byteLength > MAX_JSON_BACKUP_BYTES
  )
    throw new Error(
      'Backup JSON exceeds the 100 MB parsing budget. Use a ZIP backup for large libraries.',
    );
  let json: unknown;
  try {
    json = JSON.parse(data);
  } catch {
    throw new Error('Backup JSON is incomplete or invalid.');
  }
  const parsed = importDataSchema.parse(json);
  const warning = await storageWarning(data.length * 2);
  if (parsed.version === 3)
    throw new Error('Version 3 backups with videos must be imported from zip.');
  const session = await createBackupSession('import');
  try {
    const ids = new Set<string>();
    const videos: VideoReference[] = [];
    for (const video of parsed.demoVideos ?? []) {
      signal?.throwIfAborted();
      if (ids.has(video.id))
        throw new Error(`Backup contains duplicate video id "${video.id}"`);
      ids.add(video.id);
      if (!video.dataBase64)
        throw new Error(
          `Video "${video.fileName}" is missing embedded dataBase64 payload`,
        );
      if (!includeVideos) continue;
      const data = new Blob([base64ToArrayBuffer(video.dataBase64)], {
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
      onProgress?.({
        warning,
        phase: 'videos',
        current: videos.length,
        total: parsed.demoVideos?.length ?? 0,
      });
    }
    const plan = normalizeBackupImport(parsed, {
      includeSettings,
      videos,
      sessionId: session.id,
    });
    signal?.throwIfAborted();
    onProgress?.({
      warning,
      phase: 'finalizing',
      current: videos.length,
      total: includeVideos ? (parsed.demoVideos?.length ?? 0) : 0,
    });
    await applyBackupImportPlan(plan, {
      signal,
      onCommitting: () =>
        onProgress?.({
          warning,
          phase: 'committing',
          current: videos.length,
          total: includeVideos ? (parsed.demoVideos?.length ?? 0) : 0,
        }),
    });
  } finally {
    await finishBackupSession(session.id);
  }
}
