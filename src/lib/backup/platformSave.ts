type SavePickerWindow = Window & {
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: Array<{
      description?: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<{
    createWritable: () => Promise<{
      write: (data: Blob) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
};

export type BackupSaveResult = 'saved' | 'cancelled' | 'unavailable';

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
