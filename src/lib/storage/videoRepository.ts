import {
  BACKUP_BATCH_BYTES,
  BACKUP_RECORD_BATCH,
  type StagedBackupRecord,
  type VideoReference,
} from '@/lib/backup/archiveContract';
import { assertSafeSize, encodeBackupRecord } from '@/lib/backup/capabilities';
import { videoHeaderSchema } from '@/lib/schemas';
import type { Combo } from '@/lib/types';
import { collectUnusedPayloads } from './backupSessionRepository';
import { type DemoVideo, db, type MediaPayload } from './database';
import { generateId, toUniqueIds } from './repositoryUtils';
import {
  getCanonicalLocalVideoId,
  sanitizeCanonicalVideoReference,
} from './videoReferences';

export function getLocalVideoId(demoUrl?: string): string | null {
  return getCanonicalLocalVideoId(demoUrl);
}

export function collectLocalVideoIds(
  combos: Array<Pick<Combo, 'demoUrl'>>,
): string[] {
  const videoIds = new Set<string>();
  for (const combo of combos) {
    const videoId = getLocalVideoId(combo.demoUrl);
    if (videoId) videoIds.add(videoId);
  }
  return [...videoIds];
}

export async function deleteUnreferencedLocalVideos(
  candidateIds: string[],
): Promise<void> {
  const uniqueCandidateIds = toUniqueIds(candidateIds);
  if (uniqueCandidateIds.length === 0) return;

  const unreferenced = new Set(uniqueCandidateIds);
  await db.combos
    .toCollection()
    .until(() => unreferenced.size === 0)
    .each((combo) => {
      const id = getLocalVideoId(combo.demoUrl);
      if (id) unreferenced.delete(id);
    });
  for (const id of unreferenced) {
    // Legacy buffers may still exist; never bulk-read their bytes during deletion.
    const video = await db.demoVideos.get(id);
    await db.demoVideos.delete(id);
    if (video && 'payloadId' in video)
      await collectUnusedPayloads([video.payloadId]);
  }
}

export function validatePendingVideoReference(
  demoUrl: string | undefined,
  video: DemoVideo | undefined,
): void {
  if (!video) return;
  if (getLocalVideoId(demoUrl) !== video.id) {
    throw new Error('Pending video does not match the combo demo URL');
  }
}

export function videoBlob(video: DemoVideo): Blob {
  return 'size' in video.data
    ? video.data
    : new Blob([video.data], { type: video.mimeType });
}

function videoPayload(video: DemoVideo, sessionId?: string) {
  const blob = videoBlob(video);
  assertSafeSize(blob.size);
  const reference: VideoReference = {
    ...videoHeaderSchema.parse(video),
    payloadId: generateId(),
    size: blob.size,
  };
  const payload: MediaPayload = {
    id: reference.payloadId,
    data: blob,
    sessionId,
  };
  return { reference, payload };
}

/** Stage immutable bytes without changing any library-visible reference. */
export async function stageVideoPayload(
  video: DemoVideo,
  sessionId?: string,
): Promise<VideoReference> {
  const { reference, payload } = videoPayload(video, sessionId);
  await db.mediaPayloads.add(payload);
  return reference;
}

/** Sequential extraction, bounded small-file batches, and one large Blob at a time. */
export function createVideoStager(sessionId: string, signal?: AbortSignal) {
  let payloads: MediaPayload[] = [];
  let rows: StagedBackupRecord[] = [];
  let bytes = 0;
  const flush = async () => {
    if (!payloads.length) return;
    signal?.throwIfAborted();
    await db.transaction(
      'rw',
      [db.mediaPayloads, db.backupRecords],
      async () => {
        await db.mediaPayloads.bulkAdd(payloads);
        signal?.throwIfAborted();
        await db.backupRecords.bulkPut(rows);
        signal?.throwIfAborted();
      },
    );
    payloads = [];
    rows = [];
    bytes = 0;
  };
  return {
    flush,
    async add(
      video: DemoVideo,
      row: Extract<StagedBackupRecord, { kind: 'videos' }>,
    ) {
      signal?.throwIfAborted();
      const { reference, payload } = videoPayload(video, sessionId);
      if (payloads.length && bytes + reference.size > BACKUP_BATCH_BYTES)
        await flush();
      payloads.push(payload);
      rows.push({
        ...row,
        value: reference,
        payloadId: reference.payloadId,
        bytes: encodeBackupRecord(reference).byteLength,
      });
      bytes += reference.size;
      if (payloads.length >= BACKUP_RECORD_BATCH || bytes >= BACKUP_BATCH_BYTES)
        await flush();
    },
  };
}

/** Call within the transaction owning the combo and video metadata. */
export async function saveVideo(
  video: DemoVideo,
  replace = false,
): Promise<void> {
  const previous = replace ? await db.demoVideos.get(video.id) : undefined;
  const reference = await stageVideoPayload(video);
  if (replace) await db.demoVideos.put(reference);
  else await db.demoVideos.add(reference);
  if (previous && 'payloadId' in previous)
    await collectUnusedPayloads([previous.payloadId]);
}

export function resolveVideoReference(
  id: string,
): Promise<VideoReference | undefined> {
  return db.transaction('rw', [db.demoVideos, db.mediaPayloads], async () => {
    const video = await db.demoVideos.get(id);
    if (!video) return undefined;
    if ('payloadId' in video) return video;
    const reference = await stageVideoPayload(video);
    await db.demoVideos.put(reference);
    return reference;
  });
}

export async function readVideoPayload(
  reference: VideoReference,
): Promise<DemoVideo> {
  const payload = await db.mediaPayloads.get(reference.payloadId);
  if (!payload)
    throw new Error(`Video "${reference.fileName}" is missing its stored data`);
  return {
    id: reference.id,
    fileName: reference.fileName,
    mimeType: reference.mimeType,
    data: payload.data,
  };
}

export function sanitizeCombosLocalVideos(
  combos: Combo[],
  availableVideoIds: Set<string>,
): Combo[] {
  return combos.map((combo) =>
    sanitizeCanonicalVideoReference(combo, availableVideoIds),
  );
}

export const videoRepository = {
  get: async (id: string) => {
    const reference = await resolveVideoReference(id);
    return reference ? readVideoPayload(reference) : undefined;
  },
  add: async (video: DemoVideo) => {
    await db.transaction(
      'rw',
      [db.demoVideos, db.mediaPayloads, db.backupRecords],
      () => saveVideo(video),
    );
    return video.id;
  },
  delete: async (id: string) =>
    db.transaction(
      'rw',
      [db.demoVideos, db.mediaPayloads, db.backupRecords],
      async () => {
        const video = await db.demoVideos.get(id);
        await db.demoVideos.delete(id);
        if (video && 'payloadId' in video)
          await collectUnusedPayloads([video.payloadId]);
      },
    ),
  getAll: async () => {
    const videos: DemoVideo[] = [];
    for (const id of await db.demoVideos.toCollection().primaryKeys()) {
      const reference = await resolveVideoReference(id);
      if (reference) videos.push(await readVideoPayload(reference));
    }
    return videos;
  },
  getIds: () => db.demoVideos.toCollection().primaryKeys(),
  getBlobUrl: async (id: string) => {
    const reference = await resolveVideoReference(id);
    if (!reference) return null;
    const video = await readVideoPayload(reference);
    const blob = videoBlob(video);
    return URL.createObjectURL(blob);
  },
};
