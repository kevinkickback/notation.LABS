import type { Combo } from '@/lib/types';

const LOCAL_VIDEO_PREFIX = 'local:';
const LEGACY_LOCAL_VIDEO_PREFIX = 'local-video://';

type ComboVideoFields = Pick<
  Combo,
  'demoUrl' | 'demoFileName' | 'demoVideoTitle'
>;

function parsePrefixedId(url: string, prefix: string): string | null {
  const videoId = url.slice(prefix.length);
  return videoId || null;
}

export function getCanonicalLocalVideoId(url?: string): string | null {
  if (!url?.startsWith(LOCAL_VIDEO_PREFIX)) return null;
  return parsePrefixedId(url, LOCAL_VIDEO_PREFIX);
}

export function getImportedLocalVideoId(url?: string): string | null {
  if (!url) return null;
  if (url.startsWith(LEGACY_LOCAL_VIDEO_PREFIX)) {
    return parsePrefixedId(url, LEGACY_LOCAL_VIDEO_PREFIX);
  }
  return getCanonicalLocalVideoId(url);
}

function clearVideoReference<T extends ComboVideoFields>(combo: T): T {
  return {
    ...combo,
    demoUrl: undefined,
    demoFileName: undefined,
    demoVideoTitle: undefined,
  };
}

export function sanitizeRuntimeVideoReference<T extends ComboVideoFields>(
  combo: T,
): T {
  if (combo.demoUrl?.startsWith(LEGACY_LOCAL_VIDEO_PREFIX)) {
    return clearVideoReference(combo);
  }
  return combo;
}

export function sanitizeImportedVideoReference<T extends ComboVideoFields>(
  combo: T,
  availableVideoIds: Set<string>,
): T {
  const videoId = getImportedLocalVideoId(combo.demoUrl);
  if (!videoId) return combo;
  if (!availableVideoIds.has(videoId)) return clearVideoReference(combo);
  if (combo.demoUrl?.startsWith(LEGACY_LOCAL_VIDEO_PREFIX)) {
    return { ...combo, demoUrl: `${LOCAL_VIDEO_PREFIX}${videoId}` };
  }
  return combo;
}

export function sanitizeCanonicalVideoReference<T extends ComboVideoFields>(
  combo: T,
  availableVideoIds: Set<string>,
): T {
  const videoId = getCanonicalLocalVideoId(combo.demoUrl);
  if (!videoId || availableVideoIds.has(videoId)) return combo;
  return clearVideoReference(combo);
}
