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
  if (await slider.getAttribute('aria-disabled') === 'true') {
    await page.keyboard.press('Escape');
    return;
  }
  await slider.press('Home');
  const last = Number(await slider.getAttribute('aria-valuemax'));
  let previousWidth = 0;
  for (let stop = 0; stop <= last; stop++) {
    await expect(slider).toHaveAttribute('aria-valuenow', String(stop));
    await expect.poll(() => cards[0].evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThan(previousWidth + 1);
    previousWidth = await cards[0].evaluate(element => element.getBoundingClientRect().width);
    for (let i = 0; i < cards.length; i++) {
      const size = await cards[i].evaluate(element => ({ width: element.clientWidth, height: element.clientHeight }));
      expect(size.width / size.height).toBeCloseTo(ratios[i], 1);
    }
    const geometry = await cards[0].locator('..').evaluate(element => ({
      width: element.clientWidth,
      columns: getComputedStyle(element).gridTemplateColumns.split(' ').length,
      gap: parseFloat(getComputedStyle(element).columnGap),
    }));
    expect(previousWidth * geometry.columns + geometry.gap * (geometry.columns - 1)).toBeCloseTo(geometry.width, 0);
    if (stop < last) await slider.press('ArrowRight');
  }
  await slider.press('Escape');
}

test('fills the grid and offers a visible change at every slider step in both collections', async ({ page }) => {
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
  await checkSlider(page, [card(page, 'Size fixture')], [3 / 4]);
  await page.locator('h3', { hasText: 'Size fixture' }).click();
  await checkSlider(page, [card(page, 'Landscape fixture'), card(page, 'Portrait fixture')], [4 / 3, 3 / 4]);
  await page.setViewportSize({ width: 320, height: 700 });
  const grid = card(page, 'Landscape fixture').locator('..');
  expect(await card(page, 'Landscape fixture').evaluate(element => element.clientWidth)).toBeLessThanOrEqual(await grid.evaluate(element => element.clientWidth));
  await page.getByRole('button', { name: 'View', exact: true }).click();
  await expect(page.getByRole('slider', { name: 'Card size', exact: true })).toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(async () => {
    const path = '/src/lib/storage/indexedDbStorage.ts';
    const { indexedDbStorage } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/storage/indexedDbStorage');
    return (await indexedDbStorage.settings.get()).characterCardSize;
  })).toBe(300);
});

test('aligns full rows and keeps final-row cards the same size after resizing', async ({ page }) => {
  await page.evaluate(async () => {
    const path = '/src/lib/storage/indexedDbStorage.ts';
    const { indexedDbStorage } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/storage/indexedDbStorage');
    for (let i = 0; i < 12; i++) await indexedDbStorage.games.add({ name: `Grid peer ${i}`, buttonLayout: ['A'] });
  });
  for (const width of [1440, 1233, 800, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect.poll(() => page.locator('main [data-slot="card"]').count()).toBe(13);
    const grid = card(page, 'Size fixture').locator('..');
    await expect.poll(() => grid.evaluate(element => {
      const columns = getComputedStyle(element).gridTemplateColumns.split(' ').length;
      const cards = Array.from(element.children);
      const bounds = element.getBoundingClientRect();
      const first = cards[0].getBoundingClientRect();
      const last = cards[columns - 1].getBoundingClientRect();
      const final = cards[cards.length - 1]?.getBoundingClientRect();
      return Math.abs(first.left - bounds.left) < 1 && Math.abs(last.right - bounds.right) < 1
        && !!final && Math.abs(final.width - first.width) < 1;
    })).toBe(true);
  }
});

async function waitForNotebookChoice(page: Page, kind: 'game' | 'character', name: string, isOpen: boolean) {
  await expect.poll(() => page.evaluate(async ({ kind, name }) => {
    const path = '/src/lib/storage/indexedDbStorage.ts';
    const { indexedDbStorage } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/storage/indexedDbStorage');
    const entities = kind === 'game' ? await indexedDbStorage.games.getAll() : await indexedDbStorage.characters.getAll();
    const entity = entities.find(item => item.name === name);
    const settings = await indexedDbStorage.settings.get();
    return entity ? settings.notebookOpenPages?.includes(entity.id) : undefined;
  }, { kind, name })).toBe(isOpen);
}

test('keeps imported out-of-range and fractional game sizes consistent with the slider', async ({ page }) => {
  const grid = card(page, 'Size fixture').locator('..');
  for (const [target, width, columns] of [[400, 997, 3], [180.4, 769, 3], [10, 997, 7]]) {
    await grid.evaluate((element, width) => { element.style.width = `${width}px`; }, width);
    await page.evaluate(async target => {
      const path = '/src/lib/storage/indexedDbStorage.ts';
      const { indexedDbStorage } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/storage/indexedDbStorage');
      await indexedDbStorage.settings.update({ gameCardSize: target });
    }, target);
    await expect.poll(() => grid.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(columns);
    await page.getByRole('button', { name: 'View', exact: true }).click();
    const slider = page.getByRole('slider', { name: 'Card size', exact: true });
    await expect(slider).toHaveAttribute('aria-valuetext', `${Math.round((width - 16 * (columns - 1)) / columns)} pixels, ${columns} per row`);
    await page.keyboard.press('Escape');
    expect(await page.evaluate(async () => {
      const path = '/src/lib/storage/indexedDbStorage.ts';
      const { indexedDbStorage } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/storage/indexedDbStorage');
      return (await indexedDbStorage.settings.get()).gameCardSize;
    })).toBe(target);
  }
});

test('recalculates card sizes after docking without changing a saved preference', async ({ page }) => {
  await page.evaluate(async () => {
    const path = '/src/lib/storage/indexedDbStorage.ts';
    const { indexedDbStorage } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/storage/indexedDbStorage');
    await indexedDbStorage.settings.update({ characterCardSize: 190 });
  });
  await page.locator('h3', { hasText: 'Size fixture' }).click();
  const character = card(page, 'Landscape fixture');
  const initialWidth = await character.evaluate(element => element.getBoundingClientRect().width);
  await page.getByRole('button', { name: 'Notes', exact: true }).click();
  await page.getByRole('button', { name: 'Notebook layout', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Dock right', exact: true }).click();
  await expect.poll(() => character.evaluate(element => element.getBoundingClientRect().width)).not.toBe(initialWidth);
  await page.getByRole('button', { name: 'View', exact: true }).click();
  const slider = page.getByRole('slider', { name: 'Card size', exact: true });
  await expect(slider).toHaveAttribute('aria-valuetext', /pixels, \d+ per row/);
  await expect.poll(() => page.evaluate(async () => {
    const path = '/src/lib/storage/indexedDbStorage.ts';
    const { indexedDbStorage } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/storage/indexedDbStorage');
    return (await indexedDbStorage.settings.get()).characterCardSize;
  })).toBe(190);
});

test('remembers each game and character independently and removes the default-open setting', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Settings', exact: true });
  await expect(settings.getByRole('switch', { name: 'Notes Open by Default', exact: true })).toHaveCount(0);
  await expect(settings.getByText('Notes Open by Default', { exact: true })).toHaveCount(0);
  await settings.getByRole('button', { name: 'Done', exact: true }).click();
  await page.locator('h3', { hasText: 'Size fixture' }).click();
  const gameToggle = page.getByRole('button', { name: 'Notes', exact: true });
  await expect(gameToggle).toHaveAttribute('aria-expanded', 'false');
  await gameToggle.click();
  await waitForNotebookChoice(page, 'game', 'Size fixture', true);
  await page.locator('h3', { hasText: 'Landscape fixture' }).click();
  const characterToggle = page.getByRole('button', { name: 'Notes & Resources', exact: true });
  await expect(characterToggle).toHaveAttribute('aria-expanded', 'false');
  await characterToggle.click();
  await expect(page.getByText('Character strategy', { exact: true })).toBeVisible();
  await waitForNotebookChoice(page, 'character', 'Landscape fixture', true);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(gameToggle).toHaveAttribute('aria-expanded', 'true');
  await page.locator('h3', { hasText: 'Landscape fixture' }).click();
  await expect(characterToggle).toHaveAttribute('aria-expanded', 'true');
  await characterToggle.click();
  await waitForNotebookChoice(page, 'character', 'Landscape fixture', false);
  await page.reload();
  await page.locator('h3', { hasText: 'Size fixture' }).click();
  await expect(gameToggle).toHaveAttribute('aria-expanded', 'true');
  await page.locator('h3', { hasText: 'Landscape fixture' }).click();
  await expect(characterToggle).toHaveAttribute('aria-expanded', 'false');
});

for (const width of [1440, 800]) {
  test(`remembers resource-only and empty page choices at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(async () => {
      const path = '/src/lib/storage/indexedDbStorage.ts';
      const { indexedDbStorage } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/storage/indexedDbStorage');
      const game = (await indexedDbStorage.games.getAll()).find(item => item.name === 'Size fixture');
      if (!game) throw new Error('The game fixture is missing');
      const characterId = await indexedDbStorage.characters.add({ gameId: game.id, name: 'A reference fixture', links: [{ id: 'guide', url: 'https://example.com/guide', label: 'Practice guide' }] });
      await indexedDbStorage.combos.add({ characterId, name: 'Reference combo', notation: 'A', parsedNotation: [], tags: [] });
      await indexedDbStorage.games.add({ name: 'Empty game fixture', buttonLayout: ['A'] });
    });
    await page.locator('h3', { hasText: 'Size fixture' }).click();
    await expect(page.getByRole('button', { name: 'Notes', exact: true })).toHaveAttribute('aria-expanded', 'false');
    await page.locator('h3', { hasText: 'A reference fixture' }).click();
    const toggle = page.getByRole('button', { name: 'Notes & Resources', exact: true });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await page.getByRole('tab', { name: /^Resources/ }).click();
    if (width >= 1100) {
      await page.getByRole('button', { name: 'Notebook layout', exact: true }).click();
      await page.getByRole('menuitem', { name: 'Dock right', exact: true }).click();
    }
    const surfaceFor = (name: string) => width >= 1100
      ? page.getByRole('complementary', { name })
      : page.getByRole('dialog', { name });
    const surface = surfaceFor('A reference fixture Notebook');
    await expect(surface.getByRole('link', { name: 'Open Practice guide in a new tab', exact: true })).toBeVisible();
    await waitForNotebookChoice(page, 'character', 'A reference fixture', true);
    await page.reload();
    await page.locator('h3', { hasText: 'Size fixture' }).click();
    await expect(page.getByRole('button', { name: 'Notes', exact: true })).toHaveAttribute('aria-expanded', 'false');
    await page.locator('h3', { hasText: 'A reference fixture' }).click();
    await expect(surface).toBeVisible();
    await surface.getByRole('tab', { name: /^Resources/ }).click();
    await expect(surface.getByRole('link', { name: 'Open Practice guide in a new tab', exact: true })).toBeVisible();
    await surface.getByRole('button', { name: width >= 1100 ? 'Close notebook' : 'Close', exact: true }).click();
    await waitForNotebookChoice(page, 'character', 'A reference fixture', false);
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.locator('h3', { hasText: 'A reference fixture' }).click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.locator('h3', { hasText: 'Portrait fixture' }).click();
    const emptyCharacter = surfaceFor('Portrait fixture Notebook');
    await expect(emptyCharacter).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Notes & Resources', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Edit Note', exact: true }).click();
    await expect(emptyCharacter.getByRole('textbox', { name: 'Note', exact: true })).toHaveValue('');
    await waitForNotebookChoice(page, 'character', 'Portrait fixture', true);
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.locator('h3', { hasText: 'Portrait fixture' }).click();
    await expect(emptyCharacter).toBeVisible();
    await emptyCharacter.getByRole('button', { name: width >= 1100 ? 'Close notebook' : 'Close', exact: true }).click();
    await waitForNotebookChoice(page, 'character', 'Portrait fixture', false);
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.locator('h3', { hasText: 'Empty game fixture' }).click();
    const emptyGame = surfaceFor('Empty game fixture Notebook');
    const gameToggle = page.getByRole('button', { name: 'Notes', exact: true });
    await expect(gameToggle).toHaveCount(1);
    await expect(gameToggle).toHaveAttribute('aria-expanded', 'false');
    await gameToggle.click();
    await expect(emptyGame).toBeVisible();
    await waitForNotebookChoice(page, 'game', 'Empty game fixture', true);
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.locator('h3', { hasText: 'Empty game fixture' }).click();
    await expect(emptyGame).toBeVisible();
  });
}

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
  await page.setViewportSize({ width: 320, height: 480 });
  await page.getByRole('button', { name: 'Delete Size fixture', exact: true }).click();
  const confirmation = page.getByRole('alertdialog');
  await expect(confirmation).toBeVisible();
  const box = await confirmation.boundingBox();
  if (!box) throw new Error('Confirmation geometry is unavailable');
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(320);
  expect(box.y + box.height).toBeLessThanOrEqual(480);
  await expect(confirmation.locator('[data-slot="alert-dialog-header"]')).toHaveCSS('border-bottom-width', '0px');
  await expect(confirmation.locator('[data-slot="alert-dialog-footer"]')).toHaveCSS('border-top-width', '0px');
  await expect(confirmation.getByRole('button', { name: 'Delete', exact: true })).toBeInViewport();
  await expect(confirmation.getByRole('button', { name: 'Cancel', exact: true })).toBeInViewport();
  await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(card(page, 'Size fixture')).toBeVisible();
});
