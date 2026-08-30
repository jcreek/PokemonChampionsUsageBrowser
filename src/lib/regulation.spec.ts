import { describe, expect, it } from 'vitest';
import manifestJson from './data/current-regulation.json';
import { regulationIsActive } from './regulation';
import type { RegulationManifest } from './types';

const manifest = manifestJson as RegulationManifest;

describe('regulationIsActive', () => {
	it('fails closed outside the reviewed regulation dates', () => {
		expect(regulationIsActive(manifest, new Date('2026-08-29T12:00:00Z'))).toBe(true);
		expect(regulationIsActive(manifest, new Date('2026-09-10T00:00:00Z'))).toBe(false);
	});
});
