# Champions Usage Browser

A live usage-data browser for [Pokémon Champions](https://www.pokemonchampions.com/), built with
SvelteKit, TypeScript, and deployed to Cloudflare Workers. It exists to answer one question —
**"what's actually being used right now?"** — for the current regulation, by format (Singles /
Doubles), per Pokémon: top moves, held items, abilities, natures, stat spreads and teammates, each
with a recent trend, all backed by live data from
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
  normalizes its responses into this app's types and caches them at the edge.
- **`src/lib/data/current-regulation.json`** — the reviewed regulation manifest (eligible Pokémon,
  Mega Evolution → stone mapping, format rules) that everything else is filtered against.
- **`scripts/update-regulation.mjs`** — scrapes the official regulation notice and eligibility
  list, reconciles them against the Battle Data index, and only writes a new manifest after strict
  validation succeeds. The scheduled GitHub Actions workflow
  (`.github/workflows/regulation-update.yml`) runs this and opens a pull request for human review —
  it never deploys a scraped regulation directly.

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
