import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cn, fetchImageAsBase64, getApiBase } from '@/lib/utils';

describe('cn (className utility)', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    const isHidden = false;
    expect(cn('base', isHidden && 'hidden', 'extra')).toBe('base extra');
  });

  it('handles undefined and null', () => {
    expect(cn('base', undefined, null, 'extra')).toBe('base extra');
  });

  it('merges tailwind classes with conflict resolution', () => {
    const result = cn('px-4 py-2', 'px-8');
    expect(result).toBe('py-2 px-8');
  });

  it('returns empty string for no arguments', () => {
    expect(cn()).toBe('');
  });

  it('handles array inputs', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar');
  });
});

describe('getApiBase', () => {
  it('returns the IGDB worker URL', () => {
    expect(getApiBase('igdb')).toBe('https://igdb.capitol-k.workers.dev');
  });

  it('returns the DDG worker URL', () => {
    expect(getApiBase('ddg')).toBe('https://ddg.capitol-k.workers.dev');
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
      json: async () => ({ dataUrl: 'data:image/png;base64,abc123' }),
    });

    const result = await fetchImageAsBase64(
      'https://worker.example/download',
      'https://images.example/cover.png',
    );

    expect(result).toBe('data:image/png;base64,abc123');
    expect(fetchMock).toHaveBeenCalledWith('https://worker.example/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://images.example/cover.png' }),
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
