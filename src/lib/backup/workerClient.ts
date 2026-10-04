import { toUserMessage } from '@/lib/errors';
import type { ZipImportProgress } from '@/lib/storage/zipImport';
import type { BackupExportProgress, BackupSink } from './exportContract';
import TransferWorker from './transfer.worker?worker&inline';
import type {
  TransferRequest,
  TransferWorkerReply,
  TransferWorkerRequest,
} from './workerContract';

export const canUseTransferWorker = () =>
  typeof document !== 'undefined' && typeof Worker !== 'undefined';

/** One outstanding byte chunk, acknowledged only after its destination has accepted it. */
export function runTransferWorker(
  request: TransferRequest,
  write?: BackupSink['write'],
  onExportProgress?: (progress: BackupExportProgress) => void,
  onImportProgress?: (progress: ZipImportProgress) => void,
  signal?: AbortSignal,
): Promise<BackupExportProgress | undefined> {
  signal?.throwIfAborted();
  const worker = new TransferWorker();
  const post = (message: TransferWorkerRequest) => worker.postMessage(message);
  return new Promise((resolve, reject) => {
    const abort = () => post({ type: 'cancel' });
    const cleanup = () => {
      signal?.removeEventListener('abort', abort);
      worker.terminate();
    };
    signal?.addEventListener('abort', abort, { once: true });
    worker.onerror = () => {
      cleanup();
      reject(
        new Error(
          'The backup processor stopped unexpectedly. Retry the transfer.',
        ),
      );
    };
    worker.onmessage = ({ data }: MessageEvent<TransferWorkerReply>) => {
      switch (data.type) {
        case 'chunk':
          if (!write) {
            post({
              type: 'ack',
              sequence: data.sequence,
              error: 'Backup destination is unavailable',
            });
            break;
          }
          void Promise.resolve()
            .then(() => write(data.data))
            .then(
              () => post({ type: 'ack', sequence: data.sequence }),
              (error: unknown) =>
                post({
                  type: 'ack',
                  sequence: data.sequence,
                  error: toUserMessage(error),
                }),
            );
          break;
        case 'progress':
          if (data.direction === 'export') onExportProgress?.(data.progress);
          else onImportProgress?.(data.progress);
          break;
        case 'done':
          cleanup();
          resolve(data.progress);
          break;
        case 'error':
          cleanup();
          reject(new DOMException(data.message, data.name));
          break;
      }
    };
    post(request);
  });
}
