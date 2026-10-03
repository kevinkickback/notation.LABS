import { db } from './database';
import { toUniqueIds } from './repositoryUtils';
import { settingsRepository } from './settingsRepository';
import {
  collectLocalVideoIds,
  deleteUnreferencedLocalVideos,
} from './videoRepository';

/** Records, video cleanup, and notebook choices commit or roll back together. */
export async function deleteEntityCascade(
  kind: 'game' | 'character',
  ids: string[],
): Promise<void> {
  const uniqueIds = toUniqueIds(ids);
  if (uniqueIds.length === 0) return;

  await db.transaction(
    'rw',
    // Notebook normalization may read both parent tables when migrating old preferences.
    [db.games, db.characters, db.combos, db.demoVideos, db.settings],
    async () => {
      const characterIds =
        kind === 'game'
          ? await db.characters.where('gameId').anyOf(uniqueIds).primaryKeys()
          : uniqueIds;
      if (characterIds.length > 0) {
        const combos = await db.combos
          .where('characterId')
          .anyOf(characterIds)
          .toArray();
        const videoIds = collectLocalVideoIds(combos);
        // anyOf collections retain cursor state, so deletion needs a fresh query.
        await db.combos.where('characterId').anyOf(characterIds).delete();
        await deleteUnreferencedLocalVideos(videoIds);
        await db.characters.bulkDelete(characterIds);
      }
      if (kind === 'game') await db.games.bulkDelete(uniqueIds);
      await settingsRepository.removeNotebookOpenPages(
        kind === 'game' ? [...uniqueIds, ...characterIds] : characterIds,
      );
    },
  );
}
