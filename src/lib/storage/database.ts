import Dexie, { type EntityTable } from 'dexie';
import type {
  BackupSession,
  StagedBackupRecord,
  VideoReference,
} from '@/lib/backup/archiveContract';
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
  data: ArrayBuffer | Blob;
  mimeType: string;
  fileName: string;
}

export interface MediaPayload {
  id: string;
  data: Blob;
  sessionId?: string;
}

export const db = new Dexie('FightingGameComboTracker') as Dexie & {
  games: EntityTable<Game, 'id'>;
  characters: EntityTable<Character, 'id'>;
  combos: EntityTable<Combo, 'id'>;
  settings: EntityTable<UserSettings & { id: number }, 'id'>;
  demoVideos: EntityTable<DemoVideo | VideoReference, 'id'>;
  mediaPayloads: EntityTable<MediaPayload, 'id'>;
  backupSessions: EntityTable<BackupSession, 'id'>;
  backupRecords: EntityTable<StagedBackupRecord, 'id'>;
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

// Payload bytes are immutable. Library metadata and transfer snapshots hold their references.
// Legacy buffers migrate one video at a time, outside the schema upgrade transaction.
db.version(7).stores({
  combos:
    'id, characterId, name, notation, description, createdAt, updatedAt, *tags, sortOrder, [characterId+id]',
  demoVideos: 'id, payloadId, [id+payloadId]',
  mediaPayloads: 'id, sessionId, [sessionId+id]',
  backupSessions: 'id, updatedAt',
  backupRecords: 'id, sessionId, [sessionId+kind+entityId], payloadId',
});
