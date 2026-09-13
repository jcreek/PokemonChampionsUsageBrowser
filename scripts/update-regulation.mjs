import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Dex } from '@pkmn/dex';

// The script does not discover new regulations — update this block when one is announced.
const REGULATION = {
	id: 'M-C',
	startsAt: '2026-09-09T02:00:00.000Z',
	endsAt: '2026-12-02T01:59:00.000Z'
};
const NOTICE_URL =
	process.env.REGULATION_NOTICE_URL ?? 'https://champions-news.pokemon-home.com/en/page/816.html';
const ELIGIBLE_URL =
	process.env.ELIGIBLE_POKEMON_URL ??
	'https://web-view.app.pokemonchampions.jp/battle/pages/events/rs178713870219xeaaio/en/pokemon.html';
const API_URL = 'https://championsbattledata.com/api';
const OUTPUT = resolve('src/lib/data/current-regulation.json');
const MOVE_OUTPUT = resolve('src/lib/data/move-metadata.json');
const ABILITY_OUTPUT = resolve('src/lib/data/ability-metadata.json');
const ITEM_OUTPUT = resolve('src/lib/data/held-items.json');
const REPORT = resolve('artifacts/regulation-validation.md');
const dex = Dex.forGen(9);

function normalizeHeldItem(value) {
	return String(value)
		.trim()
		.replace(/^Mega niumite$/i, 'Meganiumite')
		.replace(/^Tyra nitarite$/i, 'Tyranitarite');
}

export function splitNames(value) {
	if (Array.isArray(value)) return value.flatMap(splitNames);
	if (typeof value !== 'string') return [];
	return value
		.split('|')
		.map((name) => name.trim())
		.filter(Boolean);
}

// Battle Data lists forms it hasn't mapped to Showdown as "<Species> Form <n>" with
// showdownId: null. <n> is the in-game form index (the official "-00n" formId suffix), and
// Showdown's formeOrder lists formes in that same order, so the Showdown ID is recoverable.
function parseFormName(name) {
	const match = /^(.+) Form (\d+)$/.exec(String(name ?? ''));
	return match ? { species: match[1], formIndex: Number(match[2]) } : null;
}

export function resolveFormShowdownId(name) {
	const parsed = parseFormName(name);
	if (!parsed) return null;
	const base = dex.species.get(parsed.species);
	const forme = base.exists ? base.formeOrder?.[parsed.formIndex] : undefined;
	const species = forme ? dex.species.get(forme) : undefined;
	return species?.exists ? species.id : null;
}

const hasCurrentData = (entry) =>
	(entry.battleDataCsvs ?? []).some((csv) => csv.season === 'Current');

/**
 * Fills in Showdown IDs for "Form <n>" entries. A resolved ID can collide with an older,
 * labelled entry for the same form (e.g. "Paldean Tauros Combat Breed" vs "Tauros Form 1");
 * the one still receiving Current-season data wins. If both are (upstream mislabelled one,
 * as with "Alolan Persian" vs "Persian Form 1"), neither is trusted and both are dropped.
 */
export function withResolvedShowdownIds(index) {
	const pokemon = index.pokemon.map((entry) => {
		if (entry.showdownId) return entry;
		const showdownId = resolveFormShowdownId(entry.name);
		if (!showdownId) return entry;
		const { formIndex } = parseFormName(entry.name);
		return { ...entry, showdownId, showdownIdResolved: true, formIndex };
	});
	const byId = new Map();
	for (const entry of pokemon) {
		if (!entry.showdownId) continue;
		byId.set(entry.showdownId, [...(byId.get(entry.showdownId) ?? []), entry]);
	}
	const dropped = new Set();
	const collisions = [];
	for (const [showdownId, entries] of byId) {
		if (entries.length < 2 || !entries.some((entry) => entry.showdownIdResolved)) continue;
		const current = entries.filter(hasCurrentData);
		const kept = current.length === 1 ? current[0] : null;
		collisions.push({
			showdownId,
			entries: entries.map((entry) => entry.name),
			kept: kept?.name ?? null
		});
		for (const entry of entries) if (entry !== kept) dropped.add(entry);
	}
	return {
		...index,
		pokemon: pokemon.map((entry) => (dropped.has(entry) ? { ...entry, showdownId: null } : entry)),
		collisions
	};
}

function hash(value) {
	return createHash('sha256').update(value).digest('hex');
}

function words(value) {
	const replacements = {
		alolan: 'alola',
		galarian: 'galar',
		hisuian: 'hisui',
		paldean: 'paldea',
		// Showdown's male form is the unsuffixed base ("Meowstic" / "Meowstic-F"), so "Male"
		// must contribute nothing; mapping it to "m" made "Meowstic (Male)" match "Meowstic-F".
		male: '',
		female: 'f'
	};
	const tokens = value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim()
		.split(/\s+/)
		.map((word) => replacements[word] ?? word)
		.filter((word) => word && !['form', 'forme', 'breed', 'variety'].includes(word));
	return [...new Set(tokens)].sort();
}

export function similarity(a, b) {
	const left = words(a);
	const right = words(b);
	const common = left.filter((word) => right.includes(word)).length;
	return common * 10 - Math.abs(left.length - right.length);
}

export function extractEligible(html) {
	const match = html.match(/const pokemons = (\[.*?\]);const noPrefix/s);
	if (!match) throw new Error('Official eligibility array was not found.');
	const rows = JSON.parse(match[1]);
	if (!Array.isArray(rows) || rows.length < 100)
		throw new Error(`Implausible eligible roster size: ${rows.length}.`);
	return rows.map(([formId, enabled, name]) => ({ formId, enabled, name }));
}

export function matchRoster(official, index) {
	const byNumber = new Map();
	for (const entry of index.pokemon) {
		// Entries still without a Showdown ID after withResolvedShowdownIds can't be
		// reconciled (and @pkmn/dex throws on them).
		if (!entry.showdownId) continue;
		if (
			[...byNumber.values()].some((candidates) =>
				candidates.some((candidate) => candidate.entry.showdownId === entry.showdownId)
			)
		)
			continue;
		const species = dex.species.get(entry.showdownId);
		if (!species.exists) continue;
		const candidates = byNumber.get(species.num) ?? [];
		candidates.push({ entry, species });
		byNumber.set(species.num, candidates);
	}
	const used = new Set();
	const unmatched = [];
	const eligiblePokemon = official.map((row) => {
		const number = Number(row.formId.slice(0, 4));
		const formIndex = Number(row.formId.slice(5));
		const candidates = (byNumber.get(number) ?? []).filter(
			({ entry }) => !used.has(entry.showdownId)
		);
		if (!candidates.length) {
			unmatched.push(row);
			return null;
		}
		const ranked = candidates
			.map((candidate) => ({
				...candidate,
				// A "Form <n>" entry names the same in-game form index as the official "-00n"
				// suffix — an exact match outranks any name similarity (the official name for
				// Eternal Floette is just "Floette").
				score:
					(candidate.entry.formIndex === formIndex ? 100 : 0) +
					Math.max(
						similarity(row.name, candidate.entry.name),
						similarity(row.name, candidate.species.name)
					)
			}))
			.sort((a, b) => b.score - a.score);
		if (ranked.length > 1 && ranked[0].score === ranked[1].score) {
			const base = row.formId.endsWith('-000')
				? ranked.find((candidate) => !candidate.species.forme)
				: undefined;
			if (base) ranked.unshift(ranked.splice(ranked.indexOf(base), 1)[0]);
			else throw new Error(`Ambiguous Battle Data match for ${row.formId} ${row.name}.`);
		}
		const { entry } = ranked[0];
		used.add(entry.showdownId);
		// The app joins Battle Data's index on showdownId; for IDs resolved here it has
		// nothing to join on, so record the Battle Data name it can match instead.
		return {
			formId: row.formId,
			name: row.name,
			showdownId: entry.showdownId,
			...(entry.showdownIdResolved ? { battleDataName: entry.name } : {})
		};
	});
	return { eligiblePokemon: eligiblePokemon.filter(Boolean), unmatched };
}

export function megaRules(index, eligibleIds) {
	const rules = [];
	for (const pokemon of index.pokemon) {
		if (!eligibleIds.has(pokemon.showdownId)) continue;
		const forms = pokemon.summary?.forms ?? [];
		for (const form of forms.filter((entry) => String(entry.form_kind).startsWith('Mega'))) {
			const itemNames = pokemon.summary?.battleSummary?.Current?.Doubles?.values?.held_item ?? [];
			const suffix = form.form_name.match(/ ([xyz])$/i);
			const expected = suffix ? ` ${suffix[1].toLowerCase()}` : '';
			// Mega Stones are named "<Species>ite" ("Mawilite") or "<Species>ite X"/"Y"/"Z" for
			// multi-mega species ("Charizardite X", "Absolite Z") — match on that suffix, not on
			// "ite" appearing anywhere in the name (which false-matches e.g. "White Herb").
			const looksLikeStone = (name) => {
				const lower = name.toLowerCase().trim();
				const base = expected ? lower.slice(0, -expected.length) : lower;
				return (!expected || lower.endsWith(expected)) && base.endsWith('ite');
			};
			const observed = itemNames.find(looksLikeStone) ?? '';
			const primaryKind = String(pokemon.summary?.primary?.form_kind ?? 'Base');
			if (!observed && primaryKind !== 'Base') continue;
			const stone = normalizeHeldItem(observed);
			if (!stone)
				throw new Error(`No Mega Stone mapping for ${pokemon.showdownId} ${form.form_name}.`);
			rules.push({ baseShowdownId: pokemon.showdownId, megaName: form.form_name, stone });
		}
	}
	return rules;
}

async function fetchText(url) {
	const response = await fetch(url, {
		headers: { 'user-agent': 'PokemonChampionsTeamBuilderAssistant/1.0' }
	});
	if (!response.ok) throw new Error(`${url} returned ${response.status}.`);
	return response.text();
}

async function main() {
	const [noticeHtml, eligibleHtml, apiText] = await Promise.all([
		fetchText(NOTICE_URL),
		fetchText(ELIGIBLE_URL),
		fetchText(API_URL)
	]);
	const index = withResolvedShowdownIds(JSON.parse(apiText));
	const official = extractEligible(eligibleHtml);
	const { eligiblePokemon, unmatched } = matchRoster(official, index);
	// A handful of forms Battle Data hasn't (reliably) mapped yet are left out and reported;
	// many more than that means something is wrong with the source data, so fail closed.
	if (unmatched.length > 10)
		throw new Error(`Too many official forms without a Battle Data match: ${unmatched.length}.`);
	const ids = new Set(eligiblePokemon.map((entry) => entry.showdownId));
	if (ids.size !== eligiblePokemon.length) throw new Error('Duplicate Showdown IDs were produced.');

	const sourceHashes = { notice: hash(noticeHtml), eligiblePokemon: hash(eligibleHtml) };
	let previous;
	try {
		previous = JSON.parse(await readFile(OUTPUT, 'utf8'));
	} catch {
		previous = null;
	}
	const unchangedSources =
		previous?.sourceHashes?.notice === sourceHashes.notice &&
		previous?.sourceHashes?.eligiblePokemon === sourceHashes.eligiblePokemon;
	const manifest = {
		schemaVersion: 1,
		id: REGULATION.id,
		title: `Regulation Set ${REGULATION.id}`,
		startsAt: REGULATION.startsAt,
		endsAt: REGULATION.endsAt,
		verifiedAt: unchangedSources ? previous.verifiedAt : new Date().toISOString(),
		sources: { notice: NOTICE_URL, eligiblePokemon: ELIGIBLE_URL },
		sourceHashes,
		formats: {
			Singles: { minimumTeamSize: 3, maximumTeamSize: 6, bringSize: 3 },
			Doubles: { minimumTeamSize: 4, maximumTeamSize: 6, bringSize: 4 }
		},
		rules: {
			speciesClause: true,
			itemClause: true,
			maximumMegaEvolutions: 1,
			maximumStatPointsPerStat: 32,
			maximumTotalStatPoints: 66
		},
		eligiblePokemon,
		megaEvolutions: megaRules(index, ids)
	};

	if (
		!noticeHtml.includes(`Regulation Set ${REGULATION.id}`) ||
		!noticeHtml.includes('Duplicate held items')
	) {
		throw new Error(`Required ${REGULATION.id} rule text was not found in the official notice.`);
	}
	if (manifest.megaEvolutions.length < 20)
		throw new Error(`Implausible Mega roster size: ${manifest.megaEvolutions.length}.`);

	await mkdir(dirname(OUTPUT), { recursive: true });
	await mkdir(dirname(REPORT), { recursive: true });
	await writeFile(OUTPUT, `${JSON.stringify(manifest, null, 2)}\n`);
	const moveNames = [
		...new Set(index.pokemon.flatMap((pokemon) => pokemon.learnableMoveNames ?? []))
	].sort();
	const moveMetadata = Object.fromEntries(
		moveNames.map((name) => {
			const move = dex.moves.get(name);
			return [
				name,
				{
					type: move.exists ? move.type : 'Unknown',
					category: move.exists ? move.category : 'Status',
					power: move.exists ? move.basePower : 0,
					// Showdown represents "never misses" moves (e.g. Swift, Aerial Ace) as
					// `true` rather than a percentage — normalise that to 100 here so
					// consumers can treat accuracy as a plain 0-100 number throughout.
					accuracy: move.exists ? (move.accuracy === true ? 100 : move.accuracy) : 0,
					description: move.exists
						? move.shortDesc || move.desc || 'Description unavailable.'
						: 'Description unavailable.'
				}
			];
		})
	);
	await writeFile(MOVE_OUTPUT, `${JSON.stringify(moveMetadata, null, 2)}\n`);
	const abilityNames = [
		...new Set(
			index.pokemon.flatMap((pokemon) => {
				const summary = pokemon.summary ?? {};
				return [summary.primary, ...(summary.forms ?? [])].flatMap((form) =>
					splitNames(form?.abilities)
				);
			})
		)
	].sort();
	const abilityMetadata = Object.fromEntries(
		abilityNames.map((name) => {
			const ability = dex.abilities.get(name);
			return [
				name,
				{
					description: ability.exists
						? ability.shortDesc || ability.desc || 'Description unavailable.'
						: 'Description unavailable.'
				}
			];
		})
	);
	await writeFile(ABILITY_OUTPUT, `${JSON.stringify(abilityMetadata, null, 2)}\n`);
	const heldItems = [
		...new Set(
			index.pokemon.flatMap((pokemon) =>
				['Singles', 'Doubles'].flatMap((format) =>
					(pokemon.summary?.battleSummary?.Current?.[format]?.values?.held_item ?? []).map(
						normalizeHeldItem
					)
				)
			)
		)
	].sort();
	await writeFile(ITEM_OUTPUT, `${JSON.stringify(heldItems, null, 2)}\n`);
	const unmatchedReport = unmatched.length
		? `\n## Left out: no reliable Battle Data match\n\n${unmatched.map((row) => `- ${row.formId} ${row.name}`).join('\n')}\n`
		: '';
	const collisionReport = index.collisions.length
		? `\n## Battle Data entries claiming the same form\n\n${index.collisions
				.map(
					(collision) =>
						`- ${collision.showdownId}: ${collision.entries.join(' / ')} → ${collision.kept ? `kept "${collision.kept}"` : 'both have current data, neither used'}`
				)
				.join('\n')}\n`
		: '';
	await writeFile(
		REPORT,
		`# Regulation validation\n\n- Regulation: ${manifest.id}\n- Eligible forms: ${eligiblePokemon.length} of ${official.length}\n- Mega forms: ${manifest.megaEvolutions.length}\n- Resolved moves: ${moveNames.length}\n- Resolved abilities: ${abilityNames.length}\n- Reviewed held items: ${heldItems.length}\n- Verified: ${manifest.verifiedAt}\n${unmatchedReport}${collisionReport}`
	);
	for (const row of unmatched)
		console.warn(`Left out (no reliable Battle Data match): ${row.formId} ${row.name}`);
	console.log(
		`Validated ${manifest.id}: ${eligiblePokemon.length} forms, ${manifest.megaEvolutions.length} Mega forms.`
	);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	});
}
