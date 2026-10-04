import { expect, test } from '@playwright/test';

test('keeps preview controls temporary without opening or changing the application database', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeVisible();
  const before = await page.evaluate(async () => {
    const path = '/src/lib/storage/indexedDbStorage.ts';
    const { db, indexedDbStorage } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/storage/indexedDbStorage');
    const gameId = await indexedDbStorage.games.add({ name: 'Real library', buttonLayout: ['L', 'H'] });
    const characterId = await indexedDbStorage.characters.add({ gameId, name: 'Real character' });
    await indexedDbStorage.combos.add({ characterId, name: 'Real combo', notation: '5L > 236H', parsedNotation: [], tags: ['BnB'] });
    await indexedDbStorage.settings.update({ colorTheme: 'light', displayMode: 'colored-text', motionIconStyle: 'arrows', videoPlayerSize: 'md', parsedNotationVersion: 0 });
    return Promise.all(db.tables.map(async table => ({ name: table.name, records: await table.toArray() })));
  });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const open = indexedDB.open.bind(indexedDB);
    indexedDB.open = (name, version) => {
      const root = document.documentElement;
      root.dataset.databaseOpens = String(Number(root.dataset.databaseOpens ?? 0) + 1);
      return open(name, version);
    };
  });
  await page.goto('/combo-card-preview.html');
  const card = page.getByRole('article', { name: 'Midscreen staple', exact: true });
  await expect(card).toBeVisible();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.getByRole('button', { name: 'Switch to light theme', exact: true }).click();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await page.getByLabel('Display mode', { exact: true }).selectOption('visual-icons');
  await page.getByLabel('Motion style', { exact: true }).selectOption('arrows');
  await expect(card.getByRole('img').first()).toBeVisible();
  await card.getByRole('button', { name: 'Edit combo', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Edit sample combo', exact: true });
  await editor.getByLabel('Damage', { exact: true }).fill('1234');
  await editor.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(card).toContainText('1234');

  const videoBytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const stream = canvas.captureStream(10);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks: Blob[] = [];
    return new Promise<number[]>(resolve => {
      recorder.ondataavailable = event => chunks.push(event.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        resolve(Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer())));
      };
      recorder.start();
      canvas.getContext('2d')?.fillRect(0, 0, 16, 16);
      setTimeout(() => recorder.stop(), 200);
    });
  });
  await card.getByRole('button', { name: 'Watch Demo', exact: true }).click();
  await page.getByLabel('Sample demo video', { exact: true }).setInputFiles({ name: 'sample.webm', mimeType: 'video/webm', buffer: Buffer.from(videoBytes) });
  const player = page.getByRole('dialog', { name: 'Midscreen staple — Demo', exact: true });
  await player.getByRole('button', { name: 'XL', exact: true }).click();
  await expect(player).toHaveClass(/sm:max-w-6xl/);
  await player.getByRole('button', { name: 'Close', exact: true }).click();
  expect(await page.locator('html').getAttribute('data-database-opens')).toBeNull();
  expect(errors).toEqual([]);
  const after = await page.evaluate(async () => {
    const path = '/src/lib/storage/indexedDbStorage.ts';
    const { db } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/storage/indexedDbStorage');
    return Promise.all(db.tables.map(async table => ({ name: table.name, records: await table.toArray() })));
  });
  expect(after).toEqual(before);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.getByLabel('Display mode', { exact: true })).toHaveValue('colored-text');
  await expect(card).toContainText('3,420');
  expect(await page.locator('html').getAttribute('data-database-opens')).toBeNull();
});
