import { expect, test } from '@playwright/test';
import packageJson from '../../package.json' with { type: 'json' };

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
