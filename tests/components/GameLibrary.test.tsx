import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameLibrary } from '@/components/game/GameLibrary';
import type { Game } from '@/lib/types';
import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';

vi.mock('@/lib/storage/indexedDbStorage', () => ({
  indexedDbStorage: {
    games: {
      add: vi.fn().mockResolvedValue('new-game-id'),
      update: vi.fn().mockResolvedValue(undefined),
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
    uiTheme: 'default',
    comboScale: 1,
    autoUpdate: true,
    confirmBeforeDelete: true,
    videoPlayerSize: 'lg',
    gameCardSize: 180,
    characterCardSize: 180,
    showChangelogBeforeUpdate: true,
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
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'game-2',
    name: 'Guilty Gear Strive',
    buttonLayout: ['P', 'K', 'S', 'H', 'D'],
    createdAt: now - 1000,
    updatedAt: now - 1000,
  },
  {
    id: 'game-3',
    name: 'Tekken 8',
    buttonLayout: ['1', '2', '3', '4'],
    createdAt: now - 2000,
    updatedAt: now - 2000,
  },
];

describe('GameLibrary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when there are no games', () => {
    render(<GameLibrary games={[]} />);
    expect(screen.getByText('No Games Yet')).not.toBeNull();
    expect(
      screen.getByRole('button', { name: /add your first game/i }),
    ).not.toBeNull();
  });

  it('renders all game cards with their names', () => {
    render(<GameLibrary games={mockGames} />);
    expect(screen.getByText('Street Fighter 6')).not.toBeNull();
    expect(screen.getByText('Guilty Gear Strive')).not.toBeNull();
    expect(screen.getByText('Tekken 8')).not.toBeNull();
  });

  it('displays the game count badge', () => {
    render(<GameLibrary games={mockGames} />);
    expect(screen.getByText('3')).not.toBeNull();
  });

  it('shows the Game Library heading when games exist', () => {
    render(<GameLibrary games={mockGames} />);
    expect(screen.getByText('Game Library')).not.toBeNull();
  });

  it('opens the add game dialog when clicking Add Game', async () => {
    const user = userEvent.setup();
    render(<GameLibrary games={mockGames} />);

    await user.click(screen.getByRole('button', { name: /add game/i }));
    expect(screen.getByText('Add New Game')).not.toBeNull();
  });

  it('shows validation error when adding a game without a name', async () => {
    const user = userEvent.setup();
    const { toast } = await import('sonner');

    render(<GameLibrary games={mockGames} />);

    await user.click(screen.getByRole('button', { name: /add game/i }));
    // Clear the default button layout and try to add
    const nameInput = screen.getByLabelText(/game name/i);
    await user.clear(nameInput);
    await user.click(screen.getByRole('button', { name: /^add game$/i }));

    expect(toast.error).toHaveBeenCalledWith('Game name is required');
  });

  it('toggles filter panel visibility', async () => {
    const user = userEvent.setup();
    render(<GameLibrary games={mockGames} />);

    const filterButton = screen.getByTitle('Sort & Filter');
    await user.click(filterButton);

    expect(screen.getByPlaceholderText('Search games...')).not.toBeNull();
  });

  it('filters games by search text', async () => {
    const user = userEvent.setup();
    render(<GameLibrary games={mockGames} />);

    // Open filters
    await user.click(screen.getByTitle('Sort & Filter'));

    const searchInput = screen.getByPlaceholderText('Search games...');
    await user.type(searchInput, 'tekken');

    expect(screen.getByText('Tekken 8')).not.toBeNull();
    expect(screen.queryByText('Street Fighter 6')).toBeNull();
    expect(screen.queryByText('Guilty Gear Strive')).toBeNull();
  });

  it('shows filtered count when searching', async () => {
    const user = userEvent.setup();
    render(<GameLibrary games={mockGames} />);

    await user.click(screen.getByTitle('Sort & Filter'));

    const searchInput = screen.getByPlaceholderText('Search games...');
    await user.type(searchInput, 'street');

    expect(screen.getByText(/1 of 3 games/)).not.toBeNull();
  });

  it('supports multi-select bulk delete for games', async () => {
    const user = userEvent.setup();
    render(<GameLibrary games={mockGames} />);

    await user.click(screen.getByTitle('Multi-select games'));
    await user.click(screen.getByRole('button', { name: /select all/i }));
    await user.click(screen.getByRole('button', { name: /delete \(3\)/i }));
    await user.click(
      screen.getByRole('button', { name: /delete selected \(3\)/i }),
    );

    expect(indexedDbStorage.games.bulkDelete).toHaveBeenCalledTimes(1);
    expect(indexedDbStorage.games.bulkDelete).toHaveBeenCalledWith(
      expect.arrayContaining(['game-1', 'game-2', 'game-3']),
    );
  });
});
