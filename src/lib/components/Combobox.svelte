<script lang="ts">
	import { ChevronDown } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import type { ComboboxOption } from '$lib/combobox-types';

	let {
		options,
		value,
		placeholder = 'Search…',
		emptyLabel = 'No matches',
		ariaLabel,
		disabled = false,
		onselect,
		optionSnippet
	}: {
		options: ComboboxOption[];
		value: string;
		placeholder?: string;
		emptyLabel?: string;
		ariaLabel: string;
		disabled?: boolean;
		onselect: (key: string) => void;
		optionSnippet?: Snippet<[ComboboxOption]>;
	} = $props();

	let open = $state(false);
	let query = $state('');
	let activeIndex = $state(0);
	let inputEl: HTMLInputElement | undefined;
	let listEl: HTMLUListElement | undefined = $state();
	const listboxId = `combobox-${Math.random().toString(36).slice(2)}`;

	let selected = $derived(options.find((option) => option.key === value));
	let filtered = $derived.by(() => {
		const needle = query.trim().toLowerCase();
		if (!needle) return options;
		return options.filter(
			(option) =>
				option.label.toLowerCase().includes(needle) ||
				(option.searchText ?? '').toLowerCase().includes(needle)
		);
	});
	// The input shows the live search query while open, and the selected option's label once
	// closed. If `value` doesn't match anything in `options` (e.g. an imported team names a
	// move outside the current roster), fall back to the raw value instead of rendering
	// blank — indistinguishable from "nothing selected" otherwise.
	let displayValue = $derived(open ? query : (selected?.label ?? value));

	// Keep the highlighted option in view during arrow-key navigation — without this a long
	// list (the empty-slot picker lists the whole roster) scrolls the highlight off-screen.
	$effect(() => {
		if (!open) return;
		const id = `${listboxId}-${activeIndex}`;
		listEl?.querySelector(`#${CSS.escape(id)}`)?.scrollIntoView({ block: 'nearest' });
	});

	let blurTimeout: ReturnType<typeof setTimeout> | undefined;

	function openList() {
		if (disabled) return;
		// A pending deferred close from a just-preceding blur (see handleBlur) must not
		// fire after this reopen, or a quick blur-then-refocus closes the list right back.
		clearTimeout(blurTimeout);
		open = true;
		query = '';
		activeIndex = Math.max(
			0,
			filtered.findIndex((option) => option.key === value)
		);
	}

	function closeList() {
		clearTimeout(blurTimeout);
		open = false;
		query = '';
	}

	function selectOption(option: ComboboxOption) {
		onselect(option.key);
		closeList();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (disabled) return;
		if (!open) {
			if (event.key === 'ArrowDown' || event.key === 'Enter') {
				event.preventDefault();
				openList();
			}
			return;
		}
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			if (filtered.length) activeIndex = Math.min(activeIndex + 1, filtered.length - 1);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			if (filtered.length) activeIndex = Math.max(activeIndex - 1, 0);
		} else if (event.key === 'Enter') {
			event.preventDefault();
			const option = filtered[activeIndex];
			if (option) selectOption(option);
		} else if (event.key === 'Escape') {
			event.preventDefault();
			closeList();
			inputEl?.blur();
		}
	}

	function handleBlur() {
		// Defer closing so a mousedown on an option (which fires before blur/click) has a
		// chance to run selectOption first. openList() cancels this if focus returns first.
		blurTimeout = setTimeout(closeList, 120);
	}
</script>

<div class="combobox" class:disabled>
	<input
		bind:this={inputEl}
		type="text"
		role="combobox"
		aria-expanded={open}
		aria-controls={open ? listboxId : undefined}
		aria-autocomplete="list"
		aria-activedescendant={open && filtered[activeIndex]
			? `${listboxId}-${activeIndex}`
			: undefined}
		aria-label={ariaLabel}
		{disabled}
		{placeholder}
		value={displayValue}
		oninput={(event) => {
			query = event.currentTarget.value;
			open = true;
			activeIndex = 0;
		}}
		onfocus={openList}
		onblur={handleBlur}
		onkeydown={handleKeydown}
	/>
	<ChevronDown size={14} />
	{#if open}
		<ul class="combobox-list" role="listbox" id={listboxId} bind:this={listEl}>
			{#if filtered.length === 0}
				<li class="combobox-empty">{emptyLabel}</li>
			{:else}
				{#each filtered as option, index (option.key)}
					<!-- Keyboard selection is handled on the combobox input (Enter/Arrow keys),
					     per the ARIA 1.2 combobox pattern — options themselves aren't focus stops. -->
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<li
						id={`${listboxId}-${index}`}
						role="option"
						aria-selected={option.key === value}
						class:active={index === activeIndex}
						class:selected={option.key === value}
						onmousedown={(event) => event.preventDefault()}
						onclick={() => selectOption(option)}
					>
						{#if optionSnippet}{@render optionSnippet(option)}{:else}{option.label}{/if}
					</li>
				{/each}
			{/if}
		</ul>
	{/if}
</div>

<style>
	.combobox {
		position: relative;
		box-sizing: border-box;
	}
	.combobox input {
		width: 100%;
		height: 100%;
		box-sizing: border-box;
		border: 1px solid var(--line);
		border-radius: 0.65rem;
		padding: 0.58rem 1.7rem 0.58rem 0.72rem;
		background: var(--paper);
		font: inherit;
		font-size: 0.68rem;
		font-weight: 800;
		color: var(--ink);
	}
	.combobox input::placeholder {
		color: var(--muted);
		font-weight: 700;
	}
	.combobox input:focus {
		outline: none;
		border-color: var(--accent);
	}
	.combobox :global(svg) {
		position: absolute;
		right: 0.6rem;
		top: 50%;
		transform: translateY(-50%);
		pointer-events: none;
		color: var(--muted);
	}
	.combobox.disabled {
		opacity: 0.6;
	}
	.combobox-list {
		position: absolute;
		z-index: 30;
		top: calc(100% + 0.3rem);
		left: 0;
		right: 0;
		max-height: 16rem;
		overflow-y: auto;
		margin: 0;
		padding: 0.3rem;
		list-style: none;
		border: 1px solid var(--line);
		border-radius: 0.6rem;
		background: var(--paper);
		box-shadow: var(--shadow);
	}
	.combobox-list li {
		padding: 0.5rem 0.6rem;
		border-radius: 0.4rem;
		font-size: 0.75rem;
		cursor: pointer;
	}
	.combobox-list li.active {
		background: var(--soft);
	}
	.combobox-list li.selected {
		font-weight: 800;
	}
	.combobox-empty {
		color: var(--muted);
		cursor: default;
	}
</style>
