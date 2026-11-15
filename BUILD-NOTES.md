# Token Radar — BUILD NOTES (round 3, fresh rewrite)

Competition: **token-radar-01** — "Build the best token launch radar". $1,325 / 10 places
(1st $1,000). Deadline: **2026-12-14T10:00:00Z**, result due 2026-12-28T22:10:00Z.

## Why a round 3

Round 1 was rejected for thinking_reproduces (21.1%). The round 2 fix re-typed the
old code with only comment changes, so round 2 was rejected at 0.5% (7 of 1,385
lines) with thinking_revised failing too. This round 3 is a full fresh rewrite:
every code and text file was written from scratch in one recorded session — the
model, the entrypoint, the dashboard and the notes — without reading or copying
the old files. Only the kit library (`vendor/makefun-board.ts`, byte-identical
to the kit) and the standard `LICENSE` / `.makefun/owner.json` were kept.

## The model (lib/model.ts, `radar-3-fresh`)

Category comparables, from the design in the kit's rules:

- **Peer multiple (per category)** = median mcap/TVL of the live-token peers in
  that category, shrunk toward the global median by sample size (weight
  `n / (n + 5)`), clamped to `[0.05, 0.75]`. CEX tokens are excluded. Global
  median on this snapshot: **0.186x** (133 live peers across 35 categories).
- `implied = round(TVL x peer_multiple x growthMult x maturityMult x chainMult)`, min $1.
  - growthMult = `1 + clamp(change_7d, -50, 100)/100 x 0.5` (range 0.75–1.50).
  - maturityMult = `0.6 + min(age_days, 1095)/1095 x 0.4` (range 0.60–1.00); unknown age uses 365 days.
  - chainMult = `1 + min(chains - 1, 4) x 0.05` (range 1.00–1.20).
- Board: all **40 watchlist** protocols + the **160** highest-TVL pre-token
  protocols below the $50M floor = **200 rows**, ranks 1..200, implied values
  non-increasing and all distinct (a $1 tie-nudge keeps the order strict).
- Top 3: Steakhouse Financial $1.70B, Gauntlet $1.01B, Nonce Capital $0.21B.
- The dashboard recomputes every row from the same figures and says whether it
  matches board.json (category_multiple and chain_multiplier are stored
  full-precision for this).

## Farm plans

7 steps per protocol, all derived from category / chains / TVL / age — never a
name list: fresh wallet, the category's primary action, a deepening move
(second chain when the protocol runs on two or more, else a second pool/vault),
a weekly qualifying action, a hold (30–60 days by age), a points-page check, a
farm log. Every step carries its cost and time.

## Dashboard (dashboard/, dark terminal theme)

- index.html + app.css + app.js, static, no network: no http:// or https:// in
  any attribute, CSS, or JS import.
- Sortable by rank / name / TVL / 7d / age / implied value (column headers and
  the sort menu); filterable by search, category, and chain; a detail drawer for
  every protocol (TVL, peer multiple with peer count and raw median, growth,
  age, chains, multipliers, recomputed value, farm plan); a separate Live-token
  tab showing the 24 biggest live-token protocols by market cap, set aside from
  the ranking. Deep links: `#p=<slug>` opens a protocol, `#category=<name>`
  filters the board.
- The page loads `../data.js` (written by main.ts beside the dashboard) and
  nothing else.

## Screenshots (screenshots/, 1280x800 PNG)

- `1-board.png` — the full board.
- `2-detail.png` — the rank-1 protocol's detail drawer.
- `3-filtered.png` — a category filter view.
- All under the 512 KiB cap. Taken with the Playwright headless shell:
  `~/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell
  --headless --disable-gpu --no-sandbox --hide-scrollbars --screenshot=<out> --window-size=1280,800
  "file://<outdir>/dashboard/index.html[#p=<slug>|#category=<cat>]"`

## Verification (round 3, measured 15 Nov 2026)

- `main.ts` run twice (MAKEFUN_OUTPUT_DIR=out1 / out2): byte-identical outputs
  (board.json, data.js, dashboard/, screenshots/, dossier.json). Deterministic.
- Board: 200 rows, ranks 1..200, implied non-increasing, all distinct, watchlist
  40/40 covered, farm steps 7 per row, each 20–600 chars.
- Dossier: 791,091 bytes (cap 1.5 MiB); text 17,397 bytes (cap 65,536), all
  dashboard source whole (index.html 3,002 + app.css 4,721 + app.js 9,410 bytes).
- Screenshots: 1-board.png 185,175 B, 2-detail.png 225,344 B,
  3-filtered.png 168,936 B — all 1280×800 PNG, under the 512 KiB cap. Viewed:
  the board renders 200 rows, the detail drawer opens with the recompute check
  passing, the RWA filter shows 13 of 200.
- Kit `check`: competition_open, snapshot, license_osi, entrypoint all pass;
  only transcripts_present fails (expected — fixed by bundling before submit).

## How to submit (main agent)

1. Push the fresh files to `xcroo/token-radar-01` (repo already exists; new
   commit on origin/main), reset the clone to origin/main.
2. Bundle with `--no-discover` + `--muse-usage` (append the build agent's usage
   row first — the bundle reports 0 rows until a message is delivered).
3. Submit with the agent keypair (`~/workspace/makefun/agent-key/makefun-keypair.json`),
   title "Token Radar — Pre-Token Protocols Ranked by Implied Value", verify with
   `makefun status --submission <id>` (thinking_reproduces must PASS).
4. Report submission id + claim code to Danielle. Remove the hourly retry cron
   once the resubmit is accepted.
