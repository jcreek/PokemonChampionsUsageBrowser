import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Dex } from '@pkmn/dex';

const NOTICE_URL =
	process.env.REGULATION_NOTICE_URL ?? 'https://champions-news.pokemon-home.com/en/page/776.html';
const ELIGIBLE_URL =
	process.env.ELIGIBLE_POKEMON_URL ??
	'https://web-view.app.pokemonchampions.jp/battle/pages/events/rs178066986988lmoqpm/en/pokemon.html';
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

function hash(value) {
	return createHash('sha256').update(value).digest('hex');
}

function words(value) {
	const replacements = {
		alolan: 'alola',
		galarian: 'galar',
		hisuian: 'hisui',
		paldean: 'paldea',
		male: 'm',
		female: 'f'
	};
	const tokens = value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim()
		.split(/\s+/)
		.map((word) => replacements[word] ?? word)
		.filter((word) => !['form', 'forme', 'breed', 'variety'].includes(word));
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

function matchRoster(official, index) {
	const byNumber = new Map();
	for (const entry of index.pokemon) {
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
	return official.map((row) => {
		const number = Number(row.formId.slice(0, 4));
		const candidates = (byNumber.get(number) ?? []).filter(
			({ entry }) => !used.has(entry.showdownId)
		);
		if (!candidates.length) throw new Error(`No Battle Data match for ${row.formId} ${row.name}.`);
		const ranked = candidates
			.map((candidate) => ({
				...candidate,
				score: Math.max(
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
		used.add(ranked[0].entry.showdownId);
		return { formId: row.formId, name: row.name, showdownId: ranked[0].entry.showdownId };
	});
}

export function megaRules(index, eligibleIds) {
	const rules = [];
	for (const pokemon of index.pokemon) {
		if (!eligibleIds.has(pokemon.showdownId)) continue;
		const forms = pokemon.summary?.forms ?? [];
		for (const form of forms.filter((entry) => String(entry.form_kind).startsWith('Mega'))) {
			const itemNames = pokemon.summary?.battleSummary?.Current?.Doubles?.values?.held_item ?? [];
			const expected = form.form_name.toLowerCase().includes(' x')
				? ' x'
				: form.form_name.toLowerCase().includes(' y')
					? ' y'
					: '';
			// Mega Stones are named "<Species>ite" ("Mawilite") or "<Species>ite X"/"Y" for
			// multi-mega species ("Charizardite X") — match on that suffix, not on "ite"
			// appearing anywhere in the name (which false-matches e.g. "White Herb").
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
	const index = JSON.parse(apiText);
	const official = extractEligible(eligibleHtml);
	const eligiblePokemon = matchRoster(official, index);
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
		id: 'M-B',
		title: 'Regulation Set M-B',
		startsAt: '2026-06-17T02:00:00.000Z',
		endsAt: '2026-09-09T01:59:00.000Z',
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

	if (!noticeHtml.includes('Regulation Set M-B') || !noticeHtml.includes('Duplicate held items')) {
		throw new Error('Required M-B rule text was not found in the official notice.');
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
	await writeFile(
		REPORT,
		`# Regulation validation\n\n- Regulation: ${manifest.id}\n- Eligible forms: ${eligiblePokemon.length}\n- Mega forms: ${manifest.megaEvolutions.length}\n- Resolved moves: ${moveNames.length}\n- Resolved abilities: ${abilityNames.length}\n- Reviewed held items: ${heldItems.length}\n- Verified: ${manifest.verifiedAt}\n`
	);
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
