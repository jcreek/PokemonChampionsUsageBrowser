import { describe, expect, it } from 'vitest';
import { buildMoveIndex, defensiveMultiplier, moveDetails } from './type-chart';
import type { PokemonRecord } from './types';

const garchomp: PokemonRecord = {
	name: 'Garchomp',
	battleName: 'Garchomp',
	showdownId: 'garchomp',
	speciesNumber: 445,
	sprite: '',
	types: ['Dragon', 'Ground'],
	abilities: ['Rough Skin'],
	stats: { hp: 183, attack: 150, defense: 115, spAttack: 90, spDefense: 105, speed: 134 },
	forms: [],
	megaForms: [],
	legalMoves: ['Earthquake', 'Dragon Claw', 'Protect', 'Rock Slide'],
	usage: {
		position: 1,
		topMove: 'Earthquake',
		topMovePct: null,
		topItem: 'Life Orb',
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
	}
};

describe('type analysis', () => {
	it('handles dual-type weaknesses and immunities', () => {
		expect(defensiveMultiplier(['Dragon', 'Ground'], 'Ice')).toBe(4);
		expect(defensiveMultiplier(['Dragon', 'Ground'], 'Electric')).toBe(0);
	});

	it('looks up a known move by type and category', () => {
		expect(moveDetails('Earthquake').type).toBe('Ground');
		expect(moveDetails('Protect').category).toBe('Status');
	});

	it('reports a move with no battle metadata as Unknown rather than a confident Status guess', () => {
		const details = moveDetails('Some Move Not In The Metadata File');
		expect(details.category).toBe('Unknown');
		expect(details.type).toBe('Unknown');
		expect(details.hasMetadata).toBe(false);
	});
});

describe('move index', () => {
	it('only includes moves at least one roster Pokémon can learn, with correct learner counts', () => {
		const dragonite: PokemonRecord = {
			...garchomp,
			showdownId: 'dragonite',
			name: 'Dragonite',
			speciesNumber: 149,
			legalMoves: ['Earthquake', 'Dragon Claw', 'Hurricane']
		};
		const index = buildMoveIndex([garchomp, dragonite]);
		const byName = new Map(index.map((move) => [move.name, move]));

		// Shared move: learned by both.
		expect(byName.get('Earthquake')?.learners).toBe(2);
		// Move only Garchomp knows.
		expect(byName.get('Rock Slide')?.learners).toBe(1);
		// Move only Dragonite knows.
		expect(byName.get('Hurricane')?.learners).toBe(1);
		// A real move in move-metadata.json that nothing on the roster can learn
		// must not appear, even though it has battle metadata available.
		expect(byName.has('Thunder Wave')).toBe(false);
	});

	it('returns an empty index for an empty roster', () => {
		expect(buildMoveIndex([])).toEqual([]);
	});
});
