import { describe, expect, it } from 'vitest';
import { buildAbilityIndex } from './ability';
import type { PokemonRecord, UsageSummary } from './types';

const emptyUsage: UsageSummary = {
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

const raichu: PokemonRecord = {
	name: 'Raichu',
	battleName: 'Raichu',
	showdownId: 'raichu',
	speciesNumber: 26,
	sprite: '',
	types: ['Electric'],
	abilities: ['Static', 'Lightning Rod'],
	stats: { hp: 60, attack: 90, defense: 55, spAttack: 90, spDefense: 80, speed: 110 },
	forms: [],
	megaForms: [
		{
			name: 'Mega Raichu X',
			savedName: 'raichu-megax',
			kind: 'mega',
			types: ['Electric'],
			abilities: ['Surge Surfer'],
			stats: { hp: 60, attack: 135, defense: 95, spAttack: 90, spDefense: 95, speed: 130 },
			sprite: ''
		}
	],
	legalMoves: ['Thunderbolt'],
	usage: emptyUsage
};

const pikachu: PokemonRecord = {
	name: 'Pikachu',
	battleName: 'Pikachu',
	showdownId: 'pikachu',
	speciesNumber: 25,
	sprite: '',
	types: ['Electric'],
	abilities: ['Static'],
	stats: { hp: 35, attack: 55, defense: 40, spAttack: 50, spDefense: 50, speed: 90 },
	forms: [],
	megaForms: [],
	legalMoves: ['Thunderbolt'],
	usage: emptyUsage
};

describe('buildAbilityIndex', () => {
	it('counts every roster Pokémon that has a base ability', () => {
		const index = buildAbilityIndex([raichu, pikachu]);
		const static_ = index.find((ability) => ability.name === 'Static');
		expect(static_?.holders).toHaveLength(2);
		expect(static_?.holders.every((holder) => holder.megaFormName === null)).toBe(true);
	});

	it('attributes a Mega-only ability to its Mega form', () => {
		const index = buildAbilityIndex([raichu, pikachu]);
		const surgeSurfer = index.find((ability) => ability.name === 'Surge Surfer');
		expect(surgeSurfer?.holders).toEqual([{ showdownId: 'raichu', megaFormName: 'Mega Raichu X' }]);
	});

	it("doesn't double-count a Mega form that keeps its base ability", () => {
		const index = buildAbilityIndex([raichu]);
		const lightningRod = index.find((ability) => ability.name === 'Lightning Rod');
		expect(lightningRod?.holders).toHaveLength(1);
	});

	it('carries the ability description through', () => {
		const index = buildAbilityIndex([pikachu]);
		const static_ = index.find((ability) => ability.name === 'Static');
		expect(static_?.description).toBeTruthy();
	});
});
