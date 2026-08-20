import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CharacterFormDialog } from '@/components/character/CharacterFormDialog';
import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';
import type { Character, Game } from '@/lib/types';

vi.mock('@/lib/storage/indexedDbStorage', () => ({
  indexedDbStorage: {
    characters: {
      add: vi.fn().mockResolvedValue('character-id'),
      update: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

vi.mock('@/context/SettingsContext', () => ({
  useSettings: () => ({ characterCardOrientation: 'portrait' }),
}));

vi.mock('@/components/character/CharacterSearchDialog', () => ({
  CharacterSearchDialog: () => null,
}));

const game: Game = {
  id: 'game-1',
  name: 'Street Fighter 6',
  buttonLayout: ['L', 'M', 'H', 'S'],
  notationProfile: 'standard',
  createdAt: 1,
  updatedAt: 1,
};

const editingCharacter: Character = {
  id: 'character-1',
  gameId: game.id,
  name: 'Ryu',
  portraitImage: 'data:image/png;base64,portrait',
  portraitFit: 'free',
  portraitZoom: 150,
  portraitPanX: 25,
  portraitPanY: 75,
  createdAt: 1,
  updatedAt: 1,
};

describe('CharacterFormDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('orders required identity before optional image and notes', () => {
    render(
      <CharacterFormDialog
        open
        onOpenChange={vi.fn()}
        editingCharacter={null}
        game={game}
      />,
    );

    const name = screen.getByLabelText('Character Name');
    const image = screen.getByText('Character Image (optional)');
    const notes = screen.getByLabelText('Notes (optional)');

    expect(screen.getByText('Required')).not.toBeNull();
    expect(name.hasAttribute('required')).toBe(true);

    expect(name.compareDocumentPosition(image) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(image.compareDocumentPosition(notes) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(notes.getAttribute('aria-describedby')).not.toBeNull();
    expect(
      screen.getByText(/multiple lines and markdown are supported/i),
    ).not.toBeNull();
  });

  it('persists the shared cover mode for an edited character', async () => {
    const user = userEvent.setup();
    render(
      <CharacterFormDialog
        open
        onOpenChange={vi.fn()}
        editingCharacter={{ ...editingCharacter, portraitFit: 'fill' }}
        game={game}
      />,
    );

    await user.click(screen.getByRole('switch', { name: 'Fill frame' }));
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(indexedDbStorage.characters.update).toHaveBeenCalledWith(
      'character-1',
      expect.objectContaining({ portraitFit: 'free' }),
    );
  });

  it('resets all portrait adjustments to fill defaults', async () => {
    const user = userEvent.setup();
    render(
      <CharacterFormDialog
        open
        onOpenChange={vi.fn()}
        editingCharacter={editingCharacter}
        game={game}
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
