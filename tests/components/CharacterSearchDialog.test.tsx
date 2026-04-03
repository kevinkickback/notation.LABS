import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { CharacterSearchDialog } from '@/components/character/CharacterSearchDialog';

describe('CharacterSearchDialog', () => {
  beforeAll(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });
  });
  it('renders and performs a search', async () => {
    render(
      <CharacterSearchDialog
        open={true}
        onOpenChange={() => {}}
        searchQuery="Ryu"
        onImageSelect={() => {}}
      />,
    );
    // Should show loading or search UI
    expect(
      screen.getByPlaceholderText(/search for a character/i),
    ).not.toBeNull();
    // Simulate user typing and searching
    fireEvent.change(screen.getByPlaceholderText(/search for a character/i), {
      target: { value: 'Ken' },
    });
    fireEvent.click(screen.getAllByRole('button')[0]);
    // Wait for results or error
    await waitFor(() => {
      expect(screen.getByText(/no images found/i)).not.toBeNull();
    });
  });
});
