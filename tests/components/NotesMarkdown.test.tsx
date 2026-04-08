import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CharacterViewNotes } from '@/components/character/CharacterViewNotes';
import { ComboViewNotes } from '@/components/combo/ComboViewNotes';

describe('Notes markdown rendering', () => {
    it('renders markdown formatting inside combo notes', () => {
        render(
            <ComboViewNotes
                notes={'Use **drive rush** to extend confirms.'}
                isOpen={true}
                onToggle={() => { }}
            />,
        );

        const boldText = screen.getByText('drive rush');
        expect(boldText.tagName).toBe('STRONG');
    });

    it('prevents script tags from rendering in character notes', () => {
        render(
            <CharacterViewNotes
                notes={"Safe text <script>alert('xss')</script>"}
                isOpen={true}
                onToggle={() => { }}
            />,
        );

        expect(document.querySelector('script')).toBeNull();
        expect(screen.getByText(/safe text/i)).not.toBeNull();
    });

    it('renders markdown links with secure external attributes', () => {
        render(
            <CharacterViewNotes
                notes={'[Matchup chart](https://example.com/matchups)'}
                isOpen={true}
                onToggle={() => { }}
            />,
        );

        const link = screen.getByRole('link', { name: /matchup chart/i });
        expect(link.getAttribute('href')).toBe('https://example.com/matchups');
        expect(link.getAttribute('target')).toBe('_blank');
        expect(link.getAttribute('rel')).toContain('noopener');
        expect(link.getAttribute('rel')).toContain('noreferrer');
    });
});