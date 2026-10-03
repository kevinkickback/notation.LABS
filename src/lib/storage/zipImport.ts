import {
  BlobReader,
  type FileEntry,
  ZipReader,
} from '@zip.js/zip.js/lib/zip-core-native.js';
import { normalizeBackupImport } from '@/lib/backup/importPipeline';
import {
  MAX_BACKUP_ENTRY_COUNT,
  MAX_BACKUP_METADATA_BYTES,
  MAX_BACKUP_UNCOMPRESSED_BYTES,
  MAX_BACKUP_VIDEO_BYTES,
  MAX_BACKUP_VIDEO_COUNT,
  MAX_VIDEO_SIZE_BYTES,
  MAX_ZIP_BACKUP_BYTES,
} from '@/lib/defaults';
import { importDataSchema } from '@/lib/schemas';
import {
  applyBackupImportPlan,
  base64ToArrayBuffer,
} from './backupImportShared';
import type { DemoVideo } from './database';
import { importJsonBackup } from './jsonImport';

const ZIP_BACKUP_METADATA_FILE = 'backup.json';

export interface ZipImportProgress {
  phase: 'loading' | 'videos' | 'finalizing';
  current: number;
  total: number | null;
}

class BoundedBlobReader extends BlobReader {
  override readUint8Array(offset: number, length: number) {
    // The library reads the directory in one allocation, before yielding entries.
    if (length > MAX_BACKUP_METADATA_BYTES) {
      throw new Error('Backup zip directory exceeds the size limit');
    }
    return super.readUint8Array(offset, length);
  }
}

async function readZipEntry(
  entry: FileEntry,
  limit: number,
  limitMessage: string,
): Promise<ArrayBuffer> {
  if (entry.uncompressedSize > limit) throw new Error(limitMessage);
  const chunks: Uint8Array[] = [];
  let size = 0;
  await entry.getData(
    new WritableStream<Uint8Array>({
      write(chunk) {
        size += chunk.byteLength;
        if (size > limit) throw new Error(limitMessage);
        if (size > entry.uncompressedSize) {
          throw new Error(
            'Invalid backup zip: file size does not match its contents',
          );
        }
        chunks.push(new Uint8Array(chunk));
      },
    }),
    { checkCrc32: true },
  );
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result.buffer;
}

export async function importZipBackup(
  file: Blob,
  includeVideos = false,
  includeSettings = false,
  onProgress?: (progress: ZipImportProgress) => void,
): Promise<void> {
  if (file.size > MAX_ZIP_BACKUP_BYTES) {
    throw new Error('Backup zip exceeds the 512 MB import limit');
  }

  onProgress?.({ phase: 'loading', current: 0, total: null });
  const reader = new ZipReader(new BoundedBlobReader(file), {
    strictness: 'strict',
    filenameValidation: 'strict',
    useWebWorkers: false,
  });
  try {
    await importArchive(reader, includeVideos, includeSettings, onProgress);
  } finally {
    await reader.close();
  }
}

async function importArchive(
  reader: ZipReader<Blob>,
  includeVideos: boolean,
  includeSettings: boolean,
  onProgress?: (progress: ZipImportProgress) => void,
): Promise<void> {
  const archiveEntries = new Map<string, FileEntry>();
  let entryCount = 0;
  let totalUncompressedBytes = 0;
  for await (const entry of reader.getEntriesGenerator()) {
    if (++entryCount > MAX_BACKUP_ENTRY_COUNT) {
      throw new Error(
        `Backup zip contains more than ${MAX_BACKUP_ENTRY_COUNT} files`,
      );
    }
    totalUncompressedBytes += entry.uncompressedSize;
    if (totalUncompressedBytes > MAX_BACKUP_UNCOMPRESSED_BYTES) {
      throw new Error('Backup zip exceeds the uncompressed size limit');
    }
    if (!entry.directory) archiveEntries.set(entry.filename, entry);
  }
  const metadataEntry = archiveEntries.get(ZIP_BACKUP_METADATA_FILE);
  if (!metadataEntry) {
    throw new Error('Invalid backup zip: missing backup.json');
  }
  const metadataText = new TextDecoder().decode(
    await readZipEntry(
      metadataEntry,
      MAX_BACKUP_METADATA_BYTES,
      'Backup metadata exceeds the 10 MB import limit',
    ),
  );
  let json: unknown;
  try {
    json = JSON.parse(metadataText);
  } catch {
    throw new Error('Invalid backup zip: backup.json is not valid JSON');
  }

  const parsed = importDataSchema.parse(json);
  if (parsed.version !== 3) {
    await importJsonBackup(metadataText, includeVideos, includeSettings);
    return;
  }
  if ((parsed.demoVideos?.length ?? 0) > MAX_BACKUP_VIDEO_COUNT) {
    throw new Error(
      `Backup contains more than ${MAX_BACKUP_VIDEO_COUNT} videos`,
    );
  }

  const videoIds = new Set<string>();
  const videoPaths = new Set<string>();
  let declaredVideoBytes = 0;
  for (const video of parsed.demoVideos ?? []) {
    if (videoIds.has(video.id)) {
      throw new Error(`Backup contains duplicate video id "${video.id}"`);
    }
    videoIds.add(video.id);

    let videoBytes = 0;
    if (video.path) {
      if (videoPaths.has(video.path)) {
        throw new Error(`Backup contains duplicate video path "${video.path}"`);
      }
      videoPaths.add(video.path);
      const entry = archiveEntries.get(video.path);
      if (!entry) {
        throw new Error(
          `Video "${video.fileName}" is missing from the backup zip`,
        );
      }
      videoBytes = entry.uncompressedSize;
    } else if (video.dataBase64) {
      videoBytes = Math.ceil(video.dataBase64.length * 0.75);
    }
    if (videoBytes > MAX_VIDEO_SIZE_BYTES) {
      throw new Error(
        `Video "${video.fileName}" exceeds the 50 MB per-video limit`,
      );
    }
    declaredVideoBytes += videoBytes;
    if (declaredVideoBytes > MAX_BACKUP_VIDEO_BYTES) {
      throw new Error('Backup videos exceed the 500 MB aggregate limit');
    }
  }

  const videosToImport: DemoVideo[] = [];
  let actualVideoBytes = 0;
  if (includeVideos && parsed.demoVideos) {
    onProgress?.({
      phase: 'videos',
      current: 0,
      total: parsed.demoVideos.length,
    });
    for (const video of parsed.demoVideos) {
      let buffer: ArrayBuffer;
      if (video.path) {
        const zipEntry = archiveEntries.get(video.path);
        if (!zipEntry) {
          throw new Error(
            `Video "${video.fileName}" is missing from the backup zip`,
          );
        }
        buffer = await readZipEntry(
          zipEntry,
          Math.min(
            MAX_VIDEO_SIZE_BYTES,
            MAX_BACKUP_VIDEO_BYTES - actualVideoBytes,
          ),
          `Video "${video.fileName}" exceeds the backup video size limit`,
        );
      } else if (video.dataBase64) {
        buffer = base64ToArrayBuffer(video.dataBase64);
      } else {
        throw new Error(
          `Video "${video.fileName}" is missing path and data payload`,
        );
      }
      if (buffer.byteLength > MAX_VIDEO_SIZE_BYTES) {
        throw new Error(
          `Video "${video.fileName}" exceeds the 50 MB per-video limit`,
        );
      }
      actualVideoBytes += buffer.byteLength;
      if (actualVideoBytes > MAX_BACKUP_VIDEO_BYTES) {
        throw new Error('Backup videos exceed the 500 MB aggregate limit');
      }
      videosToImport.push({
        id: video.id,
        fileName: video.fileName,
        mimeType: video.mimeType,
        data: buffer,
      });
      onProgress?.({
        phase: 'videos',
        current: videosToImport.length,
        total: parsed.demoVideos.length,
      });
    }
  }

  onProgress?.({
    phase: 'finalizing',
    current: videosToImport.length,
    total: includeVideos ? (parsed.demoVideos?.length ?? 0) : null,
  });
  await applyBackupImportPlan(
    normalizeBackupImport(parsed, {
      includeSettings,
      videos: includeVideos ? videosToImport : [],
    }),
  );
}
