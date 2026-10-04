import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';
import { CharacterSearchDialog } from '@/components/character/CharacterSearchDialog';

const defaultProps = {
  onOpenChange: () => { },
  searchQuery: 'Ryu',
  onImageSelect: () => { },
};

afterEach(() => vi.unstubAllGlobals());

describe('CharacterSearchDialog', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    }));
  });

  it('shows query results and reuses successful and empty searches across reopening', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [{ title: 'Ryu result', imageUrl: 'https://example.test/ryu.png', thumbnailUrl: '', width: 800, height: 800 }] })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });
    vi.stubGlobal('fetch', fetchMock);
    const { rerender } = render(<CharacterSearchDialog open {...defaultProps} />);
    await screen.findByRole('button', { name: 'Select image: Ryu result' });
    const search = screen.getByRole('button', { name: 'Search character images' });
    await act(async () => fireEvent.click(search));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByRole('textbox', { name: 'Character image search query' }), { target: { value: 'Ken' } });
    await act(async () => fireEvent.click(search));
    expect(screen.getByText('No images found')).not.toBeNull();
    expect(fetchMock.mock.calls.map(([, options]) => JSON.parse(options.body).query)).toEqual(['Ryu', 'Ken']);
    await act(async () => fireEvent.click(search));
    expect(fetchMock).toHaveBeenCalledTimes(2);

    rerender(<CharacterSearchDialog open={false} {...defaultProps} />);
    rerender(<CharacterSearchDialog open {...defaultProps} />);
    await screen.findByRole('button', { name: 'Select image: Ryu result' });
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
    vi.stubGlobal('fetch', fetchMock);
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
