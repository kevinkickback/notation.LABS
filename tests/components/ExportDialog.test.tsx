import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dexie } from 'dexie';
import { ExportDialog, ExportProgressModal } from '@/components/header/ExportDialog';
import type { Game, Character, Combo } from '@/lib/types';

vi.mock('@/lib/storage/backupSnapshot', async () => {
  const { indexedDbStorage } = await import('@/lib/storage/indexedDbStorage');
  return { readBackupSelection: () => Promise.all([
    indexedDbStorage.games.getAll(), indexedDbStorage.characters.getAll(), indexedDbStorage.combos.getAll(),
    indexedDbStorage.demoVideos.getIds().then(ids => ids.length),
  ]) };
});

const mockGames: Game[] = [
  {
    id: 'game-1',
    name: 'Street Fighter 6',
    buttonLayout: ['L', 'M', 'H', 'S'],
    notationProfile: 'standard',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'game-2',
    name: 'Guilty Gear Strive',
    buttonLayout: ['P', 'K', 'S', 'H', 'D'],
    notationProfile: 'standard',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

const mockCharacters: Character[] = [
  {
    id: 'char-1',
    gameId: 'game-1',
    name: 'Ryu',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'char-2',
    gameId: 'game-2',
    name: 'Sol',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

const mockCombos: Combo[] = [
  {
    id: 'combo-1',
    characterId: 'char-1',
    name: 'BnB Corner',
    notation: '5L > 5M > 236H',
    parsedNotation: [],
    tags: ['bnb'],
    sortOrder: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'combo-2',
    characterId: 'char-2',
    name: 'Dust Loop',
    notation: '5H > 5D',
    parsedNotation: [],
    tags: [],
    sortOrder: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

vi.mock('@/lib/storage/indexedDbStorage', () => ({
  // Inline the real implementation so ExportDialog's selectedVideoCount works.
  getLocalVideoId: (demoUrl?: string) => {
    if (!demoUrl?.startsWith('local:')) return null;
    const id = demoUrl.slice('local:'.length);
    return id || null;
  },
  indexedDbStorage: {
    games: { getAll: vi.fn() },
    characters: { getAll: vi.fn() },
    combos: { getAll: vi.fn() },
    demoVideos: { getIds: vi.fn() },
  },
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

const reportErrorMock = vi.fn();

it('disables cancellation only while committing the finished backup', () => {
  const onCancel = vi.fn();
  const props = { current: 3, total: 3, bytesWritten: 100, onCancel };
  const { rerender } = render(<ExportProgressModal {...props} phase="finalizing" />);
  expect((screen.getByRole('button', { name: 'Cancel export' }) as HTMLButtonElement).disabled).toBe(false);
  rerender(<ExportProgressModal {...props} phase="committing" />);
  expect((screen.getByRole('button', { name: 'Cancel export' }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText('Saving completed backup…')).toBeTruthy();
});

vi.mock('@/lib/errors', () => ({
  reportError: (...args: unknown[]) => reportErrorMock(...args),
}));

import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';
import { toast } from 'sonner';

describe('ExportDialog', () => {
  const onOpenChange = vi.fn();
  const onExport = vi.fn();

  const renderDialog = async (open = true) => {
    await act(async () => {
      render(
        <ExportDialog
          open={open}
          onOpenChange={onOpenChange}
          onExport={onExport}
        />,
      );
      await Promise.resolve();
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(indexedDbStorage.games.getAll).mockResolvedValue(mockGames);
    vi.mocked(indexedDbStorage.characters.getAll).mockResolvedValue(
      mockCharacters,
    );
    vi.mocked(indexedDbStorage.combos.getAll).mockResolvedValue(mockCombos);
    vi.mocked(indexedDbStorage.demoVideos.getIds).mockResolvedValue([]);
  });

  it('sorts game entries alphabetically by default', async () => {
    await renderDialog();

    expect(screen.getByRole('dialog', { name: 'Export Data' })).not.toBeNull();
    const guiltyGear = await screen.findByText('Guilty Gear Strive');
    const streetFighter = screen.getByText('Street Fighter 6');
    expect(screen.getAllByText('1 char')).toHaveLength(2);
    expect(
      guiltyGear.compareDocumentPosition(streetFighter) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('calls onExport with all items selected by default', async () => {
    const user = userEvent.setup();
    await renderDialog();

    await waitFor(() => {
      expect(screen.getByText('Street Fighter 6')).toBeTruthy();
    });

    await user.click(screen.getByRole('button', { name: /^export$/i }));

    expect(onExport).toHaveBeenCalledWith(false, {
      gameIds: expect.arrayContaining(['game-1', 'game-2']),
      characterIds: expect.arrayContaining(['char-1', 'char-2']),
      comboIds: expect.arrayContaining(['combo-1', 'combo-2']),
    });
  });

  it('disables an empty selection and restores it with All', async () => {
    const user = userEvent.setup();
    await renderDialog();

    await waitFor(() => {
      expect(screen.queryByText('Street Fighter 6')).not.toBeNull();
    });

    await user.click(screen.getByRole('button', { name: /^none$/i }));
    expect((screen.getByRole('button', { name: /select items to export/i }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole('button', { name: /^all$/i }));

    const exportButton = screen.getByRole('button', { name: /^export$/i });
    expect((exportButton as HTMLButtonElement).disabled).toBe(false);
  });

  it('counts empty characters in parent selection and exports only the chosen branch', async () => {
    vi.mocked(indexedDbStorage.characters.getAll).mockResolvedValueOnce([
      mockCharacters[0], { ...mockCharacters[0], id: 'empty-fighter', name: 'Empty fighter' },
    ]);
    vi.mocked(indexedDbStorage.combos.getAll).mockResolvedValueOnce([mockCombos[0]]);
    const user = userEvent.setup();
    await renderDialog();
    await user.click(screen.getByRole('button', { name: 'Expand Street Fighter 6' }));
    await user.click(screen.getByRole('checkbox', { name: 'Include character Empty fighter' }));
    const game = screen.getByRole('checkbox', { name: 'Include game Street Fighter 6' });
    expect(game.getAttribute('aria-checked')).toBe('mixed');
    await user.click(game);
    expect(game.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('checkbox', { name: 'Include character Empty fighter' }).getAttribute('aria-checked')).toBe('true');
    await user.click(screen.getByRole('button', { name: 'None' }));
    await user.click(screen.getByRole('checkbox', { name: 'Include character Empty fighter' }));
    await user.click(screen.getByRole('button', { name: 'Export' }));
    expect(onExport).toHaveBeenCalledWith(false, { gameIds: ['game-1'], characterIds: ['empty-fighter'], comboIds: [] });
  });

  it('keeps rapid sibling changes in one selection and derives parent and video states', async () => {
    vi.mocked(indexedDbStorage.demoVideos.getIds).mockResolvedValueOnce(['video']);
    vi.mocked(indexedDbStorage.characters.getAll).mockResolvedValueOnce([mockCharacters[0]]);
    vi.mocked(indexedDbStorage.combos.getAll).mockResolvedValueOnce([
      { ...mockCombos[0], demoUrl: 'local:video' }, { ...mockCombos[1], characterId: 'char-1' },
    ]);
    const user = userEvent.setup();
    await renderDialog();
    await user.click(screen.getByRole('button', { name: 'Expand Street Fighter 6' }));
    await user.click(screen.getByRole('button', { name: 'Expand Ryu' }));
    await user.click(screen.getByRole('button', { name: 'None' }));
    act(() => {
      screen.getByRole('checkbox', { name: 'Include combo BnB Corner' }).click();
      screen.getByRole('checkbox', { name: 'Include combo Dust Loop' }).click();
    });
    expect(screen.getByRole('checkbox', { name: 'Include character Ryu' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('Include demo videos')).toBeTruthy();
    await user.click(screen.getByRole('checkbox', { name: 'Include combo BnB Corner' }));
    expect(screen.queryByText('Include demo videos')).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Include character Ryu' }).getAttribute('aria-checked')).toBe('mixed');
    await user.click(screen.getByRole('button', { name: 'Export' }));
    expect(onExport).toHaveBeenCalledWith(false, { gameIds: ['game-1'], characterIds: ['char-1'], comboIds: ['combo-2'] });
  });

  it('ignores a previous session load after reopening and disables export until the new read finishes', async () => {
    let finishOld!: (games: Game[]) => void;
    let finishNew!: (games: Game[]) => void;
    const oldRead = new Dexie.Promise<Game[]>(resolve => { finishOld = resolve; });
    const newRead = new Dexie.Promise<Game[]>(resolve => { finishNew = resolve; });
    vi.mocked(indexedDbStorage.games.getAll).mockReturnValueOnce(oldRead).mockReturnValueOnce(newRead);
    const { rerender } = render(<ExportDialog open onOpenChange={onOpenChange} onExport={onExport} />);
    rerender(<ExportDialog open={false} onOpenChange={onOpenChange} onExport={onExport} />);
    rerender(<ExportDialog open onOpenChange={onOpenChange} onExport={onExport} />);
    await act(async () => { finishOld(mockGames); await oldRead; });
    expect(screen.getByText('Loading...')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Select items to export' }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { finishNew([mockGames[1]]); await newRead; });
    expect(screen.queryByText('Street Fighter 6')).toBeNull();
    expect(screen.getByText('Guilty Gear Strive')).toBeTruthy();
  });

  it('shows no data message when there are no games', async () => {
    vi.mocked(indexedDbStorage.games.getAll).mockResolvedValueOnce([]);
    vi.mocked(indexedDbStorage.characters.getAll).mockResolvedValueOnce([]);
    vi.mocked(indexedDbStorage.combos.getAll).mockResolvedValueOnce([]);

    await renderDialog();

    await waitFor(() => {
      expect(screen.getByText('No data to export.')).toBeTruthy();
    });
  });

  it('shows an error toast when loading export data fails', async () => {
    vi.mocked(indexedDbStorage.games.getAll).mockRejectedValueOnce(
      new Error('boom'),
    );

    await renderDialog();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to load export data');
      expect(reportErrorMock).toHaveBeenCalledWith(
        'ExportDialog.loadData',
        expect.any(Error),
      );
    });
  });

  it('calls onExport with includeVideos true when the video toggle is enabled', async () => {
    const user = userEvent.setup();
    vi.mocked(indexedDbStorage.demoVideos.getIds).mockResolvedValueOnce([
      'vid-1',
    ]);
    vi.mocked(indexedDbStorage.combos.getAll).mockResolvedValueOnce([
      { ...mockCombos[0], demoUrl: 'local:vid-1' },
    ]);

    await renderDialog();

    const videos = await screen.findByRole('switch', { name: 'Include demo videos' });

    await user.click(videos);
    await user.click(screen.getByRole('button', { name: /^export$/i }));

    expect(onExport).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        comboIds: expect.arrayContaining([mockCombos[0].id]),
      }),
    );
  });
});
