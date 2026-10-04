import { expect, type Page, test } from '@playwright/test';

async function openSettings(page: Page) {
  const menu = page.getByRole('button', { name: 'Open menu', exact: true });
  if (await menu.isVisible()) {
    await menu.click();
    await page.getByRole('menuitem', { name: 'Settings', exact: true }).click();
  } else {
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
  }
}

test('keeps unsaved color guidance centered and visible, and clears it after reverting or saving', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await openSettings(page);
  const settings = page.getByRole('dialog', { name: 'Settings', exact: true });
  await settings.getByRole('tab', { name: 'Colors', exact: true }).click();
  const hint = settings.getByText('Use Apply Changes to save your color changes.', { exact: true });
  const separator = settings.getByRole('textbox', { name: 'Separator color hex', exact: true });
  await expect(hint).toHaveCount(0);
  await separator.fill('#123456');
  await separator.blur();
  await expect(hint).toBeVisible();
  await settings.getByRole('button', { name: 'Apply Changes', exact: true }).click();
  await expect(hint).toHaveCount(0);
  await settings.getByRole('button', { name: 'Done', exact: true }).click();
  await page.evaluate(async () => {
    const path = '/src/lib/application/gameCommands.ts';
    const { createGame } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/application/gameCommands');
    const buttonLayout = Array.from({ length: 20 }, (_, index) => `B${index}`);
    await createGame({ name: 'Many input options', notationProfile: 'standard', buttonLayout, buttonColors: Object.fromEntries(buttonLayout.map(button => [button, '#345678'])) });
  });
  for (const theme of ['light', 'dark'] as const) {
    for (const width of [1440, 320]) {
      await page.setViewportSize({ width, height: 500 });
      await page.evaluate(async theme => {
        const path = '/src/lib/storage/indexedDbStorage.ts';
        const { indexedDbStorage } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/storage/indexedDbStorage');
        await indexedDbStorage.settings.update({ colorTheme: theme });
      }, theme);
      await openSettings(page);
      await settings.getByRole('tab', { name: 'Colors', exact: true }).click();
      const buttonColor = settings.getByRole('textbox', { name: 'B0 button color hex', exact: true });
      await expect(buttonColor).toBeVisible();
      await expect(hint).toHaveCount(0);
      const original = await separator.inputValue();
      await separator.fill('#abcdef');
      await separator.blur();
      await expect(hint).toBeInViewport();
      await expect(settings.getByRole('button', { name: 'Apply Changes', exact: true })).not.toBeInViewport();
      const [hintBox, dialogBox] = await Promise.all([hint.boundingBox(), settings.boundingBox()]);
      expect((hintBox?.x ?? 0) + (hintBox?.width ?? 0) / 2).toBeCloseTo((dialogBox?.x ?? 0) + (dialogBox?.width ?? 0) / 2, 0);
      await separator.fill(original);
      await separator.blur();
      await expect(hint).toHaveCount(0);
      const savedButton = await buttonColor.inputValue();
      await buttonColor.fill('invalid');
      await buttonColor.blur();
      await expect(buttonColor).toHaveValue(savedButton);
      await expect(hint).toHaveCount(0);
      const nextButton = savedButton === '#fedcba' ? '#345678' : '#fedcba';
      await buttonColor.fill(nextButton);
      await buttonColor.blur();
      await expect(hint).toBeInViewport();
      expect(await page.evaluate(async () => {
        const path = '/src/lib/application/gameCommands.ts';
        const { getGames } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/application/gameCommands');
        return (await getGames())[0].buttonColors?.B0;
      })).toBe(savedButton);
      await settings.screenshot({ path: testInfo.outputPath(`color-reminder-${theme}-${width}.png`) });
      await settings.getByRole('button', { name: 'Apply Changes', exact: true }).click();
      await expect(hint).toHaveCount(0);
      await settings.getByRole('button', { name: 'Done', exact: true }).click();
      expect(await page.evaluate(async () => {
        const path = '/src/lib/application/gameCommands.ts';
        const { getGames } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/application/gameCommands');
        return (await getGames())[0].buttonColors?.B0;
      })).toBe(nextButton);
    }
  }
  await openSettings(page);
  await settings.getByRole('tab', { name: 'Colors', exact: true }).click();
  await separator.fill('#445566');
  await separator.blur();
  await expect(hint).toBeVisible();
  await settings.getByRole('tab', { name: 'Notation', exact: true }).click();
  await expect(hint).toHaveCount(0);
  await settings.getByRole('tab', { name: 'Colors', exact: true }).click();
  await expect(separator).toHaveValue('#123456');
  await expect(hint).toHaveCount(0);
});
