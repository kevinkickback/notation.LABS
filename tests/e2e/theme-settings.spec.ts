import { expect, test } from '@playwright/test';

test('applies theme and accent choices to the workspace and notifications immediately and after reload', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Export data', exact: true })).toBeVisible();
  const notifications = page.locator('[data-sonner-toaster]');
  const addGame = async (name: string) => {
    await page.getByRole('button', { name: /add your first game|^Add Game$/i }).click();
    const editor = page.getByRole('dialog', { name: 'Add New Game', exact: true });
    await editor.getByLabel('Game Name', { exact: true }).fill(name);
    await editor.getByRole('button', { name: 'Add Game', exact: true }).click();
    const notice = notifications.locator('[data-sonner-toast]').filter({ hasText: 'Game added' });
    await expect(notice).toBeVisible();
    return notice;
  };
  const changeTheme = async (theme: 'Light' | 'Dark') => {
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const settings = page.getByRole('dialog', { name: 'Settings', exact: true });
    await settings.getByRole('combobox').first().click();
    await page.getByRole('option', { name: theme, exact: true }).click();
    return settings;
  };
  const originalNotice = await addGame('Theme game');
  await expect(notifications).toHaveAttribute('data-sonner-theme', 'dark');
  const originalBackground = await originalNotice.evaluate(element => getComputedStyle(element).backgroundColor);
  const lightSettings = await changeTheme('Light');
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await expect(notifications).toHaveAttribute('data-sonner-theme', 'light');
  await expect.poll(() => originalNotice.evaluate(element => getComputedStyle(element).backgroundColor)).not.toBe(originalBackground);
  await lightSettings.getByLabel('Accent color hex', { exact: true }).fill('#e14c9b');
  await lightSettings.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add Game', exact: true })).toHaveCSS('background-color', 'rgb(225, 76, 155)');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Theme game', exact: true })).toBeVisible();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await expect(page.getByRole('button', { name: 'Add Game', exact: true })).toHaveCSS('background-color', 'rgb(225, 76, 155)');
  const notice = await addGame('Reloaded theme');
  await expect(notifications).toHaveAttribute('data-sonner-theme', 'light');
  const lightBackground = await notice.evaluate(element => getComputedStyle(element).backgroundColor);

  const darkSettings = await changeTheme('Dark');
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(notifications).toHaveAttribute('data-sonner-theme', 'dark');
  await expect(notice).toBeVisible();
  await expect.poll(() => notice.evaluate(element => getComputedStyle(element).backgroundColor)).not.toBe(lightBackground);
  await darkSettings.getByRole('button', { name: 'Done', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Theme game', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.getByRole('button', { name: 'Add Game', exact: true })).toHaveCSS('background-color', 'rgb(225, 76, 155)');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const saved = page.getByRole('dialog', { name: 'Settings', exact: true });
  await expect(saved.getByLabel('Accent color hex', { exact: true })).toHaveValue('#e14c9b');
  await expect(saved.getByRole('combobox').first()).toHaveText('Dark');
});
