import { randomUUID } from 'node:crypto';
import {
  type FileHandle,
  mkdir,
  open,
  readdir,
  readFile,
  rename,
  stat,
  statfs,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { basename, dirname, isAbsolute, join } from 'node:path';

interface SaveSession {
  id: string;
  destination: string;
  temporary: string;
  file: FileHandle;
  pending: Promise<void>;
  accepting: boolean;
}

/** Only main-process paths selected with the save dialog reach this writer. */
export class BackupWriter {
  private session: SaveSession | undefined;
  private beginning = false;
  private generation = 0;
  constructor(private readonly recoveryDirectory?: string) {}

  private journalPath(id: string): string | undefined {
    return this.recoveryDirectory && join(this.recoveryDirectory, `${id}.json`);
  }

  private async removeJournal(id: string): Promise<void> {
    const path = this.journalPath(id);
    if (!path) return;
    await unlink(path).catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        console.error('backup journal cleanup', error);
    });
  }

  /** Only journals created by this main-process writer identify recoverable partial files. */
  async recover(): Promise<void> {
    if (!this.recoveryDirectory) return;
    const files = await readdir(this.recoveryDirectory).catch(
      (error: unknown) => {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw error;
      },
    );
    for (const name of files) {
      if (
        !/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}\.json$/i.test(
          name,
        )
      )
        continue;
      const path = join(this.recoveryDirectory, name);
      try {
        if ((await stat(path)).size > 64 * 1024)
          throw new Error('Invalid backup recovery journal');
        const saved: unknown = JSON.parse(await readFile(path, 'utf8'));
        if (
          typeof saved !== 'object' ||
          !saved ||
          !('id' in saved) ||
          !('destination' in saved) ||
          !('temporary' in saved) ||
          saved.id !== name.slice(0, -5) ||
          typeof saved.destination !== 'string' ||
          typeof saved.temporary !== 'string' ||
          !isAbsolute(saved.destination) ||
          saved.temporary !==
            join(
              dirname(saved.destination),
              `.${basename(saved.destination)}.${saved.id}.part`,
            )
        )
          throw new Error('Invalid backup recovery journal');
        await unlink(saved.temporary).catch((error: unknown) => {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        });
        await this.removeJournal(saved.id);
      } catch (error) {
        console.error('backup recovery', error);
      }
    }
  }

  async begin(destination: string): Promise<string> {
    if (this.session || this.beginning)
      throw new Error('An export is already running');
    this.beginning = true;
    const generation = this.generation;
    const id = randomUUID();
    const temporary = join(
      dirname(destination),
      `.${basename(destination)}.${id}.part`,
    );
    let file: FileHandle;
    try {
      const journal = this.journalPath(id);
      if (journal && this.recoveryDirectory) {
        await mkdir(this.recoveryDirectory, { recursive: true });
        await writeFile(
          journal,
          JSON.stringify({ id, destination, temporary }),
          { flag: 'wx' },
        );
      }
      file = await open(temporary, 'wx');
    } catch (error) {
      await this.removeJournal(id);
      throw error;
    } finally {
      this.beginning = false;
    }
    if (generation !== this.generation) {
      await file.close();
      await unlink(temporary);
      await this.removeJournal(id);
      throw new Error('Export cancelled');
    }
    this.session = {
      id,
      destination,
      temporary,
      file,
      pending: Promise.resolve(),
      accepting: true,
    };
    return id;
  }

  private getSession(id: unknown): SaveSession {
    if (typeof id !== 'string' || this.session?.id !== id)
      throw new Error('Invalid backup session');
    return this.session;
  }

  async availableBytes(id: unknown): Promise<number | null> {
    const session = this.getSession(id);
    try {
      const capacity = await statfs(dirname(session.destination), {
        bigint: true,
      });
      return Number(capacity.bavail * capacity.bsize);
    } catch {
      // Some filesystems cannot report capacity. Actual write failures remain authoritative.
      return null;
    }
  }

  async write(id: unknown, chunk: unknown): Promise<void> {
    const session = this.getSession(id);
    if (!session.accepting) throw new Error('Backup session is closing');
    if (
      !(chunk instanceof Uint8Array) ||
      chunk.byteLength > 1024 * 1024 ||
      chunk.buffer.byteLength > 1024 * 1024
    )
      throw new Error('Invalid backup chunk');
    session.pending = session.pending.then(async () => {
      let offset = 0;
      while (offset < chunk.byteLength) {
        const { bytesWritten } = await session.file.write(
          chunk,
          offset,
          chunk.byteLength - offset,
        );
        if (bytesWritten === 0) throw new Error('Unable to write backup');
        offset += bytesWritten;
      }
    });
    try {
      await session.pending;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOSPC')
        throw new Error(
          'The backup destination is out of space. Choose a drive with more free space.',
        );
      if (code === 'EFBIG')
        throw new Error(
          'This drive cannot store a file this large. For backups above 4 GB, choose an NTFS or exFAT drive.',
        );
      throw error;
    }
  }

  async finish(id: unknown): Promise<void> {
    const session = this.getSession(id);
    if (!session.accepting) throw new Error('Backup session is closing');
    session.accepting = false;
    try {
      await session.pending;
      await session.file.sync();
      await session.file.close();
      await rename(session.temporary, session.destination);
      this.session = undefined;
      await this.removeJournal(session.id);
    } catch (error) {
      await this.abort(id);
      throw error;
    }
  }

  async abort(id?: unknown): Promise<void> {
    this.generation++;
    if (!this.session) return;
    const session = id === undefined ? this.session : this.getSession(id);
    session.accepting = false;
    try {
      await session.pending.catch(() => {});
      await session.file.close().catch(() => {});
      await unlink(session.temporary).catch((error) => {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      });
      await this.removeJournal(session.id);
    } finally {
      if (this.session === session) this.session = undefined;
    }
  }
}
