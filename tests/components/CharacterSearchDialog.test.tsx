import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CharacterSearchDialog } from '@/components/character/CharacterSearchDialog';

const defaultProps = {
  onOpenChange: () => { },
  searchQuery: 'Ryu',
  onImageSelect: () => { },
};

describe('CharacterSearchDialog', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });
  });

  it('renders and performs a search', async () => {
    render(<CharacterSearchDialog open={true} {...defaultProps} />);
    expect(
      screen.getByPlaceholderText(/search for a character/i),
    ).not.toBeNull();
    fireEvent.change(screen.getByPlaceholderText(/search for a character/i), {
      target: { value: 'Ken' },
    });
    fireEvent.click(screen.getAllByRole('button')[0]);
    await waitFor(() => {
      expect(screen.getByText(/no images found/i)).not.toBeNull();
    });
  });

  it('uses cached results on reopen with the same query without re-fetching', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });
    global.fetch = fetchMock;

    const { rerender } = render(<CharacterSearchDialog open={true} {...defaultProps} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    rerender(<CharacterSearchDialog open={false} {...defaultProps} />);
    rerender(<CharacterSearchDialog open={true} {...defaultProps} />);

    await new Promise((r) => setTimeout(r, 50));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not re-fetch when the search button is clicked with an unchanged query', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });
    global.fetch = fetchMock;

    render(<CharacterSearchDialog open={true} {...defaultProps} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getAllByRole('button')[0]);
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fetches a new query then serves the first query from cache on reopen', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });
    global.fetch = fetchMock;

    const { rerender } = render(<CharacterSearchDialog open={true} {...defaultProps} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    // Search a different term via the internal input
    fireEvent.change(screen.getByPlaceholderText(/search for a character/i), {
      target: { value: 'Ken' },
    });
    fireEvent.click(screen.getAllByRole('button')[0]);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    // Close and reopen with the original query — should hit cache
    rerender(<CharacterSearchDialog open={false} {...defaultProps} />);
    rerender(<CharacterSearchDialog open={true} {...defaultProps} />);

    await new Promise((r) => setTimeout(r, 50));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
