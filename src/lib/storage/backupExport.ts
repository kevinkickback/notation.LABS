import JSZip from 'jszip';
import {
  type BackupFilter,
  closeBackupSelection,
} from '@/lib/backup/selectionClosure';
import { settingsSchema } from '@/lib/schemas';
import { db } from './database';
import {
  collectLocalVideoIds,
  sanitizeCombosLocalVideos,
} from './videoRepository';

const ZIP_BACKUP_METADATA_FILE = 'backup.json';
const ZIP_BACKUP_VIDEO_DIR = 'videos';

export async function exportBackup(
  includeVideos = false,
  filter?: BackupFilter,
  onProgress?: (current: number, total: number) => void,
): Promise<Blob> {
  let [games, characters, combos, settings] = await db.transaction(
    'r',
    [db.games, db.characters, db.combos, db.settings],
    () =>
      Promise.all([
        db.games.toArray(),
        db.characters.toArray(),
        db.combos.toArray(),
        db.settings.get(1),
      ]),
  );

  ({ games, characters, combos } = closeBackupSelection(
    { games, characters, combos },
    filter,
  ));
  const exportSettings = settings ? settingsSchema.parse(settings) : undefined;
  let sanitizedCombos = combos;

  if (includeVideos) {
    const localVideoIds = new Set(collectLocalVideoIds(combos));
    const allVideos = await db.demoVideos.toArray();
    const filteredVideos = allVideos.filter((video) =>
      localVideoIds.has(video.id),
    );
    sanitizedCombos = sanitizeCombosLocalVideos(
      combos,
      new Set(filteredVideos.map((video) => video.id)),
    );

    const zip = new JSZip();
    const demoVideos = filteredVideos.map((video) => {
      const extension = /\.[^.]+$/.exec(video.fileName)?.[0] ?? '';
      return {
        id: video.id,
        fileName: video.fileName,
        mimeType: video.mimeType,
        path: `${ZIP_BACKUP_VIDEO_DIR}/${video.id}${extension}`,
      };
    });

    onProgress?.(0, filteredVideos.length);
    for (let index = 0; index < filteredVideos.length; index++) {
      const video = filteredVideos[index];
      const entry = demoVideos[index];
      zip.file(entry.path, new Uint8Array(video.data));
      onProgress?.(index + 1, filteredVideos.length);
      if (index < filteredVideos.length - 1) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    }

    zip.file(
      ZIP_BACKUP_METADATA_FILE,
      JSON.stringify(
        {
          version: 3,
          exported: new Date().toISOString(),
          games,
          characters,
          combos: sanitizedCombos,
          settings: exportSettings,
          demoVideos,
        },
        null,
        2,
      ),
    );
    return zip.generateAsync({ type: 'blob', compression: 'STORE' });
  }

  sanitizedCombos = sanitizeCombosLocalVideos(combos, new Set());
  return new Blob(
    [
      JSON.stringify(
        {
          version: 1,
          exported: new Date().toISOString(),
          games,
          characters,
          combos: sanitizedCombos,
          settings: exportSettings,
        },
        null,
        2,
      ),
    ],
    { type: 'application/json' },
  );
}
