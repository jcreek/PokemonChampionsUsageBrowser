<script lang="ts">
	import { goto } from '$app/navigation';
	import MoveFinder from '$lib/components/MoveFinder.svelte';
	import type { PokemonRecord } from '$lib/types';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	function openPokemon(entry: PokemonRecord) {
		goto(`/pokemon/${entry.showdownId}?format=${data.format}`);
	}
</script>

<svelte:head><title>Moves · Champions Usage Browser</title></svelte:head>

<MoveFinder pokemon={data.pokemon} onselect={openPokemon} />
