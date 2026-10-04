import { fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { GameFormDialog } from '@/components/game/GameFormDialog';
import { CharacterFormDialog } from '@/components/character/CharacterFormDialog';
import { db } from '@/lib/storage/database';
import type { Game } from '@/lib/types';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
beforeEach(async () => {
  vi.clearAllMocks();
  await db.notifications.clear();
});
const game: Game = { id: 'game', name: 'Game', buttonLayout: ['A'], notationProfile: 'standard', createdAt: 1, updatedAt: 1 };

for (const kind of ['game', 'character'] as const) {
  for (const failure of ['oversized', 'invalid', 'read'] as const) {
    it(`${kind} image ${failure} gives temporary feedback and saves only read failures`, async () => {
      const view = render(kind === 'game'
        ? <GameFormDialog open editingGame={null} onOpenChange={vi.fn()} />
        : <CharacterFormDialog open game={game} editingCharacter={null} onOpenChange={vi.fn()} />);
      const input = view.container.querySelector('input[type="file"]');
      if (!(input instanceof HTMLInputElement)) throw new Error('Image input missing');
      const file = new File([new Uint8Array(failure === 'oversized' ? 2 * 1024 * 1024 + 1 : 1)], 'image.png', { type: 'image/png' });
      vi.spyOn(file, 'slice').mockReturnValue({ arrayBuffer: async () => {
        if (failure === 'read') throw new Error('Failed to read image file');
        return new Uint8Array([0]).buffer;
      } } as Blob);
      fireEvent.change(input, { target: { files: [file] } });
      const message = failure === 'oversized' ? 'Image must be under 2MB' : failure === 'invalid' ? 'Unsupported or invalid image file' : 'Failed to read image file';
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith(message));
      if (failure === 'read') await vi.waitFor(async () => expect(await db.notifications.count()).toBe(1));
      else expect(await db.notifications.count()).toBe(0);
    });
  }
}
