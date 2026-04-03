import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CharacterView } from '@/components/character/CharacterView';
import { indexedDbStorage } from '@/lib/storage/indexedDbStorage';
import type { Character, Game } from '@/lib/types';

vi.mock('@/lib/storage/indexedDbStorage', () => ({
    indexedDbStorage: {
        characters: {
            delete: vi.fn().mockResolvedValue(undefined),
        },
        settings: {
            update: vi.fn().mockResolvedValue(undefined),
        },
    },
    db: {
        combos: {
            where: vi.fn(() => ({
                anyOf: vi.fn(() => ({
                    toArray: vi.fn().mockResolvedValue([]),
                })),
            })),
        },
    },
}));

vi.mock('dexie-react-hooks', () => ({
    useLiveQuery: vi.fn().mockReturnValue([]),
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
        confirmBeforeDelete: true,
        videoPlayerSize: 'lg',
        gameCardSize: 180,
        characterCardSize: 180,
        notesDefaultOpen: false,
        showChangelogBeforeUpdate: true,
    }),
}));

vi.mock('@/hooks/useIsMobile', () => ({
    useIsMobile: vi.fn().mockReturnValue(false),
}));

vi.mock('@/hooks/useNotesOverride', () => ({
    useNotesOverride: vi.fn().mockReturnValue([false, vi.fn()]),
}));

vi.mock('@/components/character/CharacterFormDialog', () => ({
    CharacterFormDialog: () => null,
}));

vi.mock('@/components/shared/ButtonColorDialog', () => ({
    ButtonColorDialog: () => null,
}));

vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

const now = Date.now();

const mockGame: Game = {
    id: 'game-1',
    name: 'Street Fighter 6',
    buttonLayout: ['L', 'M', 'H', 'S'],
    createdAt: now,
    updatedAt: now,
};

const mockCharacters: Character[] = [
    {
        id: 'char-1',
        gameId: 'game-1',
        name: 'Ryu',
        createdAt: now,
        updatedAt: now,
    },
    {
        id: 'char-2',
        gameId: 'game-1',
        name: 'Ken',
        createdAt: now - 1000,
        updatedAt: now - 1000,
    },
];

describe('CharacterView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('supports multi-select bulk delete for characters', async () => {
        const user = userEvent.setup();
        render(<CharacterView game={mockGame} characters={mockCharacters} />);

        await user.click(screen.getByTitle('Multi-select characters'));
        await user.click(screen.getByRole('button', { name: /select all/i }));
        await user.click(screen.getByRole('button', { name: /delete \(2\)/i }));
        await user.click(
            screen.getByRole('button', { name: /delete selected \(2\)/i }),
        );

        expect(indexedDbStorage.characters.delete).toHaveBeenCalledTimes(2);
    });
});
