import { afterEach, describe, expect, it, vi } from 'vitest';
import { runTransferWorker } from '@/lib/backup/workerClient';
import type { TransferWorkerReply } from '@/lib/backup/workerContract';

const mock = vi.hoisted(() => ({
  postMessage: vi.fn(), terminate: vi.fn(),
  onmessage: null as ((event: MessageEvent<TransferWorkerReply>) => void) | null,
  onerror: null as (() => void) | null,
}));
vi.mock('@/lib/backup/transfer.worker?worker&inline', () => ({ default: class { constructor() { return mock; } } }));
const start = { type: 'start', direction: 'export', format: 'zip' } as const;
const reply = (data: TransferWorkerReply) => mock.onmessage!({ data } as MessageEvent<TransferWorkerReply>);
afterEach(() => { vi.clearAllMocks(); });

describe('transfer worker destination lifecycle', () => {
  it('acknowledges bytes only after the destination write settles', async () => {
    let accept!: () => void;
    const pending = runTransferWorker(start, () => new Promise<void>(resolve => { accept = resolve; }));
    reply({ type: 'chunk', sequence: 7, data: new Uint8Array([42]) });
    await vi.waitFor(() => expect(accept).toBeTypeOf('function'));
    expect(mock.postMessage).toHaveBeenCalledExactlyOnceWith(start);
    accept();
    await vi.waitFor(() => expect(mock.postMessage).toHaveBeenCalledWith({ type: 'ack', sequence: 7 }));
    reply({ type: 'done' });
    await pending;
    expect(mock.terminate).toHaveBeenCalledOnce();
  });
  it('returns a synchronous destination failure to the worker instead of leaving it waiting', async () => {
    const pending = runTransferWorker(start, () => { throw new Error('disk full'); });
    reply({ type: 'chunk', sequence: 2, data: new Uint8Array([1]) });
    await vi.waitFor(() => expect(mock.postMessage).toHaveBeenCalledWith({ type: 'ack', sequence: 2, error: 'disk full' }));
    reply({ type: 'error', name: 'Error', message: 'disk full' });
    await expect(pending).rejects.toThrow('disk full');
  });
  it('sends cancellation and lets the worker finish rollback before terminating', async () => {
    const controller = new AbortController();
    const pending = runTransferWorker(start, undefined, undefined, undefined, controller.signal);
    controller.abort();
    expect(mock.postMessage).toHaveBeenCalledWith({ type: 'cancel' });
    expect(mock.terminate).not.toHaveBeenCalled();
    reply({ type: 'error', name: 'AbortError', message: 'Transfer cancelled' });
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(mock.terminate).toHaveBeenCalledOnce();
  });
  it('reports a crashed worker and releases its resources', async () => {
    const pending = runTransferWorker(start);
    mock.onerror!();
    await expect(pending).rejects.toThrow('stopped unexpectedly');
    expect(mock.terminate).toHaveBeenCalledOnce();
  });
});
