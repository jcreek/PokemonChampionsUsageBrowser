<script lang="ts">
	import './global.css';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { ChevronDown, Database, Radar, AlertCircle, ExternalLink } from '@lucide/svelte';
	import manifestJson from '$lib/data/current-regulation.json';
	import type { BattleFormat, RegulationManifest } from '$lib/types';
	import { regulationIsActive } from '$lib/regulation';

	let { children } = $props();
	const manifest = manifestJson as RegulationManifest;

	let format = $derived<BattleFormat>(
		page.url.searchParams.get('format') === 'Singles' ? 'Singles' : 'Doubles'
	);
	// Client-clock fallback for the first paint; refreshed from the server-authoritative
	// endpoint on mount and whenever the tab regains focus.
	let active = $state(regulationIsActive(manifest));
	let generatedAt = $state('');
	let dataStale = $state(false);

	function setFormat(next: BattleFormat) {
		if (!browser) return;
		const url = new URL(window.location.href);
		url.searchParams.set('format', next);
		window.location.href = url.toString();
	}

	async function refreshRegulationStatus() {
		try {
			const response = await fetch('/api/regulation/current');
			if (!response.ok) return;
			const result = await response.json();
			if (typeof result.active === 'boolean') active = result.active;
		} catch {
			// Offline or the endpoint failed — keep the last known value rather than
			// blocking the user on a network hiccup.
		}
	}

	async function refreshFreshness() {
		try {
			const response = await fetch(`/api/pokemon?format=${format}`);
			if (!response.ok) return;
			const result = await response.json();
			generatedAt = result.generatedAt;
			dataStale = result.stale;
		} catch {
			// Left blank — the freshness bar just shows "Checking source…" until a
			// page's own fetch succeeds.
		}
	}

	onMount(() => {
		refreshRegulationStatus();
		refreshFreshness();
		window.addEventListener('focus', refreshRegulationStatus);
		return () => window.removeEventListener('focus', refreshRegulationStatus);
	});
</script>

<a class="skip-link" href="#main-content">Skip to content</a>

<div class="app-shell">
	<header class="topbar">
		<a class="brand" href="/" aria-label="Champions Usage Browser home"
			><span><Radar size={21} /></span>
			<div><strong>Champions</strong><small>Usage Browser</small></div></a
		>
		<div class="header-controls">
			<label class="format-control"
				><span>Format</span><select
					value={format}
					onchange={(event) => setFormat(event.currentTarget.value as BattleFormat)}
					><option>Doubles</option><option>Singles</option></select
				><ChevronDown size={14} /></label
			>
			<a
				class:inactive={!active}
				class="regulation-pill"
				href={manifest.sources.notice}
				target="_blank"
				rel="noreferrer"
				aria-label={`${active ? 'Current regulation' : 'Review required'} ${manifest.id} (opens in a new tab)`}
				><i></i><span
					><small>{active ? 'Current regulation' : 'Review required'}</small><b>{manifest.id}</b
					></span
				><ExternalLink size={12} /></a
			>
		</div>
		<nav class="primary-nav" aria-label="Primary navigation">
			<a
				class:active={page.url.pathname === '/'}
				aria-current={page.url.pathname === '/' ? 'page' : undefined}
				href={`/?format=${format}`}>Pokémon</a
			>
			<a
				class:active={page.url.pathname === '/moves'}
				aria-current={page.url.pathname === '/moves' ? 'page' : undefined}
				href={`/moves?format=${format}`}>Moves</a
			>
			<a
				class:active={page.url.pathname === '/abilities'}
				aria-current={page.url.pathname === '/abilities' ? 'page' : undefined}
				href={`/abilities?format=${format}`}>Abilities</a
			>
		</nav>
	</header>

	{#if !active}<div class="regulation-lock">
			<AlertCircle size={18} />
			<p>
				<strong>Current regulation window ended.</strong> The reviewed {manifest.id} manifest expired
				on {new Date(manifest.endsAt).toLocaleDateString()}. Usage data may reflect a regulation
				that hasn't been reviewed yet — treat rankings accordingly.
			</p>
		</div>{/if}

	<div class="freshness-bar">
		<div class="freshness">
			<Database size={16} /><span
				><small>{dataStale ? 'Showing cached data' : 'Battle data refreshed'}</small><b
					>{generatedAt
						? new Date(generatedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
						: 'Checking source…'}</b
				></span
			>
		</div>
	</div>

	<main id="main-content" tabindex="-1">
		{@render children()}
	</main>

	<footer class="site-footer">
		<p>
			Unofficial community tool. Not affiliated with or endorsed by The Pokémon Company, Nintendo,
			Game Freak or Creatures. For building and validating a legal team, see
			<a href="https://play.pokemonshowdown.com/teambuilder" target="_blank" rel="noreferrer"
				>Pokémon Showdown's Champions teambuilder</a
			>.
		</p>
		<p>
			Battle data provided by <a
				href="https://championsbattledata.com/"
				target="_blank"
				rel="noreferrer">Pokémon Champions Battle Data</a
			>.
		</p>
	</footer>
</div>

<style>
	.skip-link {
		position: absolute;
		top: -3rem;
		left: 1rem;
		z-index: 50;
		padding: 0.6rem 1rem;
		border-radius: 0.5rem;
		background: var(--ink);
		color: var(--surface);
		font-weight: 800;
		font-size: 0.75rem;
		text-decoration: none;
		transition: top 0.15s ease;
	}
	.skip-link:focus {
		top: 1rem;
	}
	main:focus-visible {
		outline: none;
	}
	main {
		width: min(90rem, 100%);
		margin: 0 auto;
		padding: clamp(1.25rem, 3vw, 2.5rem);
	}
	.app-shell {
		min-height: 100vh;
	}
	.topbar {
		position: sticky;
		top: 0;
		z-index: 20;
		height: 4.4rem;
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		padding: 0 clamp(1rem, 3vw, 2.5rem);
		border-bottom: 1px solid var(--line);
		background: color-mix(in srgb, var(--surface) 92%, transparent);
		backdrop-filter: blur(16px);
	}
	.brand {
		order: 1;
		display: flex;
		align-items: center;
		gap: 0.65rem;
		color: var(--ink);
		text-decoration: none;
	}
	.brand > span {
		width: 2.35rem;
		height: 2.35rem;
		border-radius: 0.65rem;
		display: grid;
		place-items: center;
		background: var(--ink);
		color: var(--surface);
	}
	.brand strong,
	.brand small {
		display: block;
	}
	.brand strong {
		font-family: var(--font-display);
		font-size: 1rem;
		line-height: 1;
	}
	.brand small {
		font-size: 0.62rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--muted);
		margin-top: 0.18rem;
	}
	.header-controls {
		order: 3;
		display: flex;
		justify-content: flex-end;
		align-items: center;
		gap: 0.8rem;
	}
	.primary-nav {
		order: 2;
		display: flex;
		align-items: center;
		gap: 1.4rem;
	}
	.primary-nav a {
		border: 0;
		background: transparent;
		color: var(--muted);
		font-size: 0.76rem;
		font-weight: 800;
		text-decoration: none;
	}
	.primary-nav a.active {
		color: var(--ink);
	}
	.format-control {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.45rem;
		border: 1px solid var(--line);
		border-radius: 0.65rem;
		padding: 0.45rem 0.6rem;
		background: var(--paper);
	}
	.format-control > span {
		font-size: 0.64rem;
		text-transform: uppercase;
		color: var(--muted);
		font-weight: 800;
	}
	.format-control select {
		appearance: none;
		border: 0;
		background: transparent;
		padding-right: 1rem;
		font: inherit;
		font-size: 0.72rem;
		font-weight: 800;
		color: var(--ink);
	}
	.format-control :global(svg) {
		position: absolute;
		right: 0.45rem;
		pointer-events: none;
	}
	.regulation-pill {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		text-decoration: none;
		color: var(--ink);
	}
	.regulation-pill > i {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background: var(--success);
		box-shadow: 0 0 0 3px var(--success-soft);
	}
	.regulation-pill.inactive > i {
		background: var(--danger);
		box-shadow: 0 0 0 3px var(--danger-soft);
	}
	.regulation-pill small,
	.regulation-pill b {
		display: block;
	}
	.regulation-pill small {
		font-size: 0.61rem;
		color: var(--muted);
	}
	.regulation-pill b {
		font-size: 0.72rem;
	}
	.regulation-pill :global(svg) {
		color: var(--muted);
	}
	.regulation-lock {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.7rem;
		padding: 0.75rem 1rem;
		background: var(--danger-soft);
		border-bottom: 1px solid color-mix(in srgb, var(--danger) 25%, transparent);
		color: var(--danger);
	}
	.regulation-lock p {
		margin: 0;
		font-size: 0.72rem;
	}
	.freshness-bar {
		display: flex;
		justify-content: flex-end;
		padding: 0.5rem clamp(1rem, 3vw, 2.5rem) 0;
	}
	.freshness {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: max-content;
		padding: 0.4rem 0.7rem;
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		background: var(--paper);
	}
	.freshness :global(svg) {
		color: var(--accent);
	}
	.freshness small,
	.freshness b {
		display: block;
	}
	.freshness small {
		font-size: 0.62rem;
		color: var(--muted);
	}
	.freshness b {
		font-size: 0.66rem;
	}
	.site-footer {
		width: min(90rem, 100%);
		margin: 1.5rem auto 0;
		padding: 1.2rem clamp(1rem, 3vw, 2.5rem);
		border-top: 1px solid var(--line);
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		color: var(--muted);
		font-size: 0.62rem;
	}
	.site-footer p {
		margin: 0;
	}
	.site-footer a {
		color: var(--accent-deep);
	}
	@media (max-width: 900px) {
		.topbar {
			height: auto;
			grid-template-columns: 1fr auto;
			grid-template-areas: 'brand controls' 'nav nav';
			row-gap: 0.5rem;
			padding-block: 0.6rem;
		}
		.brand {
			grid-area: brand;
		}
		.header-controls {
			grid-area: controls;
		}
		.primary-nav {
			grid-area: nav;
			justify-content: center;
			gap: 2rem;
		}
	}
	@media (max-width: 650px) {
		.topbar {
			padding: 0.5rem 1rem;
		}
		.brand small,
		.format-control > span,
		.regulation-pill small {
			display: none;
		}
		.format-control {
			padding: 0.4rem;
		}
		.freshness-bar {
			justify-content: center;
			padding-top: 0.4rem;
		}
		.site-footer {
			display: grid;
		}
	}
</style>
