import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('accepts large desktop artwork and keeps the smaller web upload limit', async ({ page }) => {
  const image = Buffer.concat([await readFile('src/assets/images/defaultGame.jpg'), Buffer.alloc(3 * 1024 * 1024)]);
  await page.goto('/');
  await page.getByRole('button', { name: /add your first game/i }).click();
  const editor = page.getByRole('dialog', { name: 'Add New Game', exact: true });
  await expect(editor.getByText('Image files up to 2 MB', { exact: true })).toBeVisible();
  const upload = async () => {
    const choosing = page.waitForEvent('filechooser');
    await editor.getByRole('button', { name: 'Upload Image', exact: true }).click();
    await (await choosing).setFiles({ name: 'large-cover.jpg', mimeType: 'image/jpeg', buffer: image });
  };
  await upload();
  await expect(page.getByText('Image must be under 2MB', { exact: true })).toBeVisible();
  await expect(editor.getByRole('button', { name: 'Remove image', exact: true })).toHaveCount(0);
  // The artwork policy reads the presence of the desktop bridge; no privileged calls are made here.
  await page.evaluate(() => Object.defineProperty(window, 'electronAPI', { value: {}, configurable: true }));
  await editor.getByLabel('Game Name').fill('Large desktop artwork');
  await expect(editor.getByText('PNG, JPG, GIF, WebP or BMP', { exact: true })).toBeVisible();
  await upload();
  await expect(editor.getByRole('button', { name: 'Remove image', exact: true })).toBeVisible();
  await editor.getByRole('button', { name: 'Add Game', exact: true }).click();
  await expect(editor).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Large desktop artwork', exact: true })).toBeVisible();
  const restoredImage = await page.evaluate(async () => {
    const path = '/src/lib/storage/indexedDbStorage.ts';
    const { db } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/storage/indexedDbStorage');
    return (await db.games.toArray())[0].logoImage;
  });
  expect(restoredImage).toBe(`data:image/jpeg;base64,${image.toString('base64')}`);
});

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
