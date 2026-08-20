import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CharacterView } from '@/components/character/CharacterView';
import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';
import type { Character, Game } from '@/lib/types';

const { setSettingMock } = vi.hoisted(() => ({
  setSettingMock: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/storage/indexedDbStorage', () => ({
  indexedDbStorage: {
    characters: {
      setFavorite: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      bulkDelete: vi.fn().mockResolvedValue(undefined),
    },
    combos: {
      getByCharacters: vi.fn().mockResolvedValue([]),
    },
    settings: {
      update: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: vi.fn().mockReturnValue([]),
}));

vi.mock('@/context/SettingsContext', () => ({
  useSettings: vi.fn().mockReturnValue({
    colorTheme: 'dark',
    fontFamily: 'system-ui',
    notationColors: { direction: '#fff', separator: '#ccc' },
    displayMode: 'colored-text',
    iconStyle: 'round',
    comboScale: 1,
    autoUpdate: true,
    confirmBeforeDelete: true,
    videoPlayerSize: 'lg',
    gameCardSize: 180,
    characterCardSize: 180,
    notesDefaultOpen: false,
  }),
  useSettingsActions: vi.fn().mockReturnValue({
    setSetting: setSettingMock,
  }),
}));

vi.mock('@/hooks/useIsMobile', () => ({
  useIsMobile: vi.fn().mockReturnValue(false),
}));

vi.mock('@/hooks/useNotesOverride', () => ({
  useNotesOverride: vi.fn().mockReturnValue([false, vi.fn()]),
}));

vi.mock('@/components/character/CharacterFormDialog', () => ({
  CharacterFormDialog: () => null,
}));

vi.mock('@/components/shared/ButtonColorDialog', () => ({
  ButtonColorDialog: () => null,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/errors', () => ({ reportError: vi.fn() }));

const now = Date.now();

const mockGame: Game = {
  id: 'game-1',
  name: 'Street Fighter 6',
  buttonLayout: ['L', 'M', 'H', 'S'],
  notationProfile: 'standard',
  createdAt: now,
  updatedAt: now,
};

const mockCharacters: Character[] = [
  {
    id: 'char-1',
    gameId: 'game-1',
    name: 'Ryu',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'char-2',
    gameId: 'game-1',
    name: 'Ken',
    createdAt: now - 1000,
    updatedAt: now - 1000,
  },
];

describe('CharacterView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSettingMock.mockResolvedValue(true);
  });

  it('pins favorite characters ahead of the selected alphabetical sort', () => {
    render(
      <CharacterView
        game={mockGame}
        characters={mockCharacters.map((character) => ({
          ...character,
          favorite: character.id === 'char-1',
        }))}
      />,
    );

    const names = screen
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent);
    expect(names).toEqual(['Ryu', 'Ken']);
  });

  it('removes a character from favorites without selecting the card', async () => {
    const user = userEvent.setup();
    render(
      <CharacterView
        game={mockGame}
        characters={mockCharacters.map((character) => ({
          ...character,
          favorite: character.id === 'char-1',
        }))}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: 'Remove from favorites: Ryu' }),
    );

    expect(indexedDbStorage.characters.setFavorite).toHaveBeenCalledWith(
      'char-1',
      false,
    );
  });

  it('supports multi-select bulk delete for characters', async () => {
    const user = userEvent.setup();
    render(<CharacterView game={mockGame} characters={mockCharacters} />);

    await user.click(screen.getByRole('button', { name: /more options/i }));
    await user.click(screen.getByText('Select Characters'));
    await user.click(screen.getByRole('button', { name: /select all/i }));
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    await user.click(
      screen.getByRole('button', { name: /delete selected \(2\)/i }),
    );

    expect(indexedDbStorage.characters.bulkDelete).toHaveBeenCalledWith([
      'char-1',
      'char-2',
    ]);
    expect(indexedDbStorage.characters.delete).not.toHaveBeenCalled();
  });

  it('preserves the bulk selection and confirmation when deletion fails', async () => {
    vi.mocked(indexedDbStorage.characters.bulkDelete).mockRejectedValueOnce(
      new Error('write failed'),
    );
    const user = userEvent.setup();
    render(<CharacterView game={mockGame} characters={mockCharacters} />);

    await user.click(screen.getByRole('button', { name: /more options/i }));
    await user.click(screen.getByText('Select Characters'));
    await user.click(screen.getByRole('button', { name: /select all/i }));
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    await user.click(
      screen.getByRole('button', { name: /delete selected \(2\)/i }),
    );

    expect(
      screen.getByRole('button', { name: /delete selected \(2\)/i }),
    ).not.toBeNull();
  });
});
