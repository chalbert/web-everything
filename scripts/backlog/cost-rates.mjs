/**
 * @file scripts/backlog/cost-rates.mjs
 * @description THE CANONICAL Claude usage-equivalent rate table + pure token↔USD helpers.
 *
 * One source of truth for "what a token costs" so the two places that price usage can never drift
 * again (the old bug: `session-cost.mjs` hardcoded stale Opus-3 rates while the card stored only the
 * derived dollars — every figure ~3x high and unrecomputable). `frontmatter.mjs` (card accrual) and
 * `backlog.mjs` (the `cost` verb) import from here directly. `skills-src/closing-session/session-cost.mjs`
 * is copied standalone into `~/.claude/skills/` and CANNOT import a repo path, so it carries a DUPLICATE
 * of `RATES` with a comment pointing back here — keep the numbers identical to this file.
 *
 * Per-Mtok USD, current pricing (2026):
 *   opus  (4.8): in 5  / out 25 / cache_read 0.5 (= 0.1x input)
 *   sonnet:      in 3  / out 15 / cache_read 0.3
 *   haiku:       in 1  / out 5  / cache_read 0.1
 * Cache WRITES are tiered: 5-minute tier = 1.25x input, 1-hour tier = 2x input. This user's sessions use
 * the 1-hour tier, so aggregate cache-creation with no per-tier split is priced as 1h. There is NO
 * long-context premium on Opus 4.8 — the 1M window is standard-priced, so no premium logic lives here.
 *
 * PURE — no fs, no process, no Date. Safe to import into the pure frontmatter core.
 */

/** Matched by first substring hit against the model id, so order specific → general. */
export const RATES = [
  { m: 'opus',   in: 5, out: 25, cr: 0.5, cw5m: 6.25, cw1h: 10 },
  { m: 'sonnet', in: 3, out: 15, cr: 0.3, cw5m: 3.75, cw1h: 6  },
  { m: 'haiku',  in: 1, out: 5,  cr: 0.1, cw5m: 1.25, cw1h: 2  },
];

/** The model family used to price a card's aggregate token breakdown (mixed-model detail is not stored). */
export const DEFAULT_MODEL = 'opus';

/**
 * Resolve the rate row for a model id, or `null` when it matches no family. Callers MUST handle `null`
 * (warn + exclude) — there is deliberately no silent opus fallback, so an unknown model can never be
 * priced as opus by accident.
 * @param {string} model
 * @returns {{m:string,in:number,out:number,cr:number,cw5m:number,cw1h:number}|null}
 */
export function rateFor(model = '') {
  return RATES.find((r) => String(model).toLowerCase().includes(r.m)) || null;
}

/**
 * Price an aggregate token breakdown at one model's rates. `cw` (cache-creation) has no tier split in the
 * aggregate form, so it is priced at the given `cacheTier` (default `'1h'` = this user's tier = 2x input).
 * Returns dollars (unrounded). An unknown model prices to 0 (the caller should have excluded it upstream).
 * @param {{in?:number,cw?:number,cr?:number,out?:number}} tokens
 * @param {string} [model]
 * @param {{ cacheTier?: '5m'|'1h' }} [opts]
 * @returns {number}
 */
export function usdFromTokens({ in: i = 0, cw = 0, cr = 0, out = 0 } = {}, model = DEFAULT_MODEL, { cacheTier = '1h' } = {}) {
  const r = rateFor(model);
  if (!r) return 0;
  const cwRate = cacheTier === '5m' ? r.cw5m : r.cw1h;
  return (i / 1e6) * r.in + (cw / 1e6) * cwRate + (cr / 1e6) * r.cr + (out / 1e6) * r.out;
}

/**
 * Parse a `costTokens` scalar (or the estimator's `--tokens-only` line) into `{in,cw,cr,out}` integers.
 * Tolerant on separator (`in:1200000` from the stored field, `in=1200000` from the estimator) and on
 * whitespace/commas. Unknown keys are ignored; missing keys default to 0. Never throws.
 * @param {string|undefined|null} s
 * @returns {{in:number,cw:number,cr:number,out:number}}
 */
export function parseCostTokens(s) {
  const out = { in: 0, cw: 0, cr: 0, out: 0 };
  if (!s) return out;
  for (const m of String(s).matchAll(/\b(in|cw|cr|out)\s*[:=]\s*(\d+)/g)) {
    out[m[1]] = Number(m[2]);
  }
  return out;
}

/** Render `{in,cw,cr,out}` as the canonical `costTokens` field value (`in:.. cw:.. cr:.. out:..`, colon form). */
export function formatCostTokens({ in: i = 0, cw = 0, cr = 0, out = 0 } = {}) {
  return `in:${i} cw:${cw} cr:${cr} out:${out}`;
}
