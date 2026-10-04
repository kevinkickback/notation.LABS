import { describe, expect, it, vi } from 'vitest';
import { ndjsonWriter, byteStream, recordChunks } from '@/lib/backup/recordStreams';
import { BACKUP_CHUNK_BYTES } from '@/lib/backup/exportContract';
import { chunkedWriter } from '@/lib/backup/chunkedWriter';
import { assertSafeSize, BackupDirectoryBudget } from '@/lib/backup/capabilities';

async function encodeRecords(records: unknown[]) {
  async function* source() { for (const value of records) yield value; }
  return new Uint8Array(await new Response(byteStream(recordChunks(source()))).arrayBuffer());
}

describe('bounded backup streams', () => {
  it('preserves UTF-8 boundaries, escaped newlines and multiple records with one-byte chunks', async () => {
    const records = [{ id: '日本語', notes: 'first\nsecond\r\nthird' }, { id: '😀', notes: 'accent é' }];
    const encoded = await encodeRecords(records);
    const result: unknown[] = [];
    const writer = ndjsonWriter(async value => { result.push(value); }).getWriter();
    for (const byte of encoded) await writer.write(new Uint8Array([byte]));
    await writer.close();
    expect(result).toEqual(records);
  });
  it.each(['\n', '{broken}\n', '{"id":"incomplete"}'])('rejects malformed or incomplete records (%s)', async text => {
    const writer = ndjsonWriter(async () => undefined).getWriter();
    await expect((async () => { await writer.write(new TextEncoder().encode(text)); await writer.close(); })()).rejects.toThrow(/record/);
  });
  it('rejects invalid UTF-8 rather than changing library text', async () => {
    const writer = ndjsonWriter(async () => undefined).getWriter();
    await expect(writer.write(new Uint8Array([0xc0, 0x80, 10]))).rejects.toThrow();
  });
  it('stops streamed parsing on cancellation', async () => {
    const controller = new AbortController();
    const consume = vi.fn(async () => { controller.abort(); });
    const writer = ndjsonWriter(consume, controller.signal).getWriter();
    await expect(writer.write(new TextEncoder().encode('{"id":1}\n{"id":2}\n'))).rejects.toMatchObject({ name: 'AbortError' });
    expect(consume).toHaveBeenCalledOnce();
  });
  it('coalesces tiny writes, waits for acceptance, and flushes the remaining bytes on close', async () => {
    const parts: Uint8Array[] = [];
    const accepted = vi.fn();
    let resolve!: () => void;
    const destination = chunkedWriter(async chunk => {
      parts.push(new Uint8Array(chunk));
      if (parts.length === 1) await new Promise<void>(done => { resolve = done; });
    }, accepted);
    const writer = destination.writable.getWriter();
    await writer.write(new Uint8Array([1, 2, 3]));
    expect(parts).toHaveLength(0);
    const pending = writer.write(new Uint8Array(BACKUP_CHUNK_BYTES).fill(42));
    await vi.waitFor(() => expect(parts).toHaveLength(1));
    expect(accepted).not.toHaveBeenCalled();
    resolve(); await pending;
    await writer.close();
    expect(parts.map(part => part.length)).toEqual([BACKUP_CHUNK_BYTES, 3]);
    expect(parts[0].subarray(0, 3)).toEqual(new Uint8Array([1, 2, 3]));
    expect(accepted.mock.calls.map(([bytes]) => bytes)).toEqual([BACKUP_CHUNK_BYTES, 3]);
  });
  it('accepts more than 65,535 short ZIP entries while bounding directory allocations', () => {
    const budget = new BackupDirectoryBudget();
    for (let index = 0; index < 70_000; index++) budget.add(`videos/v-${index}.bin`, 128);
    const name = 'x'.repeat(1024 * 1024);
    expect(() => { for (let index = 0; index < 100; index++) budget.add(name); }).toThrow(/memory/);
  });
  it.each([-1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1])('rejects unsupported ZIP64 numbers (%s)', size => {
    expect(() => assertSafeSize(size)).toThrow(/unsupported/);
  });
});
