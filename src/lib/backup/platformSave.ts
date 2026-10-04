import { BlobWriter } from '@zip.js/zip.js/lib/zip-core-native.js';
import {
  BACKUP_FORMATS,
  type BackupFormat,
  type BackupSink,
} from './exportContract';

type SavePickerWindow = Window & {
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: Array<{
      description?: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<{
    createWritable: () => Promise<{
      write: (data: Blob | Uint8Array) => Promise<void>;
      close: () => Promise<void>;
      abort: () => Promise<void>;
    }>;
  }>;
};

/** Choose the destination before reading videos; streamed writes apply backpressure. */
export async function openBackupSink(
  suggestedName: string,
  format: BackupFormat,
): Promise<BackupSink | null> {
  const { mimeType, extension } = BACKUP_FORMATS[format];
  if (window.electronAPI) {
    const id = await window.electronAPI.beginBackup(suggestedName, mimeType);
    if (!id) return null;
    let availableBytes: number | null;
    try {
      availableBytes = await window.electronAPI.getBackupCapacity(id);
    } catch (error) {
      await window.electronAPI.abortBackup(id).catch(() => {});
      throw error;
    }
    return {
      availableBytes: availableBytes ?? undefined,
      // IPC clones the backing buffer, so do not pass a view into an entire video.
      write: (chunk) =>
        window.electronAPI.writeBackupChunk(id, new Uint8Array(chunk)),
      close: () => window.electronAPI.finishBackup(id),
      abort: () => window.electronAPI.abortBackup(id),
    };
  }
  const picker = (window as SavePickerWindow).showSaveFilePicker;
  if (picker) {
    try {
      const handle = await picker.call(window, {
        suggestedName,
        types: [
          {
            description: 'Notation Labs Backup',
            accept: { [mimeType]: [extension] },
          },
        ],
      });
      const writable = await handle.createWritable();
      return {
        write: (chunk) => writable.write(new Uint8Array(chunk)),
        close: () => writable.close(),
        abort: () => writable.abort(),
      };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError')
        return null;
      throw error;
    }
  }
  // zip.js uses Response(stream).blob() on supported browsers. Native Blob storage
  // can spill to disk; each write waits instead of retaining a JS array of pieces.
  const blobWriter = new BlobWriter(mimeType);
  const writable = blobWriter.writable.getWriter();
  return {
    write: (chunk) => writable.write(new Uint8Array(chunk)),
    close: async () => {
      await writable.close();
      triggerBlobDownload(await blobWriter.getData(), suggestedName);
      writable.releaseLock();
    },
    abort: async () => {
      await writable.abort();
      writable.releaseLock();
    },
  };
}

function triggerBlobDownload(blob: Blob, suggestedName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = suggestedName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
