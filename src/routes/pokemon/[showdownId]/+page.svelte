<script lang="ts">
	import { ArrowLeft } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import type { BattleFormat, UsageSnapshot } from '$lib/types';
	import PokemonUsagePanel from '$lib/components/PokemonUsagePanel.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let pageEl: HTMLDivElement | undefined = $state();

	// The modal drawer this page replaced always moved focus to itself on open and closed
	// on Escape — a full page loses those for free (there's no overlay to trap focus behind,
	// but nothing else places focus either). Restore both: focus this page's content when a
	// different Pokémon loads, and let Escape return to the field the way closing the old
	// drawer did.
	$effect(() => {
		void data.pokemon.showdownId;
		pageEl?.focus();
	});

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') goto(`/?format=${data.format}`);
	}

	let usage = $state<UsageSnapshot | null>(null);
	let usageError = $state('');
	let usageLoading = $state(true);

	// A client-side nav to a different Pokémon while a request is still in flight can let
	// that earlier, slower response resolve after the newer one and overwrite it — guard
	// with a request token so only the most recently *started* request is allowed to apply.
	let requestToken = 0;

	async function loadUsage(showdownId: string, format: BattleFormat) {
		const token = ++requestToken;
		usageLoading = true;
		usageError = '';
		try {
			const response = await fetch(`/api/pokemon/${showdownId}/usage?format=${format}&days=7`);
			const body = response.ok ? await response.json() : null;
			if (token !== requestToken) return;
			if (body) usage = body;
			else usageError = 'The battle-data service did not respond.';
		} catch {
			if (token !== requestToken) return;
			usageError = "You're offline, or the battle-data service is unreachable.";
		} finally {
			if (token === requestToken) usageLoading = false;
		}
	}

	$effect(() => {
		loadUsage(data.pokemon.showdownId, data.format);
	});
</script>

<svelte:head
	><title>{data.pokemon.name} · Champions Usage Browser</title><meta
		name="description"
		content={`${data.pokemon.name} usage data in ${data.format} — top moves, items, abilities, natures, spreads and teammates.`}
	/></svelte:head
>

<svelte:window onkeydown={handleKeydown} />

<div class="page" bind:this={pageEl} tabindex="-1">
	<a class="back-link" href={`/?format=${data.format}`}><ArrowLeft size={15} /> Back to the field</a
	>
	<PokemonUsagePanel
		pokemon={data.pokemon}
		{usage}
		loading={usageLoading}
		{usageError}
		format={data.format}
		onretry={() => loadUsage(data.pokemon.showdownId, data.format)}
	/>
</div>

<style>
	.page:focus-visible {
		outline: none;
	}
	.back-link {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		margin-bottom: 1rem;
		color: var(--muted);
		font-size: 0.75rem;
		font-weight: 700;
		text-decoration: none;
	}
	.back-link:hover {
		color: var(--ink);
	}
</style>
