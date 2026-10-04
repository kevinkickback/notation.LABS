import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createBackupZip, forgeZipSize } from '../helpers/zip';

test('updates retained combo icons immediately when an import changes its game profile', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const storagePath = '/src/lib/storage/indexedDbStorage.ts';
    const parserPath = '/src/lib/parser.ts';
    const { db } = await import(/* @vite-ignore */ storagePath) as typeof import('../../src/lib/storage/indexedDbStorage');
    const { parseComboNotation } = await import(/* @vite-ignore */ parserPath) as typeof import('../../src/lib/parser');
    await db.transaction('rw', [db.games, db.characters, db.combos], async () => {
      await db.games.put({ id: 'retained-game', name: 'Retained game', buttonLayout: ['LP'], notationProfile: 'standard', createdAt: 1, updatedAt: 1 });
      await db.characters.put({ id: 'retained-character', gameId: 'retained-game', name: 'Retained fighter', createdAt: 1, updatedAt: 1 });
      await db.combos.put({ id: 'retained-combo', characterId: 'retained-character', name: 'Retained combo', notation: '1 B F MB', parsedNotation: parseComboNotation('1 B F MB', ['LP']), tags: [], sortOrder: 0, createdAt: 1, updatedAt: 1 });
    });
  });
  await page.getByRole('heading', { name: 'Retained game', exact: true }).click();
  await page.getByRole('heading', { name: 'Retained fighter', exact: true }).click();
  await page.getByTitle('Icons', { exact: true }).click();
  await expect(page.getByRole('img', { name: 'Button 1, Attack 1', exact: true })).toHaveCount(0);
  const backup = { version: 1, exported: '2026-10-03', games: [{ id: 'retained-game', name: 'Retained game', buttonLayout: ['1', '2', '3', '4'], notationProfile: 'nrs', createdAt: 1, updatedAt: 1 }], characters: [], combos: [] };
  await page.getByRole('button', { name: 'Import data', exact: true }).click();
  const choosing = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose backup file', exact: true }).click();
  await (await choosing).setFiles({ name: 'profile.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await expect(page.getByText('Data imported. Current settings were preserved.', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Retained combo', exact: true })).toBeVisible();
  for (const label of ['Button 1, Attack 1', 'Back', 'Forward', 'MB, Meter Burn'])
    await expect(page.getByRole('img', { name: label, exact: true }).first()).toBeVisible();
  await page.reload();
  await page.getByRole('heading', { name: 'Retained game', exact: true }).click();
  await page.getByRole('heading', { name: 'Retained fighter', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Retained combo', exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Button 1, Attack 1', exact: true }).first()).toBeVisible();
});

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

test('restores a playable local video and large legacy artwork through the current ZIP format', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true }));
  await page.goto('/');
  const original = await page.evaluate(async () => {
    const path = '/src/lib/storage/indexedDbStorage.ts';
    const { indexedDbStorage } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/storage/indexedDbStorage');
    const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 32;
    const stream = canvas.captureStream(10);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const pieces: Blob[] = [];
    recorder.ondataavailable = event => pieces.push(event.data);
    const stopped = new Promise<void>(resolve => { recorder.onstop = () => resolve(); });
    recorder.start();
    for (const color of ['red', 'green', 'blue']) {
      const drawing = canvas.getContext('2d')!; drawing.fillStyle = color; drawing.fillRect(0, 0, 32, 32);
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    recorder.stop(); await stopped; stream.getTracks().forEach(track => track.stop());
    const data = new Blob(pieces, { type: 'video/webm' });
    const smallPng = await (await fetch(canvas.toDataURL('image/png'))).blob();
    const largeImage = new Blob([smallPng, new Uint8Array(3 * 1024 * 1024)], { type: 'image/png' });
    const bitmap = await createImageBitmap(largeImage); bitmap.close();
    const logoImage = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve((reader.result as string).replace('data:image/png;', 'data:image/jpeg;'));
      reader.onerror = () => reject(reader.error); reader.readAsDataURL(largeImage);
    });
    const gameId = await indexedDbStorage.games.add({ name: 'Playback backup', buttonLayout: ['A'], logoImage });
    const characterId = await indexedDbStorage.characters.add({ gameId, name: 'Fighter' });
    await indexedDbStorage.demoVideos.add({ id: 'playable', data, mimeType: data.type, fileName: 'demo.webm' });
    await indexedDbStorage.combos.add({ characterId, name: 'Playable combo', notation: 'A', parsedNotation: [], tags: [], demoUrl: 'local:playable' });
    return {
      videoHash: Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await data.arrayBuffer()))),
      imageHash: Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await largeImage.arrayBuffer()))),
    };
  });
  await page.getByRole('button', { name: 'Export data', exact: true }).click();
  await page.getByRole('switch', { name: 'Include demo videos', exact: true }).check();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const bytes = await readFile((await (await downloading).path())!);
  expect(await page.evaluate(async () => {
    const path = '/src/lib/storage/indexedDbStorage.ts';
    const { db } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/storage/indexedDbStorage');
    return (await db.games.toArray())[0].logoImage?.startsWith('data:image/jpeg;');
  })).toBe(true);
  await page.evaluate(async () => {
    const path = '/src/lib/storage/database.ts';
    const { db } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/storage/database');
    await db.transaction('rw', db.tables, () => Promise.all(db.tables.map(table => table.clear())));
  });
  await page.getByRole('button', { name: 'Import data', exact: true }).click();
  await page.getByRole('switch', { name: /include.*video/i }).check();
  const choosing = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose backup file', exact: true }).click();
  await (await choosing).setFiles({ name: 'playable.zip', mimeType: 'application/zip', buffer: bytes });
  await expect(page.getByText('Data imported. Current settings were preserved.', { exact: true })).toBeVisible();
  const restored = await page.evaluate(async () => {
    const path = '/src/lib/storage/indexedDbStorage.ts';
    const { indexedDbStorage } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/storage/indexedDbStorage');
    const data = (await indexedDbStorage.demoVideos.get('playable'))!.data as Blob;
    const video = document.createElement('video'); video.muted = true;
    const url = await indexedDbStorage.demoVideos.getBlobUrl('playable'); video.src = url!; document.body.append(video);
    try {
      const decoded = new Promise<void>((resolve, reject) => {
        video.requestVideoFrameCallback(() => resolve()); video.onerror = () => reject(new Error('Restored video did not decode'));
      });
      await video.play(); await decoded;
      const image = (await indexedDbStorage.games.getAll())[0].logoImage!;
      const imageData = await (await fetch(image)).blob();
      const bitmap = await createImageBitmap(imageData);
      const imageWidth = bitmap.width; bitmap.close();
      return {
        width: video.videoWidth,
        hash: Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await data.arrayBuffer()))),
        imageHash: Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await imageData.arrayBuffer()))),
        imageMime: imageData.type, imageWidth,
      };
    } finally { video.pause(); video.remove(); URL.revokeObjectURL(url!); }
  });
  expect(restored.width).toBe(32);
  expect(restored.hash).toEqual(original.videoHash);
  expect(restored.imageHash).toEqual(original.imageHash);
  expect(restored.imageMime).toBe('image/png');
  expect(restored.imageWidth).toBe(32);
});

test('shows a readable image export failure and preserves the original library', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true }));
  await page.goto('/');
  await page.evaluate(async () => {
    const path = '/src/lib/storage/indexedDbStorage.ts';
    const { indexedDbStorage } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/storage/indexedDbStorage');
    const gameId = await indexedDbStorage.games.add({ name: 'Damaged artwork', buttonLayout: ['A'], logoImage: 'data:image/jpeg;base64,AQID' });
    const characterId = await indexedDbStorage.characters.add({ gameId, name: 'Fighter' });
    await indexedDbStorage.demoVideos.add({ id: 'demo', data: new Blob([new Uint8Array([1, 2, 3])]), mimeType: 'video/mp4', fileName: 'demo.mp4' });
    await indexedDbStorage.combos.add({ characterId, name: 'Combo', notation: 'A', parsedNotation: [], tags: [], demoUrl: 'local:demo' });
  });
  await page.getByRole('button', { name: 'Export data', exact: true }).click();
  await page.getByRole('switch', { name: 'Include demo videos', exact: true }).check();
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const message = 'Cannot export the image for "Damaged artwork": it is unsupported, damaged, or too large to process safely. Replace it and try again.';
  await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveText(message);
  const retained = await page.evaluate(async () => {
    const path = '/src/lib/storage/indexedDbStorage.ts';
    const { db } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/storage/indexedDbStorage');
    return { image: (await db.games.toArray())[0].logoImage, videos: await db.demoVideos.count(), staging: await db.backupRecords.count(), sessions: await db.backupSessions.count() };
  });
  expect(retained).toEqual({ image: 'data:image/jpeg;base64,AQID', videos: 1, staging: 0, sessions: 0 });
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
