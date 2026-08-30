import moveMetadataJson from './data/move-metadata.json';
import type { PokemonRecord } from './types';

export const TYPES = [
	'Normal',
	'Fire',
	'Water',
	'Electric',
	'Grass',
	'Ice',
	'Fighting',
	'Poison',
	'Ground',
	'Flying',
	'Psychic',
	'Bug',
	'Rock',
	'Ghost',
	'Dragon',
	'Dark',
	'Steel',
	'Fairy'
] as const;

export type PokemonType = (typeof TYPES)[number];
type TypeRule = { weak: string[]; resist: string[]; immune?: string[] };

const DEFENSE: Record<string, TypeRule> = {
	Normal: { weak: ['Fighting'], resist: [], immune: ['Ghost'] },
	Fire: {
		weak: ['Water', 'Ground', 'Rock'],
		resist: ['Fire', 'Grass', 'Ice', 'Bug', 'Steel', 'Fairy']
	},
	Water: { weak: ['Electric', 'Grass'], resist: ['Fire', 'Water', 'Ice', 'Steel'] },
	Electric: { weak: ['Ground'], resist: ['Electric', 'Flying', 'Steel'] },
	Grass: {
		weak: ['Fire', 'Ice', 'Poison', 'Flying', 'Bug'],
		resist: ['Water', 'Electric', 'Grass', 'Ground']
	},
	Ice: { weak: ['Fire', 'Fighting', 'Rock', 'Steel'], resist: ['Ice'] },
	Fighting: { weak: ['Flying', 'Psychic', 'Fairy'], resist: ['Bug', 'Rock', 'Dark'] },
	Poison: { weak: ['Ground', 'Psychic'], resist: ['Grass', 'Fighting', 'Poison', 'Bug', 'Fairy'] },
	Ground: { weak: ['Water', 'Grass', 'Ice'], resist: ['Poison', 'Rock'], immune: ['Electric'] },
	Flying: {
		weak: ['Electric', 'Ice', 'Rock'],
		resist: ['Grass', 'Fighting', 'Bug'],
		immune: ['Ground']
	},
	Psychic: { weak: ['Bug', 'Ghost', 'Dark'], resist: ['Fighting', 'Psychic'] },
	Bug: { weak: ['Fire', 'Flying', 'Rock'], resist: ['Grass', 'Fighting', 'Ground'] },
	Rock: {
		weak: ['Water', 'Grass', 'Fighting', 'Ground', 'Steel'],
		resist: ['Normal', 'Fire', 'Poison', 'Flying']
	},
	Ghost: { weak: ['Ghost', 'Dark'], resist: ['Poison', 'Bug'], immune: ['Normal', 'Fighting'] },
	Dragon: { weak: ['Ice', 'Dragon', 'Fairy'], resist: ['Fire', 'Water', 'Electric', 'Grass'] },
	Dark: { weak: ['Fighting', 'Bug', 'Fairy'], resist: ['Ghost', 'Dark'], immune: ['Psychic'] },
	Steel: {
		weak: ['Fire', 'Fighting', 'Ground'],
		resist: [
			'Normal',
			'Grass',
			'Ice',
			'Flying',
			'Psychic',
			'Bug',
			'Rock',
			'Dragon',
			'Steel',
			'Fairy'
		],
		immune: ['Poison']
	},
	Fairy: { weak: ['Poison', 'Steel'], resist: ['Fighting', 'Bug', 'Dark'], immune: ['Dragon'] }
};

const moveMetadata = moveMetadataJson as Record<
	string,
	{
		type: string;
		category: string;
		power: number;
		accuracy: number;
		spread?: boolean;
		description?: string;
	}
>;

export function defensiveMultiplier(defenderTypes: string[], attackingType: string): number {
	return defenderTypes.reduce((multiplier, defenderType) => {
		const rule = DEFENSE[defenderType];
		if (!rule) return multiplier;
		if (rule.immune?.includes(attackingType)) return 0;
		if (rule.weak.includes(attackingType)) return multiplier * 2;
		if (rule.resist.includes(attackingType)) return multiplier * 0.5;
		return multiplier;
	}, 1);
}

export function moveDetails(name: string) {
	const move = moveMetadata[name];
	return {
		name,
		type: move?.type ?? 'Unknown',
		// A move missing from move-metadata.json is genuinely unknown, not a confirmed
		// Status move — presenting it as "Status" would be a confident, wrong claim (see
		// M3 in the review).
		category: move?.category ?? 'Unknown',
		power: move?.power ?? 0,
		accuracy: move?.accuracy ?? 0,
		// Hits multiple Pokémon at once in Doubles (e.g. both opposing Pokémon,
		// or every Pokémon adjacent to the user).
		spread: move?.spread ?? false,
		description: move?.description ?? 'Description unavailable.',
		hasMetadata: Boolean(move)
	};
}

// Every move at least one Pokémon in the given roster can actually learn,
// decorated with battle metadata and a count of how many Pokémon learn it.
// Moves that exist only in move-metadata.json but no roster entry's
// legalMoves (e.g. unavailable in the current regulation) are excluded.
export function buildMoveIndex(pokemon: PokemonRecord[]) {
	const learners = new Map<string, number>();
	for (const entry of pokemon) {
		for (const move of entry.legalMoves) {
			learners.set(move, (learners.get(move) ?? 0) + 1);
		}
	}
	return Array.from(learners.entries()).map(([name, count]) => ({
		...moveDetails(name),
		learners: count
	}));
}
