import type { Character, Combo, Game, UserSettings } from '@/lib/types';

export interface VideoReference {
  id: string;
  fileName: string;
  mimeType: string;
  payloadId: string;
  size: number;
}

export interface BackupRecordTypes {
  games: Game;
  characters: Character;
  combos: Combo;
  videos: VideoReference;
}
export type BackupRecordKind = keyof BackupRecordTypes;
export type StagedBackupRecord = {
  [K in BackupRecordKind]: {
    id: string;
    sessionId: string;
    kind: K;
    entityId: string;
    value: BackupRecordTypes[K];
    bytes: number;
    payloadId?: string;
    notationChanged?: boolean;
    asset?: { path: string; mimeType: string };
  };
}[BackupRecordKind];

export interface BackupSession {
  id: string;
  kind: 'import' | 'export';
  state: 'staging' | 'committed';
  updatedAt: number;
  settings?: UserSettings;
  includeVideos?: boolean;
}

export const BACKUP_RECORD_BATCH = 128;
export const BACKUP_BATCH_BYTES = 8 * 1024 * 1024;
export const BACKUP_RECORD_FILES = {
  games: 'games.ndjson',
  characters: 'characters.ndjson',
  combos: 'combos.ndjson',
  videos: 'videos.ndjson',
} as const;
