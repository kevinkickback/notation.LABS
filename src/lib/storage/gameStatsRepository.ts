import { db } from './database';

export const gameStatsRepository = {
  getInputs: async () => {
    const [characters, combos] = await db.transaction(
      'r',
      [db.characters, db.combos],
      () => Promise.all([db.characters.toArray(), db.combos.toArray()]),
    );
    return { characters, combos };
  },
};
