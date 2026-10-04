import { z } from 'zod';
import { externalHttpUrlSchema } from '@/lib/schemas';

export const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;
export class ImageValidationError extends Error {}
const signatures = [
  ['image/jpeg', [0xff, 0xd8, 0xff]],
  ['image/png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  ['image/gif', [0x47, 0x49, 0x46, 0x38]],
  ['image/webp', [0x52, 0x49, 0x46, 0x46]],
  ['image/bmp', [0x42, 0x4d]],
] as const;

function matchesImageType(type: string, bytes: Uint8Array): boolean {
  const signature = signatures.find(([mime]) => mime === type)?.[1];
  if (!signature?.every((byte, index) => bytes[index] === byte)) return false;
  if (type === 'image/gif') {
    return (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61;
  }
  if (type === 'image/webp') {
    return [0x57, 0x45, 0x42, 0x50].every(
      (byte, index) => bytes[index + 8] === byte,
    );
  }
  return true;
}

export function isImageDataUrl(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    value.length > Math.ceil(MAX_IMAGE_SIZE_BYTES / 3) * 4 + 32
  )
    return false;
  const match =
    /^data:(image\/(?:jpeg|png|gif|webp|bmp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(
      value,
    );
  if (!match || match[2].length % 4 !== 0) return false;
  const encoded = match[2];
  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0;
  if ((encoded.length / 4) * 3 - padding > MAX_IMAGE_SIZE_BYTES) return false;
  try {
    const header = Uint8Array.from(atob(encoded.slice(0, 24)), (char) =>
      char.charCodeAt(0),
    );
    return matchesImageType(match[1], header);
  } catch {
    return false;
  }
}

export async function readImageFile(
  file: File,
  signal: AbortSignal,
): Promise<string> {
  signal.throwIfAborted();
  if (file.size > MAX_IMAGE_SIZE_BYTES)
    throw new ImageValidationError('Image must be under 2MB');
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  signal.throwIfAborted();
  if (!matchesImageType(file.type, header))
    throw new ImageValidationError('Unsupported or invalid image file');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const abort = () => reader.abort();
    const cleanup = () => signal.removeEventListener('abort', abort);
    reader.onload = () => {
      cleanup();
      if (isImageDataUrl(reader.result)) resolve(reader.result);
      else
        reject(new ImageValidationError('Unsupported or invalid image file'));
    };
    reader.onerror = () => {
      cleanup();
      reject(new Error('Failed to read image file'));
    };
    reader.onabort = () => {
      cleanup();
      reject(new DOMException('Image loading cancelled', 'AbortError'));
    };
    signal.addEventListener('abort', abort, { once: true });
    reader.readAsDataURL(file);
  });
}

const imageResponseSchema = z.object({
  dataUrl: z.string().refine(isImageDataUrl),
});

export async function fetchImageAsBase64(
  workerUrl: string,
  imageUrl: string,
  signal?: AbortSignal,
): Promise<string | null> {
  signal?.throwIfAborted();
  if (!externalHttpUrlSchema.safeParse(imageUrl).success) return null;
  try {
    const response = await fetch(workerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: imageUrl }),
      signal,
    });
    if (!response.ok) return null;
    const raw: unknown = await response.json();
    signal?.throwIfAborted();
    const parsed = imageResponseSchema.safeParse(raw);
    return parsed.success ? parsed.data.dataUrl : null;
  } catch (error) {
    if (signal?.aborted) throw error;
    return null;
  }
}
