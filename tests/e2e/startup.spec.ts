import { expect, test } from '@playwright/test';

for (const target of ['settings', 'library'] as const) {
  test(`keeps a failed ${target} read in the startup overlay and recovers on retry`, async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.route('**/src/lib/storage/indexedDbStorage.ts*', async route => {
      const response = await route.fetch();
      const code = await response.text();
      const repository = target === 'settings' ? 'settings' : 'games';
      const method = target === 'settings' ? 'get' : 'getAll';
      await route.fulfill({ response, body: `${code}\n
        window.startupProbe = { failedReads: 0, fail: true };
        const originalStartupRead = indexedDbStorage.${repository}.${method};
        indexedDbStorage.${repository}.${method} = async (...args) => {
          if (window.startupProbe.fail) {
            window.startupProbe.failedReads++;
            throw new Error('Temporary ${target} read failure');
          }
          return originalStartupRead(...args);
        };
      ` });
    });
    await page.goto('/');
    await expect(page.getByRole('alert')).toHaveText(`Temporary ${target} read failure`);
    await expect(page.getByTestId('app-loading-overlay')).toBeVisible();
    await expect(page.locator('.app-workspace')).toHaveAttribute('inert', '');
    await expect(page.getByRole('button', { name: 'Export data', exact: true })).toHaveCount(0);
    await expect(page.getByText('Application Error', { exact: true })).toHaveCount(0);
    await page.evaluate(() => { (window as unknown as { startupProbe: { fail: boolean } }).startupProbe.fail = false; });
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await expect(page.getByTestId('app-loading-overlay')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Export data', exact: true })).toBeVisible();
    await expect(page.locator('.app-workspace')).not.toHaveAttribute('inert');
    expect(pageErrors).toEqual([]);
  });
}
