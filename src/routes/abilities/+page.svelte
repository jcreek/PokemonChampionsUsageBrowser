<script lang="ts">
	import { goto } from '$app/navigation';
	import AbilityFinder from '$lib/components/AbilityFinder.svelte';
	import type { PokemonRecord } from '$lib/types';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	function openPokemon(entry: PokemonRecord) {
		goto(`/pokemon/${entry.showdownId}?format=${data.format}`);
	}
</script>

<svelte:head><title>Abilities · Champions Usage Browser</title></svelte:head>

<AbilityFinder pokemon={data.pokemon} onselect={openPokemon} />
