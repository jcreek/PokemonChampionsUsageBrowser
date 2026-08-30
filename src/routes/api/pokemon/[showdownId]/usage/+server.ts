import { error, json } from '@sveltejs/kit';
import { getUsage, InvalidPokemonIdError } from '$lib/server/battle-data';
import type { BattleFormat } from '$lib/types';

export async function GET({ params, url, setHeaders }) {
	const requested = url.searchParams.get('format') ?? 'Doubles';
	if (requested !== 'Singles' && requested !== 'Doubles')
		error(400, 'Format must be Singles or Doubles.');
	const days = Math.min(31, Math.max(1, Number(url.searchParams.get('days') ?? 7)));
	try {
		const result = await getUsage(params.showdownId, requested as BattleFormat, days);
		setHeaders({ 'cache-control': 'public, max-age=300, s-maxage=3600, stale-if-error=86400' });
		return json(result);
	} catch (cause) {
		if (cause instanceof InvalidPokemonIdError) error(400, cause.message);
		console.error(cause);
		error(503, 'Usage details are temporarily unavailable.');
	}
}
