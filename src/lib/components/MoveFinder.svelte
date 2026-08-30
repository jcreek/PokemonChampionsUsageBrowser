<script lang="ts">
	import { ArrowLeft, Search } from '@lucide/svelte';
	import type { PokemonRecord } from '$lib/types';
	import { buildMoveIndex, moveDetails, TYPES } from '$lib/type-chart';
	import TypeBadge from './TypeBadge.svelte';
	import { SPRITE_FALLBACK, useSpriteFallback } from '$lib/sprite-fallback';

	let {
		pokemon,
		onselect
	}: {
		pokemon: PokemonRecord[];
		onselect: (pokemon: PokemonRecord) => void;
	} = $props();

	let selectedMove = $state<string | null>(null);

	// Step 1 filters (the move browser).
	let moveQuery = $state('');
	let moveTypeFilter = $state('');
	let moveCategoryFilter = $state('');
	let spreadOnly = $state(false);

	// Step 1 sort (the move browser).
	type SortKey = 'name' | 'power' | 'accuracy' | 'type';
	let sortKey = $state<SortKey>('name');
	let sortDir = $state<'asc' | 'desc'>('asc');

	// Step 2 filter (narrows the learners of the selected move).
	let pokemonTypeFilter = $state('');

	// Every move at least one roster Pokémon can learn, decorated with battle
	// metadata and a learner count.
	let moveIndex = $derived(buildMoveIndex(pokemon));

	const sortComparators: Record<
		SortKey,
		(a: (typeof moveIndex)[number], b: (typeof moveIndex)[number]) => number
	> = {
		name: (a, b) => a.name.localeCompare(b.name),
		power: (a, b) => a.power - b.power,
		accuracy: (a, b) => a.accuracy - b.accuracy,
		type: (a, b) => a.type.localeCompare(b.type)
	};

	let filteredMoves = $derived.by(() => {
		const needle = moveQuery.toLowerCase().trim();
		const compare = sortComparators[sortKey];
		const direction = sortDir === 'asc' ? 1 : -1;
		return moveIndex
			.filter((move) => !moveTypeFilter || move.type === moveTypeFilter)
			.filter((move) => !moveCategoryFilter || move.category === moveCategoryFilter)
			.filter((move) => !spreadOnly || move.spread)
			.filter((move) => !needle || move.name.toLowerCase().includes(needle))
			.sort((a, b) => {
				const primary = compare(a, b) * direction;
				// Break ties (e.g. equal power, equal type) by name so the order stays stable.
				return primary !== 0 ? primary : a.name.localeCompare(b.name);
			});
	});

	let learners = $derived.by(() =>
		selectedMove
			? pokemon
					.filter((entry) => entry.legalMoves.includes(selectedMove!))
					.filter((entry) => !pokemonTypeFilter || entry.types.includes(pokemonTypeFilter))
			: []
	);

	// If the step-1 filters change such that the selected move no longer
	// qualifies, drop back to the move list rather than showing a stale pick.
	$effect(() => {
		if (selectedMove && !filteredMoves.some((move) => move.name === selectedMove)) {
			selectedMove = null;
		}
	});

	// Drilling into a move's detail (or back out of it) unmounts the button that was
	// clicked, which otherwise drops keyboard focus to <body> — move it to the next
	// view's first control instead (see M9 in the review).
	let searchInputEl: HTMLInputElement | undefined = $state();
	let backButtonEl: HTMLButtonElement | undefined = $state();
	let hasMounted = false;
	$effect(() => {
		void selectedMove;
		if (!hasMounted) {
			hasMounted = true;
			return;
		}
		if (selectedMove) backButtonEl?.focus();
		else searchInputEl?.focus();
	});
</script>

<section class="page-intro">
	<div>
		<p class="eyebrow">Learnset lookup</p>
		<h1>Find who can learn a move.</h1>
		<p>
			Browse every move a Pokémon on the current roster can actually learn, then pick one to see who
			learns it, open a full profile, or add a Pokémon straight to your team.
		</p>
	</div>
</section>

{#if !selectedMove}
	<div class="move-finder-controls">
		<label class="search-input"
			><Search size={16} /><input
				bind:this={searchInputEl}
				bind:value={moveQuery}
				placeholder="Search moves by name"
				aria-label="Search moves by name"
			/></label
		>
		<label class="type-select"
			>Move type<select bind:value={moveTypeFilter} aria-label="Filter by move type"
				><option value="">All types</option>{#each TYPES as type}<option value={type}>{type}</option
					>{/each}</select
			></label
		>
		<label class="type-select"
			>Category<select bind:value={moveCategoryFilter} aria-label="Filter by move category"
				><option value="">All categories</option>
				<option value="Physical">Physical</option>
				<option value="Special">Special</option>
				<option value="Status">Status</option></select
			></label
		>
		<div class="search-filters">
			<button
				class:active={spreadOnly}
				aria-pressed={spreadOnly}
				onclick={() => (spreadOnly = !spreadOnly)}>Spread moves</button
			>
		</div>
		<label class="type-select"
			>Sort by<select bind:value={sortKey} aria-label="Sort moves by"
				><option value="name">Name</option>
				<option value="power">Power</option>
				<option value="accuracy">Accuracy</option>
				<option value="type">Type</option></select
			></label
		>
		<button
			class="sort-direction"
			aria-label={sortDir === 'asc' ? 'Sort ascending' : 'Sort descending'}
			title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
			onclick={() => (sortDir = sortDir === 'asc' ? 'desc' : 'asc')}
			>{sortDir === 'asc' ? '↑ Asc' : '↓ Desc'}</button
		>
	</div>

	<div class="results-meta">
		<p><strong>{filteredMoves.length}</strong> moves</p>
	</div>

	{#if filteredMoves.length}
		<ul class="move-list">
			{#each filteredMoves as move (move.name)}
				<li>
					<button class="move-row" onclick={() => (selectedMove = move.name)}>
						<span class="move-name">{move.name}</span>
						<TypeBadge type={move.type} compact />
						<span class="move-category">{move.category}</span>
						{#if move.power}<span class="move-power">{move.power} pow</span>{/if}
						{#if move.accuracy}<span class="move-accuracy">{move.accuracy}% acc</span>{/if}
						{#if move.spread}<span class="move-spread">Spread</span>{/if}
						<span class="move-learners">{move.learners} Pokémon</span>
						<span class="move-description">{move.description}</span>
					</button>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="empty-copy">No moves match these filters.</p>
	{/if}
{:else}
	{@const details = moveDetails(selectedMove)}
	<div class="move-detail-header">
		<button bind:this={backButtonEl} class="back-button" onclick={() => (selectedMove = null)}
			><ArrowLeft size={16} /> Back to moves</button
		>
		<div class="move-detail-title">
			<h2>{selectedMove}</h2>
			<TypeBadge type={details.type} compact />
			<span>{details.category}</span>
			{#if details.power}<span>{details.power} power</span>{/if}
			{#if details.accuracy}<span>{details.accuracy}% accuracy</span>{/if}
			{#if details.spread}<span>Spread</span>{/if}
		</div>
		<p class="move-detail-description">{details.description}</p>
	</div>

	<div class="move-finder-controls">
		<label class="type-select"
			>Pokémon type<select bind:value={pokemonTypeFilter} aria-label="Filter by Pokémon type"
				><option value="">All types</option>{#each TYPES as type}<option value={type}>{type}</option
					>{/each}</select
			></label
		>
	</div>

	<div class="results-meta">
		<p><strong>{learners.length}</strong> matching Pokémon</p>
	</div>

	{#if learners.length}
		<ul class="results">
			{#each learners as entry (entry.showdownId)}
				<li>
					<button class="row-main" onclick={() => onselect(entry)}>
						<img src={entry.sprite || SPRITE_FALLBACK} alt="" onerror={useSpriteFallback} />
						<span>
							<b>{entry.name}</b>
							<div class="types">
								{#each entry.types as type}<TypeBadge {type} compact />{/each}
							</div>
						</span>
					</button>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="empty-copy">No Pokémon on the current roster can learn {selectedMove}.</p>
	{/if}
{/if}

<style>
	.page-intro {
		margin-bottom: 1.5rem;
	}
	.eyebrow {
		margin: 0 0 0.25rem;
		color: var(--accent-deep);
		font-size: 0.65rem;
		font-weight: 900;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.page-intro h1 {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(2rem, 4vw, 3.4rem);
		line-height: 1.05;
		letter-spacing: -0.035em;
	}
	.page-intro p:last-child {
		max-width: 45rem;
		margin: 0.65rem 0 0;
		color: var(--muted);
		font-size: 0.8rem;
		line-height: 1.55;
	}
	.move-finder-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.65rem;
		margin-bottom: 1rem;
	}
	.search-input {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		width: min(24rem, 100%);
		padding: 0.65rem 0.8rem;
		border: 1px solid var(--line);
		border-radius: 0.7rem;
		background: var(--paper);
		color: var(--muted);
	}
	.search-input input {
		width: 100%;
		border: 0;
		outline: 0;
		background: transparent;
		font: inherit;
		font-size: 0.76rem;
		color: var(--ink);
	}
	.type-select {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		border: 1px solid var(--line);
		border-radius: 0.65rem;
		padding: 0.5rem 0.72rem;
		background: var(--paper);
		font-size: 0.65rem;
		font-weight: 800;
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}
	.type-select select {
		border: 0;
		background: transparent;
		font: inherit;
		font-size: 0.7rem;
		font-weight: 700;
		color: var(--ink);
		text-transform: none;
		letter-spacing: 0;
	}
	.search-filters {
		display: flex;
		gap: 0.55rem;
	}
	.search-filters button {
		border: 1px solid var(--line);
		border-radius: 0.65rem;
		padding: 0.5rem 0.72rem;
		background: var(--paper);
		font: inherit;
		font-size: 0.68rem;
		font-weight: 800;
		color: var(--muted);
		cursor: pointer;
	}
	.search-filters button.active {
		border-color: var(--accent);
		color: var(--ink);
		background: var(--accent-soft);
	}
	.sort-direction {
		border: 1px solid var(--line);
		border-radius: 0.65rem;
		padding: 0.5rem 0.72rem;
		background: var(--paper);
		font: inherit;
		font-size: 0.68rem;
		font-weight: 800;
		color: var(--ink);
		cursor: pointer;
	}
	.results-meta {
		margin: 0 0 0.75rem;
		color: var(--muted);
		font-size: 0.65rem;
	}
	.results-meta p {
		margin: 0;
	}
	.move-list {
		list-style: none;
		display: grid;
		gap: 0.4rem;
		margin: 0;
		padding: 0;
	}
	.move-list li {
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		background: var(--paper);
		box-shadow: var(--shadow);
	}
	.move-row {
		display: flex;
		width: 100%;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.55rem;
		border: 0;
		background: transparent;
		padding: 0.55rem 0.7rem;
		text-align: left;
		color: var(--ink);
		cursor: pointer;
	}
	.move-name {
		flex: 1 1 auto;
		min-width: 8rem;
		font-size: 0.78rem;
		font-weight: 700;
	}
	.move-category,
	.move-power,
	.move-accuracy,
	.move-spread,
	.move-learners {
		font-size: 0.62rem;
		font-weight: 800;
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}
	.move-spread {
		color: var(--accent-deep);
	}
	.move-learners {
		margin-left: auto;
		text-transform: none;
		font-weight: 700;
	}
	.move-description {
		flex-basis: 100%;
		font-size: 0.68rem;
		font-weight: 400;
		text-transform: none;
		letter-spacing: normal;
		color: var(--muted);
	}
	.move-detail-header {
		display: grid;
		gap: 0.6rem;
		margin-bottom: 1rem;
	}
	.back-button {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		align-self: start;
		border: 1px solid var(--line);
		border-radius: 0.65rem;
		padding: 0.45rem 0.7rem;
		background: var(--paper);
		font: inherit;
		font-size: 0.68rem;
		font-weight: 800;
		color: var(--ink);
		cursor: pointer;
	}
	.move-detail-title {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}
	.move-detail-title h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.5rem;
		letter-spacing: -0.02em;
	}
	.move-detail-title span {
		font-size: 0.65rem;
		font-weight: 800;
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}
	.move-detail-description {
		margin: 0;
		color: var(--muted);
		font-size: 0.78rem;
		line-height: 1.5;
	}
	.results {
		list-style: none;
		display: grid;
		gap: 0.4rem;
		margin: 0;
		padding: 0;
	}
	.results li {
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		background: var(--paper);
		box-shadow: var(--shadow);
	}
	.row-main {
		display: grid;
		grid-template-columns: 2.4rem 1fr;
		align-items: center;
		gap: 0.65rem;
		border: 0;
		background: transparent;
		padding: 0.5rem 0.6rem;
		text-align: left;
		color: var(--ink);
		cursor: pointer;
	}
	.row-main img {
		width: 2.4rem;
		height: 2.4rem;
		object-fit: contain;
	}
	.row-main span {
		min-width: 0;
		display: grid;
		gap: 0.2rem;
	}
	.row-main b {
		font-size: 0.78rem;
	}
	.row-main .types {
		display: flex;
		gap: 0.25rem;
	}
	.empty-copy {
		margin: 0;
		color: var(--muted);
		font-size: 0.75rem;
	}
	@media (max-width: 650px) {
		.move-finder-controls {
			flex-direction: column;
			align-items: stretch;
		}
		.type-select {
			justify-content: space-between;
		}
		.move-row {
			flex-direction: column;
			align-items: flex-start;
		}
		.move-learners {
			margin-left: 0;
		}
	}
</style>
