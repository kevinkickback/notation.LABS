import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Notifications', exact: true })).toBeVisible();
});

async function emitError(page: Page, message: string) {
  await page.evaluate(async message => {
    const path = '/src/lib/notifications.ts';
    const { notify } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/notifications');
    notify.error(message);
  }, message);
  await expect(page.getByRole('button', { name: /Notifications, \d+ unread/ })).toBeVisible();
}

test('captures real operations while closed, persists without replay, and manages history', async ({ page }) => {
  await page.getByRole('button', { name: /add your first game|^Add Game$/i }).click();
  const editor = page.getByRole('dialog');
  await editor.getByLabel('Game Name', { exact: true }).fill('History game');
  await editor.getByRole('button', { name: 'Add Game', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'History game', exact: true })).toBeVisible();
  const bell = page.getByRole('button', { name: 'Notifications', exact: true });
  await expect(bell).toBeVisible();
  await emitError(page, 'A recoverable error');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Notifications, 1 unread' })).toBeVisible();
  await expect(page.locator('[data-sonner-toast]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Notifications, 1 unread' }).click();
  const history = page.getByRole('dialog', { name: 'Notifications', exact: true });
  await expect(history.getByText('Game added')).toBeVisible();
  await expect(history.getByText('A recoverable error')).toBeVisible();
  await history.getByRole('button', { name: 'Mark all read' }).click();
  await expect(history.getByText('Unread', { exact: true })).toHaveCount(0);
  await history.getByRole('button', { name: 'Remove notification: A recoverable error' }).click();
  await expect(history.getByText('A recoverable error')).toHaveCount(0);
  await history.getByRole('button', { name: 'Clear history' }).click();
  await expect(history.getByText('No notifications yet.')).toBeVisible();
});

test('opens with the keyboard, returns focus on Escape, and closes on outside clicks', async ({ page }) => {
  const bell = page.getByRole('button', { name: 'Notifications', exact: true });
  await bell.focus();
  await page.keyboard.press('Enter');
  const history = page.getByRole('dialog', { name: 'Notifications', exact: true });
  await expect(history.getByText('No notifications yet.')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(history).toHaveCount(0);
  await expect(bell).toBeFocused();
  await bell.click();
  await page.getByRole('heading', { name: 'No Games Yet', exact: true }).click();
  await expect(history).toHaveCount(0);
});

for (const width of [320, 800, 1440]) {
  for (const colorTheme of ['light', 'dark'] as const) {
    test(`keeps long history readable as docked notes adapt at ${width}px in ${colorTheme} mode`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: 1440, height: 720 });
      await page.evaluate(async colorTheme => {
        const storagePath = '/src/lib/storage/indexedDbStorage.ts';
        const { indexedDbStorage } = await import(/* @vite-ignore */ storagePath) as typeof import('../../src/lib/storage/indexedDbStorage');
        await indexedDbStorage.settings.update({ colorTheme });
        await indexedDbStorage.games.add({ name: 'Dock fixture', buttonLayout: ['A'], notes: 'Strategy notes' });
        const commandPath = '/src/lib/application/notificationCommands.ts';
        const { recordNotification } = await import(/* @vite-ignore */ commandPath) as typeof import('../../src/lib/application/notificationCommands');
        for (let index = 0; index < 15; index++) {
          await recordNotification({ id: `entry-${index}`, type: 'error', message: `Error ${index}: ${'longmessage'.repeat(18)}\nPlease retry.` });
        }
      }, colorTheme);
      await page.getByRole('heading', { name: 'Dock fixture', exact: true }).click();
      await page.getByRole('button', { name: 'Notes', exact: true }).click();
      await page.getByRole('button', { name: 'Notebook layout', exact: true }).click();
      await page.getByRole('menuitem', { name: 'Dock right', exact: true }).click();
      await page.setViewportSize({ width, height: 720 });
      await expect(page.getByText('Strategy notes', { exact: true })).toBeVisible();
      // The smallest viewport presents notes over the workspace. Close that
      // presentation before using the footer, as a user would.
      if (width < 640) await page.getByRole('button', { name: 'Close', exact: true }).click();
      await emitError(page, 'Temporary feedback');
      await page.getByRole('button', { name: 'Notifications, 16 unread' }).click();
      const history = page.getByRole('dialog', { name: 'Notifications', exact: true });
      await expect(history.getByRole('button', { name: 'Clear history' })).toBeVisible();
      const geometry = await history.evaluate(element => {
        const rect = element.getBoundingClientRect();
        const scroll = element.lastElementChild as HTMLElement;
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, scrollWidth: scroll.scrollWidth, width: scroll.clientWidth, scrollHeight: scroll.scrollHeight, height: scroll.clientHeight };
      });
      expect(geometry.left).toBeGreaterThanOrEqual(0);
      expect(geometry.right).toBeLessThanOrEqual(width);
      expect(geometry.top).toBeGreaterThanOrEqual(0);
      const bell = await page.locator('.notification-bell').boundingBox();
      expect(geometry.bottom).toBeLessThan(bell?.y ?? 0);
      expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width);
      expect(geometry.scrollHeight).toBeGreaterThan(geometry.height);
      const notice = page.locator('[data-sonner-toast]').filter({ hasText: 'Temporary feedback' });
      await expect(notice).toBeVisible();
      const toast = await notice.boundingBox();
      expect((toast?.y ?? 0) + (toast?.height ?? 0)).toBeLessThan(geometry.top);
      await page.screenshot({ path: testInfo.outputPath(`notifications-${colorTheme}-${width}.png`) });
    });
  }
}
