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

test('keeps preview text and button labels readable in both themes and distinguishes input backgrounds', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Notation guide', exact: true }).click();
  const guide = page.getByRole('dialog', { name: 'Combo Notation Guide' });
  for (const theme of ['light', 'dark'] as const) {
    for (const motionIconStyle of ['joystick', 'arrows'] as const) {
      await page.evaluate(async updates => {
        const path = '/src/lib/storage/indexedDbStorage.ts';
        const { indexedDbStorage } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/storage/indexedDbStorage');
        await indexedDbStorage.settings.update(updates);
      }, { colorTheme: theme, motionIconStyle });
      await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^$/);
      const icons = guide.locator('.guide-preview-output').filter({ has: page.getByText('Icons', { exact: true }) }).locator('.guide-preview-surface');
      await expect(icons).toHaveAttribute('data-motion-style', motionIconStyle);
      const results = await guide.evaluate(element => {
        const context = document.createElement('canvas').getContext('2d');
        if (!context) throw new Error('Cannot measure preview contrast');
        const luminance = (color: string) => {
          context.fillStyle = color;
          context.fillRect(0, 0, 1, 1);
          const rgb = context.getImageData(0, 0, 1, 1).data;
          const channels = Array.from(rgb).slice(0, 3).map(value => {
            const channel = value / 255;
            return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
          });
          return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
        };
        const surfaces = Array.from(element.querySelectorAll<HTMLElement>('.guide-preview-surface'));
        const contrast = surfaces.flatMap(surface => {
          const background = luminance(getComputedStyle(surface).backgroundColor);
          return Array.from(surface.querySelectorAll<HTMLElement>('span[style], svg text')).map(token => {
            const style = getComputedStyle(token);
            const foreground = luminance(token.tagName === 'text' ? style.fill : style.color);
            return (Math.max(background, foreground) + 0.05) / (Math.min(background, foreground) + 0.05);
          });
        });
        const plate = (style: string) => {
          const surface = element.querySelector<HTMLElement>(`.guide-live-preview [data-motion-style="${style}"]`);
          if (!surface) throw new Error(`Missing ${style} preview`);
          return luminance(getComputedStyle(surface).backgroundColor);
        };
        return { contrast, joystick: plate('joystick'), arrows: plate('arrows') };
      });
      expect(results.contrast.length).toBeGreaterThan(0);
      expect(Math.min(...results.contrast)).toBeGreaterThanOrEqual(4.5);
      if (theme === 'light') expect(results.arrows).toBeGreaterThan(results.joystick);
    }
  }
});
