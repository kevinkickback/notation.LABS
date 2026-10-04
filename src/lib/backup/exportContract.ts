import type { UserSettings } from '@/lib/types';
import type { BackupRecordKind } from './archiveContract';

export const BACKUP_FORMATS = {
  json: { mimeType: 'application/json', extension: '.json' },
  zip: { mimeType: 'application/zip', extension: '.zip' },
} as const;
export type BackupFormat = keyof typeof BACKUP_FORMATS;
export interface BackupSnapshot {
  sessionId: string;
  counts: Record<BackupRecordKind, number>;
  settings?: UserSettings;
  estimatedBytes: number;
}

export interface BackupSink {
  availableBytes?: number;
  write: (chunk: Uint8Array) => Promise<void>;
  close: () => Promise<void>;
  abort: () => Promise<void>;
}
export interface BackupExportProgress {
  phase: 'preparing' | 'videos' | 'finalizing' | 'committing';
  current: number;
  total: number;
  bytesWritten: number;
  estimatedBytes?: number;
  warning?: string;
}
export const BACKUP_CHUNK_BYTES = 256 * 1024;
export const BACKUP_CHANNELS = {
  begin: 'backup:begin',
  write: 'backup:write',
  finish: 'backup:finish',
  abort: 'backup:abort',
  capacity: 'backup:capacity',
} as const;
export interface BackupBridge {
  beginBackup: (filename: string, mimeType: string) => Promise<string | null>;
  writeBackupChunk: (id: string, chunk: Uint8Array) => Promise<void>;
  finishBackup: (id: string) => Promise<void>;
  abortBackup: (id: string) => Promise<void>;
  getBackupCapacity: (id: string) => Promise<number | null>;
}
