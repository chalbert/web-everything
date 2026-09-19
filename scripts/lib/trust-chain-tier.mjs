/**
 * trust-chain-tier.mjs — the mechanical TRUST-CHAIN TIER: which files the spec-first self-approval floor is
 * scoped to (#2875, slice 1 of epic #2873).
 *
 * WHY. Every downstream slice of #2873 — the per-diff branch-coverage floor (#2876), the probe-runner (#2877),
 * mutation testing (#2878), the ratification default (#2879) — scopes itself to "the in-scope file set". That set
 * is decided HERE, by a pure predicate, never by judgment, and every slice imports it rather than re-deriving it.
 * `we:vitest.config.ts` imports the same list into `coverage.include`, so the files the predicate names are the
 * files v8 instruments (before #2875 `scripts/` was deliberately outside the #2082 allowlist, so nothing was
 * measured on them at all).
 *
 * WHY NOT `isTrustChainPath`. `gate-config.mjs#isTrustChainPath` answers a DIFFERENT question — "must this edit
 * escalate?" — and is deliberately basename-matched so it follows a member across directories and repos, and
 * over-matches generic basenames (`cli.mjs`, `runner.mjs`) in the safe direction. Coverage globs and a mutation
 * `mutate` list need the opposite: CONCRETE repo-relative source paths, where over-inclusion of an unrelated file
 * silently skews the measurement. So this tier matches EXACT normalized paths, and is DERIVED from that roster
 * (it never hardcodes the set a second time):
 *
 *   tier = every `TRUST_CHAIN` member `home` that is JS source under `scripts/lib/` (not a test, not a JSON
 *          contract)  ∪  `TIER_ADDITIONS` (the disposition-judge core the epic names, which the escalation
 *          roster does not register).
 *
 * A new roster member homed under `scripts/lib/` joins the tier automatically; the test pins the current set so
 * a change to it is always a visible diff.
 *
 * Pure: no I/O, deterministic.
 */
import { posix } from 'node:path';
import { TRUST_CHAIN } from './gate-config.mjs';

/** The directory the tier is scoped to (repo-relative, WE locus). */
export const TRUST_CHAIN_TIER_ROOT = 'scripts/lib/';

/** Tier members the escalation roster does not register but epic #2873 names as in scope: the disposition
 *  judge (`proposeDisposition` / `redRefute`), the pure core the probe-runner (#2877) feeds. */
export const TIER_ADDITIONS = Object.freeze(['scripts/lib/disposition-judge.mjs']);

/** Is this repo-relative path instrumentable JS source under the tier root (not a test file)? */
function isTierSourceShape(path) {
  return path.startsWith(TRUST_CHAIN_TIER_ROOT)
    && /\.m?js$/.test(path)
    && !path.includes('/__tests__/')
    && !/\.(test|spec)\.m?js$/.test(path);
}

/** The trust-chain tier as a frozen, sorted list of repo-relative paths — the value `coverage.include` and any
 *  scoped runner consume. */
export const TRUST_CHAIN_TIER_FILES = Object.freeze(
  [...new Set([
    ...TRUST_CHAIN.flatMap((m) => m.homes || []).filter(isTierSourceShape),
    ...TIER_ADDITIONS,
  ])].sort(),
);

const TIER_SET = new Set(TRUST_CHAIN_TIER_FILES);

/**
 * Normalize a caller-supplied path to the repo-relative WE form, or `null` when it cannot name a WE repo file.
 * Accepts the `we:` locus prefix, a leading `./`, Windows separators, and interior `.`/`..` segments. Rejects a
 * foreign locus prefix (`fui:`, `plateau-app:` — the tier is WE-only), an absolute path (callers relativize
 * first), and anything that normalizes outside the repo root.
 */
export function normalizeTierPath(path) {
  if (typeof path !== 'string') return null;
  let p = path.trim().replace(/\\/g, '/');
  if (p.startsWith('we:')) p = p.slice(3);
  else if (/^[a-z][a-z0-9-]*:/i.test(p)) return null;
  if (p === '' || p.startsWith('/')) return null;
  p = posix.normalize(p);
  if (p === '.' || p === '..' || p.startsWith('../')) return null;
  return p;
}

/** Is this path a member of the trust-chain tier? Pure. Exact match on the normalized repo-relative path — a
 *  same-basename file elsewhere (`scripts/review-core.mjs`) or a member's own test file is NOT in the tier. */
export function isTrustChainTier(path) {
  const p = normalizeTierPath(path);
  return p !== null && TIER_SET.has(p);
}
