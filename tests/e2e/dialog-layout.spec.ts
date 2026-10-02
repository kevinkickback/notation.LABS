import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('keeps Settings a shared, viewport-safe height across categories', async ({ page }) => {
  await page.goto('/');
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 800, height: 600 }]) {
    await page.setViewportSize(viewport);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Settings' });
    await expect(dialog).toBeVisible();
    const initial = await dialog.boundingBox();
    expect(initial).not.toBeNull();
    for (const category of ['Colors', 'Notation', 'About', 'General']) {
      await page.getByRole('tab', { name: category, exact: true }).click();
      const box = await dialog.boundingBox();
      expect(Math.abs((box?.height ?? 0) - (initial?.height ?? 0))).toBeLessThan(1);
      expect(box?.y).toBeGreaterThanOrEqual(0);
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(viewport.height);
      await expect(dialog.getByRole('button', { name: 'Done' })).toBeVisible();
    }
    await dialog.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeFocused();
  }
});

test('preserves artwork proportions and unsaved fields through nested cover search', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route('**/api/igdb', route => route.fulfill({ json: [] }));
  await page.goto('/');
  const opener = page.getByRole('button', { name: /add your first game/i });
  await opener.click();
  const editor = page.getByRole('dialog', { name: 'Add New Game', exact: true });
  await editor.getByLabel('Game Name').fill('Artwork test');
  const sections = editor.locator('.dialog-section');
  const left = await sections.nth(0).boundingBox();
  const right = await sections.nth(1).boundingBox();
  expect(left?.width).toBeLessThan((right?.width ?? 0) * 0.7);
  await page.locator('input[type=file][accept="image/*"]').setInputFiles(resolve('src/assets/images/defaultGame.jpg'));
  const image = editor.locator('[data-slot="cover-image"]');
  await expect(image).toBeVisible();
  const frame = await image.locator('..').boundingBox();
  expect((frame?.width ?? 0) / (frame?.height ?? 1)).toBeCloseTo(3 / 4, 2);
  // A single percentage preserves the image's intrinsic height (the omitted
  // second axis is auto), unlike stretching both axes to the frame.
  expect(await image.evaluate(element => getComputedStyle(element).backgroundSize)).toMatch(/^(\d+(\.\d+)?%|contain|cover)$/);
  const search = editor.getByRole('button', { name: /search online/i });
  await search.click();
  const picker = page.getByRole('dialog', { name: /search game covers/i });
  await expect(picker).toBeVisible();
  await picker.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(search).toBeFocused();
  await expect(editor.getByLabel('Game Name')).toHaveValue('Artwork test');
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(opener).toBeFocused();
});

test('keeps the mobile editor and interactive notation guide usable', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await page.goto('/');
  await page.getByRole('button', { name: /add your first game/i }).click();
  const editor = page.getByRole('dialog');
  const box = await editor.boundingBox();
  expect(box?.x).toBeGreaterThanOrEqual(0);
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(375);
  await expect(editor.getByRole('button', { name: 'Add Game', exact: true })).toBeVisible();
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('menuitem', { name: 'Notation Guide' }).click();
  const guide = page.getByRole('dialog', { name: 'Combo Notation Guide' });
  await expect(guide.getByRole('textbox', { name: 'Notation', exact: true })).toBeVisible();
  const example = guide.getByRole('button', { name: /^Try / }).first();
  const notation = (await example.getAttribute('aria-label'))?.slice(4);
  await example.click();
  await expect(guide.getByRole('textbox', { name: 'Notation', exact: true })).toHaveValue(notation ?? '');
  await guide.getByRole('textbox', { name: 'Notation', exact: true }).scrollIntoViewIfNeeded();
  await expect(guide.getByRole('textbox', { name: 'Notation', exact: true })).toBeVisible();
});
