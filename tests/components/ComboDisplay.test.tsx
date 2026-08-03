import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComboDisplay } from '@/components/combo/ComboDisplay';
import { parseComboNotation } from '@/lib/parser';
import type { ComboToken, Game } from '@/lib/types';

vi.mock('@/context/SettingsContext', () => ({
    useSettings: vi.fn().mockReturnValue({
        colorTheme: 'dark',
        fontFamily: 'system-ui',
        notationColors: { direction: '#fff', separator: '#ccc' },
        displayMode: 'colored-text',
        iconStyle: 'round',
        motionIconStyle: 'joystick',
        characterCardOrientation: 'landscape',
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

describe('ComboDisplay', () => {
    it('inherits bracketed button color for preceding direction tokens', () => {
        const tokens: ComboToken[] = [
            { type: 'direction', value: '5', rawValue: '5' },
            { type: 'modifier', value: '[D]', rawValue: '[D]' },
            { type: 'separator', value: '>', rawValue: '>' },
        ];

        const game: Game = {
            id: 'game-1',
            name: 'Under Night In-Birth II Sys-Celes',
            buttonLayout: ['A', 'B', 'C', 'D'],
            buttonColors: {
                D: '#123456',
            },
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        render(<ComboDisplay tokens={tokens} game={game} mode="colored-text" />);

        const directionFive = screen.getByText('5');
        const heldButton = screen.getByText('[D]');

        expect(directionFive.getAttribute('style')).toContain('color: rgb(18, 52, 86)');
        expect(heldButton.getAttribute('style')).toContain('color: rgb(18, 52, 86)');
    });

    it('applies correct per-hit button colors for repeat notation (5L > 6H)x3', () => {
        const game: Game = {
            id: 'game-2',
            name: 'Custom Fighter',
            buttonLayout: ['L', 'M', 'H'],
            buttonColors: {
                L: '#123456',
                H: '#abcdef',
            },
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        const tokens = parseComboNotation('(5L > 6H)x3', game.buttonLayout);

        render(<ComboDisplay tokens={tokens} game={game} mode="colored-text" />);

        const directionFive = screen.getByText('5');
        const directionSix = screen.getByText('6');
        const buttonL = screen.getByText('L');
        const buttonH = screen.getByText('H');

        expect(directionFive.getAttribute('style')).toContain('color: rgb(18, 52, 86)');
        expect(buttonL.getAttribute('style')).toContain('color: rgb(18, 52, 86)');
        expect(directionSix.getAttribute('style')).toContain('color: rgb(171, 205, 239)');
        expect(buttonH.getAttribute('style')).toContain('color: rgb(171, 205, 239)');
    });

    it('renders bracket button modifier as icon flanked by bracket spans in icon mode', () => {
        const tokens: ComboToken[] = [
            { type: 'modifier', value: '[D]', rawValue: '[D]' },
        ];

        const game: Game = {
            id: 'game-1',
            name: 'Test Fighter',
            buttonLayout: ['A', 'B', 'C', 'D'],
            buttonColors: { D: '#123456' },
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        render(<ComboDisplay tokens={tokens} game={game} mode="visual-icons" />);

        // Bracket characters must be rendered around the button icon.
        expect(screen.getAllByText('[').length).toBeGreaterThan(0);
        expect(screen.getAllByText(']').length).toBeGreaterThan(0);
        // Raw "[D]" text must not appear — the bracket + icon structure replaces it.
        expect(screen.queryByText('[D]')).toBeNull();
    });

    it('keeps [charge] as text in icon mode (special keyword, not a button)', () => {
        const tokens: ComboToken[] = [
            { type: 'modifier', value: '[charge]', rawValue: '[charge]' },
        ];

        render(<ComboDisplay tokens={[...tokens]} mode="visual-icons" />);

        expect(screen.getByText('[charge]')).not.toBeNull();
    });
});
