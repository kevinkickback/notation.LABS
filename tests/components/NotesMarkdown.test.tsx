import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { NotesMarkdown } from '@/components/shared/NotesMarkdown';

describe('Notes markdown rendering', () => {
    it('renders markdown formatting inside character notes', () => {
        render(
            <NotesMarkdown
                content={'Use **drive rush** to extend confirms.'}
            />,
        );

        const boldText = screen.getByText('drive rush');
        expect(boldText.tagName).toBe('STRONG');
    });

    it('prevents script tags from rendering in character notes', () => {
        render(
            <NotesMarkdown
                content={"Safe text <script>alert('xss')</script>"}
            />,
        );

        expect(document.querySelector('script')).toBeNull();
        expect(screen.getByText(/safe text/i)).not.toBeNull();
    });

    it('renders markdown links with secure external attributes', () => {
        render(
            <NotesMarkdown
                content={'[Matchup chart](https://example.com/matchups)'}
            />,
        );

        const link = screen.getByRole('link', { name: /matchup chart/i });
        expect(link.getAttribute('href')).toBe('https://example.com/matchups');
        expect(link.getAttribute('target')).toBe('_blank');
        expect(link.getAttribute('rel')).toContain('noopener');
        expect(link.getAttribute('rel')).toContain('noreferrer');
    });
});
