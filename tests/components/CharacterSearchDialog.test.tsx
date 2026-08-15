import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  it('does not let an older response overwrite newer search results', async () => {
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
    render(<CharacterSearchDialog open={true} {...defaultProps} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const input = screen.getByPlaceholderText(/search for a character/i);
    fireEvent.change(input, { target: { value: 'Ken' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    await act(async () => {
      resolveSecond({
        ok: true,
        json: async () => [
          {
            title: 'Ken result',
            imageUrl: 'https://example.test/ken.png',
            thumbnailUrl: 'https://example.test/ken-thumb.png',
            width: 800,
            height: 800,
          },
        ],
      } as Response);
    });
    expect(
      await screen.findByRole('button', { name: 'Select image: Ken result' }),
    ).not.toBeNull();

    await act(async () => {
      resolveFirst({
        ok: true,
        json: async () => [
          {
            title: 'Ryu result',
            imageUrl: 'https://example.test/ryu.png',
            thumbnailUrl: 'https://example.test/ryu-thumb.png',
            width: 800,
            height: 800,
          },
        ],
      } as Response);
    });
    expect(screen.queryByText('Ryu result')).toBeNull();
    expect(screen.getByText('Ken result')).not.toBeNull();
  });
});
