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

  it('keeps results when a game has no cover or release date', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [
      { id: 3186, name: 'Street Fighter II', coverImageId: 'co55et', firstReleaseDate: 665366400 },
      { id: 387971, name: 'Barcode Battler II: Street Fighter II - 1. Hadouken', coverImageId: null, firstReleaseDate: 725760000 },
      { id: 267546, name: 'Street Fighter III', coverImageId: 'co7t3g', firstReleaseDate: null },
      { id: 6708, name: 'Street Fighter III: New Generation', cover: null, first_release_date: null },
      { id: 6710, name: 'Street Fighter III: 3rd Strike', cover: { image_id: null } },
    ] });
    const results = await searchIgdbGames('Street Fighter 2');
    expect(results).toHaveLength(5);
    expect(results[0].coverImageId).toBe('co55et');
    expect(results[1].coverImageId).toBeNull();
    expect(results[2].firstReleaseDate).toBeNull();
    expect(results[3]).toMatchObject({ coverImageId: null, firstReleaseDate: null });
    expect(results[4].coverImageId).toBeNull();
  });

  it('still rejects incorrectly typed provider fields', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [
      { id: 1, name: 'Invalid game', firstReleaseDate: 'unknown' },
    ] });
    await expect(searchIgdbGames('invalid')).rejects.toThrow('invalid response shape');
  });
});
