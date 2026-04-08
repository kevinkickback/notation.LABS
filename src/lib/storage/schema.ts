import Dexie, { type EntityTable } from 'dexie';
import type { Character, Combo, Game, UserSettings } from '../types';

export interface DemoVideo {
  id: string;
  data: ArrayBuffer;
  mimeType: string;
  fileName: string;
}

export const db = new Dexie('FightingGameComboTracker') as Dexie & {
  games: EntityTable<Game, 'id'>;
  characters: EntityTable<Character, 'id'>;
  combos: EntityTable<Combo, 'id'>;
  settings: EntityTable<UserSettings & { id: number }, 'id'>;
  demoVideos: EntityTable<DemoVideo, 'id'>;
};

db.version(1).stores({
  games: 'id, name, createdAt',
  characters: 'id, gameId, name, createdAt',
  combos: 'id, characterId, name, notation, createdAt, updatedAt, *tags',
  settings: 'id',
});

db.version(2)
  .stores({
    games: 'id, name, createdAt',
    characters: 'id, gameId, name, createdAt',
    combos:
      'id, characterId, name, notation, createdAt, updatedAt, *tags, sortOrder',
    settings: 'id',
  })
  .upgrade((tx) => {
    return tx
      .table('combos')
      .toCollection()
      .modify((combo) => {
        if (combo.sortOrder === undefined) {
          combo.sortOrder = combo.createdAt;
        }
      });
  });

db.version(3).stores({
  games: 'id, name, createdAt',
  characters: 'id, gameId, name, createdAt',
  combos:
    'id, characterId, name, notation, createdAt, updatedAt, *tags, sortOrder',
  settings: 'id',
  demoVideos: 'id',
});

// Version 4: no schema changes — reserved for future migration.
// Dexie requires strictly increasing version numbers; this bump
// holds the slot without modifying any table definitions.
db.version(4).stores({
  games: 'id, name, createdAt',
  characters: 'id, gameId, name, createdAt',
  combos:
    'id, characterId, name, notation, createdAt, updatedAt, *tags, sortOrder',
  settings: 'id',
  demoVideos: 'id',
});

db.version(5).stores({
  games: 'id, name, createdAt',
  characters: 'id, gameId, name, createdAt',
  combos:
    'id, characterId, name, notation, description, createdAt, updatedAt, *tags, sortOrder',
  settings: 'id',
  demoVideos: 'id',
});
