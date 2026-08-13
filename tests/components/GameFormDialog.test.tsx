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

  it('uses the accent state for the selected input type', async () => {
    const user = userEvent.setup();
    render(
      <GameFormDialog
        open
        editingGame={null}
        onOpenChange={vi.fn()}
      />,
    );

    const standard = screen.getByRole('button', { name: 'Standard' });
    const numbered = screen.getByRole('button', { name: 'NRS / Tekken' });

    expect(standard.getAttribute('aria-pressed')).toBe('true');
    expect(standard.className).toContain('bg-primary');

    await user.click(numbered);

    expect(numbered.getAttribute('aria-pressed')).toBe('true');
    expect(numbered.className).toContain('bg-primary');
    expect(standard.getAttribute('aria-pressed')).toBe('false');
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
