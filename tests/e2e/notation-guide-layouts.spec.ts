import { expect, test } from '@playwright/test';

const profiles = ['Standard / Numpad', 'NRS', 'Tekken'] as const;
const viewports = [
  { width: 1440, height: 1000 },
  { width: 800, height: 600 },
  { width: 375, height: 700 },
  { width: 320, height: 480 },
];

test('keeps the live preview in place while scrolling the Study reference', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize(viewports[0]);
  await page.goto('/');
  await page.getByRole('button', { name: 'Notation guide', exact: true }).click();
  const guide = page.getByRole('dialog', { name: 'Combo Notation Guide' });
  const reference = guide.getByRole('region', { name: 'Standard notation reference' });
  const preview = guide.locator('.guide-live-preview');
  const syntax = reference.locator('section').filter({
    has: page.getByRole('heading', { name: 'Standard Supported Syntax' }),
  });
  const firstTerm = await syntax.locator('dt').nth(0).boundingBox();
  const secondTerm = await syntax.locator('dt').nth(1).boundingBox();
  expect(secondTerm?.y).toBe(firstTerm?.y);
  expect(secondTerm?.x).toBeGreaterThan(firstTerm?.x ?? 0);

  const initialBox = await preview.boundingBox();
  const input = guide.getByRole('textbox', { name: 'Notation', exact: true });
  await input.fill('5L > 5M xx 236H');
  const initialOutput = await preview.locator('[aria-live="polite"]').textContent();
  await reference.focus();
  await page.keyboard.press('End');
  await expect.poll(() => reference.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  await expect(reference.getByRole('button', { name: /^Try / }).last()).toBeInViewport();
  await expect(input).toHaveValue('5L > 5M xx 236H');
  expect(await preview.locator('[aria-live="polite"]').textContent()).toBe(initialOutput);
  expect(await preview.boundingBox()).toEqual(initialBox);
  await page.keyboard.press('Home');
  await expect.poll(() => reference.evaluate(element => element.scrollTop)).toBe(0);
  await guide.screenshot({ path: testInfo.outputPath('guide-study.png') });
});

test('Study keeps every profile readable and examples usable at every breakpoint', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize(viewports[0]);
  await page.goto('/');
  await page.getByRole('button', { name: 'Notation guide', exact: true }).click();
  const guide = page.getByRole('dialog', { name: 'Combo Notation Guide' });
  for (const profile of profiles) {
    await page.setViewportSize(viewports[0]);
    await guide.getByRole('tab', { name: profile, exact: true }).click();
    const reference = guide.locator('.guide-reference');
    await expect(reference.getByRole('listitem')).toHaveCount(9);
    await expect(reference.getByRole('button', { name: /^Try / })).toHaveCount(3);
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      const box = await guide.boundingBox();
      expect(box?.x).toBeGreaterThanOrEqual(0);
      expect(box?.y).toBeGreaterThanOrEqual(0);
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewport.width);
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(viewport.height);
      const workspace = guide.locator('.guide-workspace');
      expect(await workspace.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
      expect(await reference.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
      const example = reference.getByRole('button', { name: /^Try / }).last();
      const notation = (await example.getAttribute('aria-label'))?.slice(4);
      await example.click();
      const input = guide.getByRole('textbox', { name: 'Notation', exact: true });
      await expect(input).toHaveValue(notation ?? '');
      await input.scrollIntoViewIfNeeded();
      await expect(input).toBeInViewport();
      const directions = reference.getByRole('list');
      await directions.scrollIntoViewIfNeeded();
      await expect(directions).toBeInViewport();
    }
  }
});
