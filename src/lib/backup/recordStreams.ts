import { BACKUP_RECORD_BYTES, encodeBackupRecord } from './capabilities';
import { BACKUP_CHUNK_BYTES } from './exportContract';

export function byteStream(
  source: AsyncGenerator<Uint8Array, void>,
  signal?: AbortSignal,
): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        signal?.throwIfAborted();
        const next = await source.next();
        if (next.done) controller.close();
        else controller.enqueue(next.value);
      },
      async cancel() {
        await source.return();
      },
    },
    { highWaterMark: 1 },
  );
}

export async function* recordChunks(
  records: AsyncGenerator<unknown, void>,
  signal?: AbortSignal,
): AsyncGenerator<Uint8Array, void> {
  for await (const record of records) {
    signal?.throwIfAborted();
    const bytes = encodeBackupRecord(record);
    for (
      let offset = 0;
      offset < bytes.byteLength;
      offset += BACKUP_CHUNK_BYTES
    )
      yield bytes.subarray(offset, offset + BACKUP_CHUNK_BYTES);
    yield new Uint8Array([10]);
  }
}

/** Decode a record only after its bounded UTF-8 line has arrived. Writes await validation/staging. */
export function ndjsonWriter(
  consume: (record: unknown) => Promise<void>,
  signal?: AbortSignal,
): WritableStream<Uint8Array> {
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let pending = '';
  let bytes = 0;
  const append = async (text: string) => {
    const parts = text.split('\n');
    for (let index = 0; index < parts.length; index++) {
      signal?.throwIfAborted();
      const part = parts[index];
      bytes += new TextEncoder().encode(part).byteLength;
      if (bytes > BACKUP_RECORD_BYTES)
        throw new Error('A backup record is too large to process safely');
      pending += part;
      if (index < parts.length - 1) {
        if (!pending.trim()) throw new Error('Backup contains an empty record');
        let record: unknown;
        try {
          record = JSON.parse(pending);
        } catch {
          throw new Error('Backup contains an invalid JSON record');
        }
        await consume(record);
        pending = '';
        bytes = 0;
      }
    }
  };
  return new WritableStream<Uint8Array>({
    write(chunk) {
      return append(decoder.decode(chunk, { stream: true }));
    },
    async close() {
      await append(decoder.decode());
      if (pending.length)
        throw new Error('Backup contains an incomplete record');
    },
  });
}
