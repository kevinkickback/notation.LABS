import { expect, test } from '@playwright/test';

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
