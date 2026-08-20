import Dexie, { type EntityTable } from 'dexie';
import { migrateLegacyNotationProfile } from '@/lib/notationProfiles';
import type {
  Character,
  Combo,
  Game,
  LegacyGame,
  UserSettings,
} from '@/lib/types';

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
  .upgrade((transaction) =>
    transaction
      .table('combos')
      .toCollection()
      .modify((combo) => {
        if (combo.sortOrder === undefined) {
          combo.sortOrder = combo.createdAt;
        }
      }),
  );

db.version(3).stores({
  games: 'id, name, createdAt',
  characters: 'id, gameId, name, createdAt',
  combos:
    'id, characterId, name, notation, createdAt, updatedAt, *tags, sortOrder',
  settings: 'id',
  demoVideos: 'id',
});

// Version 4 is reserved so existing databases retain their migration history.
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

db.version(6)
  .stores({
    games: 'id, name, createdAt',
    characters: 'id, gameId, name, createdAt',
    combos:
      'id, characterId, name, notation, description, createdAt, updatedAt, *tags, sortOrder',
    settings: 'id',
    demoVideos: 'id',
  })
  .upgrade((transaction) =>
    transaction
      .table('games')
      .toCollection()
      .modify((game: LegacyGame) => migrateLegacyNotationProfile(game)),
  );
