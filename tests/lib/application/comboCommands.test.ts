// @vitest-environment node
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createCombo,
  updateCombo,
} from '@/lib/application/comboCommands';
import { parseComboNotation } from '@/lib/parser';
import { db, indexedDbStorage } from '@/lib/storage/indexedDbStorage';

beforeEach(async () => {
  await db.games.clear();
  await db.characters.clear();
  await db.combos.clear();
  await db.demoVideos.clear();
});

async function createOwner() {
  const gameId = await indexedDbStorage.games.add({
    name: 'Test Game',
    buttonLayout: ['LP', 'HP'],
    notationProfile: 'standard',
  });
  const characterId = await indexedDbStorage.characters.add({
    gameId,
    name: 'Fighter',
  });
  return { characterId };
}

describe('combo commands', () => {
  it('saves each tag once regardless of capitalization and retains its first spelling', async () => {
    const { characterId } = await createOwner();
    const tags = [' BnB ', 'bnb', 'Corner', 'CORNER', '', ' Café', 'Cafe\u0301'];
    const comboId = await createCombo({ characterId, name: 'Tags', notation: '5LP', tags });
    expect((await indexedDbStorage.combos.get(comboId))?.tags).toEqual(['BnB', 'Corner', 'Café']);
    expect(tags[0]).toBe(' BnB ');
    await updateCombo(comboId, { tags: [' Punish ', 'punish', 'Meterless', 'METERLESS'] });
    expect((await indexedDbStorage.combos.get(comboId))?.tags).toEqual(['Punish', 'Meterless']);
    await updateCombo(comboId, { damage: '1000' });
    expect((await indexedDbStorage.combos.get(comboId))?.tags).toEqual(['Punish', 'Meterless']);
    await updateCombo(comboId, { tags: [] });
    expect((await indexedDbStorage.combos.get(comboId))?.tags).toEqual([]);
  });

  it('derives parsed notation when creating a combo', async () => {
    const { characterId } = await createOwner();
    const notation = '5LP > 236HP';

    const comboId = await createCombo({
      characterId,
      name: 'BnB',
      notation,
      tags: [],
    });

    const combo = await indexedDbStorage.combos.get(comboId);
    expect(combo?.parsedNotation).toEqual(
      parseComboNotation(notation, ['LP', 'HP'], { profile: 'standard' }),
    );
  });

  it('re-derives parsed notation when updating notation', async () => {
    const { characterId } = await createOwner();
    const comboId = await createCombo({
      characterId,
      name: 'BnB',
      notation: '5LP',
      tags: [],
    });

    await updateCombo(comboId, { notation: '236HP' });

    const combo = await indexedDbStorage.combos.get(comboId);
    expect(combo?.parsedNotation).toEqual(
      parseComboNotation('236HP', ['LP', 'HP'], { profile: 'standard' }),
    );
  });

  it('rejects a combo without an owning character', async () => {
    await expect(
      createCombo({
        characterId: 'missing-character',
        name: 'Invalid',
        notation: '5LP',
        tags: [],
      }),
    ).rejects.toThrow('Character "missing-character" was not found');
  });
});
