<script lang="ts">
	import { ArrowLeft, Search } from '@lucide/svelte';
	import type { PokemonRecord } from '$lib/types';
	import { buildAbilityIndex } from '$lib/ability';
	import { TYPES } from '$lib/type-chart';
	import TypeBadge from './TypeBadge.svelte';
	import { SPRITE_FALLBACK, useSpriteFallback } from '$lib/sprite-fallback';

	let {
		pokemon,
		onselect
	}: {
		pokemon: PokemonRecord[];
		onselect: (pokemon: PokemonRecord) => void;
	} = $props();

	let selectedAbility = $state<string | null>(null);

	// Step 1 filters (the ability browser).
	let abilityQuery = $state('');

	// Step 1 sort (the ability browser).
	type SortKey = 'name' | 'holders';
	let sortKey = $state<SortKey>('name');
	let sortDir = $state<'asc' | 'desc'>('asc');

	// Step 2 filter (narrows the holders of the selected ability).
	let pokemonTypeFilter = $state('');

	// Every ability at least one roster Pokémon has (in its base or a Mega form),
	// decorated with a description and holder count.
	let abilityIndex = $derived(buildAbilityIndex(pokemon));

	const sortComparators: Record<
		SortKey,
		(a: (typeof abilityIndex)[number], b: (typeof abilityIndex)[number]) => number
	> = {
		name: (a, b) => a.name.localeCompare(b.name),
		holders: (a, b) => a.holders.length - b.holders.length
	};

	let filteredAbilities = $derived.by(() => {
		const needle = abilityQuery.toLowerCase().trim();
		const compare = sortComparators[sortKey];
		const direction = sortDir === 'asc' ? 1 : -1;
		return abilityIndex
			.filter(
				(ability) =>
					!needle ||
					ability.name.toLowerCase().includes(needle) ||
					ability.description.toLowerCase().includes(needle)
			)
			.sort((a, b) => {
				const primary = compare(a, b) * direction;
				// Break ties (e.g. equal holder count) by name so the order stays stable.
				return primary !== 0 ? primary : a.name.localeCompare(b.name);
			});
	});

	let selectedAbilityEntry = $derived(
		abilityIndex.find((ability) => ability.name === selectedAbility)
	);
	let byId = $derived(new Map(pokemon.map((entry) => [entry.showdownId, entry])));
	let holderRows = $derived.by(() => {
		if (!selectedAbilityEntry) return [];
		return selectedAbilityEntry.holders
			.map((holder) => ({ holder, entry: byId.get(holder.showdownId) }))
			.filter(
				(
					row
				): row is { holder: (typeof selectedAbilityEntry.holders)[number]; entry: PokemonRecord } =>
					Boolean(row.entry)
			)
			.filter((row) => !pokemonTypeFilter || row.entry.types.includes(pokemonTypeFilter))
			.sort((a, b) => a.entry.name.localeCompare(b.entry.name));
	});

	// If the step-1 filters change such that the selected ability no longer
	// qualifies, drop back to the ability list rather than showing a stale pick.
	$effect(() => {
		if (selectedAbility && !filteredAbilities.some((ability) => ability.name === selectedAbility)) {
			selectedAbility = null;
		}
	});

	// Drilling into an ability's detail (or back out of it) unmounts the button that was
	// clicked, which otherwise drops keyboard focus to <body> — move it to the next view's
	// first control instead (matches the same fix in MoveFinder — see M9 in the review).
	let searchInputEl: HTMLInputElement | undefined = $state();
	let backButtonEl: HTMLButtonElement | undefined = $state();
	let hasMounted = false;
	$effect(() => {
		void selectedAbility;
		if (!hasMounted) {
			hasMounted = true;
			return;
		}
		if (selectedAbility) backButtonEl?.focus();
		else searchInputEl?.focus();
	});
</script>

<section class="page-intro">
	<div>
		<p class="eyebrow">Ability lookup</p>
		<h1>Find who has an ability.</h1>
		<p>
			Browse every ability a Pokémon on the current roster can actually have — base or Mega-form —
			then pick one to see who has it, open a full profile, or add a Pokémon straight to your team.
		</p>
	</div>
</section>

{#if !selectedAbility}
	<div class="ability-finder-controls">
		<label class="search-input"
			><Search size={16} /><input
				bind:this={searchInputEl}
				bind:value={abilityQuery}
				placeholder="Search abilities by name or effect"
				aria-label="Search abilities by name or effect"
			/></label
		>
		<label class="type-select"
			>Sort by<select bind:value={sortKey} aria-label="Sort abilities by"
				><option value="name">Name</option>
				<option value="holders">Pokémon count</option></select
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
		<p><strong>{filteredAbilities.length}</strong> abilities</p>
	</div>

	{#if filteredAbilities.length}
		<ul class="ability-list">
			{#each filteredAbilities as ability (ability.name)}
				<li>
					<button class="ability-row" onclick={() => (selectedAbility = ability.name)}>
						<span class="ability-name">{ability.name}</span>
						<span class="ability-description">{ability.description}</span>
						<span class="ability-holders">{ability.holders.length} Pokémon</span>
					</button>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="empty-copy">No abilities match this search.</p>
	{/if}
{:else if selectedAbilityEntry}
	<div class="ability-detail-header">
		<button bind:this={backButtonEl} class="back-button" onclick={() => (selectedAbility = null)}
			><ArrowLeft size={16} /> Back to abilities</button
		>
		<div class="ability-detail-title">
			<h2>{selectedAbilityEntry.name}</h2>
		</div>
		<p class="ability-detail-description">{selectedAbilityEntry.description}</p>
	</div>

	<div class="ability-finder-controls">
		<label class="type-select"
			>Pokémon type<select bind:value={pokemonTypeFilter} aria-label="Filter by Pokémon type"
				><option value="">All types</option>{#each TYPES as type}<option value={type}>{type}</option
					>{/each}</select
			></label
		>
	</div>

	<div class="results-meta">
		<p><strong>{holderRows.length}</strong> matching Pokémon</p>
	</div>

	{#if holderRows.length}
		<ul class="results">
			{#each holderRows as { holder, entry } (`${entry.showdownId}:${holder.megaFormName ?? 'base'}`)}
				<li>
					<button class="row-main" onclick={() => onselect(entry)}>
						<img src={entry.sprite || SPRITE_FALLBACK} alt="" onerror={useSpriteFallback} />
						<span>
							<b
								>{entry.name}{#if holder.megaFormName}<small class="mega-tag"
										>{holder.megaFormName}</small
									>{/if}</b
							>
							<div class="types">
								{#each entry.types as type}<TypeBadge {type} compact />{/each}
							</div>
						</span>
					</button>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="empty-copy">No Pokémon on the current roster has {selectedAbilityEntry.name}.</p>
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
	.ability-finder-controls {
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
		width: min(28rem, 100%);
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
	.ability-list {
		list-style: none;
		display: grid;
		gap: 0.4rem;
		margin: 0;
		padding: 0;
	}
	.ability-list li {
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		background: var(--paper);
		box-shadow: var(--shadow);
	}
	.ability-row {
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
	.ability-name {
		flex: 0 0 auto;
		min-width: 8rem;
		font-size: 0.78rem;
		font-weight: 700;
	}
	.ability-description {
		flex: 1 1 16rem;
		min-width: 0;
		font-size: 0.68rem;
		color: var(--muted);
		line-height: 1.4;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.ability-holders {
		flex: 0 0 auto;
		margin-left: auto;
		font-size: 0.62rem;
		font-weight: 700;
		color: var(--muted);
	}
	.ability-detail-header {
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
	.ability-detail-title {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}
	.ability-detail-title h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.5rem;
		letter-spacing: -0.02em;
	}
	.ability-detail-description {
		margin: 0;
		max-width: 45rem;
		color: var(--muted);
		font-size: 0.75rem;
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
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		font-size: 0.78rem;
	}
	.mega-tag {
		font-size: 0.58rem;
		font-weight: 800;
		color: var(--mega);
		text-transform: uppercase;
		letter-spacing: 0.03em;
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
		.ability-finder-controls {
			flex-direction: column;
			align-items: stretch;
		}
		.type-select {
			justify-content: space-between;
		}
		.ability-row {
			flex-direction: column;
			align-items: flex-start;
		}
		.ability-description {
			white-space: normal;
		}
		.ability-holders {
			margin-left: 0;
		}
	}
</style>
