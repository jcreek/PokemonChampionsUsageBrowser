import { error, json } from '@sveltejs/kit';
import { getPokemon } from '$lib/server/battle-data';
import type { BattleFormat } from '$lib/types';

export async function GET({ url, setHeaders }) {
	const requested = url.searchParams.get('format') ?? 'Doubles';
	if (requested !== 'Singles' && requested !== 'Doubles')
		error(400, 'Format must be Singles or Doubles.');
	try {
		const result = await getPokemon(requested as BattleFormat);
		setHeaders({ 'cache-control': 'public, max-age=300, s-maxage=3600, stale-if-error=86400' });
		return json(result);
	} catch (cause) {
		console.error(cause);
		error(503, 'Battle data is temporarily unavailable.');
	}
}
