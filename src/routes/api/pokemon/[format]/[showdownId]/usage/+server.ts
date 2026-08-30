import { error, json } from '@sveltejs/kit';
import { getUsage, InvalidPokemonIdError } from '$lib/server/battle-data';
import type { BattleFormat } from '$lib/types';
import manifest from '$lib/data/current-regulation.json';

// The UI only ever asks for a 7-day trend window (see the pokemon detail page's fetch
// call), so that's the only value baked into the static build.
const DAYS = 7;

export const prerender = true;

export function entries() {
	const formats: BattleFormat[] = ['Singles', 'Doubles'];
	return formats.flatMap((format) =>
		manifest.eligiblePokemon.map((entry) => ({ format, showdownId: entry.showdownId }))
	);
}

export async function GET({ params }) {
	const requested = params.format;
	if (requested !== 'Singles' && requested !== 'Doubles')
		error(400, 'Format must be Singles or Doubles.');
	try {
		const result = await getUsage(params.showdownId, requested as BattleFormat, DAYS);
		return json(result);
	} catch (cause) {
		if (cause instanceof InvalidPokemonIdError) error(400, cause.message);
		console.error(cause);
		error(503, 'Usage details are temporarily unavailable.');
	}
}
