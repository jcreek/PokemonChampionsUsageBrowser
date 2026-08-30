import type { PokemonRecord, RegulationManifest, StatPoints, UsageSnapshot } from './types';

/**
 * Champions' set builder uses its own 0–N "stat point" scale (currently 0–32 per stat,
 * 0–66 total — see current-regulation.json), not Showdown's 0–252/0–508 EV scale. Rather
 * than scale onto Showdown's range, export uses the Champions point values as-is — that's
 * the standard convention for pasting Champions teams into Showdown-based calculators, and
 * it's well under Showdown's per-stat and total EV caps anyway.
 */
export function pointsToEv(points: number, manifest: RegulationManifest): number {
	return Math.max(0, Math.min(manifest.rules.maximumStatPointsPerStat, Math.round(points)));
}

export const STAT_LABELS: Record<keyof StatPoints, string> = {
	hp: 'HP',
	attack: 'Atk',
	defense: 'Def',
	spAttack: 'SpA',
	spDefense: 'SpD',
	speed: 'Spe'
};

const EXPORT_HEADER =
	'// Champions Usage Browser export — Showdown-shaped for use in calculators. Stat points are this ' +
	"app's 0–32-point Champions values as-is, not a literal in-game team code.";

function showdownSpeciesName(pokemon: PokemonRecord, megaFormName?: string): string {
	if (!megaFormName) return pokemon.name;
	// Multi-mega species (Charizard, Raichu) have forms named e.g. "Mega Charizard X" —
	// carry that letter into the Showdown suffix ("-Mega-X") so the right form is picked.
	const lastWord = megaFormName.trim().split(/\s+/).pop() ?? '';
	const suffix = /^[A-Za-z]$/.test(lastWord) ? `-${lastWord.toUpperCase()}` : '';
	return `${pokemon.name}-Mega${suffix}`;
}

/**
 * Turns a single Pokémon's currently most-used moves/item/ability/nature/spread (rank-1
 * rows from its usage snapshot) into one Showdown-pasteable set block — for a "copy as
 * Showdown set" affordance, not a full team export. Pair with a link to Showdown's own
 * `[Gen 9 Champions]` teambuilder to actually build and validate a team.
 */
export function usageSetToShowdown(
	pokemon: PokemonRecord,
	usage: UsageSnapshot,
	manifest: RegulationManifest,
	opts?: { megaFormName?: string }
): string {
	const topOf = (category: string) =>
		usage.current.find((row) => row.category === category && row.rank === 1);

	const species = showdownSpeciesName(pokemon, opts?.megaFormName);
	const item = topOf('held_item')?.name;
	const ability = topOf('ability')?.name;
	const nature = topOf('stat_alignment')?.name;
	const spread = topOf('stat_points')?.points;
	const moves = usage.current
		.filter((row) => row.category === 'move')
		.sort((a, b) => a.rank - b.rank)
		.slice(0, 4)
		.map((row) => row.name);

	const lines: string[] = [item ? `${species} @ ${item}` : species];
	if (ability) lines.push(`Ability: ${ability}`);
	if (nature) lines.push(`${nature} Nature`);
	if (spread) {
		const evParts = (Object.entries(spread) as [keyof StatPoints, number][])
			.map(([stat, points]) => [stat, pointsToEv(points, manifest)] as const)
			.filter(([, ev]) => ev > 0)
			.map(([stat, ev]) => `${ev} ${STAT_LABELS[stat]}`);
		if (evParts.length) lines.push(`EVs: ${evParts.join(' / ')}`);
	}
	for (const move of moves) lines.push(`- ${move}`);

	return [EXPORT_HEADER, '', lines.join('\n')].join('\n');
}
