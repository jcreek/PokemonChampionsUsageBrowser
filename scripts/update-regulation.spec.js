import { describe, expect, it } from 'vitest';
import { extractEligible, megaRules, similarity, splitNames } from './update-regulation.mjs';

describe('regulation source parser', () => {
	it('extracts a plausible embedded official roster', () => {
		const rows = Array.from({ length: 100 }, (_, index) => [
			`${String(index + 1).padStart(4, '0')}-000`,
			1,
			`Pokémon ${index + 1}`
		]);
		const parsed = extractEligible(
			`<script>const pokemons = ${JSON.stringify(rows)};const noPrefix = [];</script>`
		);
		expect(parsed).toHaveLength(100);
		expect(parsed[0]).toEqual({ formId: '0001-000', enabled: 1, name: 'Pokémon 1' });
	});

	it('fails closed when the official array is missing or implausibly small', () => {
		expect(() => extractEligible('<html></html>')).toThrow('was not found');
		expect(() =>
			extractEligible('<script>const pokemons = [];const noPrefix = [];</script>')
		).toThrow('Implausible');
	});

	it('normalises regional-form wording during reconciliation', () => {
		expect(similarity('Alolan Ninetales Form', 'Ninetales-Alola')).toBeGreaterThan(0);
	});

	it('splits pipe-delimited and array ability values into individual names', () => {
		expect(splitNames('Hyper Cutter|Intimidate|Sheer Force')).toEqual([
			'Hyper Cutter',
			'Intimidate',
			'Sheer Force'
		]);
		expect(splitNames(['Huge Power', 'Mold Breaker|Sand Force'])).toEqual([
			'Huge Power',
			'Mold Breaker',
			'Sand Force'
		]);
	});
});

describe('mega stone detection', () => {
	function pokemonFixture(showdownId, heldItems) {
		return {
			showdownId,
			summary: {
				primary: { form_kind: 'Base' },
				forms: [{ form_kind: 'Mega', form_name: 'Mega Mawile' }],
				battleSummary: { Current: { Doubles: { values: { held_item: heldItems } } } }
			}
		};
	}

	it('picks the ranked item that is actually the Mega Stone', () => {
		const index = { pokemon: [pokemonFixture('mawile', ['Life Orb', 'Mawilite', 'Sitrus Berry'])] };
		expect(megaRules(index, new Set(['mawile']))).toEqual([
			{ baseShowdownId: 'mawile', megaName: 'Mega Mawile', stone: 'Mawilite' }
		]);
	});

	it('does not mistake an unrelated item merely containing "ite" for the Mega Stone', () => {
		// "White Herb" contains the substring "ite" but doesn't end with it — a naive
		// /ite/i.test() match would pick this over the real stone ranked below it.
		const index = {
			pokemon: [pokemonFixture('mawile', ['White Herb', 'Mawilite', 'Sitrus Berry'])]
		};
		expect(megaRules(index, new Set(['mawile']))).toEqual([
			{ baseShowdownId: 'mawile', megaName: 'Mega Mawile', stone: 'Mawilite' }
		]);
	});
});
