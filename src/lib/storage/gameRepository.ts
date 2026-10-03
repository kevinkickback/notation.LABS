import { haveSameGameNotation } from '@/lib/comboParsing';
import { resolveNotationProfile } from '@/lib/notationProfiles';
import type { Game } from '@/lib/types';
import { db } from './database';
import { reparseCombosForGame } from './notationMaintenance';
import { generateId, toUniqueIds } from './repositoryUtils';
import { settingsRepository } from './settingsRepository';
import {
  collectLocalVideoIds,
  deleteUnreferencedLocalVideos,
} from './videoRepository';

export const gameRepository = {
  getAll: () => db.games.toArray(),
  get: (id: string) => db.games.get(id),
  add: async (
    game: Omit<Game, 'id' | 'createdAt' | 'updatedAt' | 'notationProfile'> & {
      notationProfile?: Game['notationProfile'];
    },
  ) => {
    const id = generateId();
    const now = Date.now();
    await db.games.add({
      ...game,
      notationProfile: resolveNotationProfile(game),
      id,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },
  update: async (id: string, updates: Partial<Game>) => {
    await db.transaction(
      'rw',
      [db.games, db.characters, db.combos],
      async () => {
        const currentGame = await db.games.get(id);
        const nextButtonLayout = updates.buttonLayout;
        const nextNotationProfile = updates.notationProfile;
        const shouldReparseCombos =
          currentGame !== undefined &&
          !haveSameGameNotation(currentGame, {
            buttonLayout: nextButtonLayout ?? currentGame.buttonLayout,
            notationProfile: nextNotationProfile ?? currentGame.notationProfile,
          });

        await db.games.update(id, {
          ...updates,
          ...(nextNotationProfile
            ? { notationProfile: nextNotationProfile }
            : {}),
          updatedAt: Date.now(),
        });

        if (shouldReparseCombos) {
          await reparseCombosForGame(id);
        }
      },
    );
  },
  setFavorite: async (id: string, favorite: boolean) => {
    await db.games.update(id, { favorite });
  },
  delete: async (id: string) => {
    let characterIds: string[] = [];
    await db.transaction(
      'rw',
      [db.games, db.characters, db.combos, db.demoVideos],
      async () => {
        const characters = await db.characters
          .where('gameId')
          .equals(id)
          .toArray();
        characterIds = characters.map((character) => character.id);

        if (characterIds.length > 0) {
          const combos = await db.combos
            .where('characterId')
            .anyOf(characterIds)
            .toArray();
          const videoIds = collectLocalVideoIds(combos);
          await db.combos.where('characterId').anyOf(characterIds).delete();
          await deleteUnreferencedLocalVideos(videoIds);
        }
        await db.characters.where('gameId').equals(id).delete();
        await db.games.delete(id);
      },
    );
    await settingsRepository.removeNotebookOpenPages([...characterIds, id]);
  },
  bulkDelete: async (ids: string[]) => {
    const uniqueIds = toUniqueIds(ids);
    if (uniqueIds.length === 0) return;

    let characterIds: string[] = [];
    await db.transaction(
      'rw',
      [db.games, db.characters, db.combos, db.demoVideos],
      async () => {
        const characters = await db.characters
          .where('gameId')
          .anyOf(uniqueIds)
          .toArray();
        characterIds = characters.map((character) => character.id);

        if (characterIds.length > 0) {
          const combos = await db.combos
            .where('characterId')
            .anyOf(characterIds)
            .toArray();
          const videoIds = collectLocalVideoIds(combos);
          await db.combos.where('characterId').anyOf(characterIds).delete();
          await deleteUnreferencedLocalVideos(videoIds);
        }

        await db.characters.where('gameId').anyOf(uniqueIds).delete();
        await db.games.bulkDelete(uniqueIds);
      },
    );
    await settingsRepository.removeNotebookOpenPages([
      ...characterIds,
      ...uniqueIds,
    ]);
  },
};
