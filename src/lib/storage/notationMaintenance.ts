import { parseComboRecords } from '@/lib/comboParsing';
import { DEFAULT_SETTINGS } from '@/lib/defaults';
import { COMBO_NOTATION_PARSER_VERSION } from '@/lib/parser';
import { db } from './database';
import { toUniqueIds } from './repositoryUtils';

export interface ReparseLifecycle {
  onReparseStart?: () => void;
  onReparseEnd?: () => void;
}

/** Call within the transaction that changed the parent records. */
export async function reparseCombosForCharacters(
  characterIds: string[],
  alreadyParsedIds = new Set<string>(),
): Promise<void> {
  if (characterIds.length === 0) return;
  const [characters, candidates] = await Promise.all([
    db.characters.where('id').anyOf(characterIds).toArray(),
    db.combos.where('characterId').anyOf(characterIds).toArray(),
  ]);
  const combos = candidates.filter((combo) => !alreadyParsedIds.has(combo.id));
  if (combos.length === 0) return;
  const games = await db.games
    .where('id')
    .anyOf(toUniqueIds(characters.map((character) => character.gameId)))
    .toArray();
  await db.combos.bulkPut(parseComboRecords(combos, games, characters));
}

export async function reparseCombosForGame(gameId: string): Promise<void> {
  const characterIds = await db.characters
    .where('gameId')
    .equals(gameId)
    .primaryKeys();
  await reparseCombosForCharacters(characterIds);
}

/** Publish new tokens and their version together, including retries after a failed write. */
export async function ensureCurrentNotation(
  lifecycle?: ReparseLifecycle,
): Promise<void> {
  let started = false;
  try {
    await db.transaction(
      'rw',
      [db.games, db.characters, db.combos, db.settings],
      async () => {
        const settings = await db.settings.get(1);
        if (settings?.parsedNotationVersion === COMBO_NOTATION_PARSER_VERSION)
          return;
        started = true;
        lifecycle?.onReparseStart?.();
        const [games, characters, combos] = await Promise.all([
          db.games.toArray(),
          db.characters.toArray(),
          db.combos.toArray(),
        ]);
        if (combos.length > 0)
          await db.combos.bulkPut(parseComboRecords(combos, games, characters));
        await db.settings.put({
          ...DEFAULT_SETTINGS,
          ...settings,
          id: 1,
          parsedNotationVersion: COMBO_NOTATION_PARSER_VERSION,
        });
      },
    );
  } finally {
    if (started) lifecycle?.onReparseEnd?.();
  }
}
