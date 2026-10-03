import { expect, test } from '@playwright/test';

test('keeps records, videos, and notebook preferences after a failed bulk delete and allows retry', async ({ page }) => {
  await page.route('**/src/lib/storage/database.ts*', async route => {
    const response = await route.fetch();
    const code = await response.text();
    await route.fulfill({ response, body: `${code}\n
      const originalSettingsPut = db.settings.put.bind(db.settings);
      db.settings.put = (...args) => {
        if (window.failDeletionPreferences) {
          window.failDeletionPreferences = false;
          return Promise.reject(new Error('Preference write failed'));
        }
        return originalSettingsPut(...args);
      };
    ` });
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Export data', exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const gamePath = '/src/lib/application/gameCommands.ts';
    const characterPath = '/src/lib/application/characterCommands.ts';
    const comboPath = '/src/lib/application/comboCommands.ts';
    const storagePath = '/src/lib/storage/indexedDbStorage.ts';
    const { createGame } = await import(/* @vite-ignore */ gamePath) as typeof import('../../src/lib/application/gameCommands');
    const { createCharacter } = await import(/* @vite-ignore */ characterPath) as typeof import('../../src/lib/application/characterCommands');
    const { createCombo } = await import(/* @vite-ignore */ comboPath) as typeof import('../../src/lib/application/comboCommands');
    const { indexedDbStorage } = await import(/* @vite-ignore */ storagePath) as typeof import('../../src/lib/storage/indexedDbStorage');
    const gameId = await createGame({ name: 'Cascade game', buttonLayout: ['A'], notationProfile: 'standard' });
    const characterId = await createCharacter({ gameId, name: 'Cascade fighter' });
    await createCombo({ characterId, name: 'Cascade route', notation: 'A', tags: [], demoUrl: 'local:cascade-video' }, { id: 'cascade-video', data: new Uint8Array([1, 2, 3]).buffer, mimeType: 'video/mp4', fileName: 'cascade.mp4' });
    await indexedDbStorage.settings.update({ notebookOpenPages: [gameId, characterId] });
    (window as unknown as { cascadePageIds: string[]; failDeletionPreferences: boolean }).cascadePageIds = [gameId, characterId];
    (window as unknown as { failDeletionPreferences: boolean }).failDeletionPreferences = true;
  });
  await page.getByRole('button', { name: 'More options', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Select Games', exact: true }).click();
  await page.getByRole('button', { name: 'Select All', exact: true }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Delete 1 game?', exact: true });
  await dialog.getByRole('button', { name: 'Delete Selected (1)', exact: true }).click();
  await expect(page.getByText('Failed to delete selected games', { exact: true })).toBeVisible();
  await expect(dialog).toBeVisible();
  const snapshot = () => page.evaluate(async () => {
    const path = '/src/lib/storage/indexedDbStorage.ts';
    const { db } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/storage/indexedDbStorage');
    return { games: await db.games.count(), characters: await db.characters.count(), combos: await db.combos.count(), videos: await db.demoVideos.count(), pages: (await db.settings.get(1))?.notebookOpenPages, expectedPages: (window as unknown as { cascadePageIds: string[] }).cascadePageIds };
  });
  const failed = await snapshot();
  expect(failed).toEqual({ games: 1, characters: 1, combos: 1, videos: 1, pages: failed.expectedPages, expectedPages: failed.expectedPages });
  await dialog.getByRole('button', { name: 'Delete Selected (1)', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('No Games Yet', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('No Games Yet', { exact: true })).toBeVisible();
  expect(await snapshot()).toEqual({ games: 0, characters: 0, combos: 0, videos: 0, pages: [], expectedPages: undefined });
});
