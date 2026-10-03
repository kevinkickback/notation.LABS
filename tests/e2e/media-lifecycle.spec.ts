import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('a cancelled cover cannot replace artwork in another game editor', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const image = `data:image/jpeg;base64,${(await readFile('src/assets/images/defaultGame.jpg')).toString('base64')}`;
  let release!: () => void;
  let downloadStarted = false;
  const delayed = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/igdb', route => route.fulfill({ json: [{ id: 1, name: 'Cover result', coverImageId: 'co123' }] }));
  await page.route('**/api/igdb/download', async route => {
    downloadStarted = true;
    await delayed;
    await route.fulfill({ json: { dataUrl: image } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: /add your first game/i }).click();
  const first = page.getByRole('dialog', { name: 'Add New Game', exact: true });
  await first.getByLabel('Game Name').fill('First game');
  await first.getByRole('button', { name: 'Search Online' }).click();
  const search = page.getByRole('dialog', { name: 'Search Game Covers', exact: true });
  await search.getByRole('button', { name: 'Select cover for Cover result' }).click();
  await expect.poll(() => downloadStarted).toBe(true);
  await search.getByRole('button', { name: 'Cancel', exact: true }).click();
  await first.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: /add your first game/i }).click();
  const second = page.getByRole('dialog', { name: 'Add New Game', exact: true });
  await second.getByLabel('Game Name').fill('Second game');
  release();
  await expect(second.getByRole('button', { name: 'Upload cover artwork' })).toBeVisible();
  await second.getByRole('button', { name: 'Add Game', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Second game' }).click();
  await expect(page.getByRole('button', { name: 'Upload cover artwork' })).toBeVisible();
});
