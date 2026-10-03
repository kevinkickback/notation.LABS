import { expect, test } from '@playwright/test';

test('prevents repeated saves and keeps a new game editor open when an earlier save completes', async ({ page }) => {
  await page.route('**/src/lib/application/gameCommands.ts*', async route => {
    const response = await route.fetch();
    const code = await response.text();
    await route.fulfill({ response, body: `${code}\n
      const firstGameSave = createGame;
      const gameSaveGate = new Promise(resolve => { window.finishGameSave = resolve; });
      window.gameSaveProbe = { calls: 0 };
      createGame = async (...args) => {
        window.gameSaveProbe.calls++;
        await gameSaveGate;
        return firstGameSave(...args);
      };
    ` });
  });
  await page.goto('/');
  const openEditor = async () => page.getByRole('button', { name: /add your first game|add game/i }).first().click();
  await openEditor();
  const editor = page.getByRole('dialog', { name: 'Add New Game', exact: true });
  await editor.getByLabel('Game Name', { exact: true }).fill('First saved game');
  await editor.locator('form').evaluate(form => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await expect(editor.getByRole('button', { name: 'Add Game', exact: true })).toBeDisabled();
  await expect(editor.getByLabel('Game Name', { exact: true })).toBeDisabled();
  expect(await page.evaluate(() => (window as unknown as { gameSaveProbe: { calls: number } }).gameSaveProbe.calls)).toBe(1);
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(editor).toBeHidden();
  await openEditor();
  await expect(editor.getByLabel('Game Name', { exact: true })).toHaveValue('');
  await expect(editor.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
  await page.evaluate(() => (window as unknown as { finishGameSave: () => void }).finishGameSave());
  await expect(editor.getByLabel('Game Name', { exact: true })).toBeEnabled();
  await expect(editor).toBeVisible();
  await editor.getByLabel('Game Name', { exact: true }).fill('Second saved game');
  await editor.getByRole('button', { name: 'Add Game', exact: true }).click();
  await expect(editor).toBeHidden();
  await expect(page.getByRole('heading', { name: 'First saved game', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Second saved game', exact: true })).toBeVisible();
});

test('keeps a comma-containing tag intact when editing and reloading a combo', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Export data', exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const gamePath = '/src/lib/application/gameCommands.ts';
    const characterPath = '/src/lib/application/characterCommands.ts';
    const comboPath = '/src/lib/application/comboCommands.ts';
    const { createGame } = await import(/* @vite-ignore */ gamePath) as typeof import('../../src/lib/application/gameCommands');
    const { createCharacter } = await import(/* @vite-ignore */ characterPath) as typeof import('../../src/lib/application/characterCommands');
    const { createCombo } = await import(/* @vite-ignore */ comboPath) as typeof import('../../src/lib/application/comboCommands');
    const gameId = await createGame({ name: 'Tag game', buttonLayout: ['A'], notationProfile: 'standard' });
    const characterId = await createCharacter({ gameId, name: 'Tag fighter' });
    await createCombo({ characterId, name: 'Tag route', notation: 'A', tags: ['rock,paper', 'corner'] });
  });
  const navigate = async () => {
    await page.getByRole('heading', { name: 'Tag game', exact: true }).click();
    await page.getByRole('heading', { name: 'Tag fighter', exact: true }).click();
    await page.getByRole('button', { name: 'Edit combo', exact: true }).click();
  };
  await navigate();
  const editor = page.getByRole('dialog', { name: 'Edit Combo for Tag fighter', exact: true });
  await expect(editor.getByText('rock,paper', { exact: true })).toBeVisible();
  await editor.getByLabel('Combo Name', { exact: true }).fill('Updated tag route');
  await editor.getByRole('button', { name: 'Update Combo', exact: true }).click();
  await expect(editor).toBeHidden();
  await page.reload();
  await navigate();
  await expect(editor.getByLabel('Combo Name', { exact: true })).toHaveValue('Updated tag route');
  await expect(editor.getByText('rock,paper', { exact: true })).toBeVisible();
  await expect(editor.getByText('corner', { exact: true })).toBeVisible();
});
