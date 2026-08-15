import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { searchIgdbGames } from '@/lib/providers/igdbProvider';

describe('searchIgdbGames', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('posts the search query and returns normalized results', async () => {
    const results = [
      { id: 7, name: 'Street Fighter 6', coverImageId: 'abc123' },
    ];
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => results,
    });

    await expect(searchIgdbGames('street fighter')).resolves.toEqual([
      {
        igdbId: 7,
        name: 'Street Fighter 6',
        coverImageId: 'abc123',
        firstReleaseDate: null,
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/igdb',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'street fighter' }),
        signal: undefined,
      },
    );
  });

  it('throws a descriptive error when the worker request fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 });

    await expect(searchIgdbGames('guilty gear')).rejects.toThrow(
      'IGDB search failed: 503',
    );
  });
});
