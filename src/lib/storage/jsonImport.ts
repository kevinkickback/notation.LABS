import { normalizeBackupImport } from '@/lib/backup/importPipeline';
import {
  MAX_BACKUP_VIDEO_BYTES,
  MAX_BACKUP_VIDEO_COUNT,
  MAX_JSON_BACKUP_BYTES,
  MAX_VIDEO_SIZE_BYTES,
} from '@/lib/defaults';
import { importDataSchema } from '@/lib/schemas';
import {
  applyBackupImportPlan,
  base64ToArrayBuffer,
} from './backupImportShared';

export async function importJsonBackup(
  data: string,
  includeVideos = false,
  includeSettings = false,
): Promise<void> {
  if (data.length > MAX_JSON_BACKUP_BYTES) {
    throw new Error('Backup JSON exceeds the 100 MB import limit');
  }

  let json: unknown;
  try {
    json = JSON.parse(data);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(
        'Backup JSON is incomplete or too large to parse. Re-export with fewer videos.',
      );
    }
    throw error;
  }

  const parsed = importDataSchema.parse(json);
  if (parsed.version === 3) {
    throw new Error('Version 3 backups with videos must be imported from zip.');
  }
  if ((parsed.demoVideos?.length ?? 0) > MAX_BACKUP_VIDEO_COUNT) {
    throw new Error(
      `Backup contains more than ${MAX_BACKUP_VIDEO_COUNT} videos`,
    );
  }

  let totalVideoBytes = 0;
  for (const video of parsed.demoVideos ?? []) {
    if (!video.dataBase64) {
      throw new Error(
        `Video "${video.fileName}" is missing embedded dataBase64 payload`,
      );
    }
    const decodedBytes = Math.ceil(video.dataBase64.length * 0.75);
    if (decodedBytes > MAX_VIDEO_SIZE_BYTES) {
      throw new Error(
        `Video "${video.fileName}" exceeds the 50 MB per-video limit`,
      );
    }
    totalVideoBytes += decodedBytes;
    if (totalVideoBytes > MAX_BACKUP_VIDEO_BYTES) {
      throw new Error('Backup videos exceed the 500 MB aggregate limit');
    }
  }

  const videos = includeVideos
    ? (parsed.demoVideos ?? []).map((video) => ({
        id: video.id,
        fileName: video.fileName,
        mimeType: video.mimeType,
        data: base64ToArrayBuffer(video.dataBase64 ?? ''),
      }))
    : [];
  await applyBackupImportPlan(
    normalizeBackupImport(parsed, { includeSettings, videos }),
  );
}
