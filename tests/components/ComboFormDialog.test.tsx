import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComboFormDialog } from '@/components/combo/ComboFormDialog';
import { createCombo } from '@/lib/application/comboCommands';
import type { Game, Character, Combo } from '@/lib/types';

vi.mock('@/lib/application/comboCommands', () => ({
  createCombo: vi.fn().mockResolvedValue('new-combo-id'),
  updateCombo: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/storage/indexedDbStorage', () => ({
  getLocalVideoId: (demoUrl?: string) => {
    if (!demoUrl?.startsWith('local:')) return null;
    return demoUrl.slice('local:'.length) || null;
  },
  generateId: vi.fn(() => 'mock-video-id'),
  indexedDbStorage: {
    combos: {
      add: vi.fn().mockResolvedValue('new-combo-id'),
      addWithVideo: vi.fn().mockResolvedValue('new-combo-id'),
      update: vi.fn().mockResolvedValue(undefined),
      updateWithVideo: vi.fn().mockResolvedValue(undefined),
    },
    demoVideos: { add: vi.fn(), delete: vi.fn() },
    settings: {
      get: vi.fn().mockResolvedValue({
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
    },
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

const mockGame: Game = {
  id: 'game-1',
  name: 'Street Fighter 6',
  buttonLayout: ['L', 'M', 'H', 'S'],
  notationProfile: 'standard',
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

const mockCharacter: Character = {
  id: 'char-1',
  gameId: 'game-1',
  name: 'Ryu',
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

const mockCombo: Combo = {
  id: 'combo-1',
  characterId: 'char-1',
  name: 'BnB Corner',
  notation: '5L > 5M > 236H',
  parsedNotation: [],
  difficulty: 3,
  damage: '4200',
  meterCost: '1 bar',
  tags: ['corner', 'bnb'],
  sortOrder: 0,
  outdated: false,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

describe('ComboFormDialog', () => {
  const onOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Add Combo title when no editingCombo', () => {
    render(
      <ComboFormDialog
        open={true}
        onOpenChange={onOpenChange}
        game={mockGame}
        character={mockCharacter}
        editingCombo={null}
        allTags={['corner', 'bnb']}
      />,
    );
    expect(screen.getByText('Add Combo for Ryu')).not.toBeNull();
  });

  it('groups the form into consistent cards and marks required fields', () => {
    render(
      <ComboFormDialog
        open={true}
        onOpenChange={onOpenChange}
        game={mockGame}
        character={mockCharacter}
        editingCombo={null}
        allTags={['corner', 'bnb']}
      />,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelectorAll('[data-slot="card"]')).toHaveLength(4);
    for (const title of [
      'Combo Basics',
      'Combo Details',
      'Demo Video',
      'Description & Status',
    ]) {
      expect(screen.getByText(title).closest('[data-slot="card"]')).not.toBeNull();
    }

    expect(screen.getByText('Required')).not.toBeNull();
    expect(screen.getByLabelText('Combo Name').hasAttribute('required')).toBe(
      true,
    );
    expect(screen.getByLabelText('Notation').hasAttribute('required')).toBe(
      true,
    );
  });

  it('renders Edit Combo title when editingCombo is provided', () => {
    render(
      <ComboFormDialog
        open={true}
        onOpenChange={onOpenChange}
        game={mockGame}
        character={mockCharacter}
        editingCombo={mockCombo}
        allTags={['corner', 'bnb']}
      />,
    );
    expect(screen.getByText('Edit Combo for Ryu')).not.toBeNull();
  });

  it('populates form fields when editing an existing combo', () => {
    render(
      <ComboFormDialog
        open={true}
        onOpenChange={onOpenChange}
        game={mockGame}
        character={mockCharacter}
        editingCombo={mockCombo}
        allTags={['corner', 'bnb']}
      />,
    );
    expect(screen.getByDisplayValue('BnB Corner')).not.toBeNull();
    expect(screen.getByDisplayValue('5L > 5M > 236H')).not.toBeNull();
    expect(screen.getByDisplayValue('4200')).not.toBeNull();
    expect(screen.getByDisplayValue('1 bar')).not.toBeNull();
  });

  it('shows available button layout from the game', () => {
    render(
      <ComboFormDialog
        open={true}
        onOpenChange={onOpenChange}
        game={mockGame}
        character={mockCharacter}
        editingCombo={null}
        allTags={[]}
      />,
    );
    expect(screen.getByText('L')).not.toBeNull();
    expect(screen.getByText('M')).not.toBeNull();
    expect(screen.getByText('H')).not.toBeNull();
    expect(screen.getByText('S')).not.toBeNull();
  });

  it('shows upload file size guidance', () => {
    render(
      <ComboFormDialog
        open={true}
        onOpenChange={onOpenChange}
        game={mockGame}
        character={mockCharacter}
        editingCombo={null}
        allTags={[]}
      />,
    );

    expect(screen.getByText(/max file size:\s*50 mb/i)).not.toBeNull();
  });

  it('identifies combo descriptions as multiline Markdown fields', () => {
    render(
      <ComboFormDialog
        open={true}
        onOpenChange={onOpenChange}
        game={mockGame}
        character={mockCharacter}
        editingCombo={null}
        allTags={[]}
      />,
    );

    const description = screen.getByLabelText('Description');
    const helpId = description.getAttribute('aria-describedby');

    expect(helpId).not.toBeNull();
    expect(document.getElementById(helpId ?? '')?.textContent).toMatch(
      /multiple lines and markdown are supported/i,
    );
  });

  it('uses native validation when submitting without name and notation', async () => {
    const user = userEvent.setup();

    render(
      <ComboFormDialog
        open={true}
        onOpenChange={onOpenChange}
        game={mockGame}
        character={mockCharacter}
        editingCombo={null}
        allTags={[]}
      />,
    );

    await user.click(screen.getByRole('button', { name: /add combo/i }));
    expect(
      (screen.getByLabelText('Combo Name') as HTMLInputElement).checkValidity(),
    ).toBe(false);
    expect(
      (screen.getByLabelText('Notation') as HTMLTextAreaElement).checkValidity(),
    ).toBe(false);
  });

  it('calls onOpenChange(false) when Cancel is clicked', async () => {
    const user = userEvent.setup();

    render(
      <ComboFormDialog
        open={true}
        onOpenChange={onOpenChange}
        game={mockGame}
        character={mockCharacter}
        editingCombo={null}
        allTags={[]}
      />,
    );

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('submits a new combo with filled fields', async () => {
    const user = userEvent.setup();

    render(
      <ComboFormDialog
        open={true}
        onOpenChange={onOpenChange}
        game={mockGame}
        character={mockCharacter}
        editingCombo={null}
        allTags={[]}
      />,
    );

    await user.type(screen.getByLabelText(/combo name/i), 'New Combo');
    await user.type(screen.getByLabelText(/notation/i), '5L > 5H');
    await user.type(screen.getByLabelText(/damage/i), '3000');

    await user.click(screen.getByRole('button', { name: /add combo/i }));

    expect(createCombo).toHaveBeenCalledWith(
      expect.objectContaining({
        characterId: 'char-1',
        name: 'New Combo',
        notation: '5L > 5H',
        damage: '3000',
      }),
      undefined,
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('keeps an uploaded video pending until the combo is submitted', async () => {
    const user = userEvent.setup();
    const { indexedDbStorage } = await import('@/lib/storage/indexedDbStorage');
    render(
      <ComboFormDialog
        open={true}
        onOpenChange={onOpenChange}
        game={mockGame}
        character={mockCharacter}
        editingCombo={null}
        allTags={[]}
      />,
    );
    const input = document.querySelector<HTMLInputElement>(
      'input[type="file"]',
    );
    expect(input).not.toBeNull();
    const file = {
      name: 'demo.mp4',
      size: 3,
      type: 'video/mp4',
      arrayBuffer: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]).buffer),
    } as unknown as File;

    fireEvent.change(input as HTMLInputElement, {
      target: { files: [file] },
    });
    await screen.findByText('demo.mp4');

    expect(indexedDbStorage.demoVideos.add).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(createCombo).not.toHaveBeenCalled();
  });

  it('does not render dialog content when closed', () => {
    render(
      <ComboFormDialog
        open={false}
        onOpenChange={onOpenChange}
        game={mockGame}
        character={mockCharacter}
        editingCombo={null}
        allTags={[]}
      />,
    );
    expect(screen.queryByText('Add Combo for Ryu')).toBeNull();
  });
});
