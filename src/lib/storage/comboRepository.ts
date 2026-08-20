import type { Combo } from '@/lib/types';
import { type DemoVideo, db } from './database';
import { generateId, toUniqueIds } from './repositoryUtils';
import { sanitizeRuntimeVideoReference } from './videoReferences';
import {
  collectLocalVideoIds,
  deleteUnreferencedLocalVideos,
  getLocalVideoId,
  validatePendingVideoReference,
} from './videoRepository';

type NewCombo = Omit<Combo, 'id' | 'createdAt' | 'updatedAt' | 'sortOrder'>;

async function insertCombo(
  combo: NewCombo,
  video?: DemoVideo,
): Promise<string> {
  const sanitizedCombo = sanitizeRuntimeVideoReference(combo);
  validatePendingVideoReference(sanitizedCombo.demoUrl, video);
  const id = generateId();
  const now = Date.now();
  await db.transaction('rw', [db.combos, db.demoVideos], async () => {
    const existing = await db.combos
      .where('characterId')
      .equals(combo.characterId)
      .toArray();
    const maxOrder = existing.reduce(
      (max, current) => Math.max(max, current.sortOrder ?? 0),
      -1,
    );
    if (video) await db.demoVideos.add(video);
    await db.combos.add({
      ...sanitizedCombo,
      id,
      sortOrder: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
    });
  });
  return id;
}

export const comboRepository = {
  getAll: () => db.combos.toArray(),
  getByCharacter: (characterId: string) =>
    db.combos.where('characterId').equals(characterId).sortBy('sortOrder'),
  getByCharacters: async (characterIds: string[]): Promise<Combo[]> =>
    characterIds.length > 0
      ? await db.combos.where('characterId').anyOf(characterIds).toArray()
      : [],
  get: (id: string) => db.combos.get(id),
  add: (combo: NewCombo) => insertCombo(combo),
  addWithVideo: (combo: NewCombo, video?: DemoVideo) =>
    insertCombo(combo, video),
  update: async (id: string, updates: Partial<Combo>) => {
    const sanitizedUpdates = sanitizeRuntimeVideoReference(updates);
    await db.combos.update(id, {
      ...sanitizedUpdates,
      updatedAt: Date.now(),
    });
  },
  updateWithVideo: async (
    id: string,
    updates: Partial<Combo>,
    video?: DemoVideo,
  ) => {
    const sanitizedUpdates = sanitizeRuntimeVideoReference(updates);
    await db.transaction('rw', [db.combos, db.demoVideos], async () => {
      const current = await db.combos.get(id);
      if (!current) throw new Error(`Combo "${id}" was not found`);

      const nextDemoUrl =
        'demoUrl' in sanitizedUpdates
          ? sanitizedUpdates.demoUrl
          : current.demoUrl;
      validatePendingVideoReference(nextDemoUrl, video);

      if (video) await db.demoVideos.add(video);
      const updated = await db.combos.update(id, {
        ...sanitizedUpdates,
        updatedAt: Date.now(),
      });
      if (updated !== 1) {
        throw new Error(`Combo "${id}" could not be updated`);
      }

      const previousVideoId = getLocalVideoId(current.demoUrl);
      const nextVideoId = getLocalVideoId(nextDemoUrl);
      if (previousVideoId && previousVideoId !== nextVideoId) {
        await deleteUnreferencedLocalVideos([previousVideoId]);
      }
    });
  },
  delete: async (id: string) => {
    await db.transaction('rw', [db.combos, db.demoVideos], async () => {
      const combo = await db.combos.get(id);
      const videoId = getLocalVideoId(combo?.demoUrl);
      await db.combos.delete(id);
      if (videoId) await deleteUnreferencedLocalVideos([videoId]);
    });
  },
  bulkDelete: async (ids: string[]) => {
    const uniqueIds = toUniqueIds(ids);
    if (uniqueIds.length === 0) return;

    await db.transaction('rw', [db.combos, db.demoVideos], async () => {
      const combos = (await db.combos.bulkGet(uniqueIds)).filter(
        (combo): combo is Combo => combo !== undefined,
      );
      const videoIds = collectLocalVideoIds(combos);
      await db.combos.bulkDelete(uniqueIds);
      await deleteUnreferencedLocalVideos(videoIds);
    });
  },
  markOutdated: async (ids: string[], outdated: boolean) => {
    const uniqueIds = toUniqueIds(ids);
    if (uniqueIds.length === 0) return;

    await db.transaction('rw', db.combos, async () => {
      for (const id of uniqueIds) {
        await db.combos.update(id, {
          outdated: outdated || undefined,
          updatedAt: Date.now(),
        });
      }
    });
  },
  reorder: async (orderedIds: string[]) => {
    await db.transaction('rw', db.combos, async () => {
      const combos = await db.combos.bulkGet(orderedIds);
      const now = Date.now();
      const reorderedCombos = combos
        .filter((combo): combo is Combo => combo !== undefined)
        .map((combo, index) => ({
          ...combo,
          sortOrder: index,
          updatedAt: now,
        }));
      if (reorderedCombos.length > 0) {
        await db.combos.bulkPut(reorderedCombos);
      }
    });
  },
};
