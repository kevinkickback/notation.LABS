import { expect, test, type Locator } from '@playwright/test';

async function contrastRatio(control: Locator) {
  return control.evaluate(element => {
    const style = getComputedStyle(element);
    const parse = (color: string) => color.match(/^rgb\(([\d.]+), ([\d.]+), ([\d.]+)\)$/)?.slice(1).map(Number);
    const foreground = parse(style.color);
    const background = parse(style.backgroundColor);
    if (!foreground || !background) return 0;
    const luminance = (rgb: number[]) => {
      const linear = rgb.map(channel => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    };
    const a = luminance(foreground), b = luminance(background);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
}

for (const theme of ['Light', 'Dark'] as const) {
  test(`keeps custom accent labels readable in ${theme.toLowerCase()} mode, including hovered controls`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const opener = page.getByRole('button', { name: 'Settings', exact: true });
    await opener.click();
    const settings = page.getByRole('dialog', { name: 'Settings', exact: true });
    await settings.getByRole('combobox').first().click();
    await page.getByRole('option', { name: theme, exact: true }).click();
    const primary = page.getByRole('button', { name: /add your first game/i });
    for (const color of ['#3b82f6', '#e14c9b', '#ffffff', '#000000', '#777777', '#123456', '#fff', 'white', 'rgb(0 0 0)', 'rgba(255, 255, 255, 0.2)', 'oklch(0.8 0.1 80)', 'transparent']) {
      await settings.getByLabel('Accent color hex', { exact: true }).fill(color);
      const done = settings.getByRole('button', { name: 'Done', exact: true });
      await done.hover();
      await expect.poll(() => contrastRatio(done), { message: `Outline button for ${color}` }).toBeGreaterThanOrEqual(4.5);
      await done.click();
      await page.mouse.move(0, 0);
      await expect.poll(() => contrastRatio(primary), { message: `Primary button for ${color}` }).toBeGreaterThanOrEqual(4.5);
      await primary.hover();
      await expect.poll(() => contrastRatio(primary), { message: `Hovered primary button for ${color}` }).toBeGreaterThanOrEqual(4.5);
      await opener.hover();
      await expect.poll(() => contrastRatio(opener), { message: `Ghost button for ${color}` }).toBeGreaterThanOrEqual(4.5);
      await opener.click();
    }
  });
}

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
