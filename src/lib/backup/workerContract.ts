import type { ZipImportProgress } from '@/lib/storage/zipImport';
import type { BackupExportProgress, BackupFormat } from './exportContract';
import type { BackupFilter } from './selectionClosure';

export type TransferRequest =
  | {
      type: 'start';
      direction: 'export';
      format: BackupFormat;
      filter?: BackupFilter;
    }
  | {
      type: 'start';
      direction: 'import';
      format: BackupFormat;
      data: Blob | string;
      includeVideos: boolean;
      includeSettings: boolean;
    };
export type TransferWorkerRequest =
  | TransferRequest
  | { type: 'cancel' }
  | { type: 'ack'; sequence: number; error?: string };
export type TransferWorkerReply =
  | { type: 'progress'; direction: 'export'; progress: BackupExportProgress }
  | { type: 'progress'; direction: 'import'; progress: ZipImportProgress }
  | { type: 'chunk'; sequence: number; data: Uint8Array<ArrayBuffer> }
  | { type: 'done'; progress?: BackupExportProgress }
  | { type: 'error'; name: string; message: string };
