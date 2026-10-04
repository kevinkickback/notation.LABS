import { z } from 'zod';
import { MAX_JSON_BACKUP_BYTES } from '@/lib/defaults';
import { externalHttpUrlSchema } from '@/lib/schemas';

export const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;
// Stored images are base64 fields within the existing bounded record format.
export const MAX_EMBEDDED_IMAGE_BYTES = Math.floor(
  (MAX_JSON_BACKUP_BYTES * 3) / 4,
);
export const imageUploadByteBudget = () =>
  typeof window !== 'undefined' && window.electronAPI
    ? MAX_EMBEDDED_IMAGE_BYTES
    : MAX_IMAGE_SIZE_BYTES;
export class ImageValidationError extends Error {}
const signatures = [
  ['image/jpeg', [0xff, 0xd8, 0xff]],
  ['image/png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  ['image/gif', [0x47, 0x49, 0x46, 0x38]],
  ['image/webp', [0x52, 0x49, 0x46, 0x46]],
  ['image/bmp', [0x42, 0x4d]],
] as const;

function imageMimeType(bytes: Uint8Array) {
  const type = signatures.find(([, signature]) =>
    signature.every((byte, index) => bytes[index] === byte),
  )?.[0];
  if (type === 'image/gif') {
    if (!((bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61))
      return undefined;
  }
  if (type === 'image/webp') {
    if (
      ![0x57, 0x45, 0x42, 0x50].every(
        (byte, index) => bytes[index + 8] === byte,
      )
    )
      return undefined;
  }
  return type;
}

/** Inspect bounded raster data; callers decide whether a legacy MIME label can be corrected. */
export function inspectImageDataUrl(
  value: unknown,
  maximumBytes = MAX_IMAGE_SIZE_BYTES,
) {
  if (
    typeof value !== 'string' ||
    value.length > Math.ceil(maximumBytes / 3) * 4 + 32
  )
    return undefined;
  const match =
    /^data:(image\/(?:jpeg|png|gif|webp|bmp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(
      value,
    );
  if (!match || match[2].length % 4 !== 0) return undefined;
  const encoded = match[2];
  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0;
  if ((encoded.length / 4) * 3 - padding > maximumBytes) return undefined;
  try {
    const header = Uint8Array.from(atob(encoded.slice(0, 24)), (char) =>
      char.charCodeAt(0),
    );
    const mimeType = imageMimeType(header);
    return mimeType
      ? { mimeType, declaredMimeType: match[1], encoded }
      : undefined;
  } catch {
    return undefined;
  }
}

export function isImageDataUrl(
  value: unknown,
  maximumBytes = MAX_IMAGE_SIZE_BYTES,
): value is string {
  const image = inspectImageDataUrl(value, maximumBytes);
  return image !== undefined && image.mimeType === image.declaredMimeType;
}

export async function readImageFile(
  file: File,
  signal: AbortSignal,
): Promise<string> {
  signal.throwIfAborted();
  const budget = imageUploadByteBudget();
  if (file.size > budget)
    throw new ImageValidationError(
      budget === MAX_IMAGE_SIZE_BYTES
        ? 'Image must be under 2MB'
        : 'This image needs too much memory to save safely. Choose a smaller file.',
    );
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  signal.throwIfAborted();
  if (imageMimeType(header) !== file.type)
    throw new ImageValidationError('Unsupported or invalid image file');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const abort = () => reader.abort();
    const cleanup = () => signal.removeEventListener('abort', abort);
    reader.onload = () => {
      cleanup();
      if (isImageDataUrl(reader.result, budget)) resolve(reader.result);
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
  dataUrl: z
    .string()
    .refine((value) => isImageDataUrl(value, imageUploadByteBudget())),
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
