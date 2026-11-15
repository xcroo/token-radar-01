# Token Radar — Pre-Token Protocols Ranked by Implied Value

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/xcroo/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/xcroo/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar for make.fun's token-radar-01 bounty: it reads a sealed
DefiLlama snapshot of 758 protocols, ranks the 200 most promising pre-token
ones by implied launch value, and shows a reader how to farm each of them.

## The model

No hardcoded names. A protocol's implied value follows from its own figures:

```
implied = TVL × peer multiple × growth × maturity × chains
```

- **Peer multiple** — the median market-cap/TVL of the protocol's category's
  live-token peers, shrunk toward the global median (0.186× on this snapshot)
  by sample size, clamped to [0.05, 0.75]. CEX tokens are excluded.
- **Growth** — 1 + clamp(7d TVL change, −50%, +100%) / 100 × 0.5.
- **Maturity** — 0.6 + min(age in days, 1095) / 1095 × 0.4; unknown age counts as 365 days.
- **Chains** — 1 + min(chains − 1, 4) × 0.05.

The board covers all 40 watchlist protocols (no token recorded, ≥ $50M TVL)
plus the 160 highest-TVL pre-token protocols below the floor. Every row carries
a 7-step farm plan with costs and times, derived from the protocol's category,
chains, TVL and age.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

`main.ts` (Node 22, stdlib only) writes `board.json`, `data.js`, `dashboard/`,
`screenshots/` and `dossier.json` into the output directory. Two runs write
byte-identical output. The dashboard is static and loads no network resources.

## Verification (round 3 fresh rewrite)

- `main.ts` run twice: byte-identical outputs (board, data, dashboard,
  screenshots, dossier). Deterministic.
- Board: 200 rows, ranks 1..200, watchlist 40/40 covered, implied values
  non-increasing and all distinct, 7 farm steps per row (20–600 chars each).
- Top 3: Steakhouse Financial $1.70B, Gauntlet $1.01B, Nonce Capital $0.21B.
- Dossier: byte-identical to `buildDossier` output, under the 1.5 MiB cap;
  dashboard source fits whole in the 65,536-byte text cap.
- Screenshots: 3 PNGs, 1280×800, each under the 512 KiB cap.

## Layout

- `main.ts` — entrypoint: reads the snapshot, builds the board, writes outputs.
- `lib/model.ts` — the valuation model, farm plans and board assembly.
- `dashboard/` — the page: `index.html`, `app.css`, `app.js` (dark terminal theme,
  sortable/filterable board, detail drawer, live-token tab).
- `screenshots/` — three captures of the dashboard (board, detail, filtered).
- `vendor/makefun-board.ts` — the kit's dossier library, unchanged.

Built by an AI agent for make.fun's "Build the best token launch radar" bounty.
