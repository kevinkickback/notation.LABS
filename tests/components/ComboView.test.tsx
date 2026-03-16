import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComboView } from '@/components/combo/ComboView';
import type { Game, Character, Combo } from '@/lib/types';

vi.mock('@/lib/storage/indexedDbStorage', () => ({
    indexedDbStorage: {
        combos: {
            add: vi.fn().mockResolvedValue('new-combo-id'),
            update: vi.fn().mockResolvedValue(undefined),
            delete: vi.fn().mockResolvedValue(undefined),
            reorder: vi.fn().mockResolvedValue(undefined),
        },
        settings: {
            update: vi.fn().mockResolvedValue(undefined),
        },
        demoVideos: {
            delete: vi.fn().mockResolvedValue(undefined),
            getBlobUrl: vi.fn().mockResolvedValue(null),
        },
    },
}));

vi.mock('@/hooks/useSettings', () => ({
    useSettings: vi.fn().mockReturnValue({
        colorTheme: 'dark',
        fontFamily: 'system-ui',
        notationColors: { direction: '#fff', separator: '#ccc' },
        displayMode: 'colored-text',
        iconStyle: 'round',
        uiTheme: 'default',
        comboScale: 1,
        autoUpdate: true,
        confirmBeforeDelete: false,
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

const mockCombos: Combo[] = [
    {
        id: 'combo-1',
        characterId: 'char-1',
        name: 'BnB Corner',
        notation: '5L > 5M > 236H',
        parsedNotation: [
            { type: 'button', value: 'L', rawValue: '5L' },
            { type: 'separator', value: '>', rawValue: '>' },
            { type: 'button', value: 'M', rawValue: '5M' },
            { type: 'separator', value: '>', rawValue: '>' },
            { type: 'motion', value: '236', rawValue: '236H' },
        ],
        difficulty: 3,
        damage: '4200',
        meterCost: '1 bar',
        tags: ['corner', 'bnb'],
        sortOrder: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    },
    {
        id: 'combo-2',
        characterId: 'char-1',
        name: 'Easy Punish',
        notation: '5H > 236M',
        parsedNotation: [
            { type: 'button', value: 'H', rawValue: '5H' },
            { type: 'separator', value: '>', rawValue: '>' },
            { type: 'motion', value: '236', rawValue: '236M' },
        ],
        difficulty: 1,
        damage: '2000',
        tags: ['punish', 'easy'],
        outdated: true,
        sortOrder: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    },
];

describe('ComboView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders empty state when no combos exist', () => {
        render(
            <ComboView game={mockGame} character={mockCharacter} combos={[]} />,
        );
        expect(screen.getByText('Ryu')).toBeInTheDocument();
        expect(
            screen.getByText(/no combos yet/i),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: /add combo/i }),
        ).toBeInTheDocument();
    });

    it('renders character name and game info', () => {
        render(
            <ComboView
                game={mockGame}
                character={mockCharacter}
                combos={mockCombos}
            />,
        );
        expect(screen.getByText('Ryu')).toBeInTheDocument();
        expect(screen.getByText(/Street Fighter 6 • 2 combos/)).toBeInTheDocument();
    });

    it('renders all combo cards', () => {
        render(
            <ComboView
                game={mockGame}
                character={mockCharacter}
                combos={mockCombos}
            />,
        );
        expect(screen.getByText('BnB Corner')).toBeInTheDocument();
        expect(screen.getByText('Easy Punish')).toBeInTheDocument();
    });

    it('opens filter panel when filter button is clicked', async () => {
        const user = userEvent.setup();
        render(
            <ComboView
                game={mockGame}
                character={mockCharacter}
                combos={mockCombos}
            />,
        );

        await user.click(screen.getByTitle('Filter Combos'));
        // Filter panel should show the search input
        expect(
            screen.getByPlaceholderText(/search combos/i),
        ).toBeInTheDocument();
    });

    it('toggles multi-select mode', async () => {
        const user = userEvent.setup();
        render(
            <ComboView
                game={mockGame}
                character={mockCharacter}
                combos={mockCombos}
            />,
        );

        await user.click(screen.getByTitle('Select Combos'));
        expect(screen.getByText('0 selected')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /select all/i })).toBeInTheDocument();
    });

    it('opens add combo dialog', async () => {
        const user = userEvent.setup();
        render(
            <ComboView
                game={mockGame}
                character={mockCharacter}
                combos={mockCombos}
            />,
        );

        await user.click(screen.getByRole('button', { name: /add combo/i }));
        expect(screen.getByText('Add Combo for Ryu')).toBeInTheDocument();
    });

    it('shows empty filter result message', async () => {
        const user = userEvent.setup();
        render(
            <ComboView
                game={mockGame}
                character={mockCharacter}
                combos={mockCombos}
            />,
        );

        await user.click(screen.getByTitle('Filter Combos'));
        const searchInput = screen.getByPlaceholderText(/search combos/i);
        await user.type(searchInput, 'nonexistent combo xyz');

        expect(
            screen.getByText(/no combos match the current filters/i),
        ).toBeInTheDocument();
    });
});
