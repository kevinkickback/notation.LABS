import { expect, test, type Locator } from '@playwright/test';

test('preserves both nested repeat groups in text and icon views after reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Export data', exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const gamePath = '/src/lib/application/gameCommands.ts';
    const characterPath = '/src/lib/application/characterCommands.ts';
    const comboPath = '/src/lib/application/comboCommands.ts';
    const { createGame } = await import(/* @vite-ignore */ gamePath) as typeof import('../../src/lib/application/gameCommands');
    const { createCharacter } = await import(/* @vite-ignore */ characterPath) as typeof import('../../src/lib/application/characterCommands');
    const { createCombo } = await import(/* @vite-ignore */ comboPath) as typeof import('../../src/lib/application/comboCommands');
    const gameId = await createGame({ name: 'Repeat game', buttonLayout: ['L', 'M', 'H'], notationProfile: 'standard' });
    const characterId = await createCharacter({ gameId, name: 'Repeat fighter' });
    await createCombo({ characterId, name: 'Nested route', notation: '((2L > 5M)x2 > 5H)x3', tags: [] });
  });
  const navigate = async () => {
    await page.getByRole('heading', { name: 'Repeat game', exact: true }).click();
    await page.getByRole('heading', { name: 'Repeat fighter', exact: true }).click();
  };
  const checkRepeats = async (card: Locator) => {
    await expect(card.getByText('(', { exact: true })).toHaveCount(2);
    await expect(card.getByText(')', { exact: true })).toHaveCount(2);
    expect(await card.locator('sup').evaluateAll(labels => labels.map(label => label.parentElement?.textContent))).toEqual([')×2', ')×3']);
  };
  await navigate();
  const card = page.locator('.combo-card').filter({ has: page.getByRole('heading', { name: 'Nested route', exact: true }) });
  await checkRepeats(card);
  await page.getByTitle('Icons', { exact: true }).click();
  await expect(page.getByRole('img', { name: 'Button L', exact: true }).first()).toBeVisible();
  await checkRepeats(card);
  await page.reload();
  await navigate();
  await checkRepeats(card);
  await page.getByTitle('Text', { exact: true }).click();
  await checkRepeats(card);
});
