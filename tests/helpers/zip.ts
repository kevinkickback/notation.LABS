import JSZip from 'jszip';

export async function createBackupZip(
  metadata: unknown,
  files: Record<string, Uint8Array> = {},
  compression: 'DEFLATE' | 'STORE' = 'DEFLATE',
): Promise<Uint8Array<ArrayBuffer>> {
  const zip = new JSZip();
  zip.file('backup.json', JSON.stringify(metadata));
  for (const [name, data] of Object.entries(files)) zip.file(name, new Uint8Array(data));
  return new Uint8Array(await zip.generateAsync({ type: 'uint8array', compression }));
}

// Corrupt both size declarations while retaining the original compressed payload.
export function forgeZipSize(bytes: Uint8Array, filename: string, size: number): void {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = 0; offset + 46 <= bytes.byteLength; offset++) {
    if (view.getUint32(offset, true) !== 0x02014b50) continue;
    const nameLength = view.getUint16(offset + 28, true);
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    if (name !== filename) continue;
    view.setUint32(offset + 24, size, true);
    view.setUint32(view.getUint32(offset + 42, true) + 22, size, true);
    return;
  }
  throw new Error(`Missing fixture entry: ${filename}`);
}
