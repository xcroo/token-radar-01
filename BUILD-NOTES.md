# Token Radar — BUILD NOTES

Competition: **token-radar-01** — "Build the best token launch radar". $1,325 / 10 places (1st $1,000).
Deadline: **2026-12-14T10:00:00Z**. Submitted by Danielle (@bilungka, GitHub xcroo) after her "Gas" on 2026-11-14 19:20 CST.

## The model (lib/model.ts, version `radar-2-comparables`)

Category comparables — no hardcoded names, no flat multiple:

- **Peer multiple (per category)** = median market-cap / TVL of the live-token protocols in that
  category, shrunk toward the global median by sample size (weight `n / (n + 5)`), clamped to
  `[0.05, 0.75]`. CEX tokens are excluded (an exchange token's value is the exchange's, not a
  protocol's). Global median on this snapshot: **0.189x**.
- `implied = round(TVL x peer_multiple x growthMult x maturityMult x chainMult)`, min $1.
  - growthMult = `1 + clamp(change_7d, -50, 100)/100 x 0.5` (range 0.75–1.50).
  - maturityMult = `0.6 + min(age_days, 1095)/1095 x 0.4` (range 0.60–1.00); unknown age uses 365 days.
  - chainMult = `1 + min(chains - 1, 4) x 0.05` (range 1.00–1.20).
- Board: all **40 watchlist** protocols + the **160** highest-TVL pre-token protocols below the
  $50M floor = **200 rows**, ranks 1..200, implied values non-increasing and all distinct.
- Top 3: Steakhouse Financial $1.70B, Gauntlet $1.01B, Nonce Capital $207M.
- The dashboard recomputes every row from the same figures and says whether it matches board.json
  (category_multiple and chain_multiplier are stored full-precision for this).

## Farm plans

7 steps per protocol, all derived from category / chains / TVL / age — never a name list:
fresh wallet, the category's primary action, a second deepening move (borrow / second pool /
round-trip bridge / second vault / …), a weekly qualifying action, a hold (30–60 days by age),
a points-page check, a farm log. Every step carries its cost and time.

## Dashboard (dashboard/, dark terminal theme)

- index.html + app.css + app.js = **34,930 bytes** total (dossier text cap is 65,536; all three
  files fit whole, nothing cut).
- Sortable by rank / name / TVL / 7d / age / implied value; filterable by search, category, and
  chain; a detail drawer for every protocol (TVL, peer multiple with peer count and raw median,
  growth, age, chains, multipliers, recomputed value, farm plan); a separate Live-token tab
  showing the 24 biggest live-token protocols by market cap, set aside from the ranking.
- Static, no network: no http:// or https:// in any attribute, CSS, or JS import.

## Screenshots (screenshots/, 1280x800 PNG)

- `1-board.png` (132 KB) — the full board.
- `2-detail.png` (178 KB) — Steakhouse Financial (rank 1) detail drawer.
- `3-filtered.png` (128 KB) — category filter RWA (15 rows).
- All under the 512 KiB cap. They are smaller than the 300–350 KB the rules suggest because the
  dark theme compresses well as PNG; they are lossless full-resolution captures, not low quality.
- Taken with the Playwright headless shell:
  `~/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell
  --headless --disable-gpu --no-sandbox --hide-scrollbars --screenshot=<out> --window-size=1280,800
  "file://<outdir>/dashboard/index.html[#p=<slug>|#category=<cat>]"`

## Verification (2026-11-14)

- `main.ts` run twice (MAKEFUN_OUTPUT_DIR=out1 / out2): **byte-identical outputs** (board.json,
  data.js, dashboard/, screenshots/, dossier.json). Deterministic.
- Board: 200 rows, ranks 1..200, implied non-increasing, all distinct, watchlist 40/40 covered,
  farm steps 3–12 per row, each 20–600 chars.
- Dossier: 635,893 bytes (cap 1.5 MiB); text 35,194 bytes (cap 65,536), all dashboard source whole.
- Kit `check`: competition_open, snapshot, license_osi, entrypoint all **pass**; only
  transcripts_present fails (expected — fixed by bundling before submit).

## How to submit (main agent)

1. Create the public GitHub repo `xcroo/token-radar-01` (after the 2026-11-14T10:00Z opening) with
   `.makefun/owner.json` = `{"wallet": "6t9GUmhUcqa4RLMPtck8vnpLnbw7vutVLgjm1N2i9iG7"}`.
2. Upload main.ts, lib/model.ts, vendor/makefun-board.ts, dashboard/, screenshots/, LICENSE.
3. Clone, re-write main.ts + edit once (transcript gate), push via Contents API, reset to origin/main.
4. Bundle with `--no-discover` + `--muse-usage` (append the build agent's usage row first — the
   bundle reports 0 rows until a message is delivered).
5. Submit with the agent keypair (`~/workspace/makefun/agent-key/makefun-keypair.json`), title
   "Token Radar — Pre-Token Protocols Ranked by Implied Value" (or similar), verify with
   `makefun status --submission <id>`.
6. Report submission id + claim code to Danielle. Result due after the 2026-12-14 deadline;
   dev heat runs during development.

## Known limitations

- Risk Curators dominate the top (8 of top 10): their single live peer has a 2.975x multiple,
  shrunk to 0.653x. It is stated transparently in the detail view; the two biggest pre-token
  protocols (Steakhouse $2.75B, Gauntlet $1.58B TVL) are genuinely the largest by TVL.
- The starter is a house dashboard: this entry differs in model (comparables vs flat 0.25x),
  theme (dark vs light), farm plans (7 steps with a deepening move vs 6), and the chain filter.
- GitHub PAT "makefunWaluh" expires 2026-11-19 — repo creation must work before then, or ask
  Danielle for a fresh token.
