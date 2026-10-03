import { expect, test } from '@playwright/test';
import type { UpdateStatus } from '../../src/lib/updater/ipcContract';
import { updateDetails, updateSnapshot } from '../helpers/updater';

test('keeps newer update state through delayed replies and closing update details', async ({ page }) => {
  const available = updateSnapshot({ status: 'available', update: updateDetails() }, 2, 1);
  const checking = updateSnapshot({ status: 'checking', update: available.update }, 3, 1);
  const ready = updateSnapshot({ status: 'downloaded', update: updateDetails({ status: 'downloaded' }) }, 5, 1);
  await page.addInitScript(({ checking }) => {
    let listener: ((status: UpdateStatus) => void) | null = null;
    let resolveInitial: ((status: UpdateStatus) => void) | null = null;
    let resolveCheck: ((status: UpdateStatus) => void) | null = null;
    const send = (status: UpdateStatus) => listener?.(status);
    Object.assign(window, { updateProbe: {
      send,
      resolveInitial: (status: UpdateStatus) => resolveInitial?.(status),
      resolveCheck: (status: UpdateStatus) => resolveCheck?.(status),
    } });
    window.electronAPI = {
      platform: 'win32', versions: { electron: '1', chrome: '1', node: '1' },
      onUpdateStatus: callback => { listener = callback; return () => { listener = null; }; },
      getUpdateStatus: () => new Promise(resolve => { resolveInitial = resolve; }),
      checkForUpdate: () => {
        send(checking);
        return new Promise(resolve => { resolveCheck = status => resolve({ success: true, data: status, error: null }); });
      },
      downloadUpdate: async () => ({ success: true, data: null, error: null }),
      cancelUpdate: async () => ({ success: true, data: null, error: null }),
      installUpdate: async () => undefined,
      setAutoCheck: async () => undefined,
      getAppVersion: async () => '1.8.0',
      getCurrentChangelog: async () => ({ version: '1.8.0', changelog: null }),
      saveFile: async () => ({ success: false }),
      beginBackup: async () => null,
      writeBackupChunk: async () => undefined,
      finishBackup: async () => undefined,
      abortBackup: async () => undefined,
    };
  }, { checking });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeVisible();
  const probe = async (action: 'send' | 'resolveInitial' | 'resolveCheck', status: UpdateStatus) => page.evaluate(({ action, status }) => {
    const updateProbe = (window as unknown as { updateProbe: Record<string, (status: UpdateStatus) => void> }).updateProbe;
    updateProbe[action](status);
  }, { action, status });
  await probe('send', available);
  await probe('resolveInitial', updateSnapshot({ status: 'not-available', update: null }, 1));
  await expect(page.getByRole('button', { name: 'Update v2.0.0 available', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Settings', exact: true });
  await settings.getByRole('button', { name: 'Check Now', exact: true }).click();
  await probe('send', ready);
  await probe('resolveCheck', available);
  await expect(page.getByText('Up to date', { exact: true })).toHaveCount(0);
  await settings.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Update ready to install', exact: true }).click();
  const progress = page.getByRole('dialog', { name: 'Update Ready', exact: true });
  await expect(progress).toBeVisible();
  await progress.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Update ready to install', exact: true })).toBeVisible();
});
