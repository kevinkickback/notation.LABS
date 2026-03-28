import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { CoverSearchDialog } from '@/components/game/CoverSearchDialog';

describe('CoverSearchDialog', () => {
    beforeAll(() => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => [],
        });
    });
    it('renders and performs a search', async () => {
        render(
            <CoverSearchDialog
                open={true}
                onOpenChange={() => { }}
                defaultQuery="Street Fighter"
                onCoverSelect={() => { }}
            />
        );
        // Should show loading or search UI
        expect(screen.getByPlaceholderText(/search for a game/i)).not.toBeNull();
        // Simulate user typing and searching
        fireEvent.change(screen.getByPlaceholderText(/search for a game/i), { target: { value: 'Tekken' } });
        fireEvent.click(screen.getAllByRole('button')[0]);
        // Wait for results or error
        await waitFor(() => {
            expect(screen.getByText(/no covers found/i)).not.toBeNull();
        });
    });
});
