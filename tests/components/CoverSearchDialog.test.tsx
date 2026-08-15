import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

    await act(async () => {
      rerender(<CoverSearchDialog open={false} {...defaultProps} />);
      rerender(<CoverSearchDialog open={true} {...defaultProps} />);
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
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
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
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
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Close and reopen with the original query — should hit cache
    await act(async () => {
      rerender(<CoverSearchDialog open={false} {...defaultProps} />);
      rerender(<CoverSearchDialog open={true} {...defaultProps} />);
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not let an older response overwrite newer cover results', async () => {
    let resolveFirst!: (value: Response) => void;
    let resolveSecond!: (value: Response) => void;
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(
        () => new Promise<Response>((resolve) => (resolveFirst = resolve)),
      )
      .mockImplementationOnce(
        () => new Promise<Response>((resolve) => (resolveSecond = resolve)),
      );
    global.fetch = fetchMock;
    render(<CoverSearchDialog open={true} {...defaultProps} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const input = screen.getByPlaceholderText(/search for a game/i);
    fireEvent.change(input, { target: { value: 'Tekken' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    await act(async () => {
      resolveSecond({
        ok: true,
        json: async () => [
          { id: 2, name: 'Tekken 8', coverImageId: 'tekken-cover' },
        ],
      } as Response);
    });
    expect(await screen.findByText('Tekken 8')).not.toBeNull();

    await act(async () => {
      resolveFirst({
        ok: true,
        json: async () => [
          { id: 1, name: 'Street Fighter 6', coverImageId: 'sf-cover' },
        ],
      } as Response);
    });
    expect(screen.queryByText('Street Fighter 6')).toBeNull();
    expect(screen.getByText('Tekken 8')).not.toBeNull();
  });
});
