import type { RegulationManifest } from './types';

export function regulationIsActive(manifest: RegulationManifest, now = new Date()): boolean {
	return now >= new Date(manifest.startsAt) && now < new Date(manifest.endsAt);
}
