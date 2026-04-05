import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
]);

function hasKnownImageSignature(bytes: Uint8Array): boolean {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return true;
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return true;
  }

  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return true;
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return true;
  }

  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return true;
  }

  return false;
}

/**
 * Fetches an image from a remote worker and returns a base64 data URL.
 * @param workerUrl The worker endpoint (e.g., https://igdb.capitol-k.workers.dev/download)
 * @param imageUrl The image URL to download
 * @returns The base64 data URL, or null if failed
 */
export async function fetchImageAsBase64(
  workerUrl: string,
  imageUrl: string,
): Promise<string | null> {
  try {
    const res = await fetch(workerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: imageUrl }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.dataUrl || null;
  } catch {
    return null;
  }
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function extractYouTubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtube.com')) {
      return parsed.searchParams.get('v');
    }
    if (parsed.hostname.includes('youtu.be')) {
      return parsed.pathname.slice(1).split('/')[0] || null;
    }
  } catch {
    /* not a valid URL */
  }

  return null;
}

export function getYouTubeEmbedUrl(url: string): string | null {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) {
    return null;
  }

  return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`;
}

export async function isAllowedImageUpload(file: File): Promise<boolean> {
  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
    return false;
  }

  try {
    const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    return hasKnownImageSignature(header);
  } catch {
    return false;
  }
}

export function getApiBase(type: 'igdb' | 'ddg'): string {
  if (type === 'igdb') {
    return 'https://igdb.capitol-k.workers.dev';
  }
  if (type === 'ddg') {
    return 'https://ddg.capitol-k.workers.dev';
  }
  return '';
}
