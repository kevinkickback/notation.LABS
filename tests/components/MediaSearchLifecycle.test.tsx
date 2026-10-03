import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CoverSearchDialog } from '@/components/game/CoverSearchDialog';
import { CharacterSearchDialog } from '@/components/character/CharacterSearchDialog';

afterEach(() => vi.unstubAllGlobals());
const png = 'data:image/png;base64,iVBORw0KGgo=';
const cases = [
  { name: 'cover', results: [{ id: 1, name: 'Game', coverImageId: 'co123' }], label: 'Select cover for Game', render: (open: boolean, callback: (image: string) => void) => <CoverSearchDialog open={open} onOpenChange={() => {}} defaultQuery="Game" onCoverSelect={callback} /> },
  { name: 'portrait', results: [{ title: 'Character', imageUrl: 'https://example.test/image.png', thumbnailUrl: '', width: 100, height: 100 }], label: 'Select image: Character', render: (open: boolean, callback: (image: string) => void) => <CharacterSearchDialog open={open} onOpenChange={() => {}} searchQuery="Character" onImageSelect={callback} /> },
];

describe.each(cases)('$name media loading', entry => {
  it('aborts a pending download on close and cannot apply it to a reopened editor', async () => {
    let resolve!: (response: Response) => void;
    let signal!: AbortSignal;
    const fetch = vi.fn().mockImplementation((url: string, options: RequestInit) => {
      if (url.endsWith('/download')) {
        signal = options.signal as AbortSignal;
        return new Promise<Response>(done => { resolve = done; });
      }
      return Promise.resolve({ ok: true, json: async () => entry.results });
    });
    vi.stubGlobal('fetch', fetch);
    const applied = vi.fn();
    const { rerender } = render(entry.render(true, applied));
    fireEvent.click(await screen.findByRole('button', { name: entry.label }));
    await waitFor(() => expect(signal).toBeDefined());
    rerender(entry.render(false, applied));
    expect(signal.aborted).toBe(true);
    rerender(entry.render(true, applied));
    await act(async () => { resolve({ ok: true, json: async () => ({ dataUrl: png }) } as Response); });
    expect(applied).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('button', { name: entry.label }).hasAttribute('disabled')).toBe(false));
    fetch.mockImplementation(async (url: string) => ({ ok: true, json: async () => url.endsWith('/download') ? { dataUrl: png } : entry.results }));
    fireEvent.click(screen.getByRole('button', { name: entry.label }));
    await waitFor(() => expect(applied.mock.calls).toEqual([[png]]));
  });
});
