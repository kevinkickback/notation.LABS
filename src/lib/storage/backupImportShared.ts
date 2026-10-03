import type { BackupImportPlan } from '@/lib/backup/importPipeline';
import { haveSameGameNotation } from '@/lib/comboParsing';
import { COMBO_NOTATION_PARSER_VERSION } from '@/lib/parser';
import { db } from './database';
import {
  ensureCurrentNotation,
  reparseCombosForCharacters,
} from './notationMaintenance';
import {
  normalizeNotebookSettings,
  settingsRepository,
} from './settingsRepository';

export async function applyBackupImportPlan(
  plan: BackupImportPlan,
): Promise<void> {
  await db.transaction(
    'rw',
    [db.games, db.characters, db.combos, db.settings, db.demoVideos],
    async () => {
      const [savedSettings, previousGames, previousCharacters] =
        await Promise.all([
          db.settings.get(1),
          db.games.bulkGet(plan.games.map((game) => game.id)),
          db.characters.bulkGet(
            plan.characters.map((character) => character.id),
          ),
        ]);
      const changedGameIds = plan.games
        .filter(
          (game, index) =>
            !previousGames[index] ||
            !haveSameGameNotation(previousGames[index], game),
        )
        .map((game) => game.id);
      const changedCharacterIds = plan.characters
        .filter(
          (character, index) =>
            previousCharacters[index]?.gameId !== character.gameId,
        )
        .map((character) => character.id);
      await db.games.bulkPut(plan.games);
      await db.characters.bulkPut(plan.characters);
      if (plan.combos.length > 0) await db.combos.bulkPut(plan.combos);
      if (plan.settings)
        await db.settings.put({
          ...(await normalizeNotebookSettings(plan.settings)),
          id: 1,
          // This is a local maintenance marker, not a preference supplied by a backup.
          parsedNotationVersion: savedSettings?.parsedNotationVersion ?? 0,
        });
      await db.demoVideos.bulkPut(plan.videos);
      await settingsRepository.init();
      if (
        savedSettings?.parsedNotationVersion === COMBO_NOTATION_PARSER_VERSION
      ) {
        const affectedCharacters =
          changedGameIds.length > 0
            ? await db.characters
                .where('gameId')
                .anyOf(changedGameIds)
                .primaryKeys()
            : [];
        await reparseCombosForCharacters(
          [...new Set([...changedCharacterIds, ...affectedCharacters])],
          new Set(plan.combos.map((combo) => combo.id)),
        );
      } else {
        // Older libraries still need one complete migration, inside the import transaction.
        await ensureCurrentNotation();
      }
    },
  );
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}
