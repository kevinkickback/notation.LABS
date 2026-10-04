import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getProviderBase } from '@/lib/providers/endpoints';
import { cn } from '@/lib/utils';
import { fetchImageAsBase64 } from '@/lib/media/images';

describe('cn (className utility)', () => {
  it('resolves Tailwind conflicts after flattening conditional classes', () => {
    expect(cn('px-4 py-2', [undefined, 'extra'], { 'px-8': true, hidden: false })).toBe('py-2 extra px-8');
  });
});

describe('getProviderBase', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('uses deployed services in development without local services', () => {
    vi.stubEnv('VITE_USE_LOCAL_PROVIDERS', '');
    expect(getProviderBase('igdb')).toBe('/api/igdb');
    expect(getProviderBase('image')).toBe('https://ddg.capitol-k.workers.dev');
  });

  it('uses local proxies only when explicitly enabled in development', () => {
    vi.stubEnv('VITE_USE_LOCAL_PROVIDERS', 'true');
    expect(getProviderBase('igdb')).toBe('/api/igdb');
    expect(getProviderBase('image')).toBe('/api/image');
  });

  it('keeps production on deployed services even with the local flag enabled', () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_USE_LOCAL_PROVIDERS', 'true');
    expect(getProviderBase('igdb')).toBe('https://igdb.capitol-k.workers.dev');
    expect(getProviderBase('image')).toBe('https://ddg.capitol-k.workers.dev');
  });
});

describe('fetchImageAsBase64', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('posts the image URL to the worker and returns the data URL', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ dataUrl: 'data:image/png;base64,iVBORw0KGgo=' }),
    });

    const result = await fetchImageAsBase64(
      'https://worker.example/download',
      'https://images.example/cover.png',
    );

    expect(result).toBe('data:image/png;base64,iVBORw0KGgo=');
    expect(fetchMock).toHaveBeenCalledWith('https://worker.example/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://images.example/cover.png' }),
      signal: undefined,
    });
  });

  it('returns null when the worker responds with a non-OK status', async () => {
    fetchMock.mockResolvedValue({ ok: false });

    await expect(
      fetchImageAsBase64(
        'https://worker.example/download',
        'https://images.example/cover.png',
      ),
    ).resolves.toBeNull();
  });

  it('returns null when the fetch throws', async () => {
    fetchMock.mockRejectedValue(new Error('network failure'));

    await expect(
      fetchImageAsBase64(
        'https://worker.example/download',
        'https://images.example/cover.png',
      ),
    ).resolves.toBeNull();
  });
});
