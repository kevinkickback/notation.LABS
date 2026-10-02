import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BackupWriter } from '../../electron/backupWriter';

describe('streamed backup destination', () => {
  let directory: string;
  let writer: BackupWriter;
  beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), 'notation-export-test-')); writer = new BackupWriter(); });
  afterEach(async () => { await writer.abort(); const target = resolve(directory);
    if (!target.startsWith(resolve(tmpdir()) + sep) || !basename(target).startsWith('notation-export-test-')) throw new Error('Invalid test cleanup directory');
    await rm(target, { recursive: true, force: true }); });
  it('writes chunks in order and replaces the destination only on completion', async () => {
    const path = join(directory, 'backup.zip');
    await writeFile(path, 'original');
    const id = await writer.begin(path);
    await writer.write(id, new Uint8Array([1, 2, 3]));
    await writer.write(id, new Uint8Array([4, 5]));
    expect(await readFile(path, 'utf8')).toBe('original');
    await writer.finish(id);
    expect([...await readFile(path)]).toEqual([1, 2, 3, 4, 5]);
    expect(await readdir(directory)).toEqual(['backup.zip']);
    await expect(writer.write(id, new Uint8Array([6]))).rejects.toThrow('Invalid backup session');
  });
  it('cancels without replacing an existing backup or leaving a partial file', async () => {
    const path = join(directory, 'backup.zip');
    await writeFile(path, 'original');
    const id = await writer.begin(path);
    await writer.write(id, new Uint8Array([1]));
    await writer.abort(id);
    expect(await readFile(path, 'utf8')).toBe('original');
    expect(await readdir(directory)).toEqual(['backup.zip']);
  });
  it('rejects arbitrary sessions, oversized chunks and overlapping exports', async () => {
    const id = await writer.begin(join(directory, 'backup.zip'));
    await expect(writer.write('other', new Uint8Array([1]))).rejects.toThrow('Invalid backup session');
    await expect(writer.write(id, new Uint8Array(1024 * 1024 + 1))).rejects.toThrow('Invalid backup chunk');
    await expect(writer.begin(join(directory, 'other.zip'))).rejects.toThrow('already running');
    await writer.abort();
    expect(await readdir(directory)).toEqual([]);
  });
  it('cleans up when completion fails and allows a later export', async () => {
    const destination = join(directory, 'existing-directory');
    await mkdir(destination);
    const id = await writer.begin(destination);
    await writer.write(id, new Uint8Array([1]));
    await expect(writer.finish(id)).rejects.toThrow();
    expect(await readdir(directory)).toEqual(['existing-directory']);
    const next = await writer.begin(join(directory, 'next.zip'));
    await writer.write(next, new Uint8Array([2]));
    await writer.finish(next);
    expect([...await readFile(join(directory, 'next.zip'))]).toEqual([2]);
  });
  it('cleans up a destination still opening when the renderer goes away', async () => {
    const pending = writer.begin(join(directory, 'backup.zip'));
    await writer.abort();
    await expect(pending).rejects.toThrow('Export cancelled');
    expect(await readdir(directory)).toEqual([]);
  });

});

