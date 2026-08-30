<script lang="ts">
	import {
		RefreshCw,
		TrendingDown,
		TrendingUp,
		Minus,
		AlertCircle,
		Copy,
		Check
	} from '@lucide/svelte';
	import manifestJson from '$lib/data/current-regulation.json';
	import type {
		BattleFormat,
		PokemonRecord,
		RegulationManifest,
		UsageRow,
		UsageSnapshot
	} from '$lib/types';
	import { abilityDescription } from '$lib/ability';
	import { STAT_LABELS, usageSetToShowdown } from '$lib/showdown-format';
	import TypeBadge from './TypeBadge.svelte';
	import Sparkline from './Sparkline.svelte';
	import { SPRITE_FALLBACK, useSpriteFallback } from '$lib/sprite-fallback';

	let {
		pokemon,
		usage,
		loading,
		usageError = '',
		format,
		onretry
	}: {
		pokemon: PokemonRecord;
		usage: UsageSnapshot | null;
		loading: boolean;
		usageError?: string;
		format: BattleFormat;
		onretry?: () => void;
	} = $props();

	const manifest = manifestJson as RegulationManifest;
	let copied = $state(false);
	let copyError = $state('');

	async function copyAsShowdownSet() {
		if (!usage) return;
		const megaFormName = selectedMegaStats?.name;
		const block = usageSetToShowdown(pokemon, usage, manifest, { megaFormName });
		try {
			await navigator.clipboard.writeText(block);
			copied = true;
			copyError = '';
			setTimeout(() => (copied = false), 2000);
		} catch {
			copyError = "Couldn't copy — your browser may be blocking clipboard access.";
		}
	}

	const categories: Array<{ key: UsageRow['category']; label: string }> = [
		{ key: 'move', label: 'Moves' },
		{ key: 'held_item', label: 'Held items' },
		{ key: 'ability', label: 'Abilities' },
		{ key: 'stat_alignment', label: 'Natures' },
		{ key: 'stat_points', label: 'Stat spreads' },
		{ key: 'teammate', label: 'Teammates' }
	];
	let activeCategory = $state<UsageRow['category']>('move');
	let selectedStatsForm = $state('base');

	// Reset the selected form whenever a different Pokémon is viewed, so a
	// stale mega-tab selection can't carry over across route navigations.
	$effect(() => {
		void pokemon.showdownId;
		selectedStatsForm = 'base';
		activeCategory = 'move';
	});

	let selectedMegaStats = $derived(
		pokemon.megaForms.find((form) => form.name === selectedStatsForm)
	);
	let activeForm = $derived(
		selectedMegaStats ?? { name: pokemon.name, types: pokemon.types, sprite: pokemon.sprite }
	);
	let typeChanged = $derived(
		Boolean(
			selectedMegaStats &&
			(selectedMegaStats.types.length !== pokemon.types.length ||
				selectedMegaStats.types.some((type) => !pokemon.types.includes(type)))
		)
	);
	let displayedStats = $derived(selectedMegaStats?.stats ?? pokemon.stats);

	let rows = $derived(usage?.current.filter((row) => row.category === activeCategory) ?? []);
	// getUsage() sorts `daily` newest-first explicitly (not just as an upstream-order
	// assumption) — reverse it here to get oldest→newest, left-to-right for the sparkline.
	let trend = $derived(
		usage?.daily
			.map((day) => day.position)
			.filter((value): value is number => value !== null)
			.reverse() ?? []
	);
	// Lower usage position = more usage, so a falling position number is a "declining
	// position, rising usage" trend and vice versa — direction is read off the actual data.
	let TrendIcon = $derived.by(() => {
		if (trend.length < 2) return Minus;
		const delta = trend[trend.length - 1] - trend[0];
		if (delta < 0) return TrendingDown;
		if (delta > 0) return TrendingUp;
		return Minus;
	});

	function rowName(row: UsageRow) {
		if (row.category !== 'stat_points' || !row.points) return row.name;
		const p = row.points;
		return (Object.keys(STAT_LABELS) as (keyof typeof STAT_LABELS)[])
			.map((stat) => `${STAT_LABELS[stat]} ${p[stat]}`)
			.join(' / ');
	}

	function statLabel(label: string) {
		return STAT_LABELS[label as keyof typeof STAT_LABELS] ?? label;
	}

	function statDelta(label: string, value: number) {
		return value - pokemon.stats[label as keyof typeof pokemon.stats];
	}
</script>

<div class="panel-page">
	<header>
		<div class="identity">
			<img src={activeForm.sprite || SPRITE_FALLBACK} alt="" onerror={useSpriteFallback} />
			<div>
				<p class="eyebrow">
					{format} · Usage position {pokemon.usage.position
						? `#${pokemon.usage.position}`
						: 'unranked'}
				</p>
				<h1>{activeForm.name}</h1>
				<span class="mode-pill" class:visible={Boolean(selectedMegaStats)}>Mega form selected</span>
				<div class="types">
					{#each activeForm.types as type}<TypeBadge {type} />{/each}
				</div>
			</div>
		</div>
	</header>

	<div class="panel-body">
		<section class="overview-grid">
			<div class:mega={Boolean(selectedMegaStats)} class="panel stat-panel">
				<div class="panel-heading">
					<h2>{selectedMegaStats?.name ?? 'Base'} stats</h2>
				</div>
				{#if pokemon.megaForms.length}
					<div class="stat-form-tabs" role="group" aria-label="Stats form">
						<button
							class:active={selectedStatsForm === 'base'}
							aria-pressed={selectedStatsForm === 'base'}
							onclick={() => (selectedStatsForm = 'base')}>Base</button
						>
						{#each pokemon.megaForms as form}
							<button
								class:active={selectedStatsForm === form.name}
								aria-pressed={selectedStatsForm === form.name}
								onclick={() => (selectedStatsForm = form.name)}>{form.name}</button
							>
						{/each}
					</div>
				{/if}
				{#if typeChanged}
					<p class="type-change-note">Type changes from base form</p>
				{/if}
				{#each Object.entries(displayedStats) as [label, value]}
					{@const delta = statDelta(label, Number(value))}
					<div class="stat-row">
						<span>{statLabel(label)}</span>
						<div><i style={`width:${Math.min(100, Number(value) / 2)}%`}></i></div>
						<b
							>{value}{#if selectedMegaStats && delta !== 0}<small class:negative={delta < 0}
									>{delta > 0 ? `+${delta}` : delta}</small
								>{/if}</b
						>
					</div>
				{/each}
			</div>
			<div class="panel trend-panel">
				<div class="panel-heading">
					<h2>Recent position</h2>
					<TrendIcon size={17} />
				</div>
				{#if loading}<div class="empty-compact">
						<RefreshCw size={16} class="spin" /> Loading usage trend…
					</div>
				{:else if usageError}<div class="empty-compact error">
						<AlertCircle size={16} />
						<span>Couldn't load usage data.</span>
						{#if onretry}<button class="retry" onclick={onretry}>Retry</button>{/if}
					</div>
				{:else if trend.length > 1}<Sparkline values={trend} />
					<p>Lower positions indicate greater usage. Each point is a dated snapshot.</p>
				{:else if trend.length === 1}<div class="empty-compact">
						Not enough history yet to show a trend — currently #{trend[0]}.
					</div>
				{:else}<div class="empty-compact">
						No ladder data yet for {pokemon.name} in {format}.
					</div>{/if}
			</div>
		</section>

		<section class="ability-section">
			<div class="section-title">
				<div>
					<p class="eyebrow">Form-specific effects</p>
					<h2>Abilities</h2>
				</div>
			</div>
			<div class="ability-groups">
				<article class:active={selectedStatsForm === 'base'}>
					<h3>Base form</h3>
					{#each pokemon.abilities as ability}
						<div class="ability-row">
							<strong>{ability}</strong>
							<p>{abilityDescription(ability)}</p>
						</div>
					{/each}
				</article>
				{#each pokemon.megaForms as form}
					<article class="mega-ability" class:active={selectedStatsForm === form.name}>
						<h3>{form.name}</h3>
						{#each form.abilities as ability}
							<div class="ability-row">
								<strong>{ability}</strong>
								<p>{abilityDescription(ability)}</p>
							</div>
						{/each}
					</article>
				{/each}
			</div>
		</section>

		<section class="usage-section">
			<div class="section-title">
				<div>
					<p class="eyebrow">Observed on the {format} ladder</p>
					<h2>Battle data</h2>
				</div>
				{#if usage}<span class:stale={usage.stale}
						>{usage.stale
							? 'Cached data'
							: `Updated ${new Date(usage.generatedAt).toLocaleDateString()}`}</span
					>{/if}
			</div>
			<nav class="category-tabs" aria-label="Battle data category">
				{#each categories as category}<button
						class:active={activeCategory === category.key}
						aria-pressed={activeCategory === category.key}
						onclick={() => (activeCategory = category.key)}>{category.label}</button
					>{/each}
			</nav>
			{#if loading}<div class="loading">
					<RefreshCw size={18} class="spin" /> Loading observed sets…
				</div>
			{:else if usageError}<div class="empty-compact error">
					<AlertCircle size={18} />
					<span>Couldn't load battle data for {pokemon.name}.</span>
					{#if onretry}<button class="retry" onclick={onretry}>Retry</button>{/if}
				</div>
			{:else if rows.length}
				<p class="metric-note">
					Percentages show usage share; <em>association rank</em> means this entry is ranked by co-occurrence
					rather than a usage percentage.
				</p>
				<ol class="usage-list">
					{#each rows as row}<li>
							<span class="rank">{row.rank}</span><span class="row-name">{rowName(row)}</span
							>{#if row.percentage !== null}<strong>{row.percentage.toFixed(1)}%</strong>{:else}<em
									>association rank</em
								>{/if}
						</li>{/each}
				</ol>
			{:else}<div class="empty-compact">
					No {categories.find((entry) => entry.key === activeCategory)?.label.toLowerCase()} reported
					for {pokemon.name}
					in {format}.
				</div>{/if}
		</section>

		{#if usage && usage.current.length}
			<section class="export-panel">
				<div>
					<p class="eyebrow">Handoff</p>
					<h2>Copy as a Showdown set</h2>
					<p class="export-copy">
						The current top move/item/ability/nature/spread as a Showdown-pasteable block — for use
						in a damage calculator, or as a starting point in
						<a href="https://play.pokemonshowdown.com/teambuilder" target="_blank" rel="noreferrer"
							>Showdown's Champions teambuilder</a
						>, where the team actually gets built and validated.
					</p>
					{#if copyError}<p class="copy-error"><AlertCircle size={14} /> {copyError}</p>{/if}
				</div>
				<button class="copy-button" onclick={copyAsShowdownSet}
					>{#if copied}<Check size={16} /> Copied{:else}<Copy size={16} /> Copy set{/if}</button
				>
			</section>
		{/if}
	</div>
</div>

<style>
	.panel-page {
		width: min(56rem, 100%);
		margin: 0 auto;
	}
	header {
		padding: 1.3rem 0;
	}
	.identity {
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	.identity img {
		width: 5.25rem;
		height: 5.25rem;
		object-fit: contain;
	}
	.identity h1 {
		font-family: var(--font-display);
		font-size: 2rem;
		line-height: 1;
		margin: 0.1rem 0;
	}
	.mode-pill {
		display: inline-block;
		margin: 0.4rem 0;
		font-family: var(--font-body);
		font-size: 0.6rem;
		font-weight: 800;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		border: 1px solid var(--mega);
		border-radius: 999px;
		padding: 0.25rem 0.55rem;
		color: var(--mega);
		background: color-mix(in srgb, var(--mega) 10%, var(--surface));
		visibility: hidden;
	}
	.mode-pill.visible {
		visibility: visible;
	}
	.types {
		display: flex;
		gap: 0.35rem;
		min-height: 1.35rem;
		margin-top: 0.15rem;
	}
	.eyebrow {
		margin: 0;
		color: var(--muted);
		font-size: 0.7rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.panel-body {
		padding-bottom: 2rem;
		display: grid;
		gap: 1.2rem;
	}
	.overview-grid {
		display: grid;
		grid-template-columns: 1.15fr 0.85fr;
		gap: 1rem;
	}
	.export-panel {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.5rem;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--paper);
		padding: 1.1rem 1.3rem;
	}
	.export-copy {
		max-width: 38rem;
		margin: 0.3rem 0 0;
		color: var(--muted);
		font-size: 0.72rem;
		line-height: 1.5;
	}
	.export-copy a {
		color: var(--accent-deep);
	}
	.copy-error {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin: 0.5rem 0 0;
		color: var(--danger);
		font-size: 0.68rem;
		font-weight: 700;
	}
	.copy-button {
		flex: 0 0 auto;
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		border: 0;
		border-radius: 0.65rem;
		padding: 0.7rem 1rem;
		background: var(--accent);
		color: white;
		font: inherit;
		font-size: 0.76rem;
		font-weight: 800;
		cursor: pointer;
	}
	.panel,
	.ability-section,
	.usage-section {
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--paper);
		padding: 1rem;
	}
	.ability-section {
		padding: 0;
		overflow: hidden;
	}
	.ability-groups {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
		border-top: 1px solid var(--line);
	}
	.ability-groups article {
		padding: 0.9rem 1rem;
		border-right: 1px solid var(--line);
	}
	.ability-groups article:last-child {
		border-right: 0;
	}
	.ability-groups h3 {
		margin: 0 0 0.6rem;
		font-size: 0.72rem;
		color: var(--muted);
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.ability-groups .mega-ability h3 {
		color: var(--mega);
	}
	.ability-groups article.active {
		background: color-mix(in srgb, var(--mega) 7%, transparent);
		box-shadow: inset 0 0 0 1px var(--mega);
	}
	.ability-row + .ability-row {
		margin-top: 0.7rem;
		padding-top: 0.7rem;
		border-top: 1px solid var(--line);
	}
	.ability-row strong {
		font-size: 0.78rem;
	}
	.ability-row p {
		margin: 0.2rem 0 0;
		color: var(--muted);
		font-size: 0.7rem;
		line-height: 1.45;
	}
	.panel-heading,
	.section-title {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}
	.panel h2,
	.usage-section h2 {
		margin: 0;
		font-size: 1rem;
	}
	.section-title > span {
		font-size: 0.7rem;
		color: var(--muted);
		font-weight: 700;
	}
	.stat-form-tabs {
		display: flex;
		gap: 0.3rem;
		margin: 0.65rem 0;
		overflow-x: auto;
	}
	.stat-form-tabs button {
		flex: 0 0 auto;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: var(--surface);
		padding: 0.35rem 0.55rem;
		color: var(--muted);
		font: inherit;
		font-size: 0.62rem;
		font-weight: 800;
		cursor: pointer;
	}
	.stat-form-tabs button.active {
		border-color: var(--mega);
		background: color-mix(in srgb, var(--mega) 10%, var(--surface));
		color: var(--mega);
	}
	.type-change-note {
		margin: 0 0 0.55rem;
		font-size: 0.68rem;
		font-weight: 700;
		color: var(--mega);
	}
	.metric-note {
		margin: 0;
		padding: 0.7rem 1rem 0;
		font-size: 0.68rem;
		line-height: 1.45;
		color: var(--muted);
	}
	.stat-row {
		display: grid;
		grid-template-columns: 4.2rem 1fr 2rem;
		gap: 0.55rem;
		align-items: center;
		margin-top: 0.48rem;
		font-size: 0.72rem;
	}
	.stat-row > span {
		text-transform: capitalize;
		color: var(--muted);
	}
	.stat-row > div {
		height: 0.35rem;
		border-radius: 99px;
		background: var(--soft);
		overflow: hidden;
	}
	.stat-row i {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: var(--accent);
	}
	.stat-panel.mega .stat-row i {
		background: var(--mega);
	}
	.stat-row b {
		display: flex;
		align-items: baseline;
		justify-content: flex-end;
		gap: 0.25rem;
	}
	.stat-row b small {
		color: var(--accent-deep);
		font-size: 0.68rem;
		font-weight: 700;
	}
	.stat-row b small.negative {
		color: var(--danger);
	}
	.trend-panel p {
		margin: 0.35rem 0 0;
		font-size: 0.68rem;
		line-height: 1.45;
		color: var(--muted);
	}
	.usage-section {
		padding: 0;
		overflow: hidden;
	}
	.section-title {
		padding: 1rem;
	}
	.section-title h2 {
		font-family: var(--font-display);
		font-size: 1.35rem;
	}
	.stale {
		color: var(--warning) !important;
	}
	.category-tabs {
		display: flex;
		overflow: auto;
		border-block: 1px solid var(--line);
		background: var(--surface);
	}
	.category-tabs button {
		border: 0;
		border-bottom: 2px solid transparent;
		background: transparent;
		padding: 0.72rem 0.8rem;
		white-space: nowrap;
		font: inherit;
		font-size: 0.72rem;
		font-weight: 700;
		color: var(--muted);
		cursor: pointer;
	}
	.category-tabs button.active {
		border-color: var(--accent);
		color: var(--ink);
	}
	.usage-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.usage-list li {
		display: grid;
		grid-template-columns: 2rem minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.65rem;
		padding: 0.72rem 1rem;
		border-bottom: 1px solid var(--line);
		font-size: 0.78rem;
	}
	.usage-list li:last-child {
		border: 0;
	}
	.rank {
		width: 1.55rem;
		height: 1.55rem;
		border-radius: 50%;
		background: var(--soft);
		display: grid;
		place-items: center;
		font-size: 0.65rem;
		font-weight: 800;
	}
	.row-name {
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.usage-list strong {
		color: var(--accent-deep);
		font-variant-numeric: tabular-nums;
	}
	.usage-list em {
		font-size: 0.65rem;
		color: var(--muted);
		font-style: normal;
	}
	.loading,
	.empty-compact {
		min-height: 7rem;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		color: var(--muted);
		font-size: 0.78rem;
	}
	.empty-compact.error {
		color: var(--danger);
		flex-direction: column;
		text-align: center;
	}
	.retry {
		border: 1px solid var(--danger);
		border-radius: 0.5rem;
		background: transparent;
		color: var(--danger);
		padding: 0.35rem 0.75rem;
		font: inherit;
		font-size: 0.7rem;
		font-weight: 800;
		cursor: pointer;
	}
	:global(.spin) {
		animation: spin 1s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	@media (max-width: 640px) {
		.overview-grid {
			grid-template-columns: 1fr;
		}
		.identity img {
			width: 4.25rem;
			height: 4.25rem;
		}
		.identity h1 {
			font-size: 1.55rem;
		}
		.export-panel {
			flex-direction: column;
			align-items: stretch;
		}
	}
</style>
