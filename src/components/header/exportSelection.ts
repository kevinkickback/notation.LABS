import {
  type BackupRecords,
  closeBackupSelection,
} from '@/lib/backup/selectionClosure';
import type { Character, Combo } from '@/lib/types';

type ExportNodeKind = 'game' | 'character' | 'combo';

export interface ExportSelection {
  records: BackupRecords;
  charactersByGame: Map<string, Character[]>;
  combosByCharacter: Map<string, Combo[]>;
  leavesByNode: Map<string, string[]>;
  leaves: Set<string>;
  selected: ReadonlySet<string>;
}

function nodeKey(kind: ExportNodeKind, id: string) {
  return `${kind}:${id}`;
}

/** Only leaves are selected. Empty games and characters are leaves in their own right. */
export function createExportSelection(records: BackupRecords): ExportSelection {
  const charactersByGame = new Map<string, Character[]>();
  const combosByCharacter = new Map<string, Combo[]>();
  for (const character of records.characters) {
    const children = charactersByGame.get(character.gameId) ?? [];
    children.push(character);
    charactersByGame.set(character.gameId, children);
  }
  for (const combo of records.combos) {
    const children = combosByCharacter.get(combo.characterId) ?? [];
    children.push(combo);
    combosByCharacter.set(combo.characterId, children);
  }

  const leavesByNode = new Map<string, string[]>();
  for (const combo of records.combos) {
    const key = nodeKey('combo', combo.id);
    leavesByNode.set(key, [key]);
  }
  for (const character of records.characters) {
    const key = nodeKey('character', character.id);
    const combos = combosByCharacter.get(character.id) ?? [];
    leavesByNode.set(
      key,
      combos.length ? combos.map((combo) => nodeKey('combo', combo.id)) : [key],
    );
  }
  const leaves = new Set<string>();
  for (const game of records.games) {
    const key = nodeKey('game', game.id);
    const characters = charactersByGame.get(game.id) ?? [];
    const children = characters.length
      ? characters.flatMap(
          (character) =>
            leavesByNode.get(nodeKey('character', character.id)) ?? [],
        )
      : [key];
    leavesByNode.set(key, children);
    for (const leaf of children) leaves.add(leaf);
  }
  return {
    records,
    charactersByGame,
    combosByCharacter,
    leavesByNode,
    leaves,
    selected: new Set(leaves),
  };
}

export function getExportCheckState(
  selection: ExportSelection,
  kind: ExportNodeKind,
  id: string,
): boolean | 'indeterminate' {
  const leaves = selection.leavesByNode.get(nodeKey(kind, id)) ?? [];
  const count = leaves.filter((leaf) => selection.selected.has(leaf)).length;
  if (count === 0) return false;
  return count === leaves.length ? true : 'indeterminate';
}

export function toggleExportNode(
  selection: ExportSelection,
  kind: ExportNodeKind,
  id: string,
): ExportSelection {
  const leaves = selection.leavesByNode.get(nodeKey(kind, id));
  if (!leaves) return selection;
  const selected = new Set(selection.selected);
  const include = getExportCheckState(selection, kind, id) !== true;
  for (const leaf of leaves) {
    if (include) selected.add(leaf);
    else selected.delete(leaf);
  }
  return { ...selection, selected };
}

export function getSelectedExportRecords(
  selection: ExportSelection,
): BackupRecords {
  const { records, selected } = selection;
  return closeBackupSelection(records, {
    gameIds: records.games
      .filter((game) => selected.has(nodeKey('game', game.id)))
      .map((game) => game.id),
    characterIds: records.characters
      .filter((character) => selected.has(nodeKey('character', character.id)))
      .map((character) => character.id),
    comboIds: records.combos
      .filter((combo) => selected.has(nodeKey('combo', combo.id)))
      .map((combo) => combo.id),
  });
}
