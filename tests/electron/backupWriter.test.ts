import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import * as fsPromises from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { basename, join, resolve, sep } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BackupWriter } from '../../electron/backupWriter';

vi.mock('node:fs/promises', async importOriginal => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  const unlink = vi.fn(actual.unlink);
  const open = vi.fn(actual.open);
  const statfs = vi.fn(actual.statfs);
  return { ...actual, open, statfs, unlink, default: { ...actual, open, statfs, unlink } };
});

describe('streamed backup destination', () => {
  let directory: string;
  let writer: BackupWriter;
  beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), 'notation-export-test-')); writer = new BackupWriter(); });
  afterEach(async () => { vi.restoreAllMocks(); await writer.abort(); const target = resolve(directory);
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

  it('reports failed partial-file cleanup without blocking a later export', async () => {
    const id = await writer.begin(join(directory, 'first.zip'));
    vi.mocked(fsPromises.unlink).mockRejectedValueOnce(Object.assign(new Error('File is locked'), { code: 'EPERM' }));
    await expect(writer.abort(id)).rejects.toThrow('File is locked');
    const next = await writer.begin(join(directory, 'next.zip'));
    await writer.write(next, new Uint8Array([7]));
    await writer.finish(next);
    expect([...await readFile(join(directory, 'next.zip'))]).toEqual([7]);
  });

  it('recovers a journaled partial file without touching the existing destination', async () => {
    const journals = join(directory, 'journals');
    await mkdir(journals);
    const id = randomUUID();
    const destination = join(directory, 'backup.zip');
    const temporary = join(directory, `.backup.zip.${id}.part`);
    await writeFile(destination, 'original');
    await writeFile(temporary, 'partial');
    await writeFile(join(journals, `${id}.json`), JSON.stringify({ id, destination, temporary }));
    const recovered = new BackupWriter(journals);
    await recovered.recover();
    await recovered.recover();
    expect(await readFile(destination, 'utf8')).toBe('original');
    expect(await readdir(directory)).toEqual(['backup.zip', 'journals']);
    expect(await readdir(journals)).toEqual([]);
    const next = await recovered.begin(destination);
    expect(await readdir(journals)).toEqual([`${next}.json`]);
    await recovered.write(next, new Uint8Array([42]));
    await recovered.finish(next);
    expect(await readdir(journals)).toEqual([]);
  });

  it('refuses a recovery journal pointing at an unrelated file', async () => {
    const journals = join(directory, 'journals');
    await mkdir(journals);
    const id = randomUUID();
    const destination = join(directory, 'backup.zip');
    await writeFile(destination, 'original');
    await writeFile(join(journals, `${id}.json`), JSON.stringify({ id, destination, temporary: destination }));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await new BackupWriter(journals).recover();
    expect(await readFile(destination, 'utf8')).toBe('original');
    expect(console.error).toHaveBeenCalled();
  });

  it.each([
    ['ENOSPC', 'out of space'],
    ['EFBIG', 'destination that supports larger files'],
  ])('explains %s and cleans a failed output', async (code, message) => {
    const actual = await vi.importActual<typeof fsPromises>('node:fs/promises');
    vi.mocked(fsPromises.open).mockImplementationOnce(async (...args) => {
      const file = await actual.open(...args);
      vi.spyOn(file, 'write').mockRejectedValueOnce(Object.assign(new Error('write failed'), { code }));
      return file;
    });
    const destination = join(directory, 'backup.zip');
    await writeFile(destination, 'original');
    const id = await writer.begin(destination);
    await expect(writer.write(id, new Uint8Array([1]))).rejects.toThrow(message);
    await writer.abort(id);
    expect(await readFile(destination, 'utf8')).toBe('original');
    expect(await readdir(directory)).toEqual(['backup.zip']);
  });

  it('keeps unavailable filesystem estimates advisory and rejects arbitrary capacity sessions', async () => {
    const id = await writer.begin(join(directory, 'backup.zip'));
    expect(await writer.availableBytes(id)).toBeGreaterThan(0);
    vi.mocked(fsPromises.statfs).mockRejectedValueOnce(new Error('not supported'));
    expect(await writer.availableBytes(id)).toBeNull();
    await expect(writer.availableBytes('arbitrary')).rejects.toThrow('Invalid backup session');
  });

});
