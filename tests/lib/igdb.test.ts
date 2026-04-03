import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { searchIGDB } from '@/lib/igdb';

describe('searchIGDB', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('posts the search query to the IGDB worker and returns the response body', async () => {
    const results = [
      { id: 7, name: 'Street Fighter 6', coverImageId: 'abc123' },
    ];
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => results,
    });

    await expect(searchIGDB('street fighter')).resolves.toEqual(results);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://igdb.capitol-k.workers.dev',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'street fighter' }),
      },
    );
  });

  it('throws a descriptive error when the worker request fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 });

    await expect(searchIGDB('guilty gear')).rejects.toThrow(
      'IGDB search failed: 503',
    );
  });
});
