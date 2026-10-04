import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';
import { CoverSearchDialog } from '@/components/game/CoverSearchDialog';

const defaultProps = {
  onOpenChange: () => { },
  defaultQuery: 'Street Fighter',
  onCoverSelect: () => { },
};

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('CoverSearchDialog', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    }));
  });

  it('shows query results and reuses successful and empty searches across reopening', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: 1, name: 'Street Fighter result', coverImageId: 'cover' }] })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });
    vi.stubGlobal('fetch', fetchMock);
    let view!: ReturnType<typeof render>;
    await act(async () => { view = render(<CoverSearchDialog open {...defaultProps} />); });
    expect(screen.getByRole('button', { name: 'Select cover for Street Fighter result' })).not.toBeNull();
    const search = screen.getByRole('button', { name: 'Search covers' });
    fireEvent.click(search);
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByRole('textbox', { name: 'Game search query' }), { target: { value: 'Tekken' } });
    fireEvent.click(search);
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(screen.getByText('No covers found')).not.toBeNull();
    expect(fetchMock.mock.calls.map(([, options]) => JSON.parse(options.body).query)).toEqual(['Street Fighter', 'Tekken']);
    fireEvent.click(search);
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    view.rerender(<CoverSearchDialog open={false} {...defaultProps} />);
    await act(async () => { view.rerender(<CoverSearchDialog open {...defaultProps} />); });
    expect(screen.getByRole('button', { name: 'Select cover for Street Fighter result' })).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('shows available covers while a coverless result stays disabled without a download spinner', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [
      { id: 1, name: 'Street Fighter III', coverImageId: 'co7t3g', firstReleaseDate: null },
      { id: 2, name: 'Coverless game', coverImageId: null },
    ] }));
    render(<CoverSearchDialog open {...defaultProps} />);
    const unavailable = await screen.findByRole('button', { name: 'Select cover for Coverless game' });
    expect(unavailable.hasAttribute('disabled')).toBe(true);
    expect(unavailable.querySelector('.animate-spin')).toBeNull();
    expect(screen.getByRole('button', { name: 'Select cover for Street Fighter III' }).hasAttribute('disabled')).toBe(false);
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
    vi.stubGlobal('fetch', fetchMock);
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
