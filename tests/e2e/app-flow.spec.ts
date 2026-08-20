import { expect, test, type Page } from '@playwright/test';

async function addGame(
  page: Page,
  name: string,
  notationProfile?: 'NRS' | 'Tekken',
): Promise<void> {
  await page
    .getByRole('button', { name: /add your first game|add game/i })
    .first()
    .click();

  await expect(page.getByText('Add New Game')).toBeVisible();
  await page.getByLabel(/game name/i).fill(name);
  if (notationProfile) {
    await page.getByRole('button', { name: notationProfile }).click();
  }
  await page.getByRole('button', { name: /^add game$/i }).click();

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
): Promise<void> {
  await page.getByRole('button', { name: /add combo/i }).click();

  await expect(page.getByText(/add combo for/i)).toBeVisible();
  await page.getByLabel(/combo name/i).fill(name);
  await page
    .getByRole('textbox', { name: 'Notation', exact: true })
    .fill(notation);
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

    await addCombo(page, 'BnB Starter', '5L > 5M > 236H');
    await addCombo(page, 'Anti Air Route', '2H > 623M');

    await page.getByTitle('Filter Combos').click();
    await page.getByPlaceholder('Search combos...').fill('Anti Air');

    await expect(
      page.locator('h3', { hasText: 'Anti Air Route' }).first(),
    ).toBeVisible();
    await expect(page.locator('h3', { hasText: 'BnB Starter' })).toHaveCount(0);
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
