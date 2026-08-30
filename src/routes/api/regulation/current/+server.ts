import { json } from '@sveltejs/kit';
import manifest from '$lib/data/current-regulation.json';

export function GET() {
	const now = Date.now();
	return json(
		{
			manifest,
			active: now >= Date.parse(manifest.startsAt) && now < Date.parse(manifest.endsAt),
			serverTime: new Date(now).toISOString()
		},
		{ headers: { 'cache-control': 'public, max-age=300' } }
	);
}
