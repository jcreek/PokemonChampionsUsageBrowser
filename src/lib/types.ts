export type BattleFormat = 'Singles' | 'Doubles';

export type BaseStats = {
	hp: number;
	attack: number;
	defense: number;
	spAttack: number;
	spDefense: number;
	speed: number;
};

export type PokemonForm = {
	name: string;
	savedName: string;
	kind: string;
	types: string[];
	abilities: string[];
	stats: BaseStats;
	sprite: string;
};

export type UsageSummary = {
	position: number | null;
	topMove: string | null;
	topMovePct: number | null;
	topItem: string | null;
	topItemPct: number | null;
	topAbility: string | null;
	topAbilityPct: number | null;
	topNature: string | null;
	topNaturePct: number | null;
	topTeammate: string | null;
	topTeammatePct: number | null;
	topSpread: StatPoints | null;
	/** Percentage usage of the Mega Stone specifically, only known when it's the single
	 *  most-used held item (the bulk index exposes a percentage for rank 1 only). */
	megaStoneUsage: number | null;
	/** 1-based rank of the Mega Stone among this Pokémon's observed held items, even when
	 *  it isn't #1 (and so `megaStoneUsage` is null) — lets a "used, just not top" state be
	 *  told apart from "not observed at all" instead of both rendering as no data. */
	megaStoneRank: number | null;
};

export type PokemonRecord = {
	name: string;
	battleName: string;
	showdownId: string;
	speciesNumber: number | null;
	sprite: string;
	types: string[];
	abilities: string[];
	stats: BaseStats;
	forms: PokemonForm[];
	megaForms: PokemonForm[];
	legalMoves: string[];
	usage: UsageSummary;
};

export type UsageRow = {
	category: 'move' | 'held_item' | 'teammate' | 'stat_alignment' | 'stat_points' | 'ability';
	rank: number;
	name: string;
	percentage: number | null;
	statUp?: string;
	statDown?: string;
	points?: StatPoints;
};

export type UsageDay = {
	season: string;
	date: string;
	position: number | null;
	rows: UsageRow[];
};

export type UsageSnapshot = {
	pokemon: string;
	showdownId: string;
	format: BattleFormat;
	generatedAt: string;
	stale: boolean;
	current: UsageRow[];
	daily: UsageDay[];
};

export type EligiblePokemon = {
	formId: string;
	name: string;
	showdownId: string;
	/** Set when Battle Data's index has no showdownId for this form — the index entry's
	 *  name to join on instead (see resolveFormShowdownId in scripts/update-regulation.mjs). */
	battleDataName?: string;
};

export type MegaEvolutionRule = {
	baseShowdownId: string;
	megaName: string;
	stone: string;
};

export type RegulationManifest = {
	schemaVersion: 1;
	id: string;
	title: string;
	startsAt: string;
	endsAt: string;
	verifiedAt: string;
	sources: { notice: string; eligiblePokemon: string };
	sourceHashes: { notice: string; eligiblePokemon: string };
	formats: Record<
		BattleFormat,
		{ minimumTeamSize: number; maximumTeamSize: number; bringSize: number }
	>;
	rules: {
		speciesClause: boolean;
		itemClause: boolean;
		maximumMegaEvolutions: number;
		maximumStatPointsPerStat: number;
		maximumTotalStatPoints: number;
	};
	eligiblePokemon: EligiblePokemon[];
	megaEvolutions: MegaEvolutionRule[];
};

export type StatPoints = {
	hp: number;
	attack: number;
	defense: number;
	spAttack: number;
	spDefense: number;
	speed: number;
};
