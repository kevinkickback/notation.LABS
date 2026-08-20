import { parseComboNotation } from '@/lib/parser';
import {
  type DemoVideo,
  getLocalVideoId,
  indexedDbStorage,
} from '@/lib/storage/indexedDbStorage';
import type { Combo, Game } from '@/lib/types';

export type ComboEditableInput = Omit<
  Combo,
  | 'id'
  | 'characterId'
  | 'parsedNotation'
  | 'sortOrder'
  | 'createdAt'
  | 'updatedAt'
>;
export type CreateComboInput = ComboEditableInput & { characterId: string };
export type UpdateComboInput = Partial<ComboEditableInput>;

async function getComboGame(characterId: string): Promise<Game> {
  const character = await indexedDbStorage.characters.get(characterId);
  if (!character) {
    throw new Error(`Character "${characterId}" was not found`);
  }

  const game = await indexedDbStorage.games.get(character.gameId);
  if (!game) {
    throw new Error(`Game "${character.gameId}" was not found`);
  }
  return game;
}

function deriveParsedNotation(notation: string, game: Game) {
  return parseComboNotation(notation, game.buttonLayout, {
    profile: game.notationProfile,
  });
}

export async function createCombo(
  input: CreateComboInput,
  video?: DemoVideo,
): Promise<string> {
  const game = await getComboGame(input.characterId);
  return indexedDbStorage.combos.addWithVideo(
    {
      ...input,
      parsedNotation: deriveParsedNotation(input.notation, game),
    },
    video,
  );
}

export async function updateCombo(
  comboId: string,
  updates: UpdateComboInput,
  video?: DemoVideo,
): Promise<void> {
  const combo = await indexedDbStorage.combos.get(comboId);
  if (!combo) {
    throw new Error(`Combo "${comboId}" was not found`);
  }

  const game = await getComboGame(combo.characterId);
  const notation = updates.notation ?? combo.notation;
  return indexedDbStorage.combos.updateWithVideo(
    comboId,
    {
      ...updates,
      parsedNotation: deriveParsedNotation(notation, game),
    },
    video,
  );
}

export function duplicateCombo(combo: Combo): Promise<string> {
  return createCombo({
    characterId: combo.characterId,
    name: `${combo.name} (copy)`,
    notation: combo.notation,
    description: combo.description,
    difficulty: combo.difficulty,
    damage: combo.damage,
    meterCost: combo.meterCost,
    tags: combo.tags,
    demoUrl: getLocalVideoId(combo.demoUrl) ? undefined : combo.demoUrl,
    demoFileName: combo.demoFileName,
    demoVideoTitle: combo.demoVideoTitle,
    notes: combo.notes,
    outdated: combo.outdated,
  });
}

export function deleteCombo(comboId: string): Promise<void> {
  return indexedDbStorage.combos.delete(comboId);
}

export function deleteCombos(comboIds: string[]): Promise<void> {
  return indexedDbStorage.combos.bulkDelete(comboIds);
}

export function markCombosOutdated(
  comboIds: string[],
  outdated: boolean,
): Promise<void> {
  return indexedDbStorage.combos.markOutdated(comboIds, outdated);
}

export function reorderCombos(comboIds: string[]): Promise<void> {
  return indexedDbStorage.combos.reorder(comboIds);
}
