import { act, fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ColorCustomization } from '@/components/settings/ColorCustomization';
import { DEFAULT_SETTINGS } from '@/lib/defaults';
import type { Game } from '@/lib/types';

const mocks = vi.hoisted(() => ({ getGames: vi.fn(), setSetting: vi.fn() }));
vi.mock('@/context/SettingsContext', () => ({
  useSettings: () => DEFAULT_SETTINGS,
  useSettingsActions: () => ({ setSetting: mocks.setSetting }),
}));
vi.mock('@/lib/application/gameCommands', () => ({
  getGames: mocks.getGames,
  updateGame: vi.fn(),
}));

it('keeps an unfinished separator color through game loading and independent button edits', async () => {
  let finishLoading!: (games: Game[]) => void;
  mocks.getGames.mockReturnValue(new Promise<Game[]>(resolve => { finishLoading = resolve; }));
  const onUnsavedChangesChange = vi.fn();
  render(<ColorCustomization onUnsavedChangesChange={onUnsavedChangesChange} />);
  const separator = screen.getByRole('textbox', { name: 'Separator color hex' });
  fireEvent.change(separator, { target: { value: '#445566' } });
  await act(async () => finishLoading([{
    id: 'game', name: 'Game with a separator-named button', notationProfile: 'standard', buttonLayout: ['separator'],
    buttonColors: { separator: '#123456' }, createdAt: 0, updatedAt: 0,
  }]));
  expect((separator as HTMLInputElement).value).toBe('#445566');
  fireEvent.blur(separator);
  expect(onUnsavedChangesChange).toHaveBeenLastCalledWith(true);
  const button = screen.getByRole('textbox', { name: 'separator button color hex' });
  fireEvent.change(button, { target: { value: '#abcdef' } });
  fireEvent.blur(button);
  expect((button as HTMLInputElement).value).toBe('#abcdef');
  expect((separator as HTMLInputElement).value).toBe('#445566');
});
