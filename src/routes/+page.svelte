<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { browser } from '$app/environment';
	import { Search, RefreshCw, AlertCircle, ArrowUpDown } from '@lucide/svelte';
	import manifestJson from '$lib/data/current-regulation.json';
	import type { BattleFormat, PokemonRecord, RegulationManifest } from '$lib/types';
	import { TYPES } from '$lib/type-chart';
	import { SPRITE_FALLBACK, useSpriteFallback } from '$lib/sprite-fallback';
	import TypeBadge from '$lib/components/TypeBadge.svelte';
	import Combobox from '$lib/components/Combobox.svelte';
	import type { ComboboxOption } from '$lib/combobox-types';

	const manifest = manifestJson as RegulationManifest;

	type SortKey = 'position' | 'name' | 'mega' | 'topMovePct' | 'topItemPct';
	const SORT_LABELS: Record<SortKey, string> = {
		position: 'Usage position',
		name: 'Name',
		mega: 'Mega Stone usage',
		topMovePct: 'Top move share',
		topItemPct: 'Top item share'
	};

	// See src/routes/+layout.svelte for why this is guarded — this route has no
	// `ssr = false` of its own, so it's actually prerendered server-side.
	let format = $derived<BattleFormat>(
		browser && page.url.searchParams.get('format') === 'Singles' ? 'Singles' : 'Doubles'
	);
	let pokemon = $state<PokemonRecord[]>([]);
	let loading = $state(true);
	let loadError = $state('');
	let query = $state('');
	let megaOnly = $state(false);
	let typeFilter = $state('');
	let sort = $state<SortKey>('position');

	const typeOptions: ComboboxOption[] = [
		{ key: '', label: 'All types' },
		...TYPES.map((type) => ({ key: type, label: type }))
	];

	let filteredPokemon = $derived.by(() => {
		const needle = query.toLowerCase().trim();
		return pokemon
			.filter((entry) => !megaOnly || entry.megaForms.length > 0)
			.filter((entry) => !typeFilter || entry.types.includes(typeFilter))
			.filter((entry) => !needle || entry.name.toLowerCase().includes(needle))
			.sort((a, b) => {
				if (sort === 'name') return a.name.localeCompare(b.name);
				if (sort === 'mega') return (b.usage.megaStoneUsage ?? -1) - (a.usage.megaStoneUsage ?? -1);
				if (sort === 'topMovePct') return (b.usage.topMovePct ?? -1) - (a.usage.topMovePct ?? -1);
				if (sort === 'topItemPct') return (b.usage.topItemPct ?? -1) - (a.usage.topItemPct ?? -1);
				return (a.usage.position ?? 9999) - (b.usage.position ?? 9999);
			});
	});

	async function loadPokemon(requestedFormat: BattleFormat) {
		loading = true;
		loadError = '';
		try {
			const response = await fetch(`${base}/api/pokemon/${requestedFormat}.json`);
			if (!response.ok) throw new Error('The community battle-data service did not respond.');
			const result = await response.json();
			if (format !== requestedFormat) return;
			pokemon = result.pokemon;
		} catch (err) {
			// A request for a format the user has since switched away from can fail after the
			// current format already loaded successfully — don't let that stale failure blank
			// a page that's actually fine.
			if (format !== requestedFormat) return;
			loadError = err instanceof Error ? err.message : 'Battle data is unavailable.';
		} finally {
			if (format === requestedFormat) loading = false;
		}
	}

	// Loading the roster only ever depends on `format`.
	$effect(() => {
		loadPokemon(format);
	});

	function spreadLabel(entry: PokemonRecord) {
		const s = entry.usage.topSpread;
		if (!s) return null;
		const parts = [
			['HP', s.hp],
			['Atk', s.attack],
			['Def', s.defense],
			['SpA', s.spAttack],
			['SpD', s.spDefense],
			['Spe', s.speed]
		].filter(([, value]) => Number(value) > 0);
		return parts.length ? parts.map(([label, value]) => `${value} ${label}`).join(' / ') : null;
	}

	// The bulk index only carries a usage percentage for a Pokémon's single most-used held
	// item, so the Mega Stone's own percentage is only known when the stone happens to be
	// that top item. When it's used but ranked lower, say so by rank rather than rendering
	// the same "—" a Pokémon whose stone was never observed at all would get.
	function megaStoneLabel(entry: PokemonRecord): string {
		if (!entry.megaForms.length) return 'n/a';
		if (entry.usage.megaStoneUsage !== null) return `${entry.usage.megaStoneUsage.toFixed(1)}%`;
		if (entry.usage.megaStoneRank !== null) return `Ranked #${entry.usage.megaStoneRank}`;
		return 'Not observed';
	}

	function goToPokemon(entry: PokemonRecord) {
		goto(`/pokemon/${entry.showdownId}?format=${format}`);
	}
</script>

<svelte:head
	><title>Champions Usage Browser</title><meta
		name="description"
		content="Explore current Pokémon Champions usage data — top moves, items, abilities, natures, spreads and teammates by format."
	/></svelte:head
>

{#if loading}
	<div class="state-card">
		<RefreshCw class="spin" size={24} />
		<h2>Loading the current field</h2>
		<p>Checking {manifest.id} eligibility against the latest {format} snapshot.</p>
	</div>
{:else if loadError}
	<div class="state-card error">
		<AlertCircle size={24} />
		<h2>Battle data is unavailable</h2>
		<p>{loadError}</p>
		<button onclick={() => loadPokemon(format)}>Try again</button>
	</div>
{:else}
	<section class="page-intro">
		<div>
			<p class="eyebrow">Current ranked battle evidence</p>
			<h1>Explore the {format.toLowerCase()} field.</h1>
			<p>
				Compare what trainers are using. Positions, sets and teammate associations are descriptive —
				not recommendations or win rates.
			</p>
		</div>
	</section>

	<section class="explore-toolbar">
		<label class="search"
			><Search size={17} /><input
				bind:value={query}
				placeholder="Search Pokémon"
				aria-label="Search Pokémon"
			/></label
		>
		<div class="filters">
			<button class:active={megaOnly} aria-pressed={megaOnly} onclick={() => (megaOnly = !megaOnly)}
				><span class="mega-gem">M</span> Mega available</button
			>
			<Combobox
				options={typeOptions}
				value={typeFilter}
				onselect={(key) => (typeFilter = key)}
				placeholder="Filter by type"
				ariaLabel="Filter by type"
			/>
			<label
				><ArrowUpDown size={15} /><select bind:value={sort} aria-label="Sort Pokémon"
					>{#each Object.entries(SORT_LABELS) as [key, label]}<option value={key}>{label}</option
						>{/each}</select
				></label
			>
		</div>
	</section>

	<div class="results-meta">
		<p><strong>{filteredPokemon.length}</strong> eligible Pokémon</p>
		<p>Position is the in-game usage order for {format}.</p>
	</div>

	{#if filteredPokemon.length === 0}
		<div class="state-card">
			<Search size={24} />
			<h2>No Pokémon match these filters</h2>
			<p>Try a different search term, type, or turn off "Mega available."</p>
			<button
				onclick={() => {
					query = '';
					megaOnly = false;
					typeFilter = '';
				}}>Clear filters</button
			>
		</div>
	{:else}
		<div class="table-scroll">
			<table aria-label="Eligible Pokémon usage">
				<thead>
					<tr>
						<th scope="col">#</th>
						<th scope="col">Pokémon</th>
						<th scope="col">Types</th>
						<th scope="col">Top move</th>
						<th scope="col">Top item</th>
						<th scope="col">Top ability</th>
						<th scope="col">Top nature</th>
						<th scope="col">Top spread</th>
						<th scope="col">Top teammate</th>
						<th scope="col">Mega Stone</th>
					</tr>
				</thead>
				<tbody>
					{#each filteredPokemon as entry}
						<tr class="row-link" tabindex="0" onclick={() => goToPokemon(entry)}>
							<td class="position">{entry.usage.position ? `#${entry.usage.position}` : '—'}</td>
							<td>
								<a class="identity" href={`${base}/pokemon/${entry.showdownId}?format=${format}`}>
									<img
										src={entry.sprite || SPRITE_FALLBACK}
										alt=""
										loading="lazy"
										onerror={useSpriteFallback}
									/>
									<span
										>{entry.name}{#if entry.megaForms.length}<i class="mega-marker">M</i>{/if}</span
									>
								</a>
							</td>
							<td
								><div class="types">
									{#each entry.types as type}<TypeBadge {type} compact />{/each}
								</div></td
							>
							<td
								>{entry.usage.topMove ?? '—'}{#if entry.usage.topMovePct !== null}
									<small>{entry.usage.topMovePct.toFixed(1)}%</small>{/if}</td
							>
							<td
								>{entry.usage.topItem ?? '—'}{#if entry.usage.topItemPct !== null}
									<small>{entry.usage.topItemPct.toFixed(1)}%</small>{/if}</td
							>
							<td
								>{entry.usage.topAbility ?? '—'}{#if entry.usage.topAbilityPct !== null}
									<small>{entry.usage.topAbilityPct.toFixed(1)}%</small>{/if}</td
							>
							<td
								>{entry.usage.topNature ?? '—'}{#if entry.usage.topNaturePct !== null}
									<small>{entry.usage.topNaturePct.toFixed(1)}%</small>{/if}</td
							>
							<td class="spread">{spreadLabel(entry) ?? '—'}</td>
							<td
								>{entry.usage.topTeammate ?? '—'}{#if entry.usage.topTeammatePct !== null}
									<small>{entry.usage.topTeammatePct.toFixed(1)}%</small>{/if}</td
							>
							<td class="mega-cell" class:known={entry.usage.megaStoneUsage !== null}
								>{megaStoneLabel(entry)}</td
							>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
{/if}

<style>
	.eyebrow {
		margin: 0 0 0.25rem;
		color: var(--accent-deep);
		font-size: 0.65rem;
		font-weight: 900;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.page-intro {
		display: flex;
		justify-content: space-between;
		align-items: end;
		gap: 2rem;
		margin-bottom: 1.5rem;
	}
	.page-intro h1 {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(2rem, 4vw, 3.4rem);
		line-height: 1.05;
		letter-spacing: -0.035em;
	}
	.page-intro > div > p:last-child {
		max-width: 45rem;
		margin: 0.65rem 0 0;
		color: var(--muted);
		font-size: 0.8rem;
		line-height: 1.55;
	}
	.explore-toolbar {
		display: flex;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 1rem;
		margin-bottom: 1rem;
	}
	.search {
		width: min(28rem, 100%);
		display: flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.65rem 0.8rem;
		border: 1px solid var(--line);
		border-radius: 0.7rem;
		background: var(--paper);
	}
	.search input {
		width: 100%;
		border: 0;
		outline: 0;
		background: transparent;
		font: inherit;
		font-size: 0.76rem;
		color: var(--ink);
	}
	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
	}
	.filters > button,
	.filters > label,
	.filters :global(.combobox) {
		box-sizing: border-box;
		height: 2.6rem;
	}
	.filters > button,
	.filters > label {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		border: 1px solid var(--line);
		border-radius: 0.65rem;
		padding: 0.58rem 0.72rem;
		background: var(--paper);
		font: inherit;
		font-size: 0.68rem;
		font-weight: 800;
		color: var(--muted);
	}
	.filters button.active {
		border-color: var(--accent);
		color: var(--ink);
		background: var(--accent-soft);
	}
	.filters select {
		border: 0;
		background: transparent;
		font: inherit;
		font-size: 0.68rem;
		color: var(--ink);
	}
	.mega-gem {
		position: relative;
		display: inline-block;
		width: 1.15rem;
		height: 1.15rem;
		transform: rotate(45deg);
		border-radius: 0.25rem;
		background: var(--mega);
		color: white;
		font-size: 0;
	}
	.mega-gem:after {
		content: 'M';
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%) rotate(-45deg) translateY(1px);
		font-size: 0.61rem;
		line-height: 1;
	}
	.results-meta {
		display: flex;
		justify-content: space-between;
		margin: 0.75rem 0;
		color: var(--muted);
		font-size: 0.65rem;
	}
	.results-meta p {
		margin: 0;
	}
	.table-scroll {
		overflow-x: auto;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--paper);
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.72rem;
	}
	thead th {
		position: sticky;
		top: 0;
		z-index: 1;
		text-align: left;
		padding: 0.6rem 0.75rem;
		background: var(--surface);
		border-bottom: 1px solid var(--line);
		font-size: 0.62rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--muted);
		white-space: nowrap;
	}
	tbody tr {
		border-bottom: 1px solid var(--line);
		cursor: pointer;
	}
	tbody tr:last-child {
		border-bottom: 0;
	}
	tbody tr:hover,
	tbody tr:focus-visible {
		background: var(--soft);
	}
	td {
		padding: 0.5rem 0.75rem;
		vertical-align: middle;
		white-space: nowrap;
	}
	td small {
		display: block;
		margin-top: 0.1rem;
		color: var(--muted);
		font-weight: 700;
	}
	.position {
		font-family: var(--font-display);
		font-weight: 800;
	}
	.identity {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--ink);
		text-decoration: none;
		font-weight: 700;
	}
	.identity img {
		width: 2.1rem;
		height: 2.1rem;
		object-fit: contain;
	}
	.mega-marker {
		display: inline-flex;
		width: 0.9rem;
		height: 0.9rem;
		margin-left: 0.3rem;
		transform: rotate(45deg);
		border-radius: 0.2rem;
		background: var(--mega);
		color: white;
		font-size: 0;
		align-items: center;
		justify-content: center;
	}
	.mega-marker:before {
		content: 'M';
		font-size: 0.55rem;
		transform: rotate(-45deg);
	}
	.types {
		display: flex;
		gap: 0.25rem;
	}
	.spread {
		white-space: normal;
		min-width: 12rem;
	}
	.mega-cell.known {
		color: var(--mega);
		font-weight: 800;
	}
	.state-card {
		min-height: 24rem;
		display: grid;
		place-items: center;
		align-content: center;
		text-align: center;
		color: var(--muted);
	}
	.state-card :global(svg) {
		color: var(--accent);
	}
	.state-card h2 {
		margin: 0.7rem 0 0.2rem;
		font-family: var(--font-display);
		color: var(--ink);
	}
	.state-card p {
		margin: 0;
		font-size: 0.75rem;
	}
	.state-card button {
		margin-top: 1rem;
		border: 0;
		border-radius: 0.6rem;
		padding: 0.65rem 1rem;
		background: var(--ink);
		color: var(--surface);
		font: inherit;
		font-weight: 800;
	}
	.state-card.error :global(svg) {
		color: var(--danger);
	}
	:global(.spin) {
		animation: spin 1s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	@media (max-width: 900px) {
		.explore-toolbar {
			display: grid;
		}
		.search {
			width: auto;
		}
		.filters {
			overflow: auto;
		}
	}
</style>
