import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createBackupZip, forgeZipSize } from '../helpers/zip';

test('exports JSON through the browser download fallback and restores the library', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true }));
  await page.goto('/');
  await page.evaluate(async () => {
    const path = '/src/lib/storage/indexedDbStorage.ts';
    const { indexedDbStorage } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/storage/indexedDbStorage');
    const gameId = await indexedDbStorage.games.add({ name: 'JSON 日本語', buttonLayout: ['A'] });
    const characterId = await indexedDbStorage.characters.add({ gameId, name: 'JSON character' });
    await indexedDbStorage.combos.add({ characterId, name: 'JSON combo', notation: 'A', tags: ['日本語'], parsedNotation: [] });
  });
  await page.getByRole('button', { name: 'Export data', exact: true }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/\.json$/);
  const data = await readFile((await download.path())!);
  const backup = JSON.parse(data.toString('utf8'));
  expect(backup.version).toBe(1);
  expect(backup.games[0].name).toBe('JSON 日本語');
  expect(backup.combos[0].tags).toEqual(['日本語']);
  await expect(page.getByRole('heading', { name: 'Exporting library', exact: true })).toBeHidden();
  await page.evaluate(async () => {
    const path = '/src/lib/storage/indexedDbStorage.ts';
    const { db } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/storage/indexedDbStorage');
    await db.transaction('rw', [db.games, db.characters, db.combos], async () => { await db.combos.clear(); await db.characters.clear(); await db.games.clear(); });
  });
  await page.getByRole('button', { name: 'Import data', exact: true }).click();
  const choosing = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose backup file', exact: true }).click();
  await (await choosing).setFiles({ name: 'backup.json', mimeType: 'application/json', buffer: data });
  await expect(page.getByText('Data imported. Current settings were preserved.', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'JSON 日本語', exact: true })).toBeVisible();
  await page.getByRole('heading', { name: 'JSON 日本語', exact: true }).click();
  await page.getByRole('heading', { name: 'JSON character', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'JSON combo', exact: true })).toBeVisible();
});

test('shows a JSON save failure, aborts the destination, and allows retry', async ({ page }) => {
  await page.addInitScript(() => {
    let aborted = false;
    let attempts = 0;
    Object.assign(window, { backupFailure: () => ({ aborted, attempts }), showSaveFilePicker: async () => {
      attempts++;
      return { createWritable: async () => ({ write: async () => { if (attempts === 1) throw new Error('disk full'); }, close: async () => undefined, abort: async () => { aborted = true; } }) };
    } });
  });
  await page.goto('/');
  await page.evaluate(async () => {
    const path = '/src/lib/storage/indexedDbStorage.ts';
    const { indexedDbStorage } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/storage/indexedDbStorage');
    await indexedDbStorage.games.add({ name: 'Save retry', buttonLayout: ['A'] });
  });
  const start = async () => {
    await page.getByRole('button', { name: 'Export data', exact: true }).click();
    await page.getByRole('button', { name: 'Export', exact: true }).click();
  };
  await start();
  await expect(page.getByText('disk full', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { backupFailure: () => { aborted: boolean } }).backupFailure().aborted)).toBe(true);
  await start();
  await expect(page.getByText('Data exported', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export data', exact: true })).toBeEnabled();
});

test('rejects a forged expanding backup and preserves the existing library', async ({ page }) => {
  const bytes = await createBackupZip({ version: 3, exported: '2026-10-03', games: [], padding: 'x'.repeat(1024 * 1024) });
  forgeZipSize(bytes, 'backup.json', 1);
  await page.goto('/');
  await page.evaluate(async () => {
    const path = '/src/lib/storage/indexedDbStorage.ts';
    const { indexedDbStorage } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/storage/indexedDbStorage');
    await indexedDbStorage.games.add({ name: 'Preserved library', buttonLayout: ['A'] });
  });
  await page.getByRole('button', { name: 'Import data', exact: true }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose backup file', exact: true }).click();
  await (await chooser).setFiles({ name: 'invalid-backup.zip', mimeType: 'application/zip', buffer: Buffer.from(bytes) });
  await expect(page.getByText(/Failed to import data:/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Importing…', exact: true })).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Preserved library', exact: true })).toBeVisible();
});

test('streams a 384 MB video library with responsive progress and cancellation', async ({ page }) => {
  test.setTimeout(120000);
  await page.addInitScript(() => {
    const state = { bytes: 0, maxBuffer: 0, writes: 0, closed: false, committing: false, aborted: false, ticks: 0 };
    Object.assign(window, { exportProbe: state, showSaveFilePicker: () => Promise.resolve({ createWritable: () => Promise.resolve({
      write: (data: Uint8Array) => { state.bytes += data.byteLength; state.maxBuffer = Math.max(state.maxBuffer, data.buffer.byteLength); state.writes++; return new Promise<void>(resolve => setTimeout(resolve, 1)); },
      close: () => { state.committing = true; return new Promise<void>(resolve => { Object.assign(window, { finishExportCommit: () => { state.closed = true; resolve(); } }); }); },
      abort: () => { state.aborted = true; return Promise.resolve(); },
    }) }) });
    setInterval(() => { state.ticks++; }, 50);
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Export data', exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const path = '/src/lib/storage/indexedDbStorage.ts';
    const { indexedDbStorage } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/storage/indexedDbStorage');
    const gameId = await indexedDbStorage.games.add({ name: 'Large export fixture', buttonLayout: ['A'] });
    const characterId = await indexedDbStorage.characters.add({ gameId, name: 'Export fixture' });
    for (let i = 0; i < 24; i++) {
      await indexedDbStorage.demoVideos.add({ id: `large-video-${i}`, fileName: `demo-${i}.mp4`, mimeType: 'video/mp4', data: new Uint8Array(16 * 1024 * 1024).fill(i + 1).buffer });
      await indexedDbStorage.combos.add({ characterId, name: `Combo ${i}`, notation: 'A', tags: [], parsedNotation: [], demoUrl: `local:large-video-${i}` });
    }
  });
  await page.getByRole('button', { name: 'Export data', exact: true }).click();
  await page.getByRole('switch', { name: 'Include demo videos', exact: true }).click();
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Exporting library', exact: true })).toBeVisible();
  const read = () => page.evaluate(() => (window as unknown as { exportProbe: { bytes: number; maxBuffer: number; writes: number; closed: boolean; committing: boolean; aborted: boolean; ticks: number } }).exportProbe);
  const before = await read();
  await expect.poll(async () => (await read()).writes, { timeout: 30000 }).toBeGreaterThan(200);
  expect((await read()).ticks).toBeGreaterThan(before.ticks);
  await expect(page.getByRole('progressbar', { name: 'Export progress', exact: true })).toBeVisible();
  await expect.poll(async () => (await read()).committing, { timeout: 90000 }).toBe(true);
  await expect(page.getByRole('button', { name: 'Cancel export', exact: true })).toBeDisabled();
  await expect(page.getByText('Saving completed backup…')).toBeVisible();
  await page.evaluate(() => (window as unknown as { finishExportCommit: () => void }).finishExportCommit());
  await expect.poll(async () => (await read()).closed).toBe(true);
  const completed = await read();
  expect(completed.bytes).toBeGreaterThan(384 * 1024 * 1024);
  expect(completed.maxBuffer).toBeLessThanOrEqual(256 * 1024);
  await expect(page.getByRole('heading', { name: 'Exporting library', exact: true })).toBeHidden();
  await page.getByRole('button', { name: 'Export data', exact: true }).click();
  await page.getByRole('switch', { name: 'Include demo videos', exact: true }).click();
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel export', exact: true }).click();
  await expect.poll(async () => (await read()).aborted).toBe(true);
  await expect(page.getByRole('heading', { name: 'Exporting library', exact: true })).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Large export fixture', exact: true })).toBeVisible();
});
