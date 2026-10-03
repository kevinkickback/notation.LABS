import { describe, expect, it } from 'vitest';
import { createExportSelection, getExportCheckState, getSelectedExportRecords, toggleExportNode } from '@/components/header/exportSelection';
import type { BackupRecords } from '@/lib/backup/selectionClosure';

const records: BackupRecords = {
  games: ['mixed', 'empty'].map(id => ({ id, name: id, notationProfile: 'standard', buttonLayout: [], createdAt: 1, updatedAt: 1 })),
  characters: ['active', 'empty-fighter'].map(id => ({ id, gameId: 'mixed', name: id, createdAt: 1, updatedAt: 1 })),
  combos: ['first', 'second'].map(id => ({ id, characterId: 'active', name: id, notation: 'A', parsedNotation: [], tags: [], sortOrder: 0, createdAt: 1, updatedAt: 1 })),
};

function selectedIds(selection: ReturnType<typeof createExportSelection>) {
  const selected = getSelectedExportRecords(selection);
  return { games: selected.games.map(game => game.id), characters: selected.characters.map(character => character.id), combos: selected.combos.map(combo => combo.id) };
}

describe('export tree selection', () => {
  it('selects all records, including empty games and characters, by default', () => {
    const selection = createExportSelection(records);
    expect(getSelectedExportRecords(selection)).toEqual(records);
    expect(getExportCheckState(selection, 'game', 'mixed')).toBe(true);
    expect(getExportCheckState(selection, 'game', 'empty')).toBe(true);
  });

  it('includes an empty character in its game check state when other characters have combos', () => {
    const selection = toggleExportNode(createExportSelection(records), 'character', 'empty-fighter');
    expect(getExportCheckState(selection, 'game', 'mixed')).toBe('indeterminate');
    expect(getExportCheckState(selection, 'character', 'active')).toBe(true);
    expect(selectedIds(selection).characters).toEqual(['active']);
  });

  it('selects all children from a partial checkbox and deselects all from a checked checkbox', () => {
    const partial = toggleExportNode(createExportSelection(records), 'combo', 'first');
    expect(getExportCheckState(partial, 'character', 'active')).toBe('indeterminate');
    const all = toggleExportNode(partial, 'game', 'mixed');
    expect(getExportCheckState(all, 'game', 'mixed')).toBe(true);
    const none = toggleExportNode(all, 'game', 'mixed');
    expect(selectedIds(none)).toEqual({ games: ['empty'], characters: [], combos: [] });
  });

  it('derives required parents for selected combos without including siblings', () => {
    const none = { ...createExportSelection(records), selected: new Set<string>() };
    const selection = toggleExportNode(none, 'combo', 'second');
    expect(selectedIds(selection)).toEqual({ games: ['mixed'], characters: ['active'], combos: ['second'] });
    expect(getExportCheckState(selection, 'game', 'mixed')).toBe('indeterminate');
    expect(selection.selected.size).toBe(1);
    expect(none.selected.size).toBe(0);
  });

  it('exports an empty character and its game without unrelated combos', () => {
    const none = { ...createExportSelection(records), selected: new Set<string>() };
    const selection = toggleExportNode(none, 'character', 'empty-fighter');
    expect(selectedIds(selection)).toEqual({ games: ['mixed'], characters: ['empty-fighter'], combos: [] });
    expect(getExportCheckState(selection, 'character', 'empty-fighter')).toBe(true);
  });

  it('does not confuse identical IDs in different entity tables', () => {
    const shared = { games: records.games.slice(0, 1), characters: [{ ...records.characters[0], id: 'mixed' }], combos: [{ ...records.combos[0], id: 'mixed', characterId: 'mixed' }] };
    const all = createExportSelection(shared);
    const none = toggleExportNode(all, 'combo', 'mixed');
    expect(none.selected.size).toBe(0);
    expect(getExportCheckState(none, 'game', 'mixed')).toBe(false);
    expect(getSelectedExportRecords(toggleExportNode(none, 'game', 'mixed'))).toEqual(shared);
  });

  it('returns an empty selection for an empty library and ignores unknown nodes', () => {
    const selection = createExportSelection({ games: [], characters: [], combos: [] });
    expect(selectedIds(selection)).toEqual({ games: [], characters: [], combos: [] });
    expect(getExportCheckState(selection, 'game', 'missing')).toBe(false);
    expect(toggleExportNode(selection, 'game', 'missing')).toBe(selection);
  });
});
