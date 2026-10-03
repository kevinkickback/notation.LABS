import { expect, test } from '@playwright/test';

for (const theme of ['light', 'dark'] as const) {
  test(`loads the detailed splash and compact header marks in ${theme} mode at each breakpoint`, async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/src/lib/storage/indexedDbStorage.ts*', async route => {
      const response = await route.fetch();
      const code = await response.text();
      await route.fulfill({ response, body: `${code}\n
        const startupBrandReady = new Promise(resolve => { window.finishStartupBrandProbe = resolve; });
        const originalBrandSettings = indexedDbStorage.settings.get;
        indexedDbStorage.settings.get = async (...args) => ({ ...await originalBrandSettings(...args), colorTheme: '${theme}' });
        const originalBrandLibrary = indexedDbStorage.games.getAll;
        indexedDbStorage.games.getAll = async (...args) => { await startupBrandReady; return originalBrandLibrary(...args); };
      ` });
    });
    await page.goto('/');
    const overlay = page.getByTestId('app-loading-overlay');
    const logo = overlay.locator('.startup-logo');
    await expect(logo).toHaveJSProperty('naturalWidth', 512);
    await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);
    const source = await logo.getAttribute('src');
    for (const viewport of [{ width: 1440, height: 900 }, { width: 800, height: 600 }, { width: 375, height: 667 }, { width: 320, height: 480 }]) {
      await page.setViewportSize(viewport);
      await expect(logo).toBeInViewport();
      await expect(overlay.getByRole('status')).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      const mark = await logo.boundingBox();
      if (!mark) throw new Error('Missing splash logo');
      expect(mark.width).toBeCloseTo(mark.height, 0);
      if (viewport.width === 1440 || viewport.width === 320)
        await page.screenshot({ path: testInfo.outputPath(`splash-${theme}-${viewport.width}.png`) });
    }
    await page.evaluate(() => (window as unknown as { finishStartupBrandProbe: () => void }).finishStartupBrandProbe());
    await expect(overlay).toHaveCount(0);
    const headerLogo = page.locator('header img');
    await expect(headerLogo).toHaveJSProperty('naturalWidth', 32);
    await expect(headerLogo).toHaveAttribute('src', /(?:^data:image\/svg\+xml|(?:app|flask)-mark.*\.svg)/);
    expect(await headerLogo.getAttribute('src')).not.toBe(source);
    for (const width of [320, 800, 1440]) {
      await page.setViewportSize({ width, height: 700 });
      await expect(headerLogo).toBeInViewport();
      await expect(page.locator('header').getByRole('heading', { name: 'notation.LABS' })).toBeVisible();
      const header = await page.locator('header').boundingBox();
      expect(header?.height).toBeCloseTo(61, 0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      if (width === 1440) await page.screenshot({ path: testInfo.outputPath(`header-${theme}.png`) });
    }
  });
}

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
    // Release the injected failure and retry in one turn: settings hydration can
    // otherwise re-run a library read between releasing it and clicking Retry.
    await page.getByRole('button', { name: 'Try again', exact: true }).evaluate(button => {
      (window as unknown as { startupProbe: { fail: boolean } }).startupProbe.fail = false;
      (button as HTMLButtonElement).click();
    });
    await expect(page.getByTestId('app-loading-overlay')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Export data', exact: true })).toBeVisible();
    await expect(page.locator('.app-workspace')).not.toHaveAttribute('inert');
    expect(pageErrors).toEqual([]);
  });
}
