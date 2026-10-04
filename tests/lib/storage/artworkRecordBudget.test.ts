// @vitest-environment node
import 'fake-indexeddb/auto';
import { beforeEach, expect, it } from 'vitest';
import { MAX_EMBEDDED_IMAGE_BYTES, isImageDataUrl } from '@/lib/media/images';
import { MAX_JSON_BACKUP_BYTES } from '@/lib/defaults';
import { gameRepository } from '@/lib/storage/gameRepository';
import { characterRepository } from '@/lib/storage/characterRepository';
import { db } from '@/lib/storage/database';

beforeEach(async () => { await db.games.clear(); await db.characters.clear(); });

it.each(['game', 'character'] as const)('rejects a %s save when an accepted image leaves no room for the complete record', async kind => {
  const image = `data:image/jpeg;base64,/9j/${'A'.repeat(MAX_JSON_BACKUP_BYTES - 4)}`;
  expect(isImageDataUrl(image, MAX_EMBEDDED_IMAGE_BYTES)).toBe(true);
  if (kind === 'game') {
    await expect(gameRepository.add({ name: 'Too large', buttonLayout: ['A'], logoImage: image })).rejects.toThrow('record is too large');
    expect(await db.games.count()).toBe(0);
    const id = await gameRepository.add({ name: 'Existing', buttonLayout: ['A'] });
    const before = await gameRepository.get(id);
    await expect(gameRepository.update(id, { name: 'Changed', logoImage: image })).rejects.toThrow('record is too large');
    expect(await gameRepository.get(id)).toEqual(before);
  } else {
    await expect(characterRepository.add({ gameId: 'g', name: 'Too large', portraitImage: image })).rejects.toThrow('record is too large');
    expect(await db.characters.count()).toBe(0);
    const id = await characterRepository.add({ gameId: 'g', name: 'Existing' });
    const before = await characterRepository.get(id);
    await expect(characterRepository.update(id, { name: 'Changed', portraitImage: image })).rejects.toThrow('record is too large');
    expect(await characterRepository.get(id)).toEqual(before);
  }
}, 20000);
