import { describe, expect, it } from 'vitest';
import manifestJson from './data/current-regulation.json';
import { regulationIsActive } from './regulation';
import type { RegulationManifest } from './types';

const manifest = manifestJson as RegulationManifest;

describe('regulationIsActive', () => {
	// Derived from the manifest so the test doesn't need editing for every new regulation.
	it('fails closed outside the reviewed regulation dates', () => {
		const start = new Date(manifest.startsAt).getTime();
		const end = new Date(manifest.endsAt).getTime();
		expect(regulationIsActive(manifest, new Date(start))).toBe(true);
		expect(regulationIsActive(manifest, new Date(end - 1))).toBe(true);
		expect(regulationIsActive(manifest, new Date(start - 1))).toBe(false);
		expect(regulationIsActive(manifest, new Date(end))).toBe(false);
	});
});
