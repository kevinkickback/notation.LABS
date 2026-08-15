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
        comboScale: 1,
        autoUpdate: true,
        confirmBeforeDelete: false,
        videoPlayerSize: 'lg',
        gameCardSize: 180,
        characterCardSize: 180,
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
            notationProfile: 'standard',
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
            notationProfile: 'standard',
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

    it.each(['colored-text', 'visual-icons'] as const)(
        'uses one neutral separator color for grouping parentheses in %s mode',
        (mode) => {
            const game: Game = {
                id: `grouping-parentheses-${mode}`,
                name: 'Custom Fighter',
                notationProfile: 'standard',
                buttonLayout: ['L', 'M', 'H'],
                buttonColors: {
                    L: '#123456',
                    M: '#abcdef',
                    H: '#fedcba',
                },
                createdAt: 1,
                updatedAt: 1,
            };
            const tokens = parseComboNotation(
                '(214L or 236M+H)',
                game.buttonLayout,
            );

            render(<ComboDisplay tokens={tokens} game={game} mode={mode} />);

            const openingParen = screen.getByText('(');
            const closingParen = screen.getByText(')');

            for (const paren of [openingParen, closingParen]) {
                expect(paren.getAttribute('style')).toContain(
                    'color: rgb(204, 204, 204)',
                );
                expect(paren.getAttribute('class')).toContain('opacity-60');
            }
        },
    );

    it('renders bracket button modifier as icon flanked by bracket spans in icon mode', () => {
        const tokens: ComboToken[] = [
            { type: 'modifier', value: '[D]', rawValue: '[D]' },
        ];

        const game: Game = {
            id: 'game-1',
            name: 'Test Fighter',
            buttonLayout: ['A', 'B', 'C', 'D'],
            notationProfile: 'standard',
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
        expect(screen.getByRole('img', { name: 'Hold Button D' })).not.toBeNull();
    });

    it('renders released buttons with inverse delimiters in icon mode', () => {
        const game: Game = {
            id: 'game-release',
            name: 'Test Fighter',
            notationProfile: 'standard',
            buttonLayout: ['L'],
            buttonColors: { L: '#123456' },
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        const tokens = parseComboNotation('22]L[', game.buttonLayout);

        render(<ComboDisplay tokens={tokens} game={game} mode="visual-icons" />);

        expect(screen.getByRole('img', { name: 'Release Button L' })).not.toBeNull();
        expect(screen.getByText(']')).not.toBeNull();
        expect(screen.getByText('[')).not.toBeNull();
        expect(screen.queryByText(']L[')).toBeNull();
    });

    it('renders bracketed numpad inputs as held directions unless configured as buttons', () => {
        const directionGame: Game = {
            id: 'numpad-hold',
            name: 'Numpad Fighter',
            notationProfile: 'standard',
            buttonLayout: ['L', 'M', 'H'],
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        const buttonGame: Game = {
            ...directionGame,
            id: 'numeric-buttons',
            buttonLayout: ['1', '2', '3', '4'],
        };
        const tokens = parseComboNotation('[2]', directionGame.buttonLayout);

        const { rerender } = render(
            <ComboDisplay tokens={tokens} game={directionGame} mode="visual-icons" />,
        );

        const heldDown = screen.getByRole('img', { name: 'Hold Down' });
        expect(heldDown.getAttribute('class')).toContain('motion-icon--hold');
        expect(screen.queryByRole('img', { name: 'Hold Button 2' })).toBeNull();

        rerender(
            <ComboDisplay tokens={tokens} game={buttonGame} mode="visual-icons" />,
        );

        expect(screen.getByRole('img', { name: 'Hold Button 2' })).not.toBeNull();
        expect(screen.queryByRole('img', { name: 'Hold Down' })).toBeNull();
    });

    it('keeps [charge] as text in icon mode (special keyword, not a button)', () => {
        const tokens: ComboToken[] = [
            { type: 'modifier', value: '[charge]', rawValue: '[charge]' },
        ];

        render(<ComboDisplay tokens={[...tokens]} mode="visual-icons" />);

        expect(screen.getByText('[charge]')).not.toBeNull();
    });

    it('renders NRS directions sequentially with accessible button names', () => {
        const game: Game = {
            id: 'mk1',
            name: 'Mortal Kombat 1',
            notationProfile: 'nrs',
            buttonLayout: ['1', '2', '3', '4'],
            createdAt: 1,
            updatedAt: 1,
        };
        const tokens = parseComboNotation('DF1 AMP', game.buttonLayout, {
            profile: 'nrs',
        });

        render(<ComboDisplay tokens={tokens} game={game} mode="visual-icons" />);

        expect(screen.getByRole('img', { name: 'Down' })).not.toBeNull();
        expect(screen.getByRole('img', { name: 'Forward' })).not.toBeNull();
        expect(
            screen.getByRole('img', { name: 'Button 1, Attack 1' }),
        ).not.toBeNull();
        expect(
            screen.getByRole('img', { name: 'AMP, Amplified move' }),
        ).not.toBeNull();
    });

    it('renders common Injustice inputs through the NRS profile', () => {
        const game: Game = {
            id: 'injustice-2',
            name: 'Injustice 2',
            notationProfile: 'nrs',
            buttonLayout: ['1', '2', '3', '4'],
            createdAt: 1,
            updatedAt: 1,
        };
        const tokens = parseComboNotation('B3 > JI2 xx BF2 MB', game.buttonLayout, {
            profile: 'nrs',
        });

        render(<ComboDisplay tokens={tokens} game={game} mode="visual-icons" />);

        expect(
            screen.getByRole('img', { name: 'Button 3, Attack 3' }),
        ).not.toBeNull();
        expect(
            screen.getByRole('img', { name: 'JI, Jump-in attack' }),
        ).not.toBeNull();
        expect(screen.getByRole('img', { name: 'MB, Meter Burn' })).not.toBeNull();
    });

    it('renders MK1 legend buttons, diagonals, and annotations accessibly', () => {
        const game: Game = {
            id: 'mk1-legend',
            name: 'Mortal Kombat 1',
            notationProfile: 'nrs',
            buttonLayout: ['1', '2', '3', '4'],
            createdAt: 1,
            updatedAt: 1,
        };
        const tokens = parseComboNotation(
            'U/F 1, TH BL FL K, JF 2 EX (HOLD), (SWAP SIDE), (AIR) 3',
            game.buttonLayout,
            { profile: 'nrs' },
        );

        render(<ComboDisplay tokens={tokens} game={game} mode="visual-icons" />);

        expect(screen.getByRole('img', { name: 'Up Forward' })).not.toBeNull();
        expect(screen.getByRole('img', { name: 'Button TH, Throw' })).not.toBeNull();
        expect(screen.getByRole('img', { name: 'Button BL, Block' })).not.toBeNull();
        expect(
            screen.getByRole('img', { name: 'Button FL, Flip Stance' }),
        ).not.toBeNull();
        expect(
            screen.getByRole('img', { name: 'Button K, Kameo Input' }),
        ).not.toBeNull();
        expect(screen.getByRole('img', { name: 'JF, Jump forward' })).not.toBeNull();
        expect(
            screen.getByRole('img', { name: 'Hold Button 2, Attack 2' }),
        ).not.toBeNull();
        expect(
            screen.queryByRole('img', { name: '(hold), Hold the preceding input' }),
        ).toBeNull();
        expect(
            screen.getByRole('img', {
                name: '(swap side), Switch sides during the combo',
            }),
        ).not.toBeNull();
        expect(screen.getByRole('img', { name: 'AIR, Airborne input' })).not.toBeNull();
    });

    it('renders recognized Standard mechanics as labeled badges', () => {
        const game: Game = {
            id: 'standard-game',
            name: 'Standard Fighter',
            notationProfile: 'standard',
            buttonLayout: ['L', 'M', 'H'],
            createdAt: 1,
            updatedAt: 1,
        };
        const tokens = parseComboNotation('iad jc. (whiff)', game.buttonLayout, {
            profile: 'standard',
        });

        render(<ComboDisplay tokens={tokens} game={game} mode="visual-icons" />);

        expect(screen.getByRole('img', { name: 'iad mechanic' })).not.toBeNull();
        expect(screen.getByRole('img', { name: 'jc. mechanic' })).not.toBeNull();
        expect(
            screen.getByRole('img', { name: '(whiff) mechanic' }),
        ).not.toBeNull();
    });

    it('renders recognized Tekken mechanics and states as labeled badges', () => {
        const game: Game = {
            id: 'tekken-8-mechanics',
            name: 'Tekken 8',
            notationProfile: 'tekken',
            buttonLayout: ['1', '2', '3', '4'],
            createdAt: 1,
            updatedAt: 1,
        };
        const tokens = parseComboNotation(
            'f+2 W! WB! WS H. FD/FT',
            game.buttonLayout,
            { profile: 'tekken' },
        );

        render(<ComboDisplay tokens={tokens} game={game} mode="visual-icons" />);

        for (const mechanic of ['WS', 'H.', 'FD/FT']) {
            expect(
                screen.getByRole('img', { name: `${mechanic} mechanic` }),
            ).not.toBeNull();
        }
        expect(screen.getByRole('img', { name: 'W!, Wall splat' })).not.toBeNull();
        expect(screen.getByRole('img', { name: 'WB!, Wall break' })).not.toBeNull();
    });

    it('renders expanded Tekken legend terms with accessible meanings', () => {
        const game: Game = {
            id: 'tekken-legend',
            name: 'Tekken',
            notationProfile: 'tekken',
            buttonLayout: ['1', '2', '3', '4'],
            createdAt: 1,
            updatedAt: 1,
        };
        const tokens = parseComboNotation(
            '(1),2*(max) ► (Switch) ► iWS,3,S! ► Heat Smash',
            game.buttonLayout,
            { profile: 'tekken' },
        );

        render(<ComboDisplay tokens={tokens} game={game} mode="visual-icons" />);

        expect(
            screen.getByLabelText('Start required omitted input'),
        ).not.toBeNull();
        expect(screen.getByLabelText('End required omitted input')).not.toBeNull();
        expect(
            screen.getByRole('img', {
                name: '*(max), Hold the preceding button to maximum level',
            }),
        ).not.toBeNull();
        expect(
            screen.getByRole('img', { name: '(Switch), Side switch' }),
        ).not.toBeNull();
        expect(
            screen.getByRole('img', {
                name: 'iWS, Instant While Standing',
            }),
        ).not.toBeNull();
        expect(
            screen.getByRole('img', { name: 'S!, Screw attack' }),
        ).not.toBeNull();
        expect(
            screen.getByRole('img', { name: 'Heat Smash, Heat Smash' }),
        ).not.toBeNull();
    });

    it('renders Tekken neutral and distinguishes tap from held directions', () => {
        const game: Game = {
            id: 'tekken-8',
            name: 'Tekken 8',
            notationProfile: 'tekken',
            buttonLayout: ['1', '2', '3', '4'],
            createdAt: 1,
            updatedAt: 1,
        };
        const tokens = parseComboNotation('f,N,D/F+2', game.buttonLayout, {
            profile: 'tekken',
        });

        render(<ComboDisplay tokens={tokens} game={game} mode="visual-icons" />);

        expect(screen.getByRole('img', { name: 'Tap Forward' })).not.toBeNull();
        expect(screen.getByRole('img', { name: 'Neutral' })).not.toBeNull();
        expect(
            screen.getByRole('img', { name: 'Hold Down Forward' }),
        ).not.toBeNull();
        expect(
            screen
                .getByRole('img', { name: 'Hold Down Forward' })
                .getAttribute('class'),
        ).toContain('motion-icon--hold');
        expect(
            screen.getByRole('img', { name: 'Button 2, Right Punch' }),
        ).not.toBeNull();
        expect(screen.queryByText('H')).toBeNull();
    });

    it('applies NRS hold annotations to preceding directions and buttons', () => {
        const game: Game = {
            id: 'mk1-holds',
            name: 'Mortal Kombat 1',
            notationProfile: 'nrs',
            buttonLayout: ['1', '2', '3', '4'],
            createdAt: 1,
            updatedAt: 1,
        };
        const tokens = parseComboNotation('B (HOLD), F 3 (HOLD)', game.buttonLayout, {
            profile: 'nrs',
        });

        render(<ComboDisplay tokens={tokens} game={game} mode="visual-icons" />);

        const heldBack = screen.getByRole('img', { name: 'Hold Back' });
        expect(heldBack.getAttribute('class')).toContain('motion-icon--hold');
        expect(
            screen.getByRole('img', { name: 'Hold Button 3, Attack 3' }),
        ).not.toBeNull();
        expect(screen.getByText('Hold')).not.toBeNull();
        expect(screen.queryByText('H')).toBeNull();
        expect(
            screen.queryByRole('img', { name: '(hold), Hold the preceding input' }),
        ).toBeNull();
    });

    it('keeps Tekken neutral on the direction color within a button group', () => {
        const game: Game = {
            id: 'tekken-neutral-color',
            name: 'Tekken 7',
            notationProfile: 'tekken',
            buttonLayout: ['1', '2', '3', '4'],
            buttonColors: { '4': '#123456' },
            createdAt: 1,
            updatedAt: 1,
        };
        const tokens = parseComboNotation('U/F N 4', game.buttonLayout, {
            profile: 'tekken',
        });

        const { rerender } = render(
            <ComboDisplay tokens={tokens} game={game} mode="visual-icons" />,
        );

        const neutralStar = screen.getByRole('img', { name: 'Neutral' });
        expect(neutralStar.querySelector('path')?.getAttribute('fill')).toBe(
            '#fff',
        );

        rerender(<ComboDisplay tokens={tokens} game={game} mode="colored-text" />);
        expect(screen.getByText('N').getAttribute('style')).toContain(
            'color: rgb(255, 255, 255)',
        );
    });

    it('supports Tekken 8 explicit and Tekken 7 comma move boundaries', () => {
        const game: Game = {
            id: 'tekken-separators',
            name: 'Tekken 8',
            notationProfile: 'tekken',
            buttonLayout: ['1', '2', '3', '4'],
            createdAt: 1,
            updatedAt: 1,
        };
        const explicitBoundaries = ['►', '>', '→', '»'];
        const firstTekken8Combo = parseComboNotation(
            `WS1,2 ${explicitBoundaries[0]} uf1 ${explicitBoundaries[0]} f2,3`,
            game.buttonLayout,
            { profile: 'tekken' },
        );
        const { rerender } = render(
            <ComboDisplay
                tokens={firstTekken8Combo}
                game={game}
                mode="visual-icons"
            />,
        );

        for (const boundary of explicitBoundaries) {
            const tekken8Combo = parseComboNotation(
                `WS1,2 ${boundary} uf1 ${boundary} f2,3`,
                game.buttonLayout,
                { profile: 'tekken' },
            );
            rerender(
                <ComboDisplay
                    tokens={tekken8Combo}
                    game={game}
                    mode="visual-icons"
                />,
            );

            expect(screen.getAllByText('→')).toHaveLength(2);
            expect(screen.queryByText(',')).toBeNull();
        }

        const tekken7Combo = parseComboNotation(
            'd d/f f 1 , U/F N 4 , d d/f f 1 , f 1 , d d/f f 1 , f 3 2 , f f f 2 3 W! , d d/f f 2+3 , SSR f 2+3',
            game.buttonLayout,
            { profile: 'tekken' },
        );
        rerender(
            <ComboDisplay tokens={tekken7Combo} game={game} mode="visual-icons" />,
        );

        expect(screen.getAllByText('→')).toHaveLength(8);
        expect(screen.queryByText(',')).toBeNull();
    });

    it('keeps Tekken 7 input spacing readable in colored text', () => {
        const game: Game = {
            id: 'tekken-7-spacing',
            name: 'Tekken 7',
            notationProfile: 'tekken',
            buttonLayout: ['1', '2', '3', '4'],
            createdAt: 1,
            updatedAt: 1,
        };
        const notation = 'd d/f f 1 , U/F N 4';
        const tokens = parseComboNotation(notation, game.buttonLayout, {
            profile: 'tekken',
        });

        const { container } = render(
            <ComboDisplay tokens={tokens} game={game} mode="colored-text" />,
        );

        expect(container.textContent).toBe(notation);
        expect(container.querySelectorAll('.whitespace-pre').length).toBeGreaterThan(0);
    });

    it('preserves raw NRS community notation and spacing in colored-text mode', () => {
        const game: Game = {
            id: 'mk11',
            name: 'Mortal Kombat 11',
            notationProfile: 'nrs',
            buttonLayout: ['1', '2', '3', '4'],
            createdAt: 1,
            updatedAt: 1,
        };
        const notation = 'F 2 2 D B 2 ex, B K, (AIR) 1 2 2';
        const tokens = parseComboNotation(notation, game.buttonLayout, {
            profile: 'nrs',
        });

        const { container } = render(
            <ComboDisplay tokens={tokens} game={game} mode="colored-text" />,
        );

        expect(container.textContent).toBe(notation);
        expect(screen.getByText('ex')).not.toBeNull();
        expect(screen.queryByText('EX')).toBeNull();
        expect(container.querySelectorAll('.whitespace-pre').length).toBeGreaterThan(0);
    });

    it('keeps unknown NRS stance names visible in icon mode', () => {
        const game: Game = {
            id: 'future-nrs-game',
            name: 'Future NRS-style Game',
            notationProfile: 'nrs',
            buttonLayout: ['1', '2', '3', '4'],
            createdAt: 1,
            updatedAt: 1,
        };
        const tokens = parseComboNotation('SENTO STANCE 4', game.buttonLayout, {
            profile: 'nrs',
        });

        render(<ComboDisplay tokens={tokens} game={game} mode="visual-icons" />);

        expect(screen.getByText('SENTO STANCE')).not.toBeNull();
        expect(
            screen.getByRole('img', { name: 'Button 4, Attack 4' }),
        ).not.toBeNull();
    });
});
