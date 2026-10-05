import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { notationContrast, textContrast } from '../helpers/contrast';

async function checkText(page: Page, selector?: string) {
  let builder = new AxeBuilder({ page }).withRules(['color-contrast']);
  if (selector) builder = builder.include(selector);
  const { violations } = await builder.analyze();
  expect(violations.flatMap(violation => violation.nodes.map(node => ({
    target: node.target, message: node.failureSummary,
  })))).toEqual([]);
}

async function checkInk(surface: Locator) {
  const results = await notationContrast(surface);
  expect(results.length).toBeGreaterThan(0);
  for (const { text, ratio } of results) expect(ratio, `Notation ${text}`).toBeGreaterThanOrEqual(4.5);
}

async function checkScrolledPanel(page: Page, panel: Locator, selector: string) {
  const height = await panel.evaluate(element => element.scrollHeight);
  const step = await panel.evaluate(element => Math.max(1, element.clientHeight - 80));
  for (let top = 0; top < height; top += step) {
    await panel.evaluate((element, top) => { element.scrollTop = top; }, top);
    await checkText(page, selector);
  }
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const path = '/src/lib/storage/indexedDbStorage.ts';
    const { indexedDbStorage: db } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/storage/indexedDbStorage');
    const parserPath = '/src/lib/parser.ts';
    const { parseComboNotation } = await import(/* @vite-ignore */ parserPath) as typeof import('../../src/lib/parser');
    await db.settings.update({ colorTheme: 'light', displayMode: 'visual-icons' });
    const gameId = await db.games.add({ name: 'Contrast game', buttonLayout: ['L', 'M', 'H'], buttonColors: { L: '#00ff00', M: '#ffff00', H: '#ff0000' }, notes: 'Practice [reference](https://example.com)' });
    const characterId = await db.characters.add({ gameId, name: 'Contrast character', notes: 'Practice [reference](https://example.com)', links: [{ id: 'link', label: 'Frame data', url: 'https://example.com' }] });
    const notation = 'CH (5L > 2M > 236H)x3 [corner]';
    await db.combos.add({ characterId, name: 'Contrast combo', notation, parsedNotation: parseComboNotation(notation, ['L', 'M', 'H']), description: 'Practice [reference](https://example.com)', tags: ['confirm', 'corner', 'meter'], damage: '2500', meterCost: '1 Assist · 0–50 Meter', difficulty: 3 });
  });
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await expect(page.getByRole('heading', { name: 'Contrast game', exact: true })).toBeVisible();
});

test('keeps light settings readable through every category, including previews and hover states', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Settings', exact: true });
  for (const name of ['General', 'Notation', 'Colors', 'About']) {
    await settings.getByRole('tab', { name, exact: true }).click();
    await checkScrolledPanel(page, settings.getByRole('tabpanel'), '.settings-dialog');
    if (name === 'Notation') {
      await checkInk(settings.getByRole('radiogroup', { name: 'Button Style' }));
      await checkInk(settings.locator('.notation-preview').first());
      await checkInk(settings.locator('.notation-preview').last());
      await settings.locator('.notation-preview').last().scrollIntoViewIfNeeded();
      await settings.screenshot({ path: testInfo.outputPath('light-notation-settings.png') });
      for (const choice of await settings.getByRole('radiogroup').locator('label').all()) {
        await choice.hover();
        await checkText(page, '.settings-dialog');
      }
    }
  }
});

test('keeps every guide profile and both motion styles readable in light and dark themes', async ({ page }) => {
  await page.getByRole('button', { name: 'Notation guide', exact: true }).click();
  const guide = page.getByRole('dialog', { name: 'Combo Notation Guide' });
  for (const colorTheme of ['light', 'dark'] as const) {
    for (const motionIconStyle of ['joystick', 'arrows'] as const) {
      await page.evaluate(async updates => {
        const path = '/src/lib/storage/indexedDbStorage.ts';
        const { indexedDbStorage } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/storage/indexedDbStorage');
        await indexedDbStorage.settings.update(updates);
      }, { colorTheme, motionIconStyle });
      await expect(page.locator('html')).toHaveClass(colorTheme === 'dark' ? /dark/ : /^$/);
      for (const name of ['Standard / Numpad', 'NRS', 'Tekken']) {
        await guide.getByRole('tab', { name, exact: true }).click();
        await checkScrolledPanel(page, guide.locator('.guide-reference'), '.notation-guide-dialog');
        for (const surface of await guide.locator('.guide-preview-surface').all()) await checkInk(surface);
      }
    }
  }
});

test('keeps library lists, combo details, editors, notes and accent controls readable', async ({ page }) => {
  const list = async () => {
    await page.getByRole('button', { name: 'View', exact: true }).click();
    await page.getByRole('button', { name: 'List', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toBeHidden();
  };
  await checkText(page);
  await list();
  await checkText(page);
  await page.getByRole('heading', { name: 'Contrast game', exact: true }).click();
  await checkText(page);
  await list();
  await checkText(page);
  await page.getByRole('heading', { name: 'Contrast character', exact: true }).click();
  await checkText(page);
  await checkInk(page.locator('.combo-card-notation'));
  await page.getByRole('button', { name: 'Edit combo', exact: true }).click();
  await checkText(page, '.combo-form-dialog');
  await checkInk(page.locator('.combo-form-dialog .combo-display'));
  await page.keyboard.press('Escape');
  await expect(page.locator('.combo-form-dialog')).toBeHidden();
  await page.getByRole('button', { name: 'Notes & Resources', exact: true }).click();
  await checkText(page);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Settings', exact: true });
  for (const color of ['#ffffff', '#000000', '#ffff00', '#3b82f6', '#e14c9b']) {
    await settings.getByLabel('Accent color hex', { exact: true }).fill(color);
    await checkText(page, '.settings-dialog');
    const control = settings.getByRole('combobox').first();
    await control.focus();
    expect(await textContrast(control, 'borderTopColor', true)).toBeGreaterThanOrEqual(3);
    await settings.getByRole('tab', { name: 'Notation', exact: true }).click();
    await settings.getByText('Colored Text', { exact: true }).hover();
    await checkText(page, '.settings-dialog');
    const radio = settings.getByRole('radio', { name: /Colored Text/ });
    expect(await textContrast(radio, 'borderTopColor', true)).toBeGreaterThanOrEqual(3);
    const thumb = settings.getByRole('slider');
    expect(await textContrast(thumb, 'borderTopColor', true)).toBeGreaterThanOrEqual(3);
    await settings.getByRole('tab', { name: 'General', exact: true }).click();
    await settings.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(settings).toBeHidden();
    await checkText(page);
    await expect(page.locator('.combo-card-notes a')).toHaveCSS('text-decoration-line', 'underline');
    const edit = page.getByRole('button', { name: 'Edit combo', exact: true });
    await page.keyboard.press('Tab');
    await edit.focus();
    expect(await edit.evaluate(element => element.matches(':focus-visible'))).toBe(true);
    await expect(edit).toHaveCSS('outline-style', 'solid');
    expect(await textContrast(edit, 'outlineColor', true)).toBeGreaterThanOrEqual(3);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
  }
});

test('keeps entity forms, transfer selection, and notification feedback readable in light mode', async ({ page }) => {
  await page.getByRole('button', { name: 'Add Game', exact: true }).click();
  await checkText(page, '[data-slot="dialog-content"]');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('heading', { name: 'Contrast game', exact: true }).click();
  await page.getByRole('button', { name: 'Add Character', exact: true }).click();
  await checkText(page, '[data-slot="dialog-content"]');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('button', { name: 'Export data', exact: true }).click();
  const exporter = page.getByRole('dialog', { name: 'Export Data', exact: true });
  await exporter.getByRole('button', { name: 'Expand Contrast game', exact: true }).click();
  await exporter.getByRole('button', { name: 'Expand Contrast character', exact: true }).click();
  await checkText(page, '[data-slot="dialog-content"]');
  await page.keyboard.press('Escape');
  await expect(exporter).toBeHidden();
  await page.getByRole('button', { name: 'Import data', exact: true }).click();
  await checkText(page, '[data-slot="dialog-content"]');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  for (const type of ['success', 'warning', 'error', 'info'] as const) {
    await page.evaluate(async type => {
    const path = '/src/lib/notifications.ts';
    const { notify } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/notifications');
    notify[type](`Contrast ${type}`, { duration: 30000 });
    }, type);
    await expect(page.locator('[data-sonner-toast][data-front="true"]')).toContainText(`Contrast ${type}`);
    await checkText(page, '[data-sonner-toaster]');
  }
  await page.getByRole('button', { name: /Notifications/ }).click();
  await expect(page.getByRole('dialog', { name: 'Notifications', exact: true })).toBeVisible();
  await checkText(page);
});
