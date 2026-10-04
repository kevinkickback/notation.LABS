import { expect, test, type Page } from '@playwright/test';
import { textContrast } from '../helpers/contrast';

async function addGame(
  page: Page,
  name: string,
  notationProfile?: 'NRS' | 'Tekken',
): Promise<void> {
  await page
    .getByRole('button', { name: /add your first game|add game/i })
    .first()
    .click();

  const editor = page.getByRole('dialog', { name: 'Add New Game', exact: true });
  await expect(editor).toBeVisible();
  await editor.getByLabel(/game name/i).fill(name);
  if (notationProfile) {
    await editor.getByRole('button', { name: notationProfile }).click();
  }
  await editor.getByRole('button', { name: /^add game$/i }).click();
  await expect(editor).toBeHidden();

  await expect(page.locator('h3', { hasText: name }).first()).toBeVisible();
}

async function addCharacter(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: /add character/i }).click();

  await expect(page.getByText(/add character to/i)).toBeVisible();
  await page.getByLabel(/character name/i).fill(name);
  await page.getByRole('button', { name: /^add character$/i }).click();

  await expect(page.locator('h3', { hasText: name }).first()).toBeVisible();
}

async function addCombo(
  page: Page,
  name: string,
  notation: string,
  tags: string[] = [],
): Promise<void> {
  await page.getByRole('button', { name: /add combo/i }).click();

  await expect(page.getByText(/add combo for/i)).toBeVisible();
  await page.getByLabel(/combo name/i).fill(name);
  await page
    .getByRole('textbox', { name: 'Notation', exact: true })
    .fill(notation);
  for (const tag of tags) {
    const input = page.getByLabel('Tags', { exact: true });
    await input.fill(tag);
    await input.press('Enter');
  }
  await page.getByRole('button', { name: /^add combo$/i }).click();

  await expect(page.locator('h3', { hasText: name }).first()).toBeVisible();
}

async function navigateToComboView(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /notation/i })).toBeVisible();

  await addGame(page, 'E2E Fighter Game');
  await page.locator('h3', { hasText: 'E2E Fighter Game' }).first().click();

  await addCharacter(page, 'E2E Hero');
  await page.locator('h3', { hasText: 'E2E Hero' }).first().click();

  await expect(page.getByRole('button', { name: /add combo/i })).toBeVisible();
}

test.describe('Core E2E Flows', () => {
  test('keeps the game form usable at the minimum desktop window size', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 800, height: 600 });
    await page.goto('/');
    await page
      .getByRole('button', { name: /add your first game|add game/i })
      .first()
      .click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('button', { name: /^add game$/i })).toBeVisible();

    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.y ?? -1).toBeGreaterThanOrEqual(0);
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(600);
  });

  test('creates game, character, and combo then filters combos', async ({
    page,
  }) => {
    await navigateToComboView(page);

    await addCombo(page, 'BnB Starter', '5L > 5M > 236H', ['BnB', 'bnb']);
    await addCombo(page, 'Anti Air Route', '2H > 623M', ['bNB']);

    await page.getByTitle('Filter Combos').click();
    await page.getByPlaceholder('Search combos...').fill('Anti Air');

    await expect(
      page.locator('h3', { hasText: 'Anti Air Route' }).first(),
    ).toBeVisible();
    await expect(page.locator('h3', { hasText: 'BnB Starter' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Clear', exact: true }).click();

    // Older libraries and imports can contain different spellings and duplicates.
    const savedTags = await page.evaluate(async () => {
      const path = '/src/lib/storage/indexedDbStorage.ts';
      const { indexedDbStorage } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/storage/indexedDbStorage');
      const combos = await indexedDbStorage.combos.getAll();
      const first = combos.find(combo => combo.name === 'BnB Starter');
      const second = combos.find(combo => combo.name === 'Anti Air Route');
      if (!first || !second) throw new Error('Missing saved tag fixtures');
      await indexedDbStorage.combos.update(second.id, { tags: ['BNB', 'bnb'] });
      return [first.tags, second.tags];
    });
    expect(savedTags).toEqual([['BnB'], ['BnB']]);
    await page.reload();
    await page.locator('h3', { hasText: 'E2E Fighter Game' }).click();
    await page.locator('h3', { hasText: 'E2E Hero' }).click();
    const legacy = page.getByRole('article', { name: 'Anti Air Route', exact: true });
    await expect(legacy.getByRole('button', { name: /^Filter by/ })).toHaveCount(1);
    const originalTag = page.getByRole('article', { name: 'BnB Starter', exact: true }).getByRole('button', { name: 'Filter by BnB', exact: true });
    const originalColor = await originalTag.evaluate(element => getComputedStyle(element).color);
    expect(await legacy.getByRole('button', { name: 'Filter by BNB', exact: true }).evaluate(element => getComputedStyle(element).color)).toBe(originalColor);
    await legacy.getByRole('button', { name: 'Filter by BNB', exact: true }).click();
    const tagFilter = page.getByRole('button', { name: '#BnB', exact: true });
    await expect(tagFilter).toHaveAttribute('aria-pressed', 'true');
    expect(await tagFilter.evaluate(element => getComputedStyle(element).color)).toBe(originalColor);
    await expect(page.getByRole('button', { name: '#BNB', exact: true })).toHaveCount(0);
    await expect(page.getByText('2 of 2 combos', { exact: true })).toBeVisible();
    await tagFilter.press('Space');
    await expect(tagFilter).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('article')).toHaveCount(2);
  });

  test('keeps tag colors distinct and readable across cards, filters, and editing in both themes', async ({ page }) => {
    await navigateToComboView(page);
    const tags = Array.from({ length: 8 }, (_, index) => `tag-${index}`);
    await addCombo(page, 'Colored tags', '5L > 236H', tags);
    const card = page.getByRole('article', { name: 'Colored tags', exact: true });
    await page.getByTitle('Filter Combos').click();
    for (const colorTheme of ['light', 'dark'] as const) {
      await page.evaluate(async colorTheme => {
        const path = '/src/lib/storage/indexedDbStorage.ts';
        const { indexedDbStorage } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/storage/indexedDbStorage');
        await indexedDbStorage.settings.update({ colorTheme });
      }, colorTheme);
      await expect(page.locator('html')).toHaveClass(colorTheme === 'dark' ? /dark/ : /^$/);
      const colors: string[] = [];
      for (const tag of tags) {
        const chip = card.getByRole('button', { name: `Filter by ${tag}`, exact: true });
        const filter = page.getByRole('button', { name: `#${tag}`, exact: true });
        await chip.hover();
        await expect.poll(() => textContrast(chip), { message: `${colorTheme} card tag ${tag}` }).toBeGreaterThanOrEqual(4.5);
        const color = await chip.evaluate(element => getComputedStyle(element).color);
        colors.push(color);
        expect(await filter.evaluate(element => getComputedStyle(element).color)).toBe(color);
        await expect.poll(() => textContrast(filter), { message: `${colorTheme} inactive filter ${tag}` }).toBeGreaterThanOrEqual(4.5);
        await filter.click();
        await expect(filter).toHaveAttribute('aria-pressed', 'true');
        await expect.poll(() => textContrast(filter), { message: `${colorTheme} selected filter ${tag}` }).toBeGreaterThanOrEqual(4.5);
        await filter.press('Space');
        await expect(filter).toHaveAttribute('aria-pressed', 'false');
        await filter.press('Space');
        await expect(filter).toHaveAttribute('aria-pressed', 'true');
        const focus = await filter.evaluate(element => ({ style: getComputedStyle(element).outlineStyle, width: Number.parseFloat(getComputedStyle(element).outlineWidth) }));
        expect(focus.style).not.toBe('none');
        expect(focus.width).toBeGreaterThan(0);
        await filter.press('Space');
      }
      expect(new Set(colors).size).toBe(tags.length);
      await card.getByRole('button', { name: 'Edit combo', exact: true }).click();
      const editor = page.getByRole('dialog', { name: 'Edit Combo for E2E Hero', exact: true });
      for (const [index, tag] of tags.entries()) {
        const chip = editor.getByRole('button', { name: `Remove tag: ${tag}`, exact: true });
        expect(await chip.evaluate(element => getComputedStyle(element).color)).toBe(colors[index]);
        await expect.poll(() => textContrast(chip), { message: `${colorTheme} editor tag ${tag}` }).toBeGreaterThanOrEqual(4.5);
      }
      await editor.getByRole('button', { name: 'Close', exact: true }).click();
    }
  });

  test('persists favorite games and keeps them first', async ({
    page,
  }) => {
    await page.goto('/');
    await addGame(page, 'Alpha Fighter');
    await addGame(page, 'Zulu Fighter');

    const gameNames = page.locator('h3');
    await expect(gameNames).toHaveText(['Alpha Fighter', 'Zulu Fighter']);

    await page.locator('h3', { hasText: 'Zulu Fighter' }).first().hover();
    await page
      .getByRole('button', { name: 'Add to favorites: Zulu Fighter' })
      .click();
    await expect(gameNames).toHaveText(['Zulu Fighter', 'Alpha Fighter']);

    await page.reload();
    await expect(
      page.getByRole('button', { name: 'Remove from favorites: Zulu Fighter' }),
    ).toBeVisible();
    await expect(gameNames).toHaveText(['Zulu Fighter', 'Alpha Fighter']);

  });

  test('marks selected combos as outdated', async ({ page }) => {
    await navigateToComboView(page);
    await addCombo(page, 'Patch Check Combo', '5L > 5H > 214H');

    await page.getByRole('button', { name: 'More options' }).click();
    await page.getByRole('menuitem', { name: 'Select Combos' }).click();
    await page.getByRole('button', { name: /^select all$/i }).click();
    await page.getByRole('button', { name: 'Mark Outdated' }).click();

    const comboMetadata = page
      .locator('h3', { hasText: 'Patch Check Combo' })
      .locator('..');
    await expect(comboMetadata.getByText('Outdated', { exact: true })).toBeVisible();
  });

  test('deletes selected combos through confirmation dialog', async ({
    page,
  }) => {
    await navigateToComboView(page);
    await addCombo(page, 'To Delete', '5L > 236L');

    await page.getByRole('button', { name: 'More options' }).click();
    await page.getByRole('menuitem', { name: 'Select Combos' }).click();
    await page.getByRole('button', { name: /^select all$/i }).click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();

    await expect(page.getByText('Delete 1 combo?')).toBeVisible();
    await page
      .getByRole('button', { name: /^delete \(1\)$/i })
      .last()
      .click();

    await expect(page.getByText(/no combos yet/i)).toBeVisible();
  });

  for (const profileCase of [
    {
      profile: 'NRS' as const,
      game: 'E2E Injustice Game',
      combo: 'Injustice Route',
      notation: 'B3 > JI2 > 123 xx BF2 MB',
      expectedIcons: [
        'Button 3, Attack 3',
        'JI, Jump-in attack',
        'Button 1, Attack 1',
        'Back',
        'Forward',
        'MB, Meter Burn',
      ],
    },
    {
      profile: 'Tekken' as const,
      game: 'E2E Tekken Game',
      combo: 'Tekken Route',
      notation: 'f,N,D/F+2',
      expectedIcons: [
        'Tap Forward',
        'Neutral',
        'Hold Down Forward',
        'Button 2, Right Punch',
      ],
    },
  ]) {
    test(`saves and reloads ${profileCase.profile} notation and icons`, async ({
      page,
    }) => {
      await page.goto('/');
      await addGame(page, profileCase.game, profileCase.profile);
      await page.locator('h3', { hasText: profileCase.game }).first().click();
      await addCharacter(page, 'E2E Fighter');
      await page.locator('h3', { hasText: 'E2E Fighter' }).first().click();
      await addCombo(page, profileCase.combo, profileCase.notation);
      await page.getByTitle('Icons').click();

      for (const label of profileCase.expectedIcons) {
        await expect(page.getByRole('img', { name: label }).first()).toBeVisible();
      }

      // Icons render optimistically; reload only after the preference is saved.
      await expect.poll(() => page.evaluate(async () => {
        const path = '/src/lib/storage/indexedDbStorage.ts';
        const { indexedDbStorage } = await import(/* @vite-ignore */ path) as typeof import('../../src/lib/storage/indexedDbStorage');
        return (await indexedDbStorage.settings.get()).displayMode;
      })).toBe('visual-icons');
      await page.reload();
      await page.locator('h3', { hasText: profileCase.game }).first().click();
      await page.locator('h3', { hasText: 'E2E Fighter' }).first().click();
      await expect(
        page.locator('h3', { hasText: profileCase.combo }).first(),
      ).toBeVisible();
      for (const label of profileCase.expectedIcons) {
        await expect(page.getByRole('img', { name: label }).first()).toBeVisible();
      }
    });
  }
});
