import { base } from '$app/paths';
import type { BattleFormat, PokemonRecord } from '$lib/types';
import type { PageLoad } from './$types';

// See src/routes/pokemon/[showdownId]/+page.ts for why this is client-only.
export const ssr = false;

export const load: PageLoad = async ({ url, fetch }) => {
	const format: BattleFormat = url.searchParams.get('format') === 'Singles' ? 'Singles' : 'Doubles';
	const response = await fetch(`${base}/api/pokemon/${format}.json`);
	const result: { pokemon: PokemonRecord[] } = response.ok
		? await response.json()
		: { pokemon: [] };
	return { pokemon: result.pokemon, format };
};
