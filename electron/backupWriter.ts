import { randomUUID } from 'node:crypto';
import { type FileHandle, open, rename, unlink } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

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
      file = await open(temporary, 'wx');
    } finally {
      this.beginning = false;
    }
    if (generation !== this.generation) {
      await file.close();
      await unlink(temporary);
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
    await session.pending;
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
    } finally {
      if (this.session === session) this.session = undefined;
    }
  }
}
