import { MAX_VIDEO_SIZE_BYTES } from '@/lib/defaults';
import type { Combo } from '@/lib/types';
import { type DemoVideo, db } from './database';
import { toUniqueIds } from './repositoryUtils';
import {
  getCanonicalLocalVideoId,
  sanitizeCanonicalVideoReference,
} from './videoReferences';

export function getLocalVideoId(demoUrl?: string): string | null {
  return getCanonicalLocalVideoId(demoUrl);
}

export function collectLocalVideoIds(
  combos: Array<Pick<Combo, 'demoUrl'>>,
): string[] {
  const videoIds = new Set<string>();
  for (const combo of combos) {
    const videoId = getLocalVideoId(combo.demoUrl);
    if (videoId) videoIds.add(videoId);
  }
  return [...videoIds];
}

export async function deleteUnreferencedLocalVideos(
  candidateIds: string[],
): Promise<void> {
  const uniqueCandidateIds = toUniqueIds(candidateIds);
  if (uniqueCandidateIds.length === 0) return;

  const referencedIds = new Set(
    collectLocalVideoIds(await db.combos.toArray()),
  );
  const unreferencedIds = uniqueCandidateIds.filter(
    (id) => !referencedIds.has(id),
  );
  if (unreferencedIds.length > 0) {
    await db.demoVideos.bulkDelete(unreferencedIds);
  }
}

export function validatePendingVideoReference(
  demoUrl: string | undefined,
  video: DemoVideo | undefined,
): void {
  if (!video) return;
  if (video.data.byteLength > MAX_VIDEO_SIZE_BYTES) {
    throw new Error(`Video "${video.fileName}" exceeds the 50 MB limit`);
  }
  if (getLocalVideoId(demoUrl) !== video.id) {
    throw new Error('Pending video does not match the combo demo URL');
  }
}

export function sanitizeCombosLocalVideos(
  combos: Combo[],
  availableVideoIds: Set<string>,
): Combo[] {
  return combos.map((combo) =>
    sanitizeCanonicalVideoReference(combo, availableVideoIds),
  );
}

export const videoRepository = {
  get: async (id: string) => db.demoVideos.get(id),
  add: async (video: DemoVideo) => {
    await db.demoVideos.add(video);
    return video.id;
  },
  delete: async (id: string) => db.demoVideos.delete(id),
  getAll: () => db.demoVideos.toArray(),
  getBlobUrl: async (id: string) => {
    const video = await db.demoVideos.get(id);
    if (!video) return null;
    const blob = new Blob([video.data], { type: video.mimeType });
    return URL.createObjectURL(blob);
  },
};
