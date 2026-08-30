import { describe, expect, it } from 'vitest';
import manifestJson from './data/current-regulation.json';
import { pointsToEv, usageSetToShowdown } from './showdown-format';
import type { PokemonRecord, RegulationManifest, UsageSnapshot } from './types';

const manifest = manifestJson as RegulationManifest;

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

const charizard: PokemonRecord = {
	name: 'Charizard',
	battleName: 'Charizard',
	showdownId: 'charizard',
	speciesNumber: 6,
	sprite: '',
	types: ['Fire', 'Flying'],
	abilities: ['Blaze'],
	stats: { hp: 78, attack: 84, defense: 78, spAttack: 109, spDefense: 85, speed: 100 },
	forms: [],
	megaForms: [
		{
			name: 'Mega Charizard Y',
			savedName: 'Mega Charizard Y',
			kind: 'Mega',
			types: ['Fire', 'Flying'],
			abilities: ['Drought'],
			stats: { hp: 78, attack: 104, defense: 78, spAttack: 159, spDefense: 115, speed: 100 },
			sprite: ''
		}
	],
	legalMoves: ['Flamethrower', 'Dragon Claw', 'Roost', 'Air Slash'],
	usage: { ...emptyUsage, position: 5, topMove: 'Flamethrower', topItem: 'Charizardite Y' }
};

function usageSnapshot(overrides: Partial<UsageSnapshot> = {}): UsageSnapshot {
	return {
		pokemon: charizard.name,
		showdownId: charizard.showdownId,
		format: 'Doubles',
		generatedAt: '2026-08-01T00:00:00.000Z',
		stale: false,
		current: [],
		daily: [],
		...overrides
	};
}

describe('pointsToEv', () => {
	it('leaves Champions stat points as-is rather than rescaling onto Showdown EVs', () => {
		expect(pointsToEv(20, manifest)).toBe(20);
	});

	it('clamps to the manifest per-stat cap', () => {
		expect(pointsToEv(999, manifest)).toBe(manifest.rules.maximumStatPointsPerStat);
	});
});

describe('usageSetToShowdown', () => {
	it("assembles a set from each category's rank-1 row", () => {
		const usage = usageSnapshot({
			current: [
				{ category: 'move', rank: 1, name: 'Flamethrower', percentage: 61 },
				{ category: 'move', rank: 2, name: 'Air Slash', percentage: 40 },
				{ category: 'held_item', rank: 1, name: 'Charizardite Y', percentage: 30 },
				{ category: 'ability', rank: 1, name: 'Blaze', percentage: 99 },
				{ category: 'stat_alignment', rank: 1, name: 'Timid', percentage: 55 },
				{
					category: 'stat_points',
					rank: 1,
					name: '',
					percentage: 12,
					points: { hp: 4, attack: 0, defense: 0, spAttack: 20, spDefense: 10, speed: 20 }
				}
			]
		});
		const block = usageSetToShowdown(charizard, usage, manifest);
		expect(block).toContain('Charizard @ Charizardite Y');
		expect(block).toContain('Ability: Blaze');
		expect(block).toContain('Timid Nature');
		expect(block).toContain('EVs: 4 HP / 20 SpA / 10 SpD / 20 Spe');
		expect(block).toContain('- Flamethrower');
		expect(block).toContain('- Air Slash');
	});

	it('carries a multi-mega letter suffix into the Showdown species name', () => {
		const usage = usageSnapshot();
		const block = usageSetToShowdown(charizard, usage, manifest, {
			megaFormName: 'Mega Charizard Y'
		});
		expect(block).toContain('Charizard-Mega-Y');
	});

	it('omits empty fields rather than emitting blank lines', () => {
		const block = usageSetToShowdown(charizard, usageSnapshot(), manifest);
		expect(block).not.toContain('Ability:');
		expect(block).not.toContain('EVs:');
	});
});
