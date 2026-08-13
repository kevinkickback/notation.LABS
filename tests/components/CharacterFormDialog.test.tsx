import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CharacterFormDialog } from '@/components/character/CharacterFormDialog';
import type { Game } from '@/lib/types';

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
  createdAt: 1,
  updatedAt: 1,
};

describe('CharacterFormDialog', () => {
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
  });
});
