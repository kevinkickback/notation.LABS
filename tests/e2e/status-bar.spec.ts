import { expect, test } from '@playwright/test';
import packageJson from '../../package.json' with { type: 'json' };

for (const width of [320, 800, 1440]) {
  test(`scrolls a long library above the full-width status bar at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 600 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'No Games Yet' })).toBeVisible();
    await page.evaluate(async () => {
      const path = '/src/lib/application/gameCommands.ts';
      const { createGame } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/application/gameCommands');
      for (let index = 0; index < 40; index++) await createGame({ name: `Game ${String(index).padStart(2, '0')}`, buttonLayout: ['A'], notationProfile: 'standard' });
    });
    const area = page.locator('.workspace-scroll-area');
    const footer = page.getByRole('contentinfo');
    await expect.poll(() => area.evaluate(element => element.scrollHeight - element.clientHeight)).toBeGreaterThan(500);
    const initial = await footer.boundingBox();
    await page.getByRole('heading', { name: 'Game 39', exact: true }).scrollIntoViewIfNeeded();
    const bounds = await area.boundingBox();
    const final = await footer.boundingBox();
    if (!bounds || !final || !initial) throw new Error('Workspace geometry is unavailable');
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(final.y);
    expect(final).toEqual(initial);
    expect(final.x).toBe(0);
    expect(final.width).toBe(width);
    expect(final.y + final.height).toBe(600);
    expect(await area.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    const viewport = await page.evaluate(() => ({ y: scrollY, height: document.documentElement.scrollHeight, width: document.documentElement.scrollWidth }));
    expect(viewport).toEqual({ y: 0, height: 600, width });
  });
}

test('keeps version and connection status in a viewport-safe footer', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'No Games Yet' })).toBeVisible();
  const footer = page.getByRole('contentinfo');
  await expect(footer.getByText(`v${packageJson.version}`, { exact: true })).toBeVisible();
  await expect(page.getByRole('banner').getByText(`v${packageJson.version}`, { exact: true })).toHaveCount(0);
  await expect(footer.getByText('Up to date')).toHaveCount(0);
  await expect(footer.getByText(/Image search|Current version/)).toHaveCount(0);
  await context.setOffline(true);
  await expect(footer.getByText('Offline · updates unavailable')).toBeVisible();
  await page.setViewportSize({ width: 375, height: 700 });
  const box = await footer.boundingBox();
  expect(box?.x).toBeGreaterThanOrEqual(0);
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(375);
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(700);
  await context.setOffline(false);
  await expect(footer.getByText('Offline · updates unavailable')).toHaveCount(0);
  await expect(footer.getByText(`v${packageJson.version}`, { exact: true })).toBeVisible();
});
