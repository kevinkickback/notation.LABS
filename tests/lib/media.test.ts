import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchImageAsBase64, inspectImageDataUrl, isImageDataUrl, MAX_IMAGE_SIZE_BYTES, MAX_EMBEDDED_IMAGE_BYTES, readImageFile } from '@/lib/media/images';
import { extractYouTubeVideoId, fetchYouTubeTitle, getYouTubeEmbedUrl } from '@/lib/media/youtube';
import { downloadIgdbCover } from '@/lib/providers/igdbProvider';
import { searchCharacterImages } from '@/lib/providers/imageSearchProvider';

const png = 'data:image/png;base64,iVBORw0KGgo=';
const imageUrl = 'https://images.example/cover.png';
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('image acquisition', () => {
  it.each([png, 'data:image/jpeg;base64,/9j/AA==', 'data:image/gif;base64,R0lGODlh', 'data:image/webp;base64,UklGRgAAAABXRUJQ', 'data:image/bmp;base64,Qk0='])('accepts supported raster signature %s', value => {
    expect(isImageDataUrl(value)).toBe(true);
  });
  it.each([null, 3, {}, 'https://example.com/image.png', 'data:text/html;base64,PGgxPg==', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,/9j/AA==', 'data:image/png;base64,invalid', 'data:image/png;base64,iVBORw0KGgo=AAAA', 'data:image/gif;base64,R0lGODBh'])('rejects malformed or incorrectly typed images', value => {
    expect(isImageDataUrl(value)).toBe(false);
  });
  it('rejects oversized data URLs before decoding', () => {
    expect(isImageDataUrl(`data:image/png;base64,iVBORw0KGgoA${'A'.repeat(Math.ceil(MAX_IMAGE_SIZE_BYTES / 3) * 4)}`)).toBe(false);
  });
  it('keeps raster validation strict while allowing a caller to inspect a safe legacy MIME mismatch', () => {
    const value = 'data:image/png;base64,/9j/AA==';
    expect(isImageDataUrl(value)).toBe(false);
    expect(inspectImageDataUrl(value)).toMatchObject({ mimeType: 'image/jpeg', declaredMimeType: 'image/png' });
    expect(inspectImageDataUrl('data:text/html;base64,/9j/AA==')).toBeUndefined();
    expect(inspectImageDataUrl(png, 7)).toBeUndefined();
    expect(inspectImageDataUrl(png, 8)).toBeDefined();
  });
  it('accepts large desktop uploads while retaining the web upload limit', async () => {
    const bytes = new Uint8Array(MAX_IMAGE_SIZE_BYTES + 1).fill(42);
    bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
    const file = new File([bytes], 'large.png', { type: 'image/png' });
    vi.spyOn(file, 'slice').mockReturnValue({ arrayBuffer: async () => bytes.buffer } as Blob);
    await expect(readImageFile(file, new AbortController().signal)).rejects.toThrow('2MB');
    vi.stubGlobal('electronAPI', {});
    const uploaded = await readImageFile(file, new AbortController().signal);
    expect(isImageDataUrl(uploaded, MAX_EMBEDDED_IMAGE_BYTES)).toBe(true);
    expect(isImageDataUrl(uploaded)).toBe(false);
  });
  it('rejects an image beyond the desktop record budget before reading it', async () => {
    vi.stubGlobal('electronAPI', {});
    const file = new File([], 'huge.png', { type: 'image/png' });
    vi.spyOn(file, 'size', 'get').mockReturnValue(MAX_EMBEDDED_IMAGE_BYTES + 1);
    const read = vi.spyOn(file, 'slice');
    await expect(readImageFile(file, new AbortController().signal)).rejects.toThrow('memory');
    expect(read).not.toHaveBeenCalled();
  });
  it.each([{ dataUrl: 1 }, { dataUrl: 'https://example.com/image' }, null, { dataUrl: 'data:image/png;base64,abc123' }])('validates downloaded provider payloads', async raw => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => raw }));
    await expect(fetchImageAsBase64('/api/image/download', imageUrl)).resolves.toBeNull();
  });
  it('rejects unsafe source URLs before contacting the provider', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    for (const url of ['file:///secret', 'javascript:alert(1)', 'https://user:pass@example.com/image']) {
      await expect(fetchImageAsBase64('/api/download', url)).resolves.toBeNull();
    }
    expect(fetch).not.toHaveBeenCalled();
  });
  it('retains cover size fallbacks for unusable downloads', async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ dataUrl: 1 }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ dataUrl: png }) });
    vi.stubGlobal('fetch', fetch);
    await expect(downloadIgdbCover('co123')).resolves.toBe(png);
    expect(fetch.mock.calls.map(call => JSON.parse(call[1].body).url)).toEqual([
      'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co123.jpg',
      'https://images.igdb.com/igdb/image/upload/t_cover_big/co123.jpg',
    ]);
  });
  it('stops cover fallbacks when cancelled even if the provider ignores abort', async () => {
    const controller = new AbortController();
    const fetch = vi.fn().mockImplementation(async () => { controller.abort(); return { ok: true, json: async () => ({ dataUrl: png }) }; });
    vi.stubGlobal('fetch', fetch);
    await expect(downloadIgdbCover('co123', controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('validates URLs in character image search results', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [{ title: 'Bad', thumbnailUrl: 'javascript:alert(1)', imageUrl, width: 1, height: 1 }] }));
    await expect(searchCharacterImages('bad')).rejects.toThrow('Invalid image search response');
  });
  it('reads a validated local file and rejects mismatched MIME types', async () => {
    const bytes = Uint8Array.from(atob(png.split(',')[1]), char => char.charCodeAt(0));
    const file = new File([bytes], 'cover.png', { type: 'image/png' });
    vi.spyOn(file, 'slice').mockReturnValue({ arrayBuffer: async () => bytes.buffer } as Blob);
    await expect(readImageFile(file, new AbortController().signal)).resolves.toBe(png);
    const fake = new File([bytes], 'fake.jpg', { type: 'image/jpeg' });
    vi.spyOn(fake, 'slice').mockReturnValue({ arrayBuffer: async () => bytes.buffer } as Blob);
    await expect(readImageFile(fake, new AbortController().signal)).rejects.toThrow('Unsupported or invalid image');
  });
  it('reports local file read failures and cancels the active reader', async () => {
    const bytes = new Uint8Array([0x42, 0x4d]);
    const file = new File([bytes], 'cover.bmp', { type: 'image/bmp' });
    vi.spyOn(file, 'slice').mockReturnValue({ arrayBuffer: async () => bytes.buffer } as Blob);
    vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function(this: FileReader) { this.dispatchEvent(new ProgressEvent('error')); });
    await expect(readImageFile(file, new AbortController().signal)).rejects.toThrow('Failed to read image');
    const controller = new AbortController();
    vi.spyOn(FileReader.prototype, 'abort').mockImplementation(function(this: FileReader) { this.dispatchEvent(new ProgressEvent('abort')); });
    vi.mocked(FileReader.prototype.readAsDataURL).mockImplementation(() => controller.abort());
    await expect(readImageFile(file, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('YouTube media contracts', () => {
  const id = 'dQw4w9WgXcQ';
  it.each([`https://www.youtube.com/watch?v=${id}`, `https://m.youtube.com/watch?v=${id}&t=10`, `https://youtu.be/${id}?t=10`, `https://www.youtube.com/shorts/${id}`, `https://www.youtube.com/live/${id}`, `https://www.youtube-nocookie.com/embed/${id}`])('recognizes supported YouTube URL %s', url => {
    expect(extractYouTubeVideoId(url)).toBe(id);
    expect(getYouTubeEmbedUrl(url)).toBe(`https://www.youtube-nocookie.com/embed/${id}?autoplay=1`);
  });
  it.each([`https://youtube.com.attacker.test/watch?v=${id}`, `https://evilyoutu.be/${id}`, `https://user:pass@youtube.com/watch?v=${id}`, `http://youtube.com/watch?v=${id}`, 'https://youtube.com/watch?v=bad', `https://youtu.be/${id}/extra`, `https://youtube.com:444/watch?v=${id}`])('rejects spoofed or invalid YouTube URL %s', url => {
    expect(extractYouTubeVideoId(url)).toBeNull();
    expect(getYouTubeEmbedUrl(url)).toBeNull();
  });
  it.each([{ title: 123 }, { title: {} }, null, {}])('ignores invalid title payloads', async raw => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => raw }));
    await expect(fetchYouTubeTitle(`https://youtu.be/${id}`, new AbortController().signal)).resolves.toBe('');
  });
  it('checks HTTP status and uses the canonical YouTube URL', async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true, json: async () => ({ title: 'Demo' }) });
    vi.stubGlobal('fetch', fetch);
    await expect(fetchYouTubeTitle(`https://youtu.be/${id}`, new AbortController().signal)).resolves.toBe('');
    await expect(fetchYouTubeTitle(`https://youtu.be/${id}`, new AbortController().signal)).resolves.toBe('Demo');
    expect(fetch.mock.calls[0][0]).toContain(encodeURIComponent(`https://www.youtube.com/watch?v=${id}`));
  });
});
