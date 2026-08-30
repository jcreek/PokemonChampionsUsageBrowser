import type { StatPoints } from './types';

export type StatKey = keyof StatPoints;

export type NatureEffect = { plus: StatKey | null; minus: StatKey | null };

/** The five stats a nature can raise or lower — HP is never affected by nature. */
export const NATURE_STATS: Exclude<StatKey, 'hp'>[] = [
	'attack',
	'defense',
	'spAttack',
	'spDefense',
	'speed'
];

// Rows are the raised stat, columns are the lowered stat — matches the conventional nature
// chart. The diagonal (raised === lowered) cancels out to a neutral nature. HP is never
// affected by nature, so it has no row or column here.
export const NATURE_GRID: Record<Exclude<StatKey, 'hp'>, Record<Exclude<StatKey, 'hp'>, string>> = {
	attack: {
		attack: 'Hardy',
		defense: 'Lonely',
		spAttack: 'Adamant',
		spDefense: 'Naughty',
		speed: 'Brave'
	},
	defense: {
		attack: 'Bold',
		defense: 'Docile',
		spAttack: 'Impish',
		spDefense: 'Lax',
		speed: 'Relaxed'
	},
	spAttack: {
		attack: 'Modest',
		defense: 'Mild',
		spAttack: 'Bashful',
		spDefense: 'Rash',
		speed: 'Quiet'
	},
	spDefense: {
		attack: 'Calm',
		defense: 'Gentle',
		spAttack: 'Careful',
		spDefense: 'Quirky',
		speed: 'Sassy'
	},
	speed: {
		attack: 'Timid',
		defense: 'Hasty',
		spAttack: 'Jolly',
		spDefense: 'Naive',
		speed: 'Serious'
	}
};

export const NATURE_EFFECTS: Record<string, NatureEffect> = (() => {
	const table: Record<string, NatureEffect> = {};
	for (const plus of NATURE_STATS) {
		for (const minus of NATURE_STATS) {
			const name = NATURE_GRID[plus][minus];
			table[name] = plus === minus ? { plus: null, minus: null } : { plus, minus };
		}
	}
	return table;
})();

export function natureEffect(name: string): NatureEffect {
	return NATURE_EFFECTS[name] ?? { plus: null, minus: null };
}

const LEVEL = 50;
const IV = 31;

export type StatBreakdown = {
	/** Stat value at level 50, 31 IVs, no EVs, neutral nature. */
	base: number;
	/** How much the assigned EVs (converted from stat points) add on top of `base`. */
	evBonus: number;
	/** How much the nature adds (or removes) once EVs are already applied. */
	natureBonus: number;
	/** base + evBonus + natureBonus. */
	total: number;
};

function statAt(base: number, statKey: StatKey, ev: number, multiplier: number): number {
	const core = Math.floor(((2 * base + IV + Math.floor(ev / 4)) * LEVEL) / 100);
	return statKey === 'hp' ? core + LEVEL + 10 : Math.floor((core + 5) * multiplier);
}

/**
 * Splits a stat's final value into how much came from the base stat, from allocated EVs, and
 * from the nature — so the UI can render it as stacked, differently-coloured bar segments
 * instead of a single opaque number. `ev` is Showdown-scale EVs (0-252), not raw stat points.
 */
export function statBreakdown(
	base: number,
	statKey: StatKey,
	ev: number,
	nature: string
): StatBreakdown {
	const effect = natureEffect(nature);
	const multiplier = effect.plus === statKey ? 1.1 : effect.minus === statKey ? 0.9 : 1;
	const baseOnly = statAt(base, statKey, 0, 1);
	const withEv = statAt(base, statKey, ev, 1);
	const total = statKey === 'hp' ? withEv : statAt(base, statKey, ev, multiplier);
	return { base: baseOnly, evBonus: withEv - baseOnly, natureBonus: total - withEv, total };
}
