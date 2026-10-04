import { db } from './database';
import { projectRecords } from './recordBatches';

export const gameStatsRepository = {
  getInputs: async () => {
    const [characters, combos] = await db.transaction(
      'r',
      [db.characters, db.combos],
      () =>
        Promise.all([
          projectRecords(db.characters, ({ id, gameId, updatedAt }) => ({
            id,
            gameId,
            updatedAt,
          })),
          projectRecords(db.combos, ({ characterId, updatedAt }) => ({
            characterId,
            updatedAt,
          })),
        ]),
    );
    return { characters, combos };
  },
};
