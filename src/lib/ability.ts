import metadata from '$lib/data/ability-metadata.json';
import type { PokemonRecord } from './types';

const abilities = metadata as Record<string, { description: string }>;

export function abilityDescription(name: string): string {
	return abilities[name]?.description ?? 'Description unavailable.';
}

export type AbilityHolder = {
	showdownId: string;
	/** The mega form that grants this ability, or null when it's a base-form ability. */
	megaFormName: string | null;
};

export type AbilityIndexEntry = {
	name: string;
	description: string;
	holders: AbilityHolder[];
};

/**
 * Every ability at least one roster Pokémon (in its base or a Mega form) actually has,
 * decorated with a description and its holders — mirrors buildMoveIndex() in type-chart.ts
 * so the ability browser can offer the same "search, then see who has it" flow as moves.
 */
export function buildAbilityIndex(pokemon: PokemonRecord[]): AbilityIndexEntry[] {
	const holders = new Map<string, AbilityHolder[]>();
	const addHolder = (name: string, holder: AbilityHolder) => {
		if (!holders.has(name)) holders.set(name, []);
		holders.get(name)!.push(holder);
	};
	for (const entry of pokemon) {
		for (const ability of entry.abilities) {
			addHolder(ability, { showdownId: entry.showdownId, megaFormName: null });
		}
		for (const form of entry.megaForms) {
			for (const ability of form.abilities) {
				// A Mega form frequently keeps its base ability alongside a new one — don't list
				// the same species twice under one ability just because both forms share it.
				if (entry.abilities.includes(ability)) continue;
				addHolder(ability, { showdownId: entry.showdownId, megaFormName: form.name });
			}
		}
	}
	return Array.from(holders.entries()).map(([name, entryHolders]) => ({
		name,
		description: abilityDescription(name),
		holders: entryHolders
	}));
}
