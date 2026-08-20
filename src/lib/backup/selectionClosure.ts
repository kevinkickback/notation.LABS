import type { Character, Combo, Game } from '@/lib/types';

export interface BackupFilter {
  gameIds?: string[];
  characterIds?: string[];
  comboIds?: string[];
}

interface BackupRecords {
  games: Game[];
  characters: Character[];
  combos: Combo[];
}

export function closeBackupSelection(
  records: BackupRecords,
  filter?: BackupFilter,
): BackupRecords {
  if (!filter) return records;

  const requestedGameIds = new Set(filter.gameIds ?? []);
  const requestedCharacterIds = new Set(filter.characterIds ?? []);
  const requestedComboIds = new Set(filter.comboIds ?? []);
  const hasGameFilter = filter.gameIds !== undefined;
  const hasCharacterFilter = filter.characterIds !== undefined;
  const hasComboFilter = filter.comboIds !== undefined;

  const characterById = new Map(
    records.characters.map((character) => [character.id, character]),
  );

  const selectedGameIds = hasGameFilter ? requestedGameIds : new Set<string>();
  const selectedCharacterIds = hasCharacterFilter
    ? requestedCharacterIds
    : hasGameFilter
      ? new Set(
          records.characters
            .filter((character) => selectedGameIds.has(character.gameId))
            .map((character) => character.id),
        )
      : new Set<string>();
  const selectedComboIds = hasComboFilter
    ? requestedComboIds
    : hasCharacterFilter || hasGameFilter
      ? new Set(
          records.combos
            .filter((combo) => selectedCharacterIds.has(combo.characterId))
            .map((combo) => combo.id),
        )
      : new Set(records.combos.map((combo) => combo.id));

  if (!hasGameFilter && !hasCharacterFilter && !hasComboFilter) {
    return records;
  }

  for (const combo of records.combos) {
    if (selectedComboIds.has(combo.id)) {
      selectedCharacterIds.add(combo.characterId);
    }
  }
  for (const characterId of selectedCharacterIds) {
    const character = characterById.get(characterId);
    if (character) selectedGameIds.add(character.gameId);
  }

  return {
    games: records.games.filter((game) => selectedGameIds.has(game.id)),
    characters: records.characters.filter((character) =>
      selectedCharacterIds.has(character.id),
    ),
    combos: records.combos.filter((combo) => selectedComboIds.has(combo.id)),
  };
}
