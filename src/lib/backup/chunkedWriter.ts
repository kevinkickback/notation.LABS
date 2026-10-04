import { BACKUP_CHUNK_BYTES, type BackupSink } from './exportContract';

/** Coalesce tiny ZIP headers without creating an unbounded pending-write queue. */
export function chunkedWriter(
  write: BackupSink['write'],
  onBytes: (bytes: number) => void,
  signal?: AbortSignal,
) {
  let buffer = new Uint8Array(BACKUP_CHUNK_BYTES);
  let used = 0;
  const flush = async () => {
    if (!used) return;
    signal?.throwIfAborted();
    const chunk = buffer.subarray(0, used);
    await write(chunk);
    onBytes(used);
    used = 0;
    // A destination may transfer ownership. Never reuse an acknowledged buffer.
    buffer = new Uint8Array(BACKUP_CHUNK_BYTES);
  };
  return {
    flush,
    writable: new WritableStream<Uint8Array>({
      async write(chunk) {
        signal?.throwIfAborted();
        let offset = 0;
        while (offset < chunk.byteLength) {
          const length = Math.min(
            chunk.byteLength - offset,
            buffer.length - used,
          );
          buffer.set(chunk.subarray(offset, offset + length), used);
          used += length;
          offset += length;
          if (used === buffer.length) await flush();
        }
      },
      close: flush,
    }),
  };
}
