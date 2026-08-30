import { expect, test } from '@playwright/test';

const emptyUsage = {
	position: null,
	topMove: null,
	topMovePct: null,
	topItem: null,
	topItemPct: null,
	topAbility: null,
	topAbilityPct: null,
	topNature: null,
	topNaturePct: null,
	topTeammate: null,
	topTeammatePct: null,
	topSpread: null,
	megaStoneUsage: null,
	megaStoneRank: null
};

const mawile = {
	name: 'Mawile',
	battleName: 'Mawile',
	showdownId: 'mawile',
	speciesNumber: 303,
	sprite: 'https://championsbattledata.com/pokemon_champions_assets/pokemon/Mawile.png',
	types: ['Steel', 'Fairy'],
	abilities: ['Intimidate'],
	stats: { hp: 125, attack: 105, defense: 125, spAttack: 75, spDefense: 95, speed: 70 },
	forms: [],
	megaForms: [
		{
			name: 'Mega Mawile',
			savedName: 'Mega Mawile',
			kind: 'Mega',
			types: ['Steel', 'Fairy'],
			abilities: ['Huge Power'],
			stats: { hp: 125, attack: 155, defense: 165, spAttack: 95, spDefense: 135, speed: 70 },
			sprite: ''
		}
	],
	legalMoves: ['Play Rough', 'Sucker Punch', 'Protect', 'Iron Head'],
	usage: {
		...emptyUsage,
		position: 37,
		topMove: 'Play Rough',
		topMovePct: 97.6,
		topItem: 'Mawilite',
		topItemPct: 99.1,
		megaStoneUsage: 99.1,
		megaStoneRank: 1
	}
};

const garchomp = {
	name: 'Garchomp',
	battleName: 'Garchomp',
	showdownId: 'garchomp',
	speciesNumber: 445,
	sprite: 'https://championsbattledata.com/pokemon_champions_assets/pokemon/Garchomp.png',
	types: ['Dragon', 'Ground'],
	abilities: ['Rough Skin'],
	stats: { hp: 183, attack: 150, defense: 115, spAttack: 90, spDefense: 105, speed: 134 },
	forms: [],
	megaForms: [],
	legalMoves: ['Earthquake', 'Dragon Claw', 'Protect', 'Rock Slide'],
	usage: { ...emptyUsage, position: 1, topMove: 'Earthquake', topItem: 'Life Orb' }
};

function rosterFixture(pokemon: unknown[]) {
	return {
		pokemon,
		items: ['Mawilite', 'Life Orb'],
		natures: ['Adamant', 'Brave'],
		generatedAt: '2026-08-29T00:50:01.077Z',
		dataVersion: 'test',
		stale: false
	};
}

test.beforeEach(async ({ page }) => {
	await page.route('**/api/pokemon?format=*', (route) =>
		route.fulfill({ json: rosterFixture([mawile]) })
	);
	await page.route('**/api/pokemon/mawile/usage?*', (route) =>
		route.fulfill({
			json: {
				pokemon: 'Mawile',
				showdownId: 'mawile',
				format: 'Doubles',
				generatedAt: '2026-08-29T00:50:01.077Z',
				stale: false,
				current: [{ category: 'move', rank: 1, name: 'Play Rough', percentage: 97.6 }],
				daily: []
			}
		})
	);
});

test('explores the current field and opens a Pokémon detail page', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'Explore the doubles field.' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Mawile' })).toBeVisible();

	await page.getByRole('link', { name: 'Mawile' }).click();
	await expect(page).toHaveURL(/\/pokemon\/mawile/);
	await expect(page.getByRole('heading', { name: 'Mawile', exact: true })).toBeVisible();
	await expect(page.getByText("This Pokemon's Attack is doubled.")).toBeVisible();

	const statsPanel = page.locator('.stat-panel');
	await statsPanel.getByRole('button', { name: 'Mega Mawile' }).click();
	await expect(statsPanel.getByRole('heading', { name: 'Mega Mawile stats' })).toBeVisible();
	await expect(statsPanel.getByText('+50')).toBeVisible();

	await page.getByRole('link', { name: 'Back to the field' }).click();
	await expect(page).toHaveURL(/^[^?]*\/(\?.*)?$/);
});

test('returns to the field on Escape, mirroring the old drawer close', async ({ page }) => {
	await page.goto('/pokemon/mawile');
	await expect(page.getByRole('heading', { name: 'Mawile', exact: true })).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page).toHaveURL(/^[^?]*\/(\?.*)?$/);
});

test('shows the Mega Stone as ranked-but-not-top rather than blank when it is not the top item', async ({
	page
}) => {
	await page.route('**/api/pokemon?format=*', (route) =>
		route.fulfill({
			json: rosterFixture([
				{
					...mawile,
					usage: { ...mawile.usage, megaStoneUsage: null, megaStoneRank: 2, topItem: 'Life Orb' }
				}
			])
		})
	);
	await page.goto('/');
	await expect(page.getByRole('cell', { name: 'Ranked #2' })).toBeVisible();
});

test('switches battle formats and carries the format across navigation', async ({ page }) => {
	await page.goto('/');
	await page.getByLabel('Format').selectOption('Singles');
	await expect(page).toHaveURL(/format=Singles/);
	await expect(page.getByRole('heading', { name: 'Explore the singles field.' })).toBeVisible();

	await page.getByRole('link', { name: 'Mawile' }).click();
	await expect(page).toHaveURL(/format=Singles/);
	await expect(page.getByText('Singles · Usage position #37')).toBeVisible();
});

test('browses moves and follows a learner to its detail page', async ({ page }) => {
	await page.goto('/moves');
	await expect(page.getByRole('heading', { name: 'Find who can learn a move.' })).toBeVisible();
	await expect(page.getByText('4 moves')).toBeVisible();

	await page.getByPlaceholder('Search moves by name').fill('Iron Head');
	await expect(page.getByText('1 moves')).toBeVisible();
	await page.getByRole('button', { name: /Iron Head/ }).click();

	await expect(page.getByRole('button', { name: 'Back to moves' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Iron Head', exact: true })).toBeVisible();
	await expect(page.getByText('1 matching Pokémon')).toBeVisible();

	await page.getByRole('button', { name: 'Mawile' }).click();
	await expect(page).toHaveURL(/\/pokemon\/mawile/);
});

test('browses abilities and follows a holder to its detail page', async ({ page }) => {
	await page.goto('/abilities');
	await expect(page.getByRole('heading', { name: 'Find who has an ability.' })).toBeVisible();
	await page.getByPlaceholder('Search abilities by name or effect').fill('Intimidate');
	// "Intimidate" also appears inside other abilities' descriptions (what they're immune
	// to), so match the row whose *name* is exactly "Intimidate", not just any mention.
	await page
		.getByRole('button')
		.filter({ has: page.getByText('Intimidate', { exact: true }) })
		.click();
	await page.getByRole('button', { name: 'Mawile' }).click();
	await expect(page).toHaveURL(/\/pokemon\/mawile/);
});

test('shows a distinct error with retry when usage data fails to load, and recovers', async ({
	page
}) => {
	let usageShouldFail = true;
	await page.route('**/api/pokemon/mawile/usage?*', (route) => {
		if (usageShouldFail) return route.fulfill({ status: 500, body: 'nope' });
		return route.fulfill({
			json: {
				pokemon: 'Mawile',
				showdownId: 'mawile',
				format: 'Doubles',
				generatedAt: '2026-08-29T00:50:01.077Z',
				stale: false,
				current: [{ category: 'move', rank: 1, name: 'Play Rough', percentage: 97.6 }],
				daily: []
			}
		});
	});
	await page.goto('/pokemon/mawile');

	await expect(page.getByText("Couldn't load usage data.")).toBeVisible();
	await expect(page.getByText('No ladder data yet')).toHaveCount(0);

	usageShouldFail = false;
	await page.getByRole('button', { name: 'Retry' }).first().click();
	await expect(page.getByText('97.6%')).toBeVisible();
});

test('shows an empty state when filters match nothing, with a way to clear them', async ({
	page
}) => {
	await page.goto('/');
	await page.getByLabel('Search Pokémon').fill('nonexistent-species');
	await expect(page.getByRole('heading', { name: 'No Pokémon match these filters' })).toBeVisible();
	await page.getByRole('button', { name: 'Clear filters' }).click();
	await expect(page.getByText('Mawile')).toBeVisible();
});

test('sorts by a usage column', async ({ page }) => {
	await page.route('**/api/pokemon?format=*', (route) =>
		route.fulfill({ json: rosterFixture([mawile, garchomp]) })
	);
	await page.goto('/');
	const firstRow = () => page.locator('tbody tr').first();
	await expect(firstRow()).toContainText('Garchomp'); // position 1 sorts first by default

	await page.getByLabel('Sort Pokémon').selectOption('name');
	await expect(firstRow()).toContainText('Garchomp'); // also alphabetically first
	await page.getByLabel('Sort Pokémon').selectOption('mega');
	await expect(firstRow()).toContainText('Mawile'); // only Mawile has mega-stone usage
});

test('falls back to a placeholder sprite instead of a broken image', async ({ page }) => {
	await page.goto('/pokemon/mawile');
	const statsPanel = page.locator('.stat-panel');
	// Mega Mawile's fixture sprite is '' — this used to render <img src=""> (a broken-image
	// glyph with no visual meaning); it should now show the placeholder instead.
	await statsPanel.getByRole('button', { name: 'Mega Mawile' }).click();
	const src = await page.locator('.identity img').getAttribute('src');
	expect(src).toContain('data:image/svg+xml');
});

test('keeps the primary workflow usable at a mobile viewport', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'Explore the doubles field.' })).toBeVisible();
	const hasHorizontalOverflow = await page.evaluate(
		() => document.documentElement.scrollWidth > window.innerWidth
	);
	expect(hasHorizontalOverflow).toBe(false);
});
