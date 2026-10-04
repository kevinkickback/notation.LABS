import { expect, test, type Page } from '@playwright/test';
import { updateDetails, updateSnapshot } from '../helpers/updater';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Notifications', exact: true })).toBeVisible();
});

async function emitError(page: Page, message: string, duration?: number) {
  await page.evaluate(async ({ message, duration }) => {
    const path = '/src/lib/notifications.ts';
    const { notify } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/notifications');
    notify.error(message, { duration });
  }, { message, duration });
  await expect(page.getByRole('button', { name: /Notifications, \d+ unread/ })).toBeVisible();
}

for (const theme of ['light', 'dark'] as const) {
  for (const width of [320, 800, 1440]) {
    test(`positions feedback above the bell and open history at ${width}px in ${theme} mode`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 600 });
      await page.evaluate(async theme => {
        const storagePath = '/src/lib/storage/indexedDbStorage.ts';
        const { indexedDbStorage } = await import(/* @vite-ignore */ storagePath) as typeof import('../../src/lib/storage/indexedDbStorage');
        await indexedDbStorage.settings.update({ colorTheme: theme });
        const path = '/src/lib/application/notificationCommands.ts';
        const { recordNotification } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/application/notificationCommands');
        for (let index = 0; index < 15; index++) await recordNotification({ id: `layout-${index}`, type: 'error', message: `Earlier error ${index}: ${'Details '.repeat(30)}` });
      }, theme);
      const message = 'Cannot export the image for "Practice library": it is unsupported, damaged, or too large to process safely. Replace it and try again.';
      await emitError(page, message, 30000);
      await expect(page.locator('[data-sonner-toaster]')).toHaveAttribute('data-sonner-theme', theme);
      const toast = page.locator('[data-sonner-toast][data-front="true"]');
      const bell = page.getByRole('button', { name: /Notifications/ });
      const footer = page.getByRole('contentinfo');
      await expect(toast).toBeVisible();
      const fits = async (anchor: typeof footer) => {
        const [notice, target] = await Promise.all([toast.boundingBox(), anchor.boundingBox()]);
        return !!notice && !!target && notice.y >= 0 && notice.x >= 0 && notice.x + notice.width <= width && notice.y + notice.height <= target.y - 7;
      };
      await expect.poll(() => fits(footer)).toBe(true);
      const closed = await toast.boundingBox();
      expect(Math.round((closed?.x ?? 0) + (closed?.width ?? 0))).toBe(width - 16);
      await bell.click();
      const history = page.getByRole('dialog', { name: 'Notifications', exact: true });
      await expect(history).toBeVisible();
      await expect.poll(() => fits(history)).toBe(true);
      await expect(history.getByRole('button', { name: 'Close notifications' })).toBeInViewport();
      await page.screenshot({ path: testInfo.outputPath('feedback-layout.png') });
      for (const height of [1000, 900, 500]) {
        await page.setViewportSize({ width, height });
        await expect.poll(() => fits(history)).toBe(true);
      }
      await history.getByRole('button', { name: 'Close notifications' }).click();
      await expect(history).toHaveCount(0);
      await expect.poll(() => fits(footer)).toBe(true);
    });
  }
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

test('keeps very long feedback readable and scrollable above open history', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 500 });
  await page.getByRole('button', { name: 'Notifications', exact: true }).click();
  const message = `Transfer failed: ${'Please retry after replacing the affected artwork. '.repeat(25)}`;
  await emitError(page, message, 30000);
  const history = page.getByRole('dialog', { name: 'Notifications', exact: true });
  const notice = page.locator('[data-sonner-toast][data-front="true"]');
  await expect(notice).toHaveText(message);
  await expect(notice).toHaveCSS('touch-action', 'pan-y');
  await expect.poll(() => notice.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
  await notice.evaluate(element => { element.scrollTop = element.scrollHeight; });
  expect(await notice.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  await expect(history.getByRole('button', { name: 'Close notifications' })).toBeInViewport();
  const bounds = await notice.boundingBox();
  const panel = await history.boundingBox();
  expect(bounds?.y).toBeGreaterThanOrEqual(0);
  expect((bounds?.y ?? 0) + (bounds?.height ?? 0)).toBeLessThan(panel?.y ?? 0);
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

test('keeps keyboard focus in the panel after removing the final entry and clearing history', async ({ page }) => {
  await emitError(page, 'First error');
  await page.getByRole('button', { name: 'Notifications, 1 unread' }).click();
  const history = page.getByRole('dialog', { name: 'Notifications', exact: true });
  await history.getByRole('button', { name: 'Remove notification: First error' }).focus();
  await page.keyboard.press('Enter');
  await expect(history.getByText('No notifications yet.')).toBeVisible();
  await expect(history.getByRole('button', { name: 'Close notifications' })).toBeFocused();
  await emitError(page, 'Second error');
  await history.getByRole('button', { name: 'Clear history' }).focus();
  await page.keyboard.press('Enter');
  await expect(history.getByText('No notifications yet.')).toBeVisible();
  await expect(history.getByRole('button', { name: 'Close notifications' })).toBeFocused();
});

test('preserves keyboard focus when retrying a failed history read', async ({ page }) => {
  await page.getByRole('button', { name: 'Notifications', exact: true }).click();
  const history = page.getByRole('dialog', { name: 'Notifications', exact: true });
  await expect(history.getByText('No notifications yet.')).toBeVisible();
  await page.evaluate(async () => {
    const repositoryPath = '/src/lib/storage/notificationRepository.ts';
    const { notificationRepository } = await import(/* @vite-ignore */ repositoryPath) as typeof import('../../src/lib/storage/notificationRepository');
    const original = notificationRepository.list;
    notificationRepository.list = async () => {
      notificationRepository.list = original;
      throw new Error('Temporary read failure');
    };
    const commandPath = '/src/lib/application/notificationCommands.ts';
    const { recordNotification } = await import(/* @vite-ignore */ commandPath) as typeof import('../../src/lib/application/notificationCommands');
    await recordNotification({ id: 'recovery', type: 'success', message: 'Recovered history' });
  });
  await expect(history.getByText('Could not load notification history.')).toBeVisible();
  await history.getByRole('button', { name: 'Try again' }).focus();
  await page.keyboard.press('Enter');
  await expect(history.getByText('Recovered history')).toBeVisible();
  await expect(history.getByRole('button', { name: 'Close notifications' })).toBeFocused();
});

test('does not duplicate a retained update error or restore it after clearing and reloading', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'electronAPI', { value: {
      getUpdateStatus: async () => ({ status: 'error', update: null, error: 'Check failed', revision: 2, availabilityEventId: 0, eventId: 'retained-failure' }),
      onUpdateStatus: () => () => {},
      setAutoCheck: async () => {},
      getAppVersion: async () => '1.8.0',
    } });
  });
  await page.reload();
  await page.getByRole('button', { name: 'Notifications, 1 unread' }).click();
  const history = page.getByRole('dialog', { name: 'Notifications', exact: true });
  await history.getByRole('button', { name: 'Mark all read' }).click();
  await expect(page.getByRole('button', { name: 'Notifications', exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Notifications', exact: true }).click();
  await expect(history.locator('li')).toHaveCount(1);
  await expect(history.getByText('Unread', { exact: true })).toHaveCount(0);
  await history.getByRole('button', { name: 'Clear history' }).click();
  await expect(history.getByText('No notifications yet.')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Notifications', exact: true }).click();
  await expect(history.getByText('No notifications yet.')).toBeVisible();
});

for (const status of ['available', 'downloaded'] as const) {
  test(`returns keyboard focus to the bell after viewing the ${status} update from history`, async ({ page }) => {
    const snapshot = updateSnapshot({ status, update: updateDetails({ status }) }, 1, 1, `update-${status}`);
    await page.addInitScript(snapshot => {
      Object.defineProperty(window, 'electronAPI', { value: {
        getUpdateStatus: async () => snapshot,
        onUpdateStatus: () => () => {},
        setAutoCheck: async () => {},
        getAppVersion: async () => '1.8.0',
        installUpdate: async () => {},
      } });
    }, snapshot);
    await page.reload();
    const bell = page.getByRole('button', { name: 'Notifications, 1 unread' });
    await bell.focus();
    await page.keyboard.press('Enter');
    const history = page.getByRole('dialog', { name: 'Notifications', exact: true });
    await history.getByRole('button', { name: 'View update' }).focus();
    await page.keyboard.press('Enter');
    const details = page.getByRole('dialog', {
      name: status === 'available' ? 'Update Available — v2.0.0' : 'Update Ready', exact: true,
    });
    await expect(details).toBeVisible();
    await expect.poll(() => details.evaluate(element => element.contains(document.activeElement))).toBe(true);
    await expect(history).toHaveCount(0);
    await details.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(details).toHaveCount(0);
    await expect(bell).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(history).toBeVisible();
  });
}

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
