import { error, json } from '@sveltejs/kit';
import { getPokemon } from '$lib/server/battle-data';
import type { BattleFormat } from '$lib/types';

// Static hosting (GitHub Pages) has no server to answer this on demand, so every
// combination is baked in at build time instead — the live upstream fetch happens
// once per format, during the build, not per visitor request.
export const prerender = true;

export function entries() {
	return [{ format: 'Singles' }, { format: 'Doubles' }];
}

export async function GET({ params }) {
	const requested = params.format;
	if (requested !== 'Singles' && requested !== 'Doubles')
		error(400, 'Format must be Singles or Doubles.');
	try {
		const result = await getPokemon(requested as BattleFormat);
		return json(result);
	} catch (cause) {
		console.error(cause);
		error(503, 'Battle data is temporarily unavailable.');
	}
}
