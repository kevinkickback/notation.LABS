import { expect, test, type Locator, type Page } from '@playwright/test';
import { resolve } from 'node:path';

const orientations = ['landscape', 'portrait'] as const;
const viewports = [
  { width: 1440, height: 1000 },
  { width: 800, height: 600 },
  { width: 375, height: 700 },
  { width: 320, height: 480 },
];

async function checkResponsive(page: Page, editor: Locator, saveLabel: string) {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    const box = await editor.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.x).toBeGreaterThanOrEqual(0);
    expect(box?.y).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewport.width);
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(viewport.height);
    await expect(editor.getByRole('button', { name: saveLabel, exact: true })).toBeInViewport();
    await expect(editor.getByRole('button', { name: 'Cancel', exact: true })).toBeInViewport();
    const body = editor.locator('[data-slot="dialog-body"]');
    expect(await body.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    await editor.getByRole('slider', { name: 'Pan Y', exact: true }).scrollIntoViewIfNeeded();
    await expect(editor.getByRole('slider', { name: 'Pan Y', exact: true })).toBeInViewport();
  }
}

for (const orientation of orientations) {
  test(`Studio preserves game and ${orientation} character create/edit behavior at every breakpoint`, async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize(viewports[0]);
    await page.goto('/');
    if (orientation === 'portrait') {
      await page.getByRole('button', { name: 'Settings', exact: true }).click();
      const settings = page.getByRole('dialog', { name: 'Settings', exact: true });
      await settings.getByRole('combobox').filter({ hasText: 'Landscape' }).click();
      await page.getByRole('option', { name: 'Portrait', exact: true }).click();
      await settings.getByRole('button', { name: 'Done', exact: true }).click();
    }
    await page.getByRole('button', { name: /add your first game/i }).click();
    let editor = page.getByRole('dialog', { name: 'Add New Game', exact: true });
    await expect(editor.getByLabel('Game Name')).toBeFocused();
    await editor.getByLabel('Game Name').fill('Studio fighter');
    await editor.getByRole('button', { name: 'NRS', exact: true }).click();
    await editor.getByLabel('Game notes (optional)').fill('Game **strategy**');
    await page.locator('input[type=file][accept="image/*"]').setInputFiles(resolve('src/assets/images/defaultGame.jpg'));
    await editor.getByRole('slider', { name: 'Zoom', exact: true }).press('End');
    await editor.getByRole('switch', { name: 'Fill frame' }).click();
    await page.screenshot({ path: testInfo.outputPath('game-studio.png') });
    await checkResponsive(page, editor, 'Add Game');
    await editor.getByRole('button', { name: 'Add Game', exact: true }).click();
    await page.setViewportSize(viewports[0]);
    await page.getByRole('button', { name: `Edit Studio fighter`, exact: true }).click();
    editor = page.getByRole('dialog', { name: 'Edit Game', exact: true });
    await expect(editor.getByLabel('Game notes (optional)')).toHaveValue('Game **strategy**');
    await expect(editor.getByRole('slider', { name: 'Zoom', exact: true })).toHaveAttribute('aria-valuenow', '200');
    await expect(editor.getByRole('switch', { name: 'Fill frame' })).toHaveAttribute('aria-checked', 'false');
    await expect(editor.getByRole('button', { name: 'NRS', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await editor.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await page.locator('h3', { hasText: `Studio fighter` }).click();
    await page.getByRole('button', { name: 'Add Character', exact: true }).click();
    editor = page.getByRole('dialog');
    await expect(editor.getByLabel('Character Name')).toBeFocused();
    await editor.getByLabel('Character Name').fill('Ryu');
    await editor.getByLabel('Notes (optional)', { exact: true }).fill('Character **strategy**');
    // The bundled character placeholder contains AVIF data despite its .jpg
    // extension. Use the verified JPEG to exercise the supported upload path.
    await page.locator('input[type=file][accept="image/*"]').setInputFiles(resolve('src/assets/images/defaultGame.jpg'));
    await editor.getByRole('slider', { name: 'Zoom', exact: true }).press('End');
    const portrait = await editor.locator('.entity-artwork-frame').boundingBox();
    expect((portrait?.width ?? 0) / (portrait?.height ?? 1)).toBeCloseTo(orientation === 'portrait' ? 3 / 4 : 4 / 3, 2);
    await page.screenshot({ path: testInfo.outputPath('character-studio.png') });
    await checkResponsive(page, editor, 'Add Character');
    await editor.getByRole('button', { name: 'Add Character', exact: true }).click();
    await page.setViewportSize(viewports[0]);
    await page.getByRole('button', { name: 'Edit Ryu', exact: true }).click();
    editor = page.getByRole('dialog', { name: 'Edit Character', exact: true });
    await expect(editor.getByLabel('Notes (optional)', { exact: true })).toHaveValue('Character **strategy**');
    await expect(editor.getByRole('slider', { name: 'Zoom', exact: true })).toHaveAttribute('aria-valuenow', '200');
    await editor.getByRole('button', { name: 'Remove image', exact: true }).click();
    await expect(editor.getByRole('button', { name: 'Upload character image' })).toBeVisible();
    await expect(editor.getByRole('slider', { name: 'Zoom', exact: true })).toHaveCount(0);
    await editor.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await page.getByRole('button', { name: 'Edit Ryu', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Upload character image' })).toBeVisible();
  });
}
