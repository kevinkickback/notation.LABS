import { expect, test } from '@playwright/test';

test('does not flash empty states when game and character reads are delayed', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Export data', exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const path = '/src/lib/storage/indexedDbStorage.ts';
    const { indexedDbStorage } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/storage/indexedDbStorage');
    const gameId = await indexedDbStorage.games.add({ name: 'Navigation fixture', buttonLayout: ['A'] });
    const characterId = await indexedDbStorage.characters.add({ gameId, name: 'Navigation character' });
    await indexedDbStorage.combos.add({ characterId, name: 'Navigation combo', notation: 'A', parsedNotation: [], tags: [] });
    const readCharacters = indexedDbStorage.characters.getByGame;
    const readCombos = indexedDbStorage.combos.getByCharacter;
    indexedDbStorage.characters.getByGame = id => readCharacters(id).then(async rows => { await new Promise(resolve => setTimeout(resolve, 750)); return rows; });
    indexedDbStorage.combos.getByCharacter = id => readCombos(id).then(async rows => { await new Promise(resolve => setTimeout(resolve, 750)); return rows; });
  });
  await expect(page.locator('h3', { hasText: 'Navigation fixture' })).toBeVisible();
  await page.evaluate(() => {
    const emptyFlashes: string[] = [];
    Object.assign(window, { emptyFlashes });
    const observer = new MutationObserver(() => {
      const text = document.querySelector('main')?.textContent ?? '';
      if (/No Games Yet|No characters added yet|No combos match/.test(text)) emptyFlashes.push(text);
    });
    observer.observe(document.querySelector('.app-workspace')!, { childList: true, subtree: true });
  });
  await page.locator('h3', { hasText: 'Navigation fixture' }).click();
  await expect(page.locator('main')).toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('h3', { hasText: 'Navigation fixture' })).toBeVisible();
  await expect(page.getByRole('navigation')).toHaveCount(0);
  await expect(page.locator('h3', { hasText: 'Navigation character' })).toBeVisible();
  await page.locator('h3', { hasText: 'Navigation character' }).click();
  await expect(page.locator('main')).toHaveAttribute('inert', '');
  await expect(page.locator('h3', { hasText: 'Navigation character' })).toBeVisible();
  await expect(page.locator('h3', { hasText: 'Navigation combo' })).toBeVisible();
  await expect(page.locator('main')).toHaveAttribute('aria-busy', 'false');
  expect(await page.evaluate(() => (window as unknown as { emptyFlashes: string[] }).emptyFlashes)).toEqual([]);
});
