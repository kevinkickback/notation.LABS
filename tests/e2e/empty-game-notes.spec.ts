import { expect, test } from '@playwright/test';

test('centers empty-game Notes beside Add Character and keeps notes usable after adding a character', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Add Your First Game', exact: true }).click();
  const gameEditor = page.getByRole('dialog', { name: 'Add New Game', exact: true });
  await gameEditor.getByLabel('Game Name', { exact: true }).fill('Empty Game Notes');
  await gameEditor.getByRole('button', { name: 'Add Game', exact: true }).click();
  await expect(gameEditor).toBeHidden();
  await page.getByRole('heading', { name: 'Empty Game Notes', exact: true }).click();
  await expect(page.getByText('No characters added yet.', { exact: false })).toBeVisible();

  const notes = page.getByRole('button', { name: 'Notes', exact: true });
  const addCharacter = page.getByRole('button', { name: 'Add Character', exact: true });
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 800, height: 600 },
    { width: 375, height: 700 },
    { width: 320, height: 480 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(notes).toHaveCount(1);
    await expect(notes).toBeVisible();
    await notes.scrollIntoViewIfNeeded();
    await expect(notes).toBeInViewport();
    await expect(addCharacter).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath(`empty-game-${viewport.width}.png`) });
    await expect.poll(async () => {
      const noteBox = await notes.boundingBox();
      const addBox = await addCharacter.boundingBox();
      if (!noteBox || !addBox) throw new Error('Missing empty-game action');
      return Math.abs(noteBox.y + noteBox.height / 2 - addBox.y - addBox.height / 2);
    }).toBeLessThanOrEqual(1);
    const noteBox = await notes.boundingBox();
    const addBox = await addCharacter.boundingBox();
    const titleBox = await page.getByRole('heading', { name: 'Empty Game Notes', exact: true }).boundingBox();
    if (!noteBox || !addBox || !titleBox) throw new Error('Missing empty-game content');
    expect(noteBox.x + noteBox.width).toBeLessThan(addBox.x);
    expect((noteBox.x + addBox.x + addBox.width) / 2).toBeCloseTo(titleBox.x + titleBox.width / 2, 0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  }

  await page.setViewportSize({ width: 800, height: 600 });
  await notes.click();
  const notebook = page.getByRole('dialog', { name: 'Empty Game Notes Notebook', exact: true });
  await notebook.getByRole('button', { name: 'Add note', exact: true }).click();
  await notebook.getByRole('textbox', { name: 'Note', exact: true }).fill('Practice before adding characters');
  await notebook.getByRole('button', { name: 'Save Note', exact: true }).click();
  await expect(notebook.getByText('Practice before adding characters', { exact: true })).toBeVisible();
  await notebook.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(notes).toBeFocused();
  await expect.poll(() => page.evaluate(async () => {
    const path = '/src/lib/storage/indexedDbStorage.ts';
    const { indexedDbStorage } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/storage/indexedDbStorage');
    const game = (await indexedDbStorage.games.getAll()).find(game => game.name === 'Empty Game Notes');
    if (!game) throw new Error('Missing game');
    return (await indexedDbStorage.settings.get()).notebookOpenPages?.includes(game.id) ?? false;
  })).toBe(false);

  await page.reload();
  await page.getByRole('heading', { name: 'Empty Game Notes', exact: true }).click();
  await notes.click();
  await expect(notebook.getByText('Practice before adding characters', { exact: true })).toBeVisible();
  await notebook.getByRole('button', { name: 'Close', exact: true }).click();
  await addCharacter.click();
  const characterEditor = page.getByRole('dialog', { name: 'Add Character to Empty Game Notes', exact: true });
  await characterEditor.getByLabel('Character Name', { exact: true }).fill('First Character');
  await characterEditor.getByRole('button', { name: 'Add Character', exact: true }).click();
  await expect(characterEditor).toBeHidden();
  await expect(page.getByRole('heading', { name: 'First Character', exact: true })).toBeVisible();
  await expect(notes).toHaveCount(1);
  await notes.click();
  await expect(notebook.getByText('Practice before adding characters', { exact: true })).toBeVisible();
});
