import { haveSameGameNotation } from '@/lib/comboParsing';
import { resolveNotationProfile } from '@/lib/notationProfiles';
import type { Game } from '@/lib/types';
import { db } from './database';
import { deleteEntityCascade } from './entityDeletion';
import { reparseCombosForGame } from './notationMaintenance';
import { generateId } from './repositoryUtils';

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
  delete: (id: string) => deleteEntityCascade('game', [id]),
  bulkDelete: (ids: string[]) => deleteEntityCascade('game', ids),
};
