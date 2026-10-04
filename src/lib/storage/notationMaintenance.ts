import { parseComboRecords } from '@/lib/comboParsing';
import { DEFAULT_SETTINGS } from '@/lib/defaults';
import { COMBO_NOTATION_PARSER_VERSION } from '@/lib/parser';
import type { Combo } from '@/lib/types';
import { db } from './database';
import { recordBatches } from './recordBatches';

export interface ReparseLifecycle {
  onReparseStart?: () => void;
  onReparseEnd?: () => void;
}

/** Resolve one record's current parents, without retaining all covers or notes. */
export async function parseStoredCombo(combo: Combo): Promise<Combo> {
  const character = await db.characters.get(combo.characterId);
  const game = character ? await db.games.get(character.gameId) : undefined;
  return parseComboRecords(
    [combo],
    game ? [game] : [],
    character ? [character] : [],
  )[0];
}

/** Call within the transaction that changed the parent records. */
export async function reparseCombosForCharacters(
  characterIds: string[],
  alreadyParsedIds = new Set<string>(),
): Promise<void> {
  if (!characterIds.length) return;
  const affected = new Set(characterIds);
  for await (const batch of recordBatches(db.combos)) {
    const changed: Combo[] = [];
    for (const combo of batch)
      if (affected.has(combo.characterId) && !alreadyParsedIds.has(combo.id))
        changed.push(await parseStoredCombo(combo));
    if (changed.length) await db.combos.bulkPut(changed);
  }
}

export async function reparseCombosForGame(gameId: string): Promise<void> {
  await reparseCombosForCharacters(
    await db.characters.where('gameId').equals(gameId).primaryKeys(),
  );
}

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
        for await (const batch of recordBatches(db.combos)) {
          const parsed: Combo[] = [];
          for (const combo of batch) parsed.push(await parseStoredCombo(combo));
          await db.combos.bulkPut(parsed);
        }
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
