import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CoverSearchDialog } from '@/components/game/CoverSearchDialog';

const defaultProps = {
  onOpenChange: () => { },
  defaultQuery: 'Street Fighter',
  onCoverSelect: () => { },
};

describe('CoverSearchDialog', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });
  });

  it('renders and performs a search', async () => {
    render(<CoverSearchDialog open={true} {...defaultProps} />);
    expect(screen.getByPlaceholderText(/search for a game/i)).not.toBeNull();
    fireEvent.change(screen.getByPlaceholderText(/search for a game/i), {
      target: { value: 'Tekken' },
    });
    fireEvent.click(screen.getAllByRole('button')[0]);
    await waitFor(() => {
      expect(screen.getByText(/no covers found/i)).not.toBeNull();
    });
  });

  it('uses cached results on reopen with the same query without re-fetching', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });
    global.fetch = fetchMock;

    const { rerender } = render(<CoverSearchDialog open={true} {...defaultProps} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    rerender(<CoverSearchDialog open={false} {...defaultProps} />);
    rerender(<CoverSearchDialog open={true} {...defaultProps} />);

    await new Promise((r) => setTimeout(r, 50));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not re-fetch when the search button is clicked with an unchanged query', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });
    global.fetch = fetchMock;

    render(<CoverSearchDialog open={true} {...defaultProps} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getAllByRole('button')[0]);
    await new Promise((r) => setTimeout(r, 400));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fetches a new query then serves the first query from cache on reopen', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });
    global.fetch = fetchMock;

    const { rerender } = render(<CoverSearchDialog open={true} {...defaultProps} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    // Search a different term via the internal input
    fireEvent.change(screen.getByPlaceholderText(/search for a game/i), {
      target: { value: 'Tekken' },
    });
    fireEvent.click(screen.getAllByRole('button')[0]);
    await new Promise((r) => setTimeout(r, 400));
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Close and reopen with the original query — should hit cache
    rerender(<CoverSearchDialog open={false} {...defaultProps} />);
    rerender(<CoverSearchDialog open={true} {...defaultProps} />);

    await new Promise((r) => setTimeout(r, 50));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
