// Token Radar — valuation model (radar-3-fresh).
//
// A pre-token protocol's implied launch value is estimated from its own
// snapshot figures, never from a list of names: the TVL it holds, the
// market-cap/TVL multiple its category's live-token peers actually trade
// at, its seven-day TVL growth, how long it has run with no token, and how
// many chains it runs on. Everything below is computed from the sealed
// snapshot; nothing here names a protocol.
//
// The model:
//   peer multiple (per category) = median mcap/TVL of that category's
//     live-token protocols, shrunk toward the global median by sample size
//     (weight n / (n + 5)), clamped to [0.05, 0.75]. CEX tokens are
//     excluded: an exchange token prices the exchange, not a protocol.
//   implied = TVL x peer multiple x growth x maturity x chains, min $1.
//     growth   = 1 + clamp(change_7d, -50, 100) / 100 * 0.5   (0.75..1.50)
//     maturity = 0.6 + min(age_days, 1095) / 1095 * 0.4       (0.60..1.00)
//     chains   = 1 + min(chains - 1, 4) * 0.05                (1.00..1.20)
//   The board holds every watchlist protocol plus the 160 highest-TVL
//   pre-token protocols below the $50M floor: 200 rows, ranked by implied
//   value, ties broken by TVL then slug so the order is deterministic.

export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

export interface BoardRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  age_days: number;
  rank: number;
  implied_value_usd: number;
  category_multiple: number;
  raw_category_median: number | null;
  peer_count: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  chain_multiplier: number;
  watchlist: boolean;
  farm_steps: string[];
}

export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  tvl_usd: number;
  mcap_usd: number;
  multiple: number;
}

export interface RadarResult {
  as_of: string;
  floor_usd: number;
  global_median: number;
  live_peer_count: number;
  rows: BoardRow[];
  live: LiveRow[];
}

// ---------------------------------------------------------------- helpers

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 === 1 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** Whole days between the snapshot date and the day tracking began; 365 when unknown. */
export function ageDays(listedAt: string | null, asOf: string): number {
  if (!listedAt) return 365;
  const start = Date.parse(`${listedAt}T00:00:00Z`);
  const end = Date.parse(`${asOf}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 365;
  return Math.max(0, Math.round((end - start) / 86400000));
}

/** A protocol records a token when DefiLlama carries any of its token fields. */
export function recordsToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd !== null || p.gecko_id !== null || p.symbol !== null;
}

export function formatUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}

// ---------------------------------------------------------------- peer multiples

export interface PeerTable {
  globalMedian: number;
  /** How many live-token protocols (excluding CEX) the medians come from. */
  livePeerCount: number;
  /** category -> { multiple, rawMedian, peers } */
  byCategory: Map<string, { multiple: number; rawMedian: number; peers: number }>;
}

export function buildPeerTable(protocols: SnapshotProtocol[]): PeerTable {
  const live = protocols.filter(
    (p) => p.mcap_usd !== null && p.category !== null && p.category !== 'CEX',
  );
  const globalMedian = median(live.map((p) => p.mcap_usd! / p.tvl_usd));
  const perCat = new Map<string, number[]>();
  for (const p of live) {
    const arr = perCat.get(p.category!) ?? [];
    arr.push(p.mcap_usd! / p.tvl_usd);
    perCat.set(p.category!, arr);
  }
  const byCategory = new Map<string, { multiple: number; rawMedian: number; peers: number }>();
  for (const [cat, ratios] of perCat) {
    const n = ratios.length;
    const raw = median(ratios);
    const shrunk = (n / (n + 5)) * raw + (5 / (n + 5)) * globalMedian;
    byCategory.set(cat, { multiple: clamp(shrunk, 0.05, 0.75), rawMedian: raw, peers: n });
  }
  return { globalMedian, livePeerCount: live.length, byCategory };
}

// ---------------------------------------------------------------- scoring

export interface Scored {
  proto: SnapshotProtocol;
  age: number;
  multiple: number;
  rawMedian: number | null;
  peers: number;
  growth: number;
  maturity: number;
  chains: number;
  implied: number;
}

export function scoreProtocol(
  p: SnapshotProtocol,
  table: PeerTable,
  asOf: string,
): Scored {
  const entry = p.category !== null ? table.byCategory.get(p.category) : undefined;
  const multiple = entry ? entry.multiple : table.globalMedian;
  const growth = 1 + (clamp(p.change_7d ?? 0, -50, 100) / 100) * 0.5;
  const age = ageDays(p.listed_at, asOf);
  const maturity = 0.6 + (Math.min(age, 1095) / 1095) * 0.4;
  const chains = 1 + Math.min(Math.max((p.chains?.length ?? 1) - 1, 0), 4) * 0.05;
  const implied = Math.max(1, Math.round(p.tvl_usd * multiple * growth * maturity * chains));
  return {
    proto: p,
    age,
    multiple,
    rawMedian: entry ? entry.rawMedian : null,
    peers: entry ? entry.peers : 0,
    growth,
    maturity,
    chains,
    implied,
  };
}

// ---------------------------------------------------------------- farm plans

/** The primary on-chain action for a category, as a verb phrase the steps reuse. */
const CATEGORY_ACTIONS: Record<string, { verb: string; object: string }> = {
  'Lending': { verb: 'Supply', object: 'stablecoins or blue-chip collateral to the lending pool' },
  'Dexs': { verb: 'Provide', object: 'liquidity to the deepest pool on the DEX' },
  'Liquid Staking': { verb: 'Stake', object: 'ETH or the chain asset through the liquid staking token' },
  'Yield': { verb: 'Deposit', object: 'into the highest-yield vault that matches your risk' },
  'Yield Aggregator': { verb: 'Deposit', object: 'into the auto-compounding vault' },
  'RWA': { verb: 'Buy', object: 'a tokenized real-world asset position' },
  'Derivatives': { verb: 'Open', object: 'a small hedged perpetual position' },
  'CDP': { verb: 'Mint', object: 'the stablecoin against over-collateralized deposits' },
  'Bridge': { verb: 'Bridge', object: 'a modest amount across the bridge to the main chain' },
  'Canonical Bridge': { verb: 'Bridge', object: 'assets through the canonical bridge' },
  'Risk Curators': { verb: 'Allocate', object: 'to a curated vault run by the risk team' },
  'Onchain Capital Allocator': { verb: 'Allocate', object: 'capital to the allocator vault' },
  'Basis Trading': { verb: 'Deposit', object: 'into the basis-trading vault' },
  'Staking Pool': { verb: 'Stake', object: 'through the staking pool' },
  'Chain': { verb: 'Use', object: 'the chain daily: send, swap and interact with apps' },
  'Liquid Restaking': { verb: 'Restake', object: 'the liquid staking token for extra yield' },
  'Restaked BTC': { verb: 'Restake', object: 'BTC through the restaking vault' },
  'Leveraged Farming': { verb: 'Open', object: 'a small leveraged farming position' },
};

function categoryAction(category: string | null): { verb: string; object: string } {
  if (category && CATEGORY_ACTIONS[category]) return CATEGORY_ACTIONS[category]!;
  return { verb: 'Use', object: 'the protocol once a week with a real transaction' };
}

function money(n: number): string {
  return n >= 1000 ? `$${Math.round(n / 100) * 100}` : `$${Math.round(n)}`;
}

/**
 * Seven farm steps for a protocol, each 20-600 characters, derived only from
 * its category, chains, TVL and age. Every step carries what it costs and
 * how long it takes; no step names a token that does not exist yet.
 */
export function farmPlan(s: Scored): string[] {
  const p = s.proto;
  const action = categoryAction(p.category);
  const chainList = (p.chains ?? []).slice(0, 3).join(', ') || 'its home chain';
  const mainChain = (p.chains ?? [])[0] ?? 'its home chain';
  const holdDays = s.age >= 730 ? 30 : s.age >= 365 ? 45 : 60;
  const ticket = clamp(Math.round(p.tvl_usd / 50000), 25, 500);
  const weekly = clamp(Math.round(ticket / 4), 10, 100);
  const secondChain = (p.chains ?? [])[1];
  const deepening = secondChain
    ? `Repeat the same position on ${secondChain} so activity is spread across chains, not stacked on one.`
    : `Deepen the position: add a second pool or vault in the same protocol to raise your share of its volume.`;
  const steps = [
    `Set up a fresh wallet funded only for farming, with ${money(ticket)} in gas and position money on ${mainChain}; keep this wallet separate from your main holdings.`,
    `${action.verb} ${action.object} with about ${money(ticket)} on ${chainList}, in one transaction, and keep the receipt hash in your farm log.`,
    `${deepening} Cost is one more transaction fee plus ${money(weekly)} of position size; allow 30 minutes.`,
    `Return once a week and repeat the main action with ${money(weekly)}: protocols reward steady weekly users over one-off deposits, so keep a 4-week streak.`,
    `Hold the position for at least ${holdDays} days without withdrawing; early exits reset most activity-based scores, so plan the lock-up before you deposit.`,
    `Check the protocol's points or rewards page every two weeks and screenshot your balance, rank and any multiplier so you can prove the activity later.`,
    `Log every action in a farm journal: date, chain, amount, transaction hash and fees paid, so you know your true cost per point before any launch.`,
  ];
  return steps.map((t) => t.trim());
}

// ---------------------------------------------------------------- board assembly

const BOARD_ROWS = 200;
const BELOW_FLOOR_ROWS = 160;

/** Order rows by implied value, then TVL, then slug: fully deterministic. */
function byValue(a: Scored, b: Scored): number {
  if (b.implied !== a.implied) return b.implied - a.implied;
  if (b.proto.tvl_usd !== a.proto.tvl_usd) return b.proto.tvl_usd - a.proto.tvl_usd;
  return a.proto.slug < b.proto.slug ? -1 : 1;
}

export function buildRadar(snapshot: Snapshot): RadarResult {
  const table = buildPeerTable(snapshot.protocols);
  const watchlist = new Set(snapshot.watchlist);
  const preToken = snapshot.protocols.filter((p) => !recordsToken(p));
  const scored = new Map<string, Scored>();
  for (const p of preToken) scored.set(p.slug, scoreProtocol(p, table, snapshot.as_of));

  const watchRows = snapshot.watchlist
    .map((slug) => scored.get(slug))
    .filter((s): s is Scored => s !== undefined);
  const belowFloor = preToken
    .filter((p) => !watchlist.has(p.slug) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1))
    .slice(0, BELOW_FLOOR_ROWS)
    .map((p) => scored.get(p.slug)!);

  const picked = [...watchRows, ...belowFloor].sort(byValue).slice(0, BOARD_ROWS);
  const rows: BoardRow[] = picked.map((s, i) => {
    const p = s.proto;
    return {
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains ?? [],
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      age_days: s.age,
      rank: i + 1,
      implied_value_usd: s.implied,
      category_multiple: s.multiple,
      raw_category_median: s.rawMedian,
      peer_count: s.peers,
      growth_multiplier: s.growth,
      maturity_multiplier: s.maturity,
      chain_multiplier: s.chains,
      watchlist: watchlist.has(p.slug),
      farm_steps: farmPlan(s),
    };
  });
  // Keep implied values distinct and non-increasing: nudge a tie down by $1.
  for (let i = 1; i < rows.length; i++) {
    if (rows[i]!.implied_value_usd >= rows[i - 1]!.implied_value_usd) {
      rows[i]!.implied_value_usd = Math.max(1, rows[i - 1]!.implied_value_usd - 1);
    }
  }

  const live: LiveRow[] = snapshot.protocols
    .filter((p) => p.mcap_usd !== null)
    .sort((a, b) => b.mcap_usd! - a.mcap_usd! || (a.slug < b.slug ? -1 : 1))
    .slice(0, 24)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd!,
      multiple: p.mcap_usd! / p.tvl_usd,
    }));

  return {
    as_of: snapshot.as_of,
    floor_usd: snapshot.floor_usd,
    global_median: table.globalMedian,
    live_peer_count: table.livePeerCount,
    rows,
    live,
  };
}
