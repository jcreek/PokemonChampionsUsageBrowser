import { describe, expect, it } from 'vitest';
import { NATURE_EFFECTS, NATURE_GRID, natureEffect, statBreakdown } from './nature';

describe('nature grid', () => {
	it('matches the conventional nature chart', () => {
		expect(NATURE_GRID.attack.defense).toBe('Lonely');
		expect(NATURE_GRID.speed.spAttack).toBe('Jolly');
		expect(NATURE_GRID.spDefense.attack).toBe('Calm');
	});

	it('cancels out on the diagonal to a neutral nature', () => {
		expect(natureEffect('Hardy')).toEqual({ plus: null, minus: null });
		expect(natureEffect('Serious')).toEqual({ plus: null, minus: null });
	});

	it('reports the raised and lowered stat for a directional nature', () => {
		expect(natureEffect('Adamant')).toEqual({ plus: 'attack', minus: 'spAttack' });
	});

	it('falls back to neutral for an unrecognised name', () => {
		expect(natureEffect('')).toEqual({ plus: null, minus: null });
	});

	it('covers all 25 natures with no duplicates', () => {
		expect(Object.keys(NATURE_EFFECTS)).toHaveLength(25);
	});
});

describe('statBreakdown', () => {
	it('reconciles base + evBonus + natureBonus back to the total', () => {
		const breakdown = statBreakdown(100, 'attack', 252, 'Adamant');
		expect(breakdown.base + breakdown.evBonus + breakdown.natureBonus).toBe(breakdown.total);
	});

	it('gives HP no nature bonus', () => {
		const breakdown = statBreakdown(100, 'hp', 252, 'Adamant');
		expect(breakdown.natureBonus).toBe(0);
	});

	it('boosts an increased stat and shows a positive nature bonus', () => {
		const boosted = statBreakdown(100, 'attack', 0, 'Adamant');
		const neutral = statBreakdown(100, 'attack', 0, 'Hardy');
		expect(boosted.natureBonus).toBeGreaterThan(0);
		expect(boosted.total).toBeGreaterThan(neutral.total);
	});

	it('lowers a decreased stat and shows a negative nature bonus', () => {
		const lowered = statBreakdown(100, 'spAttack', 0, 'Adamant');
		const neutral = statBreakdown(100, 'spAttack', 0, 'Hardy');
		expect(lowered.natureBonus).toBeLessThan(0);
		expect(lowered.total).toBeLessThan(neutral.total);
	});
});
