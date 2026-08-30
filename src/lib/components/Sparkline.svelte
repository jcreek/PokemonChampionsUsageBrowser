<script lang="ts">
	let { values = [], label = 'Usage position trend' }: { values: number[]; label?: string } =
		$props();
	const width = 164;
	const height = 46;
	let min = $derived(values.length ? Math.min(...values) : 0);
	let max = $derived(values.length ? Math.max(...values) : 0);
	let points = $derived.by(() => {
		if (values.length < 2) return '';
		const range = Math.max(1, max - min);
		return values
			.map(
				(value, index) =>
					`${(index / (values.length - 1)) * width},${5 + ((value - min) / range) * (height - 10)}`
			)
			.join(' ');
	});
</script>

<svg viewBox="0 0 {width} {height}" role="img" aria-label={`${label}: ${values.join(', ')}`}>
	<line x1="0" y1={height - 1} x2={width} y2={height - 1}></line>
	{#if points}<polyline {points}></polyline>{/if}
</svg>
{#if values.length > 1}
	<div class="axis">
		<span>#{values[0]}</span>
		<span class="range">low #{min} · high #{max}</span>
		<span>#{values[values.length - 1]}</span>
	</div>
{/if}

<style>
	svg {
		width: 100%;
		height: 2.9rem;
		overflow: visible;
	}
	line {
		stroke: var(--line);
		stroke-width: 1;
	}
	polyline {
		fill: none;
		stroke: var(--accent);
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-width: 2.5;
		vector-effect: non-scaling-stroke;
	}
	.axis {
		display: flex;
		justify-content: space-between;
		margin-top: 0.2rem;
		font-size: 0.62rem;
		font-variant-numeric: tabular-nums;
		color: var(--muted);
	}
	.axis .range {
		color: var(--muted);
	}
</style>
