import { z } from 'zod';
import manifestJson from '$lib/data/current-regulation.json';
import heldItemsJson from '$lib/data/held-items.json';
import type {
	BattleFormat,
	PokemonForm,
	PokemonRecord,
	RegulationManifest,
	StatPoints,
	UsageRow,
	UsageSnapshot
} from '$lib/types';

/** A malformed showdownId is a permanent client error, not a transient upstream failure —
 *  distinguish it from every other thrown error so a caller (the API route) can map it to
 *  400 instead of a retryable 503. */
export class InvalidPokemonIdError extends Error {}

const API_ORIGIN = 'https://championsbattledata.com';
const cache = new Map<string, { value: unknown; fetchedAt: number }>();
const MAX_CACHE_ENTRIES = 260;

// getPokemon() re-derives every PokemonRecord (forms, eligibility, usage summary, …) from
// the raw index on every call, even when cachedJson() served that index from cache — memoize
// the built result per format, invalidated by the index's own dataVersion rather than a
// separate TTL, so a cache hit on the raw JSON is also a cache hit on the transform.
const pokemonCache = new Map<
	string,
	{ value: ReturnType<typeof buildPokemon>; dataVersion: string }
>();

const rowSchema = z
	.object({
		category: z.enum(['move', 'held_item', 'teammate', 'stat_alignment', 'stat_points', 'ability']),
		rank: z.coerce.number(),
		name: z.string().default(''),
		percentage_value: z.coerce.number().nullable().optional(),
		stat_up: z.string().optional(),
		stat_down: z.string().optional(),
		hp_points: z.union([z.coerce.number(), z.literal('')]).optional(),
		attack_points: z.union([z.coerce.number(), z.literal('')]).optional(),
		defense_points: z.union([z.coerce.number(), z.literal('')]).optional(),
		sp_atk_points: z.union([z.coerce.number(), z.literal('')]).optional(),
		sp_def_points: z.union([z.coerce.number(), z.literal('')]).optional(),
		speed_points: z.union([z.coerce.number(), z.literal('')]).optional()
	})
	.passthrough();

const indexSchema = z
	.object({
		generatedAt: z.string(),
		dataVersion: z.string(),
		pokemon: z.array(z.record(z.string(), z.unknown()))
	})
	.passthrough();

async function cachedJson<T>(
	path: string,
	ttlMs: number,
	schema: z.ZodType<T>
): Promise<{ value: T; stale: boolean }> {
	const now = Date.now();
	const hit = cache.get(path);
	if (hit && now - hit.fetchedAt < ttlMs) return { value: hit.value as T, stale: false };
	try {
		const response = await fetch(`${API_ORIGIN}${path}`, {
			headers: {
				accept: 'application/json',
				'user-agent': 'PokemonChampionsTeamBuilderAssistant/1.0'
			}
		});
		if (!response.ok) throw new Error(`Battle Data returned ${response.status}`);
		const value = schema.parse(await response.json());
		if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value ?? '');
		cache.set(path, { value, fetchedAt: now });
		return { value, stale: false };
	} catch (error) {
		if (hit) return { value: hit.value as T, stale: true };
		throw error;
	}
}

function stringArray(value: unknown): string[] {
	if (Array.isArray(value))
		return value.filter((entry): entry is string => typeof entry === 'string');
	if (typeof value === 'string') return value.split('|').filter(Boolean);
	return [];
}

function numberValue(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function normalizeHeldItem(value: string): string {
	return value
		.trim()
		.replace(/^Mega niumite$/i, 'Meganiumite')
		.replace(/^Tyra nitarite$/i, 'Tyranitarite');
}

function stats(value: Record<string, unknown> | undefined) {
	return {
		hp: numberValue(value?.hp),
		attack: numberValue(value?.attack ?? value?.atk),
		defense: numberValue(value?.defense ?? value?.def),
		spAttack: numberValue(value?.sp_attack ?? value?.spa),
		spDefense: numberValue(value?.sp_defense ?? value?.spd),
		speed: numberValue(value?.speed ?? value?.spe)
	};
}

function asset(path: unknown): string {
	return typeof path === 'string' && path ? `${API_ORIGIN}/${path}` : '';
}

function normalizeForm(value: Record<string, unknown>): PokemonForm {
	return {
		name: String(value.form_name ?? value.title ?? ''),
		savedName: String(value.saved_name ?? value.form_name ?? ''),
		kind: String(value.form_kind ?? 'Base'),
		types: stringArray(value.types),
		abilities: stringArray(value.abilities),
		stats: stats(value),
		sprite: asset(value.image_path)
	};
}

export async function getPokemon(format: BattleFormat) {
	const { value: index, stale } = await cachedJson('/api', 60 * 60 * 1000, indexSchema);
	const memoKey = format;
	const memoHit = pokemonCache.get(memoKey);
	if (memoHit && memoHit.dataVersion === index.dataVersion) return { ...memoHit.value, stale };
	const built = buildPokemon(index, format, stale);
	pokemonCache.set(memoKey, { value: built, dataVersion: index.dataVersion });
	return built;
}

function buildPokemon(index: z.infer<typeof indexSchema>, format: BattleFormat, stale: boolean) {
	const manifest = manifestJson as RegulationManifest;
	const eligible = new Map(manifest.eligiblePokemon.map((entry) => [entry.showdownId, entry]));
	const items = new Set<string>(heldItemsJson);
	const natures = new Set<string>();
	const pokemon: PokemonRecord[] = [];
	const seenShowdownIds = new Set<string>();

	for (const raw of index.pokemon) {
		const showdownId = typeof raw.showdownId === 'string' ? raw.showdownId : '';
		const eligibility = eligible.get(showdownId);
		if (!eligibility || seenShowdownIds.has(showdownId)) continue;
		seenShowdownIds.add(showdownId);
		const summary = (raw.summary ?? {}) as Record<string, unknown>;
		const primary = (summary.primary ?? {}) as Record<string, unknown>;
		const forms = Array.isArray(summary.forms)
			? summary.forms
					.filter(
						(entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object'
					)
					.map(normalizeForm)
			: [];
		const battleSummary = ((
			(summary.battleSummary as Record<string, unknown> | undefined)?.Current as
				Record<string, unknown> | undefined
		)?.[format] ?? {}) as Record<string, unknown>;
		const values = (battleSummary.values ?? {}) as Record<string, unknown>;
		for (const item of stringArray(values.held_item)) items.add(normalizeHeldItem(item));
		for (const nature of stringArray(values.stat_alignment)) natures.add(nature);
		const top = (battleSummary.top ?? {}) as Record<string, Record<string, unknown>>;
		const topItem = top.held_item;
		const topMove = top.move;
		const topAbility = normalizeTopEntry(top.ability, 'ability');
		const topNature = normalizeTopEntry(top.stat_alignment, 'stat_alignment');
		const topTeammate = normalizeTopEntry(top.teammate, 'teammate');
		const topSpread = normalizeTopEntry(top.stat_points, 'stat_points');
		const baseForm = normalizeForm(primary);
		const allowedMegaNames = new Set(
			manifest.megaEvolutions
				.filter((rule) => rule.baseShowdownId === showdownId)
				.map((rule) => rule.megaName)
		);
		const allowedMegaStones = new Set(
			manifest.megaEvolutions
				.filter((rule) => rule.baseShowdownId === showdownId)
				.map((rule) => rule.stone)
		);
		const normalizedTopItem =
			typeof topItem?.name === 'string' ? normalizeHeldItem(topItem.name) : null;
		const rankedItems = stringArray(values.held_item).map(normalizeHeldItem);
		const stoneRankIndex = rankedItems.findIndex((item) => allowedMegaStones.has(item));
		const record: PokemonRecord = {
			name: String(raw.name ?? eligibility.name),
			battleName: String(raw.battleName ?? raw.name ?? eligibility.name),
			showdownId,
			speciesNumber: Number(eligibility.formId.slice(0, 4)) || null,
			sprite: asset(summary.sprite ?? primary.image_path),
			types: baseForm.types,
			abilities: baseForm.abilities,
			stats: baseForm.stats,
			forms,
			megaForms: forms.filter(
				(form) => form.kind.startsWith('Mega') && allowedMegaNames.has(form.name)
			),
			legalMoves: stringArray(raw.learnableMoveNames),
			usage: {
				position: typeof battleSummary.position === 'number' ? battleSummary.position : null,
				topMove: typeof topMove?.name === 'string' ? topMove.name : null,
				topMovePct: typeof topMove?.percentage_value === 'number' ? topMove.percentage_value : null,
				topItem: normalizedTopItem,
				topItemPct: typeof topItem?.percentage_value === 'number' ? topItem.percentage_value : null,
				topAbility: topAbility.name,
				topAbilityPct: topAbility.percentage,
				topNature: topNature.name,
				topNaturePct: topNature.percentage,
				topTeammate: topTeammate.name,
				topTeammatePct: topTeammate.percentage,
				topSpread: topSpread.points,
				megaStoneUsage:
					typeof topItem?.percentage_value === 'number' &&
					normalizedTopItem !== null &&
					allowedMegaStones.has(normalizedTopItem)
						? topItem.percentage_value
						: null,
				megaStoneRank: stoneRankIndex === -1 ? null : stoneRankIndex + 1
			}
		};
		pokemon.push(record);
	}
	pokemon.sort((a, b) => (a.usage.position ?? 9999) - (b.usage.position ?? 9999));
	return {
		pokemon,
		items: [...items].sort(),
		natures: [...natures].sort(),
		generatedAt: index.generatedAt,
		dataVersion: index.dataVersion,
		stale
	};
}

function pointsFromRow(row: z.infer<typeof rowSchema>): StatPoints {
	return {
		hp: Number(row.hp_points) || 0,
		attack: Number(row.attack_points) || 0,
		defense: Number(row.defense_points) || 0,
		spAttack: Number(row.sp_atk_points) || 0,
		spDefense: Number(row.sp_def_points) || 0,
		speed: Number(row.speed_points) || 0
	};
}

function normalizeRow(raw: unknown): UsageRow {
	const row = rowSchema.parse(raw);
	return {
		category: row.category,
		rank: row.rank,
		name: row.category === 'held_item' ? normalizeHeldItem(row.name) : row.name,
		percentage: row.percentage_value ?? null,
		statUp: row.stat_up || undefined,
		statDown: row.stat_down || undefined,
		points: row.category === 'stat_points' ? pointsFromRow(row) : undefined
	};
}

/**
 * The index's per-format `top` object carries the rank-1 row for every usage
 * category (same shape as a full usage row, minus `category`/`rank`) at no
 * extra network cost over the index fetch itself.
 */
function normalizeTopEntry(
	raw: unknown,
	category: 'held_item' | 'ability' | 'stat_alignment' | 'teammate' | 'stat_points'
): { name: string | null; percentage: number | null; points: StatPoints | null } {
	if (!raw || typeof raw !== 'object') return { name: null, percentage: null, points: null };
	const parsed = rowSchema.safeParse({ ...raw, category, rank: 1 });
	if (!parsed.success) return { name: null, percentage: null, points: null };
	const row = parsed.data;
	const name = row.name
		? category === 'held_item'
			? normalizeHeldItem(row.name)
			: row.name
		: null;
	return {
		name,
		percentage: row.percentage_value ?? null,
		points: category === 'stat_points' ? pointsFromRow(row) : null
	};
}

/** Parses the battle-data API's "DD_MM_YYYY" daily-folder date into a comparable
 *  timestamp, or NaN if it doesn't match — callers must handle NaN explicitly rather
 *  than let it silently poison a sort (NaN comparisons are neither < nor >). */
function parseDailyDate(value: string): number {
	const match = /^(\d{2})_(\d{2})_(\d{4})$/.exec(value);
	if (!match) return NaN;
	const [, day, month, year] = match;
	return Date.UTC(Number(year), Number(month) - 1, Number(day));
}

export async function getUsage(
	showdownId: string,
	format: BattleFormat,
	days: number
): Promise<UsageSnapshot> {
	const safeId = showdownId.toLowerCase().replace(/[^a-z0-9]/g, '');
	if (!safeId) throw new InvalidPokemonIdError('Invalid Pokémon ID.');
	const battleSchema = z
		.object({ pokemon: z.string(), showdownId: z.string(), rows: z.array(z.unknown()) })
		.passthrough();
	const dailySchema = z
		.object({
			pokemon: z.string(),
			showdownId: z.string(),
			daily: z.array(
				z.object({ season: z.string(), date: z.string(), rows: z.array(z.unknown()) }).passthrough()
			)
		})
		.passthrough();
	const [current, recent, index] = await Promise.all([
		cachedJson(`/api/battle/${format}/${safeId}`, 60 * 60 * 1000, battleSchema),
		cachedJson(`/api/battle/${format}/${safeId}?days=${days}`, 60 * 60 * 1000, dailySchema),
		cachedJson('/api', 60 * 60 * 1000, indexSchema)
	]);
	const currentPosition = (rows: unknown[]) => {
		const parsed = rows.map(normalizeRow);
		const first = rows[0] as Record<string, unknown> | undefined;
		const rawPosition = first?.column_position ?? first?.position;
		const numericPosition = typeof rawPosition === 'number' ? rawPosition : Number(rawPosition);
		return {
			rows: parsed,
			position: Number.isFinite(numericPosition) ? numericPosition : null
		};
	};
	// The API has returned `daily` newest-first in practice, but nothing guarantees that
	// ordering — sort explicitly by the folder date so a caller reversing this for a
	// chronological (oldest→newest) trend isn't relying on unverified upstream order.
	// An unparseable date sorts last rather than corrupting the rest of the ordering.
	const sortedDaily = [...recent.value.daily].sort((a, b) => {
		const diff = parseDailyDate(b.date) - parseDailyDate(a.date);
		return Number.isNaN(diff) ? 0 : diff;
	});
	return {
		pokemon: current.value.pokemon,
		showdownId: current.value.showdownId,
		format,
		generatedAt: index.value.generatedAt,
		stale: current.stale || recent.stale || index.stale,
		current: current.value.rows.map(normalizeRow),
		daily: sortedDaily.map((day) => ({
			season: day.season,
			date: day.date,
			...currentPosition(day.rows)
		}))
	};
}
