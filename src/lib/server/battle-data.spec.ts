import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPokemon, getUsage, InvalidPokemonIdError } from './battle-data';

// venusaur and mawile are real eligible-pokemon data from current-regulation.json (mawile
// also has a real Mega Mawile / Mawilite rule there), so getPokemon's regulation-eligibility
// and mega-evolution lookups don't need their own mocks.
const ELIGIBLE_SHOWDOWN_ID = 'venusaur';

function jsonResponse(body: unknown, ok = true) {
	return new Response(JSON.stringify(body), {
		status: ok ? 200 : 500,
		headers: { 'content-type': 'application/json' }
	});
}

const indexFixture = {
	generatedAt: '2026-08-01T00:00:00.000Z',
	dataVersion: '1',
	pokemon: [
		{
			name: 'Venusaur',
			battleName: 'Venusaur',
			showdownId: ELIGIBLE_SHOWDOWN_ID,
			learnableMoveNames: ['Sludge Bomb', 'Giga Drain'],
			summary: {
				sprite: 'sprites/venusaur.png',
				primary: { types: ['Grass', 'Poison'], abilities: ['Overgrow'], hp: 80, atk: 82 },
				forms: [],
				battleSummary: {
					Current: {
						Doubles: {
							position: 3,
							values: { held_item: ['Focus Sash'], stat_alignment: ['Bold'] },
							top: {
								move: { name: 'Sludge Bomb', percentage_value: 61.2 },
								held_item: { name: 'Focus Sash', percentage_value: 44.5 },
								ability: { name: 'Overgrow', percentage_value: 98.1 },
								stat_alignment: { name: 'Bold', percentage_value: 30.4 },
								teammate: { name: 'Incineroar', percentage_value: 25.9 },
								stat_points: {
									percentage_value: 12.3,
									hp_points: 4,
									attack_points: 0,
									defense_points: 20,
									sp_atk_points: 12,
									sp_def_points: 10,
									speed_points: 20
								}
							}
						}
					}
				}
			}
		},
		{
			name: 'Mawile',
			battleName: 'Mawile',
			showdownId: 'mawile',
			learnableMoveNames: ['Play Rough'],
			summary: {
				sprite: 'sprites/mawile.png',
				primary: { types: ['Steel', 'Fairy'], abilities: ['Intimidate'], hp: 50, atk: 85 },
				forms: [],
				battleSummary: {
					Current: {
						Doubles: {
							position: 37,
							// Mawilite is used, but ranks behind Life Orb -- the top-item percentage
							// (44.5%, on Life Orb) is therefore not the Mega Stone's own usage.
							values: { held_item: ['Life Orb', 'Mawilite', 'Sitrus Berry'] },
							top: { held_item: { name: 'Life Orb', percentage_value: 44.5 } }
						}
					}
				}
			}
		},
		{
			name: 'Not Eligible',
			battleName: 'Not Eligible',
			showdownId: 'not-a-real-eligible-pokemon',
			learnableMoveNames: [],
			summary: { primary: {}, forms: [], battleSummary: {} }
		}
	]
};

const battleFixture = {
	pokemon: 'Venusaur',
	showdownId: ELIGIBLE_SHOWDOWN_ID,
	rows: [
		{ category: 'move', rank: 1, name: 'Sludge Bomb', percentage_value: 61.2 },
		{
			category: 'stat_points',
			rank: 1,
			name: '',
			percentage_value: 12.3,
			hp_points: 4,
			attack_points: 0,
			defense_points: 20,
			sp_atk_points: 12,
			sp_def_points: 10,
			speed_points: 20
		}
	]
};

// Dates use the real battle-data API's "DD_MM_YYYY" folder-name format, deliberately
// listed out of order here to exercise getUsage's explicit sort rather than assume the
// upstream API always returns them newest-first.
const dailyFixture = {
	pokemon: 'Venusaur',
	showdownId: ELIGIBLE_SHOWDOWN_ID,
	daily: [
		{
			season: 'M5',
			date: '01_08_2026',
			rows: [
				{
					category: 'move',
					rank: 1,
					name: 'Sludge Bomb',
					percentage_value: 60,
					column_position: 3
				}
			]
		},
		{
			season: 'M5',
			date: '03_08_2026',
			rows: [
				{
					category: 'move',
					rank: 1,
					name: 'Sludge Bomb',
					percentage_value: 65,
					column_position: 1
				}
			]
		},
		{
			season: 'M5',
			date: '02_08_2026',
			rows: [
				{
					category: 'move',
					rank: 1,
					name: 'Sludge Bomb',
					percentage_value: 63,
					column_position: 2
				}
			]
		}
	]
};

describe('battle-data', () => {
	beforeEach(() => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async (url: string) => {
				if (url.endsWith('/api')) return jsonResponse(indexFixture);
				if (url.includes('/api/battle/Doubles/venusaur') && url.includes('days='))
					return jsonResponse(dailyFixture);
				if (url.includes('/api/battle/Doubles/venusaur')) return jsonResponse(battleFixture);
				return jsonResponse({}, false);
			})
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	describe('getPokemon', () => {
		it('widens usage with the index top-row entries for every category, at no extra fetch', async () => {
			const { pokemon } = await getPokemon('Doubles');
			const venusaur = pokemon.find((entry) => entry.showdownId === ELIGIBLE_SHOWDOWN_ID);
			expect(venusaur?.usage).toEqual({
				position: 3,
				topMove: 'Sludge Bomb',
				topMovePct: 61.2,
				topItem: 'Focus Sash',
				topItemPct: 44.5,
				topAbility: 'Overgrow',
				topAbilityPct: 98.1,
				topNature: 'Bold',
				topNaturePct: 30.4,
				topTeammate: 'Incineroar',
				topTeammatePct: 25.9,
				topSpread: { hp: 4, attack: 0, defense: 20, spAttack: 12, spDefense: 10, speed: 20 },
				megaStoneUsage: null,
				megaStoneRank: null
			});
			// Only the index endpoint should have been hit — no per-row fetches.
			expect(fetch).toHaveBeenCalledTimes(1);
		});

		it('reports a rank instead of a usage percentage when the Mega Stone is used but is not the top held item', async () => {
			const { pokemon } = await getPokemon('Doubles');
			const mawile = pokemon.find((entry) => entry.showdownId === 'mawile');
			// Life Orb, not Mawilite, is the top item, so its percentage isn't the stone's own
			// usage — megaStoneUsage must stay null rather than misreporting Life Orb's share,
			// while megaStoneRank still says the stone was seen, and where it ranked.
			expect(mawile?.usage.megaStoneUsage).toBeNull();
			expect(mawile?.usage.megaStoneRank).toBe(2);
		});

		it('omits Pokémon that are not in the current regulation-eligible list', async () => {
			// Both index-fixture entries (venusaur, mawile) are genuinely eligible, so this
			// only exercises the filter with a showdownId that isn't in the manifest at all.
			const { pokemon } = await getPokemon('Doubles');
			expect(pokemon.some((entry) => entry.showdownId === 'not-a-real-eligible-pokemon')).toBe(
				false
			);
			expect(pokemon.map((entry) => entry.showdownId).sort()).toEqual(['mawile', 'venusaur']);
		});
	});

	describe('getUsage', () => {
		it('throws a distinguishable error for a malformed id, not a generic failure', async () => {
			// The API route maps this specifically to 400 rather than a retryable 503 — it
			// must stay identifiable as this class of error, not just any thrown Error.
			await expect(getUsage('!!!', 'Doubles', 7)).rejects.toBeInstanceOf(InvalidPokemonIdError);
		});

		it('normalizes current and daily rows, including stat-points into StatPoints', async () => {
			const snapshot = await getUsage(ELIGIBLE_SHOWDOWN_ID, 'Doubles', 7);
			expect(snapshot.current).toEqual([
				{
					category: 'move',
					rank: 1,
					name: 'Sludge Bomb',
					percentage: 61.2,
					statUp: undefined,
					statDown: undefined,
					points: undefined
				},
				{
					category: 'stat_points',
					rank: 1,
					name: '',
					percentage: 12.3,
					statUp: undefined,
					statDown: undefined,
					points: { hp: 4, attack: 0, defense: 20, spAttack: 12, spDefense: 10, speed: 20 }
				}
			]);
			// The fixture lists 01/03/02 August out of order — daily must come back sorted
			// newest-first by the parsed date, not upstream's original order.
			expect(snapshot.daily.map((day) => day.date)).toEqual([
				'03_08_2026',
				'02_08_2026',
				'01_08_2026'
			]);
			expect(snapshot.daily[0]).toEqual({
				season: 'M5',
				date: '03_08_2026',
				position: 1,
				rows: [
					{
						category: 'move',
						rank: 1,
						name: 'Sludge Bomb',
						percentage: 65,
						statUp: undefined,
						statDown: undefined,
						points: undefined
					}
				]
			});
		});
	});
});
