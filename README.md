# Champions Usage Browser

A usage-data browser for [Pokémon Champions](https://www.pokemonchampions.com/), built with
SvelteKit, TypeScript, and deployed as a static site to GitHub Pages. It exists to answer one
question — **"what's actually being used right now?"** — for the current regulation, by format
(Singles / Doubles), per Pokémon: top moves, held items, abilities, natures, stat spreads and
teammates, each with a recent trend, backed by data from
[Pokémon Champions Battle Data](https://championsbattledata.com/).

**This is not a team builder.** It doesn't validate, save, or export a full team, and it never has
— for actually building and validating a legal Champions team, use
[Pokémon Showdown's own Champions teambuilder](https://play.pokemonshowdown.com/teambuilder),
which already implements Champions' rules (species/item clause, stat-point caps, per-regulation
banlists) against a real battle engine. Each Pokémon's detail page here offers a "copy as Showdown
set" shortcut — the current usage data's top move/item/ability/nature/spread, formatted as a
Showdown-pasteable block — to hand off to Showdown's teambuilder from a starting point grounded in
what's actually being played.

## What's in this repo

- **`/`** — the dashboard: every regulation-eligible Pokémon for the selected format, sortable and
  filterable by name, type, and usage share.
- **`/pokemon/[showdownId]`** — a single Pokémon's usage detail: base/Mega stats, ability
  descriptions, a recent usage-position trend, and the full ranked breakdown for every usage
  category, plus the "copy as Showdown set" export.
- **`/moves`** and **`/abilities`** — reverse lookups: browse by move or ability to see which
  currently-eligible Pokémon can use it.
- **`src/lib/server/battle-data.ts`** — the only thing that talks to championsbattledata.com;
  normalizes its responses into this app's types. Since the site is a static build, this only ever
  runs at build time, from `src/routes/api/pokemon`'s prerendered routes (see below) — never in a
  visitor's browser.
- **`src/lib/data/current-regulation.json`** — the reviewed regulation manifest (eligible Pokémon,
  Mega Evolution → stone mapping, format rules) that everything else is filtered against.
- **`scripts/update-regulation.mjs`** — scrapes the official regulation notice and eligibility
  list, reconciles them against the Battle Data index, and only writes a new manifest after strict
  validation succeeds. The scheduled GitHub Actions workflow
  (`.github/workflows/regulation-update.yml`) runs this and opens a pull request for human review —
  it never deploys a scraped regulation directly.

## Deployment

The site is fully static (SvelteKit's `adapter-static`) and deploys to GitHub Pages via
`.github/workflows/deploy.yml`, which builds and publishes on every push to `main`, once daily
(`06:00 UTC`), and on manual dispatch. There's no server at runtime: the two `/api/pokemon/*`
routes that talk to championsbattledata.com are prerendered into static JSON files at build time
for every `{format, Pokémon}` combination, so "live" here means "as of the last build" — the daily
schedule is what keeps that from going stale. Deep links like `/pokemon/pikachu` work via
adapter-static's `fallback: '404.html'`: GitHub Pages serves that file (with a 404 status) for any
unmatched path, and the app — already fully client-rendered — boots from it and resolves the real
route client-side.

## Local development

```sh
npm install
npm run dev
```

Useful checks:

```sh
npm run check
npm run lint
npm run test:unit -- --run
npm run test:e2e
npm run build
```

`npm run regulation:update` runs the regulation-reconciliation script described above by hand.

## Data and attribution

Battle data is provided by [Pokémon Champions Battle Data](https://championsbattledata.com/). This
project is unofficial and is not affiliated with or endorsed by The Pokémon Company, Nintendo,
Game Freak, or Creatures.
