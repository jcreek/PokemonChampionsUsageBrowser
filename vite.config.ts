import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';

// GitHub Pages serves this as a project page (https://jcreek.github.io/<repo>/), so
// every asset/link needs that repo-name prefix in production. Keep it empty in dev
// so `npm run dev` still serves at `/`.
const base = (process.env.BASE_PATH ?? '') as '' | `/${string}`;

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter({
				pages: 'build',
				assets: 'build',
				// GitHub Pages has no server-side routing: it serves 404.html for any
				// unmatched path. Every route here is already client-rendered
				// (`ssr = false`), so SvelteKit's client router boots from that fallback
				// and navigates to the right page — this is what makes deep links like
				// /pokemon/pikachu work on Pages.
				fallback: '404.html',
				strict: true
			}),
			paths: { base },
			prerender: {
				// The full roster (`/api/pokemon/[format].json`) is essential — if the
				// upstream battle-data API is unreachable for that, fail the build loudly.
				// A single Pokémon's usage detail (`/api/pokemon/[format]/[id]/usage`)
				// missing upstream data (e.g. a rare form with no recorded games yet) is
				// expected and shouldn't block the whole deploy — the UI already has a
				// "couldn't load usage data" retry state for exactly this case.
				handleHttpError: ({ path, message }) => {
					if (path.includes('/usage')) {
						console.warn(`prerender: skipping ${path} (${message})`);
						return;
					}
					throw new Error(message);
				}
			}
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}', 'scripts/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
