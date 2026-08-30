<script lang="ts">
	let { type, compact = false }: { type: string; compact?: boolean } = $props();
</script>

<span class:compact class="type-badge type-{type.toLowerCase()}">{type}</span>

<style>
	.type-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 4.35rem;
		padding: 0.25rem 0.55rem;
		border-radius: 999px;
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.045em;
		text-transform: uppercase;
		color: #fff;
		/* Every color below is darkened just enough to clear WCAG AA (4.5:1) for white
		   text at this badge's size — see M7 in the review. Unlisted hues (Fighting,
		   Poison, Ghost, Dragon, Dark) already passed and are left as-is. */
		background: #687685;
	}
	.compact {
		min-width: 0;
		padding: 0.17rem 0.42rem;
		font-size: 0.63rem;
	}
	.type-normal {
		background: #73766d;
	}
	.type-fire {
		background: #c74e28;
	}
	.type-water {
		background: #3a77be;
	}
	.type-electric {
		background: #91700f;
	}
	.type-grass {
		background: #498242;
	}
	.type-ice {
		background: #397e8d;
	}
	.type-fighting {
		background: #aa4138;
	}
	.type-poison {
		background: #8954a0;
	}
	.type-ground {
		background: #976d39;
	}
	.type-flying {
		background: #5c75a8;
	}
	.type-psychic {
		background: #c54871;
	}
	.type-bug {
		background: #6a7c2b;
	}
	.type-rock {
		background: #867345;
	}
	.type-ghost {
		background: #63577d;
	}
	.type-dragon {
		background: #665ab4;
	}
	.type-dark {
		background: #544b46;
	}
	.type-steel {
		background: #5e7984;
	}
	.type-fairy {
		background: #b45483;
	}
</style>
