import { describe, expect, it } from 'vitest';
import {
	extractEligible,
	matchRoster,
	megaRules,
	resolveFormShowdownId,
	similarity,
	splitNames,
	withResolvedShowdownIds
} from './update-regulation.mjs';

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

	it('matches "(Male)" to the unsuffixed Showdown base form, not the "-F" forme', () => {
		expect(similarity('Meowstic (Male)', 'Meowstic')).toBeGreaterThan(
			similarity('Meowstic (Male)', 'Meowstic-F')
		);
		expect(similarity('Meowstic (Female)', 'Meowstic-F')).toBeGreaterThan(
			similarity('Meowstic (Female)', 'Meowstic')
		);
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

	it('maps a "Z" Mega to its Z stone rather than the plain stone', () => {
		const index = {
			pokemon: [
				{
					showdownId: 'absol',
					summary: {
						primary: { form_kind: 'Base' },
						forms: [
							{ form_kind: 'Mega', form_name: 'Mega Absol' },
							{ form_kind: 'Mega', form_name: 'Mega Absol Z' }
						],
						battleSummary: {
							Current: { Doubles: { values: { held_item: ['Absolite Z', 'Absolite'] } } }
						}
					}
				}
			]
		};
		expect(megaRules(index, new Set(['absol']))).toEqual([
			{ baseShowdownId: 'absol', megaName: 'Mega Absol', stone: 'Absolite' },
			{ baseShowdownId: 'absol', megaName: 'Mega Absol Z', stone: 'Absolite Z' }
		]);
	});
});

describe('roster reconciliation', () => {
	it('ignores Battle Data entries without a Showdown ID', () => {
		const index = {
			pokemon: [
				{ name: 'Tauros Form 1', showdownId: null },
				{ name: 'Tauros', showdownId: 'tauros' }
			]
		};
		expect(matchRoster([{ formId: '0128-000', name: 'Tauros' }], index).eligiblePokemon).toEqual([
			{ formId: '0128-000', name: 'Tauros', showdownId: 'tauros' }
		]);
	});

	it('resolves unmapped "<Species> Form <n>" entries via Showdown forme order', () => {
		expect(resolveFormShowdownId('Persian Form 1')).toBe('persianalola');
		expect(resolveFormShowdownId('Tauros Form 1')).toBe('taurospaldeacombat');
		expect(resolveFormShowdownId('Floette Form 5')).toBe('floetteeternal');
		expect(resolveFormShowdownId('Persian Form 9')).toBeNull();
		expect(resolveFormShowdownId('Persian')).toBeNull();
	});

	it('matches a resolved form and records its Battle Data name for the app join', () => {
		const index = withResolvedShowdownIds({
			pokemon: [
				{ name: 'Persian', showdownId: 'persian' },
				{ name: 'Persian Form 1', showdownId: null }
			]
		});
		expect(
			matchRoster(
				[
					{ formId: '0053-000', name: 'Persian' },
					{ formId: '0053-001', name: 'Persian (Alolan Form)' }
				],
				index
			).eligiblePokemon
		).toEqual([
			{ formId: '0053-000', name: 'Persian', showdownId: 'persian' },
			{
				formId: '0053-001',
				name: 'Persian (Alolan Form)',
				showdownId: 'persianalola',
				battleDataName: 'Persian Form 1'
			}
		]);
	});

	const current = [{ season: 'Current' }];
	const stale = [{ season: 'M5' }];

	it('prefers the colliding entry that still has Current-season data', () => {
		const index = withResolvedShowdownIds({
			pokemon: [
				{ name: 'Tauros', showdownId: 'tauros', battleDataCsvs: current },
				{
					name: 'Paldean Tauros Combat Breed',
					showdownId: 'taurospaldeacombat',
					battleDataCsvs: stale
				},
				{ name: 'Tauros Form 1', showdownId: null, battleDataCsvs: current }
			]
		});
		expect(index.collisions).toEqual([
			{
				showdownId: 'taurospaldeacombat',
				entries: ['Paldean Tauros Combat Breed', 'Tauros Form 1'],
				kept: 'Tauros Form 1'
			}
		]);
		const { eligiblePokemon, unmatched } = matchRoster(
			[
				{ formId: '0128-000', name: 'Tauros' },
				{ formId: '0128-001', name: 'Tauros (Paldean Form (Combat Breed))' }
			],
			index
		);
		expect(unmatched).toEqual([]);
		expect(eligiblePokemon[1]).toEqual({
			formId: '0128-001',
			name: 'Tauros (Paldean Form (Combat Breed))',
			showdownId: 'taurospaldeacombat',
			battleDataName: 'Tauros Form 1'
		});
	});

	it('drops both colliding entries when both have current data, reporting the rows as unmatched', () => {
		const index = withResolvedShowdownIds({
			pokemon: [
				{ name: 'Alolan Persian', showdownId: 'persianalola', battleDataCsvs: current },
				{ name: 'Persian Form 1', showdownId: null, battleDataCsvs: current }
			]
		});
		expect(index.collisions[0].kept).toBeNull();
		const rows = [
			{ formId: '0053-000', name: 'Persian' },
			{ formId: '0053-001', name: 'Persian (Alolan Form)' }
		];
		expect(matchRoster(rows, index)).toEqual({ eligiblePokemon: [], unmatched: rows });
	});

	it('matches a "Form <n>" entry to the official row with the same form index', () => {
		// The official name for Eternal Floette is just "Floette", which would otherwise
		// out-score "Floette Form 5" in favour of the stale labelled entry.
		const index = withResolvedShowdownIds({
			pokemon: [
				{ name: 'Floette', showdownId: 'floette', battleDataCsvs: stale },
				{ name: 'Floette Form 5', showdownId: null, battleDataCsvs: current }
			]
		});
		expect(matchRoster([{ formId: '0670-005', name: 'Floette' }], index).eligiblePokemon).toEqual([
			{
				formId: '0670-005',
				name: 'Floette',
				showdownId: 'floetteeternal',
				battleDataName: 'Floette Form 5'
			}
		]);
	});
});
