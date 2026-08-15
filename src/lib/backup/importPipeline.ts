import { normalizeGameNotationProfile } from '@/lib/notationProfiles';
import type {
  BackupImportData,
  Character,
  Combo,
  Game,
  UserSettings,
} from '@/lib/types';

export interface ResolvedBackupVideo {
  id: string;
  data: ArrayBuffer;
  mimeType: string;
  fileName: string;
}

export interface BackupImportPlan {
  games: Game[];
  characters: Character[];
  combos: Combo[];
  settings?: UserSettings;
  videos: ResolvedBackupVideo[];
}

function getLocalVideoId(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('local:')) return url.slice('local:'.length) || undefined;
  if (url.startsWith('local-video://')) {
    return url.slice('local-video://'.length) || undefined;
  }
  return undefined;
}

function sanitizeComboVideo(
  combo: Combo,
  availableVideoIds: Set<string>,
): Combo {
  const videoId = getLocalVideoId(combo.demoUrl);
  if (!videoId || availableVideoIds.has(videoId)) return combo;
  return {
    ...combo,
    demoUrl: undefined,
    demoFileName: undefined,
    demoVideoTitle: undefined,
  };
}

export function normalizeBackupImport(
  data: BackupImportData,
  options: {
    includeSettings: boolean;
    videos: ResolvedBackupVideo[];
  },
): BackupImportPlan {
  const availableVideoIds = new Set(options.videos.map((video) => video.id));
  const plan: BackupImportPlan = {
    games: (data.games ?? []).map(normalizeGameNotationProfile),
    characters: data.characters ?? [],
    combos: (data.combos ?? []).map((combo) =>
      sanitizeComboVideo(combo, availableVideoIds),
    ),
    settings: options.includeSettings ? data.settings : undefined,
    videos: options.videos,
  };

  const gameIds = new Set(plan.games.map((game) => game.id));
  const characterIds = new Set(
    plan.characters.map((character) => character.id),
  );
  const orphanedCharacters = plan.characters.filter(
    (character) => !gameIds.has(character.gameId),
  );
  const orphanedCombos = plan.combos.filter(
    (combo) => !characterIds.has(combo.characterId),
  );
  if (orphanedCharacters.length > 0 || orphanedCombos.length > 0) {
    throw new Error(
      `Import has referential integrity issues: ${orphanedCharacters.length} orphaned characters, ${orphanedCombos.length} orphaned combos`,
    );
  }

  return plan;
}
