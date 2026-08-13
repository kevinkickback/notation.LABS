import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameFormDialog } from '@/components/game/GameFormDialog';
import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';
import type { Game } from '@/lib/types';

vi.mock('@/lib/storage/indexedDbStorage', () => ({
  indexedDbStorage: {
    games: {
      add: vi.fn().mockResolvedValue('new-game-id'),
      update: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

vi.mock('@/components/game/CoverSearchDialog', () => ({
  CoverSearchDialog: () => null,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const editingGame: Game = {
  id: 'game-1',
  name: 'Street Fighter 6',
  logoImage: 'data:image/png;base64,cover',
  coverZoom: 150,
  coverPanX: 25,
  coverPanY: 75,
  coverFit: 'free',
  buttonLayout: ['L', 'M', 'H', 'S'],
  createdAt: 1,
  updatedAt: 1,
};

describe('GameFormDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('groups the form into readable sections', () => {
    render(
      <GameFormDialog
        open
        editingGame={null}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Required')).not.toBeNull();
    expect(screen.getByLabelText('Game Name').hasAttribute('required')).toBe(
      true,
    );

    expect(screen.getByText('Game Profile')).not.toBeNull();
    expect(screen.getByText('Notation & Buttons')).not.toBeNull();
    expect(screen.getByText('Notes')).not.toBeNull();
    const notes = screen.getByLabelText('Game notes');
    expect(notes).not.toBeNull();
    expect(notes.getAttribute('aria-describedby')).not.toBeNull();
    expect(
      screen.getByText(/multiple lines and markdown are supported/i),
    ).not.toBeNull();
  });

  it('uses accessible accent states and presets for notation styles', async () => {
    const user = userEvent.setup();
    render(
      <GameFormDialog
        open
        editingGame={null}
        onOpenChange={vi.fn()}
      />,
    );

    const standard = screen.getByRole('button', {
      name: 'Standard / Numpad',
    });
    const nrs = screen.getByRole('button', { name: 'NRS' });
    const tekken = screen.getByRole('button', { name: 'Tekken' });

    expect(screen.getByText('Notation Style')).not.toBeNull();
    expect(standard.getAttribute('aria-pressed')).toBe('true');
    expect(standard.className).toContain('bg-primary');
    expect(screen.queryByText('2L > 5M > 236H')).toBeNull();
    expect(screen.queryByText('1 4 1 D B 2 B (hold)')).toBeNull();
    expect(screen.queryByText('WS1,2 ► uf1 ► f2,3 ► ff3+4')).toBeNull();

    await user.click(nrs);

    expect(
      screen.getByText(
        'For Mortal Kombat, Injustice, and similar games. Numbers are attack buttons; directions use letters.',
      ),
    ).not.toBeNull();
    expect(nrs.getAttribute('aria-pressed')).toBe('true');
    expect(nrs.className).toContain('bg-primary');
    expect(standard.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByLabelText(/button layout/i).getAttribute('value')).toBe(
      '1, 2, 3, 4',
    );

    await user.click(tekken);
    expect(tekken.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByLabelText(/button layout/i).getAttribute('value')).toBe(
      '1, 2, 3, 4',
    );
  });

  it('persists free crop mode with the shared cover controls', async () => {
    const user = userEvent.setup();
    render(
      <GameFormDialog
        open
        editingGame={{ ...editingGame, coverFit: 'fill' }}
        onOpenChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('switch', { name: 'Fill frame' }));
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(indexedDbStorage.games.update).toHaveBeenCalledWith(
      'game-1',
      expect.objectContaining({ coverFit: 'free' }),
    );
  });

  it('resets all cover adjustments to fill defaults', async () => {
    const user = userEvent.setup();
    render(
      <GameFormDialog
        open
        editingGame={editingGame}
        onOpenChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Reset' }));

    expect(
      screen
        .getByRole('switch', { name: 'Fill frame' })
        .getAttribute('aria-checked'),
    ).toBe('true');
    expect(
      screen.getByRole('slider', { name: 'Zoom' }).getAttribute('aria-valuenow'),
    ).toBe('100');
    expect(
      screen.getByRole('slider', { name: 'Pan X' }).getAttribute('aria-valuenow'),
    ).toBe('50');
    expect(
      screen.getByRole('slider', { name: 'Pan Y' }).getAttribute('aria-valuenow'),
    ).toBe('50');
  });
});
