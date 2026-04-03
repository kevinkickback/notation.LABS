import { expect, test, type Page } from '@playwright/test';

async function addGame(page: Page, name: string): Promise<void> {
	await page
		.getByRole('button', { name: /add your first game|add game/i })
		.first()
		.click();

	await expect(page.getByText('Add New Game')).toBeVisible();
	await page.getByLabel(/game name/i).fill(name);
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
	await page.getByLabel(/^notation/i).fill(notation);
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

	test('marks selected combos as outdated', async ({ page }) => {
		await navigateToComboView(page);
		await addCombo(page, 'Patch Check Combo', '5L > 5H > 214H');

		await page.getByTitle('Multi-select combos').click();
		await page.getByRole('button', { name: /^select all$/i }).click();
		await page.getByRole('button', { name: /^mark outdated \(1\)$/i }).click();

		await expect(page.getByText('Outdated')).toBeVisible();
	});

	test('deletes selected combos through confirmation dialog', async ({
		page,
	}) => {
		await navigateToComboView(page);
		await addCombo(page, 'To Delete', '5L > 236L');

		await page.getByTitle('Multi-select combos').click();
		await page.getByRole('button', { name: /^select all$/i }).click();
		await page.getByRole('button', { name: /^delete \(1\)$/i }).click();

		await expect(page.getByText('Delete 1 combo?')).toBeVisible();
		await page
			.getByRole('button', { name: /^delete \(1\)$/i })
			.last()
			.click();

		await expect(page.getByText(/no combos yet/i)).toBeVisible();
	});
});
