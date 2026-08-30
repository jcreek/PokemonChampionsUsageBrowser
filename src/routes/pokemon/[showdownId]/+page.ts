import { error } from '@sveltejs/kit';
import { base } from '$app/paths';
import type { BattleFormat, PokemonRecord } from '$lib/types';
import type { PageLoad } from './$types';

// Client-only: the roster comes from a third-party API this app doesn't control the
// shape or availability of, so it's fetched the same way everywhere in this app —
// in the browser, on demand — rather than duplicating that fetch on the server too.
export const ssr = false;
// One page per regulation-eligible Pokémon can't be enumerated as build-time entries
// the way the JSON endpoints are (see src/routes/api/pokemon) without doubling the
// build's page count for no benefit — this route is already fully client-rendered,
// so it's served through the adapter's `fallback: '404.html'` and hydrates from there.
export const prerender = false;

function formatFromUrl(url: URL): BattleFormat {
	return url.searchParams.get('format') === 'Singles' ? 'Singles' : 'Doubles';
}

export const load: PageLoad = async ({ params, url, fetch }) => {
	const format = formatFromUrl(url);
	const response = await fetch(`${base}/api/pokemon/${format}.json`);
	if (!response.ok) error(503, 'The community battle-data service did not respond.');
	const result: { pokemon: PokemonRecord[]; generatedAt: string; stale: boolean } =
		await response.json();
	const pokemon = result.pokemon.find((entry) => entry.showdownId === params.showdownId);
	if (!pokemon) error(404, `"${params.showdownId}" isn't in the current regulation-eligible list.`);
	return { pokemon, format };
};
