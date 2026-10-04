import { MAX_JSON_BACKUP_BYTES } from '@/lib/defaults';
import { toUserMessage } from '@/lib/errors';
import { importJsonBackup } from '@/lib/storage/jsonImport';
import { importZipBackup } from '@/lib/storage/zipImport';
import { writeBackup } from './transferCore';
import type {
  TransferRequest,
  TransferWorkerReply,
  TransferWorkerRequest,
} from './workerContract';

const worker = self as unknown as {
  postMessage: (
    message: TransferWorkerReply,
    transfer?: Transferable[],
  ) => void;
  onmessage: ((event: MessageEvent<TransferWorkerRequest>) => void) | null;
};
const controller = new AbortController();
let committing = false;
let started = false;
let sequence = 0;
let pending:
  | { sequence: number; resolve: () => void; reject: (error: Error) => void }
  | undefined;
let lastReport = 0;
let lastPhase = '';
const progress = (
  message: Extract<TransferWorkerReply, { type: 'progress' }>,
) => {
  committing = message.progress.phase === 'committing';
  if (
    message.progress.phase !== lastPhase ||
    performance.now() - lastReport >= 100
  ) {
    lastPhase = message.progress.phase;
    lastReport = performance.now();
    worker.postMessage(message);
  }
};
const write = (chunk: Uint8Array): Promise<void> => {
  controller.signal.throwIfAborted();
  const data = new Uint8Array(chunk);
  return new Promise((resolve, reject) => {
    pending = { sequence: ++sequence, resolve, reject };
    worker.postMessage({ type: 'chunk', sequence, data }, [data.buffer]);
  });
};
async function run(request: TransferRequest): Promise<void> {
  try {
    if (request.direction === 'export') {
      const result = await writeBackup(
        request.format,
        write,
        request.filter,
        (value) =>
          progress({ type: 'progress', direction: 'export', progress: value }),
        controller.signal,
      );
      worker.postMessage({ type: 'done', progress: result });
    } else {
      const report = (
        value: Parameters<typeof importZipBackup>[3] extends
          | ((value: infer P) => void)
          | undefined
          ? P
          : never,
      ) => progress({ type: 'progress', direction: 'import', progress: value });
      if (request.format === 'zip') {
        if (typeof request.data === 'string')
          throw new Error('ZIP import requires a file');
        await importZipBackup(
          request.data,
          request.includeVideos,
          request.includeSettings,
          report,
          controller.signal,
        );
      } else {
        if (
          typeof request.data !== 'string' &&
          request.data.size > MAX_JSON_BACKUP_BYTES
        )
          throw new Error(
            'This JSON backup is too large to read safely. Choose a ZIP backup.',
          );
        const text =
          typeof request.data === 'string'
            ? request.data
            : await request.data.text();
        await importJsonBackup(
          text,
          request.includeVideos,
          request.includeSettings,
          report,
          controller.signal,
        );
      }
      worker.postMessage({ type: 'done' });
    }
  } catch (error) {
    worker.postMessage({
      type: 'error',
      name: error instanceof Error ? error.name : 'Error',
      message: toUserMessage(error),
    });
  }
}
worker.onmessage = ({ data }) => {
  if (data.type === 'cancel') {
    if (!committing) controller.abort();
  } else if (data.type === 'ack' && pending?.sequence === data.sequence) {
    const acknowledgement = pending;
    pending = undefined;
    if (data.error) acknowledgement.reject(new Error(data.error));
    else acknowledgement.resolve();
  } else if (data.type === 'start' && !started) {
    started = true;
    void run(data);
  }
};
