import JSZip from 'jszip';
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

interface ZipEntryMetadata {
  uncompressedSize: number;
}

async function inspectZipCentralDirectory(
  file: Blob,
): Promise<Map<string, ZipEntryMetadata>> {
  const endRecordSize = 22;
  const maxCommentSize = 65_535;
  if (file.size < endRecordSize) {
    throw new Error('Invalid backup zip: end record not found');
  }

  const tailStart = Math.max(0, file.size - endRecordSize - maxCommentSize);
  const tail = await file.slice(tailStart).arrayBuffer();
  const tailView = new DataView(tail);
  let endRecordOffset = -1;
  for (let offset = tail.byteLength - endRecordSize; offset >= 0; offset--) {
    if (tailView.getUint32(offset, true) === 0x06054b50) {
      const commentLength = tailView.getUint16(offset + 20, true);
      if (offset + endRecordSize + commentLength === tail.byteLength) {
        endRecordOffset = offset;
        break;
      }
    }
  }
  if (endRecordOffset < 0) {
    throw new Error('Invalid backup zip: end record not found');
  }

  const diskNumber = tailView.getUint16(endRecordOffset + 4, true);
  const directoryDisk = tailView.getUint16(endRecordOffset + 6, true);
  const diskEntryCount = tailView.getUint16(endRecordOffset + 8, true);
  const entryCount = tailView.getUint16(endRecordOffset + 10, true);
  const directorySize = tailView.getUint32(endRecordOffset + 12, true);
  const directoryOffset = tailView.getUint32(endRecordOffset + 16, true);
  if (
    diskNumber !== 0 ||
    directoryDisk !== 0 ||
    diskEntryCount !== entryCount ||
    entryCount === 0xffff ||
    directorySize === 0xffffffff ||
    directoryOffset === 0xffffffff
  ) {
    throw new Error('Unsupported multi-volume or ZIP64 backup');
  }
  if (entryCount > MAX_BACKUP_ENTRY_COUNT) {
    throw new Error(
      `Backup zip contains more than ${MAX_BACKUP_ENTRY_COUNT} files`,
    );
  }
  if (directorySize > MAX_BACKUP_METADATA_BYTES) {
    throw new Error('Backup zip central directory exceeds the size limit');
  }
  if (directoryOffset + directorySize > file.size) {
    throw new Error('Invalid backup zip: central directory is out of bounds');
  }

  const directory = await file
    .slice(directoryOffset, directoryOffset + directorySize)
    .arrayBuffer();
  const directoryView = new DataView(directory);
  const decoder = new TextDecoder();
  const entries = new Map<string, ZipEntryMetadata>();
  let offset = 0;
  let totalUncompressedBytes = 0;
  for (let index = 0; index < entryCount; index++) {
    if (
      offset + 46 > directory.byteLength ||
      directoryView.getUint32(offset, true) !== 0x02014b50
    ) {
      throw new Error('Invalid backup zip: malformed central directory');
    }
    const uncompressedSize = directoryView.getUint32(offset + 24, true);
    const fileNameLength = directoryView.getUint16(offset + 28, true);
    const extraLength = directoryView.getUint16(offset + 30, true);
    const commentLength = directoryView.getUint16(offset + 32, true);
    const nextOffset =
      offset + 46 + fileNameLength + extraLength + commentLength;
    if (nextOffset > directory.byteLength || uncompressedSize === 0xffffffff) {
      throw new Error('Invalid backup zip: malformed or ZIP64 entry');
    }

    const name = decoder.decode(
      new Uint8Array(directory, offset + 46, fileNameLength),
    );
    if (entries.has(name)) {
      throw new Error(`Backup zip contains duplicate file "${name}"`);
    }
    entries.set(name, { uncompressedSize });
    totalUncompressedBytes += uncompressedSize;
    if (totalUncompressedBytes > MAX_BACKUP_UNCOMPRESSED_BYTES) {
      throw new Error('Backup zip exceeds the uncompressed size limit');
    }
    offset = nextOffset;
  }

  if (offset !== directory.byteLength) {
    throw new Error('Invalid backup zip: central directory size mismatch');
  }
  return entries;
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
  const archiveEntries = await inspectZipCentralDirectory(file);
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const metadataFile = zip.file(ZIP_BACKUP_METADATA_FILE);
  const metadataEntry = archiveEntries.get(ZIP_BACKUP_METADATA_FILE);
  if (!metadataFile || !metadataEntry) {
    throw new Error('Invalid backup zip: missing backup.json');
  }
  if (metadataEntry.uncompressedSize > MAX_BACKUP_METADATA_BYTES) {
    throw new Error('Backup metadata exceeds the 10 MB import limit');
  }

  const metadataText = await metadataFile.async('string');
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
      if (!entry || !zip.file(video.path)) {
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
  if (includeVideos && parsed.demoVideos) {
    onProgress?.({
      phase: 'videos',
      current: 0,
      total: parsed.demoVideos.length,
    });
    for (const video of parsed.demoVideos) {
      let buffer: ArrayBuffer;
      if (video.path) {
        const zipEntry = zip.file(video.path);
        if (!zipEntry) {
          throw new Error(
            `Video "${video.fileName}" is missing from the backup zip`,
          );
        }
        buffer = await zipEntry.async('arraybuffer');
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
