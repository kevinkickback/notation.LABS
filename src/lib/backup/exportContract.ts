export interface BackupSink {
  write: (chunk: Uint8Array) => Promise<void>;
  close: () => Promise<void>;
  abort: () => Promise<void>;
}
export interface BackupExportProgress {
  phase: 'videos' | 'finalizing';
  current: number;
  total: number;
  bytesWritten: number;
}
export const BACKUP_CHUNK_BYTES = 256 * 1024;
export const BACKUP_CHANNELS = {
  begin: 'backup:begin',
  write: 'backup:write',
  finish: 'backup:finish',
  abort: 'backup:abort',
} as const;
export interface BackupBridge {
  beginBackup: (filename: string, mimeType: string) => Promise<string | null>;
  writeBackupChunk: (id: string, chunk: Uint8Array) => Promise<void>;
  finishBackup: (id: string) => Promise<void>;
  abortBackup: (id: string) => Promise<void>;
}
