import type { BackupSink } from './exportContract';

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

export type BackupSaveResult = 'saved' | 'cancelled' | 'unavailable';

/** Choose the destination before reading videos; streamed writes apply backpressure. */
export async function openBackupSink(
  suggestedName: string,
): Promise<BackupSink | null> {
  if (window.electronAPI) {
    const id = await window.electronAPI.beginBackup(
      suggestedName,
      'application/zip',
    );
    if (!id) return null;
    return {
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
      const handle = await picker({
        suggestedName,
        types: [
          {
            description: 'Notation Labs Backup',
            accept: { 'application/zip': ['.zip'] },
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
  // Browsers without a file picker retain native Blob pieces, never one giant ArrayBuffer.
  const parts: Blob[] = [];
  return {
    write: (chunk) => {
      parts.push(new Blob([new Uint8Array(chunk)]));
      return Promise.resolve();
    },
    close: () => {
      triggerBlobDownload(
        new Blob(parts, { type: 'application/zip' }),
        suggestedName,
      );
      parts.length = 0;
      return Promise.resolve();
    },
    abort: () => {
      parts.length = 0;
      return Promise.resolve();
    },
  };
}

export function triggerBlobDownload(blob: Blob, suggestedName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = suggestedName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function saveBlobWithPicker(
  blob: Blob,
  suggestedName: string,
  mimeType: string,
): Promise<BackupSaveResult> {
  const picker = (window as SavePickerWindow).showSaveFilePicker;
  if (!picker) return 'unavailable';

  try {
    const handle = await picker({
      suggestedName,
      types: [
        {
          description: 'Notation Labs Backup',
          accept: {
            [mimeType]: [suggestedName.endsWith('.zip') ? '.zip' : '.json'],
          },
        },
      ],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return 'saved';
  } catch (error) {
    return error instanceof DOMException && error.name === 'AbortError'
      ? 'cancelled'
      : 'unavailable';
  }
}

export async function saveBackupBlob(
  blob: Blob,
  suggestedName: string,
  mimeType: string,
  isDesktop: boolean,
): Promise<BackupSaveResult> {
  if (isDesktop) {
    const buffer = new Uint8Array(await blob.arrayBuffer());
    const result = await window.electronAPI.saveFile(
      buffer,
      suggestedName,
      mimeType,
    );
    if (result.success) return 'saved';
    if (result.error === 'User cancelled') return 'cancelled';
    throw new Error(result.error ?? 'Failed to save exported file');
  }

  return mimeType === 'application/json'
    ? saveBlobWithPicker(blob, suggestedName, mimeType)
    : 'unavailable';
}
