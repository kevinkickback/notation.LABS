import { parseComboRecords } from '@/lib/comboParsing';
import { normalizeGameNotationProfile } from '@/lib/notationProfiles';
import { sanitizeImportedVideoReference } from '@/lib/storage/videoReferences';
import type {
  BackupImportData,
  Character,
  Combo,
  Game,
  UserSettings,
} from '@/lib/types';
import type { VideoReference } from './archiveContract';

export interface ResolvedBackupVideo {
  id: string;
  data: ArrayBuffer | Blob;
  mimeType: string;
  fileName: string;
}

export interface BackupImportPlan {
  games: Game[];
  characters: Character[];
  combos: Combo[];
  settings?: UserSettings;
  videos: (ResolvedBackupVideo | VideoReference)[];
  sessionId?: string;
}

export function normalizeBackupImport(
  data: BackupImportData,
  options: {
    includeSettings: boolean;
    videos: (ResolvedBackupVideo | VideoReference)[];
    sessionId?: string;
  },
): BackupImportPlan {
  const availableVideoIds = new Set(options.videos.map((video) => video.id));
  const plan: BackupImportPlan = {
    games: (data.games ?? []).map(normalizeGameNotationProfile),
    characters: data.characters ?? [],
    combos: (data.combos ?? []).map((combo) =>
      sanitizeImportedVideoReference(combo, availableVideoIds),
    ),
    settings: options.includeSettings ? data.settings : undefined,
    videos: options.videos,
    sessionId: options.sessionId,
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

  return {
    ...plan,
    combos: parseComboRecords(plan.combos, plan.games, plan.characters),
  };
}
