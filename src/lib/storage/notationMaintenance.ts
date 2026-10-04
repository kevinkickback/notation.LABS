import { parseComboRecords } from '@/lib/comboParsing';
import { DEFAULT_SETTINGS } from '@/lib/defaults';
import { COMBO_NOTATION_PARSER_VERSION } from '@/lib/parser';
import type { Combo, Game } from '@/lib/types';
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
  const games = new Map<
    string,
    Pick<Game, 'id' | 'buttonLayout' | 'notationProfile'> | undefined
  >();
  for (const characterId of new Set(characterIds)) {
    const character = await db.characters.get(characterId);
    if (character && !games.has(character.gameId)) {
      const game = await db.games.get(character.gameId);
      games.set(
        character.gameId,
        game
          ? {
              id: game.id,
              buttonLayout: game.buttonLayout,
              notationProfile: game.notationProfile,
            }
          : undefined,
      );
    }
    const game = character ? games.get(character.gameId) : undefined;
    for await (const batch of recordBatches(db.combos, {
      index: 'characterId',
      value: characterId,
    })) {
      const changed = parseComboRecords(
        batch.filter((combo) => !alreadyParsedIds.has(combo.id)),
        game ? [game] : [],
        character ? [{ id: character.id, gameId: character.gameId }] : [],
      );
      if (changed.length) await db.combos.bulkPut(changed);
    }
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
