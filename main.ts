// Token Radar — entrypoint (program/v1, Node 22, stdlib only).
//
// Reads the sealed snapshot, builds the 200-row board with the valuation
// model in lib/model.ts, and writes everything the gate and the judge need
// into the output directory:
//   board.json    — the ranked board (rows with farm steps)
//   data.js       — the dashboard's data, loaded by dashboard/index.html
//   dashboard/    — the page (index.html + app.css + app.js)
//   screenshots/  — the three captures of the page
//   dossier.json  — buildDossier output over dashboard/ + screenshots/
//
// Usage: node main.ts [--input <snapshot.json>]
// The snapshot defaults to /input/snapshot.json; the output directory comes
// from MAKEFUN_OUTPUT_DIR and defaults to /output. Both runs must write the
// same bytes, so every step below is deterministic: fixed key order, fixed
// sort orders, no clocks, no randomness, no network.

import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-board.ts';
import { buildRadar } from './lib/model.ts';

const REPO_ROOT = dirname(fileURLToPath(import.meta.url));

function argValue(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1]! : null;
}

function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function main(): void {
  const inputPath = argValue('--input') ?? '/input/snapshot.json';
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

  const snapshot = JSON.parse(readFileSync(inputPath, 'utf8'));
  const radar = buildRadar(snapshot);

  // The board must cover the whole watchlist; refuse to ship a broken one.
  const covered = new Set(radar.rows.map((r) => r.slug));
  for (const slug of snapshot.watchlist) {
    if (!covered.has(slug)) throw new Error(`watchlist protocol missing from board: ${slug}`);
  }
  if (radar.rows.length < 100 || radar.rows.length > 4000) {
    throw new Error(`board has ${radar.rows.length} rows, outside 100..4000`);
  }
  for (const row of radar.rows) {
    if (row.farm_steps.length < 3 || row.farm_steps.length > 12) {
      throw new Error(`row ${row.slug} has ${row.farm_steps.length} farm steps, outside 3..12`);
    }
    for (const step of row.farm_steps) {
      const len = step.trim().length;
      if (len < 20 || len > 600) {
        throw new Error(`row ${row.slug} has a farm step of ${len} chars, outside 20..600`);
      }
    }
  }

  mkdirSync(outDir, { recursive: true });

  const board = {
    as_of: radar.as_of,
    floor_usd: radar.floor_usd,
    global_median_mcap_tvl: radar.global_median,
    live_peer_count: radar.live_peer_count,
    rows: radar.rows,
  };
  writeFileSync(join(outDir, 'board.json'), stableJson(board), 'utf8');

  const payload = {
    as_of: radar.as_of,
    floor_usd: radar.floor_usd,
    global_median: radar.global_median,
    rows: radar.rows,
    live: radar.live,
  };
  writeFileSync(join(outDir, 'data.js'), `window.RADAR = ${JSON.stringify(payload)};\n`, 'utf8');

  for (const dir of ['dashboard', 'screenshots']) {
    const src = join(REPO_ROOT, dir);
    if (!existsSync(src)) throw new Error(`missing ${dir}/ in the repository`);
    cpSync(src, join(outDir, dir), { recursive: true });
  }

  const dossier = buildDossier(outDir, { text_max_bytes: 65536 });
  writeFileSync(join(outDir, 'dossier.json'), dossier);

  const top = radar.rows[0]!;
  console.log(
    `token-radar: ${radar.rows.length} rows, watchlist ${snapshot.watchlist.length}/${snapshot.watchlist.length} covered, ` +
      `top ${top.name} ${top.implied_value_usd}, dossier ${dossier.length} bytes`,
  );
}

main();
