import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameFormDialog } from '@/components/game/GameFormDialog';
import { CharacterFormDialog } from '@/components/character/CharacterFormDialog';
import { ComboFormDialog } from '@/components/combo/ComboFormDialog';
import { DEFAULT_SETTINGS } from '@/lib/defaults';
import type { Character, Combo, Game } from '@/lib/types';

const mocks = vi.hoisted(() => ({ createGame: vi.fn(), updateGame: vi.fn(), createCharacter: vi.fn(), updateCharacter: vi.fn(), createCombo: vi.fn(), updateCombo: vi.fn(), report: vi.fn(), error: vi.fn(), success: vi.fn() }));
vi.mock('@/lib/application/gameCommands', () => ({ createGame: mocks.createGame, updateGame: mocks.updateGame }));
vi.mock('@/lib/application/characterCommands', () => ({ createCharacter: mocks.createCharacter, updateCharacter: mocks.updateCharacter }));
vi.mock('@/lib/application/comboCommands', () => ({ createCombo: mocks.createCombo, updateCombo: mocks.updateCombo }));
vi.mock('@/components/game/CoverSearchDialog', () => ({ CoverSearchDialog: () => null }));
vi.mock('@/components/character/CharacterSearchDialog', () => ({ CharacterSearchDialog: () => null }));
vi.mock('@/context/SettingsContext', () => ({ useSettings: () => DEFAULT_SETTINGS }));
vi.mock('@/lib/storage/indexedDbStorage', () => ({ getLocalVideoId: () => null, generateId: () => 'video' }));
vi.mock('@/lib/errors', () => ({ reportError: mocks.report }));
vi.mock('sonner', () => ({ toast: { success: mocks.success, error: mocks.error, warning: vi.fn() } }));

const game: Game = { id: 'game', name: 'Game', notationProfile: 'standard', buttonLayout: ['A'], createdAt: 1, updatedAt: 1 };
const character: Character = { id: 'character', gameId: game.id, name: 'Fighter', createdAt: 1, updatedAt: 1 };
const combo: Combo = { id: 'combo', characterId: character.id, name: 'Route', notation: 'A', parsedNotation: [], tags: ['rock,paper', 'corner'], difficulty: 3, damage: '100', meterCost: '1', sortOrder: 0, createdAt: 1, updatedAt: 1 };
const cases = [
  { kind: 'game', label: 'Game Name', save: 'Add Game', write: mocks.createGame },
  { kind: 'character', label: 'Character Name', save: 'Add Character', write: mocks.createCharacter },
  { kind: 'combo', label: 'Combo Name', save: 'Add Combo', write: mocks.createCombo },
] as const;
type Kind = typeof cases[number]['kind'];

function editor(kind: Kind, open: boolean, onOpenChange: (open: boolean) => void) {
  if (kind === 'game') return <GameFormDialog open={open} onOpenChange={onOpenChange} editingGame={null} />;
  if (kind === 'character') return <CharacterFormDialog open={open} onOpenChange={onOpenChange} game={game} editingCharacter={null} />;
  return <ComboFormDialog open={open} onOpenChange={onOpenChange} game={game} character={character} editingCombo={null} allTags={[]} />;
}
function fill(kind: Kind, label: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value: 'New record' } });
  if (kind === 'combo') fireEvent.change(screen.getByLabelText('Notation'), { target: { value: 'A' } });
}

describe('persisted editor saves', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.createGame.mockResolvedValue('new-game');
    mocks.createCharacter.mockResolvedValue('new-character');
    mocks.createCombo.mockResolvedValue('new-combo');
    mocks.updateCombo.mockResolvedValue(undefined);
  });

  it.each(cases)('blocks duplicate $kind saves and keeps a reopened editor open after the old save completes', async ({ kind, label, save, write }) => {
    let finish!: (id: string) => void;
    const saved = new Promise<string>(resolve => { finish = resolve; });
    write.mockReturnValueOnce(saved);
    const close = vi.fn();
    const { rerender } = render(editor(kind, true, close));
    fill(kind, label);
    const button = screen.getByRole('button', { name: save }) as HTMLButtonElement;
    const form = button.closest('form')!;
    act(() => { fireEvent.submit(form); fireEvent.submit(form); });
    expect(write).toHaveBeenCalledOnce();
    if (kind === 'game') {
      const payload = mocks.createGame.mock.calls[0][0] as { buttonColors: Record<string, string> };
      expect(Object.keys(payload.buttonColors)).toEqual(['L', 'M', 'H', 'S']);
    }
    expect(button.disabled).toBe(true);
    expect(form.getAttribute('aria-busy')).toBe('true');
    expect(screen.getByLabelText(label).matches(':disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Cancel' }).matches(':disabled')).toBe(false);
    rerender(editor(kind, false, close));
    rerender(editor(kind, true, close));
    expect((screen.getByLabelText(label) as HTMLInputElement).value).toBe('');
    await act(async () => { finish('saved'); await saved; });
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: save })).toBeTruthy();
    expect(screen.getByLabelText(label).matches(':disabled')).toBe(false);
    fill(kind, label);
    await act(async () => fireEvent.submit(screen.getByRole('button', { name: save }).closest('form')!));
    expect(write).toHaveBeenCalledTimes(2);
    expect(close).toHaveBeenCalledWith(false);
  });

  it.each(cases)('preserves the $kind draft and allows retry after a failed save', async ({ kind, label, save, write }) => {
    write.mockRejectedValueOnce(new Error('storage unavailable'));
    const close = vi.fn();
    render(editor(kind, true, close));
    fill(kind, label);
    await act(async () => fireEvent.submit(screen.getByRole('button', { name: save }).closest('form')!));
    expect(mocks.error).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
    expect((screen.getByLabelText(label) as HTMLInputElement).value).toBe('New record');
    expect(screen.getByLabelText(label).matches(':disabled')).toBe(false);
    await act(async () => fireEvent.submit(screen.getByRole('button', { name: save }).closest('form')!));
    expect(write).toHaveBeenCalledTimes(2);
    expect(close).toHaveBeenCalledWith(false);
  });

  it('preserves comma-containing tags and other combo fields through an edit', async () => {
    render(<ComboFormDialog open onOpenChange={vi.fn()} game={game} character={character} editingCombo={combo} allTags={combo.tags} />);
    expect(screen.getByText('rock,paper', { exact: true })).toBeTruthy();
    await act(async () => fireEvent.submit(screen.getByRole('button', { name: 'Update Combo' }).closest('form')!));
    expect(mocks.updateCombo).toHaveBeenCalledWith(combo.id, expect.objectContaining({ tags: ['rock,paper', 'corner'], difficulty: 3, damage: '100', meterCost: '1', name: combo.name, notation: combo.notation }), undefined);
  });
});
