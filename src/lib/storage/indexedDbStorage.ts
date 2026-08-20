import { exportBackup } from './backupExport';
import { characterRepository } from './characterRepository';
import { comboRepository } from './comboRepository';
import { gameRepository } from './gameRepository';
import { gameStatsRepository } from './gameStatsRepository';
import { importJsonBackup } from './jsonImport';
import { generateId } from './repositoryUtils';
import { settingsRepository } from './settingsRepository';
import { getLocalVideoId, videoRepository } from './videoRepository';
import { importZipBackup, type ZipImportProgress } from './zipImport';

export type { DemoVideo } from './database';
export { db } from './database';
export { generateId, getLocalVideoId };
export type { ZipImportProgress };

/**
 * Stable storage facade retained for reactive queries and existing consumers.
 * Implementations live in focused repositories so transaction ownership stays
 * close to each persistence concern.
 */
export const indexedDbStorage = {
  games: gameRepository,
  characters: characterRepository,
  combos: comboRepository,
  settings: settingsRepository,
  gameStats: gameStatsRepository,
  demoVideos: videoRepository,
  export: exportBackup,
  import: importJsonBackup,
  importZip: importZipBackup,
};
