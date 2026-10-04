import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { createServer, type ViteDevServer } from 'vite';

test('loads a cold development workspace within the desktop window deadline', async ({ page }) => {
  const temporaryRoot = resolve('.tmp');
  await mkdir(temporaryRoot, { recursive: true });
  const cache = await mkdtemp(join(temporaryRoot, 'development-startup-'));
  expect(dirname(cache)).toBe(temporaryRoot);
  expect(basename(cache)).toMatch(/^development-startup-/);
  const originalElectron = process.env.ELECTRON;
  let server: ViteDevServer | undefined;
  try {
    process.env.ELECTRON = 'false';
    server = await createServer({
      configFile: resolve('vite.config.ts'),
      cacheDir: cache,
      logLevel: 'error',
      server: { host: '127.0.0.1', port: 5174, open: false },
    });
    await server.listen();
    const url = server.resolvedUrls?.local[0];
    if (!url) throw new Error('Development server did not expose its address');
    // Isolate local stylesheet/renderer startup from an external font service.
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.goto(url, { timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Notifications', exact: true })).toBeVisible();
    await expect(page.locator('.notification-bell')).toHaveCSS('height', '24px');
  } finally {
    if (originalElectron === undefined) delete process.env.ELECTRON;
    else process.env.ELECTRON = originalElectron;
    await server?.close();
    await rm(cache, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
