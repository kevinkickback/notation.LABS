import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComboFormDialog } from '@/components/combo/ComboFormDialog';
import type { Game, Character, Combo } from '@/lib/types';

vi.mock('@/lib/storage/indexedDbStorage', () => ({
    indexedDbStorage: {
        combos: {
            add: vi.fn().mockResolvedValue('new-combo-id'),
            update: vi.fn().mockResolvedValue(undefined),
        },
        demoVideos: { delete: vi.fn() },
        settings: {
            get: vi.fn().mockResolvedValue({
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
        },
    },
}));

vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

const mockGame: Game = {
    id: 'game-1',
    name: 'Street Fighter 6',
    buttonLayout: ['L', 'M', 'H', 'S'],
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
        expect(screen.getByText('Add Combo for Ryu')).toBeInTheDocument();
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
        expect(screen.getByText('Edit Combo for Ryu')).toBeInTheDocument();
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
        expect(screen.getByDisplayValue('BnB Corner')).toBeInTheDocument();
        expect(screen.getByDisplayValue('5L > 5M > 236H')).toBeInTheDocument();
        expect(screen.getByDisplayValue('4200')).toBeInTheDocument();
        expect(screen.getByDisplayValue('1 bar')).toBeInTheDocument();
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
        expect(screen.getByText('L')).toBeInTheDocument();
        expect(screen.getByText('M')).toBeInTheDocument();
        expect(screen.getByText('H')).toBeInTheDocument();
        expect(screen.getByText('S')).toBeInTheDocument();
    });

    it('shows validation error when submitting without name and notation', async () => {
        const user = userEvent.setup();
        const { toast } = await import('sonner');

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
        expect(toast.error).toHaveBeenCalledWith('Name and notation are required');
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
        const { indexedDbStorage } = await import(
            '@/lib/storage/indexedDbStorage'
        );

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

        expect(indexedDbStorage.combos.add).toHaveBeenCalledWith(
            expect.objectContaining({
                characterId: 'char-1',
                name: 'New Combo',
                notation: '5L > 5H',
                damage: '3000',
            }),
        );
        expect(onOpenChange).toHaveBeenCalledWith(false);
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
        expect(screen.queryByText('Add Combo for Ryu')).not.toBeInTheDocument();
    });
});
