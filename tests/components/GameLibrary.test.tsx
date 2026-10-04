import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameLibrary } from '@/components/game/GameLibrary';
import type { Game } from '@/lib/types';
import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';
import { useAppStore } from '@/lib/store';

const { setSettingMock } = vi.hoisted(() => ({
  setSettingMock: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/storage/indexedDbStorage', () => ({
  indexedDbStorage: {
    games: {
      add: vi.fn().mockResolvedValue('new-game-id'),
      update: vi.fn().mockResolvedValue(undefined),
      setFavorite: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      bulkDelete: vi.fn().mockResolvedValue(undefined),
    },
    gameStats: {
      getInputs: vi.fn().mockResolvedValue({
        characters: [],
        combos: [],
      }),
    },
    settings: {
      update: vi.fn().mockResolvedValue(undefined),
    },
  },
  db: {
    characters: { toArray: vi.fn().mockResolvedValue([]) },
    combos: { toArray: vi.fn().mockResolvedValue([]) },
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
  }),
  useSettingsActions: vi.fn().mockReturnValue({
    setSetting: setSettingMock,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/components/game/CoverSearchDialog', () => ({
  CoverSearchDialog: () => null,
}));

const now = Date.now();

const mockGames: Game[] = [
  {
    id: 'game-1',
    name: 'Street Fighter 6',
    buttonLayout: ['L', 'M', 'H', 'S'],
    notationProfile: 'standard',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'game-2',
    name: 'Guilty Gear Strive',
    buttonLayout: ['P', 'K', 'S', 'H', 'D'],
    notationProfile: 'standard',
    createdAt: now - 1000,
    updatedAt: now - 1000,
  },
  {
    id: 'game-3',
    name: 'Tekken 8',
    buttonLayout: ['1', '2', '3', '4'],
    notationProfile: 'tekken',
    createdAt: now - 2000,
    updatedAt: now - 2000,
  },
];

describe('GameLibrary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.getState().resetSelection();
    setSettingMock.mockResolvedValue(true);
  });

  it('renders empty state when there are no games', () => {
    render(<GameLibrary games={[]} />);
    expect(screen.getByText('No Games Yet')).not.toBeNull();
    expect(
      screen.getByRole('button', { name: /add your first game/i }),
    ).not.toBeNull();
  });

  it('shows the library heading, total, and game cards', () => {
    render(<GameLibrary games={mockGames} />);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toMatch(/^Game Library\s*3$/);
    expect(screen.getByText('Street Fighter 6')).not.toBeNull();
    expect(screen.getByText('Guilty Gear Strive')).not.toBeNull();
    expect(screen.getByText('Tekken 8')).not.toBeNull();
  });

  it('finishes the first save when the library read updates before the write resolves', async () => {
    let finish!: (id: string) => void;
    const saved = new Promise<string>(resolve => { finish = resolve; });
    vi.mocked(indexedDbStorage.games.add).mockReturnValueOnce(saved);
    const user = userEvent.setup();
    const { rerender } = render(<GameLibrary games={[]} />);
    await user.click(screen.getByRole('button', { name: /add your first game/i }));
    const name = screen.getByLabelText('Game Name');
    fireEvent.change(name, { target: { value: mockGames[0].name } });
    fireEvent.submit(screen.getByRole('button', { name: 'Add Game' }).closest('form')!);
    rerender(<GameLibrary games={[mockGames[0]]} />);
    expect(screen.getByLabelText('Game Name')).toBe(name);
    expect(name.matches(':disabled')).toBe(true);
    await act(async () => { finish(mockGames[0].id); await saved; });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('pins favorite games ahead of the selected alphabetical sort', () => {
    render(
      <GameLibrary
        games={mockGames.map((game) => ({
          ...game,
          favorite: game.id === 'game-3',
        }))}
      />,
    );

    const names = screen
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent);
    expect(names).toEqual([
      'Tekken 8',
      'Guilty Gear Strive',
      'Street Fighter 6',
    ]);
  });

  it('favorites a game without navigating into it', async () => {
    const user = userEvent.setup();
    render(<GameLibrary games={mockGames} />);

    await user.click(
      screen.getByRole('button', {
        name: 'Add to favorites: Street Fighter 6',
      }),
    );

    expect(indexedDbStorage.games.setFavorite).toHaveBeenCalledWith(
      'game-1',
      true,
    );
    expect(useAppStore.getState().selectedGameId).toBeNull();
    expect(useAppStore.getState().selectedCharacterId).toBeNull();
  });

  it('places the favorite action before edit in list view', async () => {
    const user = userEvent.setup();
    render(<GameLibrary games={mockGames} />);

    await user.click(screen.getByRole('button', { name: /view/i }));
    await user.click(screen.getByRole('button', { name: 'List' }));
    await user.keyboard('{Escape}');

    const favorite = screen.getByRole('button', {
      name: 'Add to favorites: Street Fighter 6',
    });
    const edit = screen.getByRole('button', {
      name: 'Edit Street Fighter 6',
    });
    expect(
      favorite.compareDocumentPosition(edit) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('uses native validation when adding a game without a name', async () => {
    const user = userEvent.setup();

    render(<GameLibrary games={mockGames} />);

    await user.click(screen.getByRole('button', { name: /add game/i }));
    const nameInput = screen.getByLabelText(/game name/i);
    await user.clear(nameInput);
    await user.click(screen.getByRole('button', { name: /^add game$/i }));

    expect((nameInput as HTMLInputElement).checkValidity()).toBe(false);
    expect(indexedDbStorage.games.add).not.toHaveBeenCalled();
  });

  it('filters games by search text', async () => {
    const user = userEvent.setup();
    render(<GameLibrary games={mockGames} />);

    const searchInput = screen.getByPlaceholderText('Search games...');
    await user.type(searchInput, 'tekken');

    expect(screen.getByText('Tekken 8')).not.toBeNull();
    expect(screen.queryByText('Street Fighter 6')).toBeNull();
    expect(screen.queryByText('Guilty Gear Strive')).toBeNull();
  });

  it('supports multi-select bulk delete for games', async () => {
    const user = userEvent.setup();
    render(<GameLibrary games={mockGames} />);

    await user.click(screen.getByRole('button', { name: /more options/i }));
    await user.click(screen.getByText('Select Games'));
    await user.click(screen.getByRole('button', { name: /select all/i }));
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    await user.click(
      screen.getByRole('button', { name: /delete selected \(3\)/i }),
    );

    expect(indexedDbStorage.games.bulkDelete).toHaveBeenCalledTimes(1);
    expect(indexedDbStorage.games.bulkDelete).toHaveBeenCalledWith(
      expect.arrayContaining(['game-1', 'game-2', 'game-3']),
    );
  });
});
