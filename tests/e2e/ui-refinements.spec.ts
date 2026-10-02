import { expect, test, type Locator, type Page } from '@playwright/test';
import { resolve } from 'node:path';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Export data', exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const path = '/src/lib/storage/indexedDbStorage.ts';
    const { indexedDbStorage } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/storage/indexedDbStorage');
    const gameId = await indexedDbStorage.games.add({ name: 'Size fixture', buttonLayout: ['A'], notes: 'Game strategy' });
    const landscape = await indexedDbStorage.characters.add({ gameId, name: 'Landscape fixture', notes: 'Character strategy', portraitOrientation: 'landscape' });
    await indexedDbStorage.characters.add({ gameId, name: 'Portrait fixture', portraitOrientation: 'portrait' });
    await indexedDbStorage.combos.add({ characterId: landscape, name: 'Fixture combo', notation: 'A', parsedNotation: [], tags: [] });
  });
  await expect(page.locator('h3', { hasText: 'Size fixture' })).toBeVisible();
});

function card(page: Page, name: string): Locator {
  return page.locator('main [data-slot="card"]').filter({ has: page.locator('h3', { hasText: name }) });
}

async function checkSlider(page: Page, cards: Locator[], ratios: number[]) {
  await page.getByRole('button', { name: 'View', exact: true }).click();
  const slider = page.getByRole('slider', { name: 'Card size', exact: true });
  await slider.press('Home');
  for (let width = 120; width <= 300; width += 10) {
    await expect(slider).toHaveAttribute('aria-valuenow', String(width));
    for (let i = 0; i < cards.length; i++) {
      await expect.poll(() => cards[i].evaluate(element => parseFloat(getComputedStyle(element).width))).toBe(width);
      const size = await cards[i].evaluate(element => ({ width: element.clientWidth, height: element.clientHeight }));
      expect(size.width / size.height).toBeCloseTo(ratios[i], 1);
    }
    if (width < 300) await slider.press('ArrowRight');
  }
  await slider.press('Escape');
}

test('gives both collections equal widths and a visible change at every slider step', async ({ page }) => {
  await checkSlider(page, [card(page, 'Size fixture')], [3 / 4]);
  await page.locator('h3', { hasText: 'Size fixture' }).click();
  await expect(page.locator('h3', { hasText: 'Landscape fixture' })).toBeVisible();
  await checkSlider(page, [card(page, 'Landscape fixture'), card(page, 'Portrait fixture')], [4 / 3, 3 / 4]);
  // The controls update optimistically. Wait for the last write before tearing
  // down the page so this checks durable settings rather than an interrupted save.
  await expect.poll(() => page.evaluate(async () => {
    const path = '/src/lib/storage/indexedDbStorage.ts';
    const { indexedDbStorage } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/storage/indexedDbStorage');
    const settings = await indexedDbStorage.settings.get();
    return [settings.gameCardSize, settings.characterCardSize];
  })).toEqual([300, 300]);
  await page.reload();
  await expect(page.locator('h3', { hasText: 'Size fixture' })).toBeVisible();
  await expect.poll(() => card(page, 'Size fixture').evaluate(element => parseFloat(getComputedStyle(element).width))).toBe(300);
  await page.locator('h3', { hasText: 'Size fixture' }).click();
  await expect.poll(() => card(page, 'Landscape fixture').evaluate(element => parseFloat(getComputedStyle(element).width))).toBe(300);
  await page.setViewportSize({ width: 320, height: 700 });
  const grid = card(page, 'Landscape fixture').locator('..');
  expect(await card(page, 'Landscape fixture').evaluate(element => element.clientWidth)).toBeLessThanOrEqual(await grid.evaluate(element => element.clientWidth));
});

test('applies Notes Open by Default to Character Info and remembers new manual choices', async ({ page }) => {
  await page.locator('h3', { hasText: 'Size fixture' }).click();
  await page.locator('h3', { hasText: 'Landscape fixture' }).click();
  const info = page.getByRole('button', { name: /Character Info/ });
  await expect(info).toHaveAttribute('aria-expanded', 'false');
  await info.click();
  await expect(info).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('switch', { name: 'Notes Open by Default', exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(info).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText('Character strategy', { exact: true })).toBeVisible();
  await info.click();
  await expect(info).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Notes', exact: true })).toHaveAttribute('aria-expanded', 'true');
  await page.locator('h3', { hasText: 'Landscape fixture' }).click();
  await expect(info).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('switch', { name: 'Notes Open by Default', exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(info).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Notes', exact: true })).toHaveAttribute('aria-expanded', 'false');
});

async function checkDivider(editor: Locator) {
  const left = editor.locator('.entity-artwork');
  const right = editor.locator('.entity-identity');
  const leftBox = await left.boundingBox();
  const rightBox = await right.boundingBox();
  const notesBox = await editor.locator('.entity-notes').boundingBox();
  expect(rightBox?.y).toBeCloseTo(leftBox?.y ?? -1, 1);
  expect((leftBox?.y ?? 0) + (leftBox?.height ?? 0)).toBeGreaterThanOrEqual((notesBox?.y ?? 0) + (notesBox?.height ?? 0) - 1);
  await expect(left).toHaveCSS('border-right-width', '1px');
}

test('extends game and character dividers for either taller column in add and edit forms', async ({ page }) => {
  await page.getByRole('button', { name: 'Add Game', exact: true }).click();
  let editor = page.getByRole('dialog');
  await checkDivider(editor);
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Size fixture', exact: true }).click();
  editor = page.getByRole('dialog');
  await page.locator('input[type=file][accept="image/*"]').setInputFiles(resolve('src/assets/images/defaultGame.jpg'));
  await checkDivider(editor);
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.locator('h3', { hasText: 'Size fixture' }).click();
  await page.getByRole('button', { name: 'Add Character', exact: true }).click();
  editor = page.getByRole('dialog');
  await checkDivider(editor);
  await editor.getByLabel('Notes (optional)', { exact: true }).evaluate(element => { element.style.height = '500px'; });
  await checkDivider(editor);
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Landscape fixture', exact: true }).click();
  editor = page.getByRole('dialog');
  await page.locator('input[type=file][accept="image/*"]').setInputFiles(resolve('src/assets/images/defaultCharacter.jpg'));
  await checkDivider(editor);
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
});

test('squares Settings navigation and removes delete-dialog dividers', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Settings', exact: true });
  await expect(settings.locator('.settings-navigation')).toHaveCSS('border-radius', '0px');
  await settings.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Delete Size fixture', exact: true }).click();
  const confirmation = page.getByRole('alertdialog');
  await expect(confirmation.locator('[data-slot="alert-dialog-header"]')).toHaveCSS('border-bottom-width', '0px');
  await expect(confirmation.locator('[data-slot="alert-dialog-footer"]')).toHaveCSS('border-top-width', '0px');
  await expect(confirmation.getByRole('button', { name: 'Delete', exact: true })).toBeVisible();
  await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(card(page, 'Size fixture')).toBeVisible();
});
