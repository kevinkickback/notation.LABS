import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportDialog } from '@/components/layout/ExportDialog';
import type { Game, Character, Combo } from '@/lib/types';

const mockGames: Game[] = [
    {
        id: 'game-1',
        name: 'Street Fighter 6',
        buttonLayout: ['L', 'M', 'H', 'S'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
    },
    {
        id: 'game-2',
        name: 'Guilty Gear Strive',
        buttonLayout: ['P', 'K', 'S', 'H', 'D'],
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
    indexedDbStorage: {
        games: { getAll: vi.fn() },
        characters: { getAll: vi.fn() },
        combos: { getAll: vi.fn() },
        demoVideos: { getAll: vi.fn() },
    },
}));

import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';

describe('ExportDialog', () => {
    const onOpenChange = vi.fn();
    const onExport = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(indexedDbStorage.games.getAll).mockResolvedValue(mockGames);
        vi.mocked(indexedDbStorage.characters.getAll).mockResolvedValue(mockCharacters);
        vi.mocked(indexedDbStorage.combos.getAll).mockResolvedValue(mockCombos);
        vi.mocked(indexedDbStorage.demoVideos.getAll).mockResolvedValue([]);
    });

    it('renders dialog title', async () => {
        render(
            <ExportDialog
                open={true}
                onOpenChange={onOpenChange}
                onExport={onExport}
            />,
        );
        expect(screen.getByText('Export Data')).toBeTruthy();
    });

    it('loads and displays games in the tree', async () => {
        render(
            <ExportDialog
                open={true}
                onOpenChange={onOpenChange}
                onExport={onExport}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText('Street Fighter 6')).toBeTruthy();
            expect(screen.getByText('Guilty Gear Strive')).toBeTruthy();
        });
    });

    it('shows character counts for each game', async () => {
        render(
            <ExportDialog
                open={true}
                onOpenChange={onOpenChange}
                onExport={onExport}
            />,
        );

        await waitFor(() => {
            const charLabels = screen.getAllByText('1 char');
            expect(charLabels.length).toBe(2);
        });
    });

    it('calls onExport with all items selected by default', async () => {
        const user = userEvent.setup();
        render(
            <ExportDialog
                open={true}
                onOpenChange={onOpenChange}
                onExport={onExport}
            />,
        );

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

    it('deselects all when None is clicked, disabling export', async () => {
        const user = userEvent.setup();
        render(
            <ExportDialog
                open={true}
                onOpenChange={onOpenChange}
                onExport={onExport}
            />,
        );

        await waitFor(() => {
            expect(screen.queryByText('Street Fighter 6')).not.toBeNull();
        });

        await user.click(screen.getByRole('button', { name: /^none$/i }));

        const exportButton = screen.getByRole('button', {
            name: /select items to export/i,
        });
        expect((exportButton as HTMLButtonElement).disabled).toBe(true);
    });

    it('re-selects all when All is clicked after None', async () => {
        const user = userEvent.setup();
        render(
            <ExportDialog
                open={true}
                onOpenChange={onOpenChange}
                onExport={onExport}
            />,
        );

        await waitFor(() => {
            expect(screen.queryByText('Street Fighter 6')).not.toBeNull();
        });

        await user.click(screen.getByRole('button', { name: /^none$/i }));
        await user.click(screen.getByRole('button', { name: /^all$/i }));

        const exportButton = screen.getByRole('button', { name: /^export$/i });
        expect((exportButton as HTMLButtonElement).disabled).toBe(false);
    });

    it('does not render dialog content when closed', () => {
        render(
            <ExportDialog
                open={false}
                onOpenChange={onOpenChange}
                onExport={onExport}
            />,
        );
        expect(screen.queryByText('Export Data')).toBeFalsy();
    });

    it('shows no data message when there are no games', async () => {
        vi.mocked(indexedDbStorage.games.getAll).mockResolvedValueOnce([]);
        vi.mocked(indexedDbStorage.characters.getAll).mockResolvedValueOnce([]);
        vi.mocked(indexedDbStorage.combos.getAll).mockResolvedValueOnce([]);

        render(
            <ExportDialog
                open={true}
                onOpenChange={onOpenChange}
                onExport={onExport}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText('No data to export.')).toBeTruthy();
        });
    });
});
