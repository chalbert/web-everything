/**
 * @file review-baseline-state.test.mjs — proof of the #2414 first-drain-sighting manifest baseline: the
 *   durable capture of the escalation-sensitive manifest values the drain FIRST saw for a ready-to-merge PR
 *   (post-queue), and the land-time diff that refuses a PR whose LIVE manifest was WEAKENED after that first
 *   sighting (a value edited down, or a stripped manifest). NOTE the cache-loss residual proven below: a null
 *   baseline fails OPEN, and the CLI's paired recordBaseline re-captures the live body — so losing the cache
 *   while a tamper is live durably re-baselines to the tampered values (a bypass, not a one-pass gap).
 */
import { describe, it, expect } from 'vitest';
import {
  emptyBaselineState,
  baselineKey,
  parseBaselineState,
  serializeBaselineState,
  getBaseline,
  recordBaseline,
  clearBaseline,
  diffBaseline,
} from '../review-baseline-state.mjs';

const vals = (o = {}) => ({ hasManifest: true, dismissedFindings: 0, crossRepo: false, blockedBy: [], ...o });

describe('baselineKey', () => {
  it('keys a (repo, num) pair, normalizing a missing repo to the local-repo slug', () => {
    expect(baselineKey('org/we', '110')).toBe('org/we#110');
    expect(baselineKey(null, '110')).toBe('cwd#110');
    expect(baselineKey(undefined, '110')).toBe('cwd#110');
  });
});

describe('parseBaselineState', () => {
  it('empty/missing text → empty state', () => {
    expect(parseBaselineState('')).toEqual({ baselines: [] });
    expect(parseBaselineState(undefined)).toEqual({ baselines: [] });
  });
  it('bad JSON never throws — degrades to empty (a corrupt cache must not break the drain)', () => {
    expect(parseBaselineState('{not json')).toEqual({ baselines: [] });
  });
  it('parses valid entries, normalizes the key, and coerces the values', () => {
    const s = parseBaselineState(JSON.stringify({ baselines: [{ repo: 'org/we', num: 110, values: { hasManifest: true, dismissedFindings: 2, crossRepo: true, blockedBy: [2151] } }] }));
    expect(s.baselines).toEqual([{ key: 'org/we#110', repo: 'org/we', num: '110', values: { hasManifest: true, dismissedFindings: 2, crossRepo: true, blockedBy: ['2151'] } }]);
  });
  it('drops junk rows (missing num, missing values) rather than choking on them', () => {
    const s = parseBaselineState(JSON.stringify({ baselines: [{ values: {} }, { num: 5 }, { num: 5, values: { dismissedFindings: 1 } }] }));
    expect(s.baselines.map((b) => b.key)).toEqual(['cwd#5']);
  });
  it('sanitizes blockedBy to the legit-id allowlist (a smuggled delimiter cannot split the field)', () => {
    const s = parseBaselineState(JSON.stringify({ baselines: [{ num: 1, values: { blockedBy: ['21,99', 'x_7-a', '<b>'] } }] }));
    expect(getBaseline(s, { repo: null, num: 1 }).blockedBy).toEqual(['2199', 'x_7-a', 'b']);
  });
});

describe('recordBaseline — first-seen-wins, keeps the HONEST baseline', () => {
  it('first record captures the values', () => {
    const s = recordBaseline(emptyBaselineState(), { repo: 'org/we', num: 110 }, vals({ dismissedFindings: 2 }));
    expect(getBaseline(s, { repo: 'org/we', num: 110 })).toEqual(vals({ dismissedFindings: 2 }));
  });
  it('a LATER pass reading an already-tampered body does NOT overwrite the first-seen baseline', () => {
    let s = recordBaseline(emptyBaselineState(), { repo: 'org/we', num: 110 }, vals({ dismissedFindings: 2 }));
    s = recordBaseline(s, { repo: 'org/we', num: 110 }, vals({ dismissedFindings: 0 })); // attacker edited down
    expect(getBaseline(s, { repo: 'org/we', num: 110 }).dismissedFindings).toBe(2); // honest value survives
  });
  it('already-tracked re-record returns the SAME reference (lets the CLI skip a needless file write)', () => {
    const s = recordBaseline(emptyBaselineState(), { repo: 'org/we', num: 110 }, vals());
    expect(recordBaseline(s, { repo: 'org/we', num: 110 }, vals({ crossRepo: true }))).toBe(s);
  });
  it('keeps a RAW finite negative dismissedFindings (mirrors what scoreEscalation acts on — no clamp)', () => {
    const s = recordBaseline(emptyBaselineState(), { repo: 'org/we', num: 1 }, vals({ dismissedFindings: -4 }));
    expect(getBaseline(s, { repo: 'org/we', num: 1 }).dismissedFindings).toBe(-4);
  });
});

describe('serializeBaselineState', () => {
  it('round-trips through parse and strips internal bookkeeping (key)', () => {
    const s = recordBaseline(emptyBaselineState(), { repo: 'org/we', num: 110 }, vals({ dismissedFindings: 3, blockedBy: [2151] }));
    const text = serializeBaselineState(s);
    expect(getBaseline(parseBaselineState(text), { repo: 'org/we', num: 110 })).toEqual(vals({ dismissedFindings: 3, blockedBy: ['2151'] }));
    expect(JSON.parse(text).baselines).toEqual([{ repo: 'org/we', num: '110', values: vals({ dismissedFindings: 3, blockedBy: ['2151'] }) }]);
  });
});

describe('clearBaseline', () => {
  it('removes the tracked entry', () => {
    let s = recordBaseline(emptyBaselineState(), { repo: 'org/we', num: 110 }, vals());
    s = clearBaseline(s, { repo: 'org/we', num: 110 });
    expect(getBaseline(s, { repo: 'org/we', num: 110 })).toBeNull();
  });
  it('is a no-op (same reference) when nothing is tracked', () => {
    const s = emptyBaselineState();
    expect(clearBaseline(s, { repo: 'org/we', num: 110 })).toBe(s);
  });
});

describe('diffBaseline — flags ONLY weakening (escalation-suppressing) edits', () => {
  it('no baseline → not tampered (fails OPEN — the cache-loss residual, NOT a benign transient)', () => {
    expect(diffBaseline(null, vals())).toEqual({ tampered: false, reasons: [] });
  });
  it('identical live values → not tampered', () => {
    const b = vals({ dismissedFindings: 2, crossRepo: true, blockedBy: ['2151'] });
    expect(diffBaseline(b, b).tampered).toBe(false);
  });
  it('manifest STRIPPED (present at review, absent at land) → tampered, reported alone', () => {
    const r = diffBaseline(vals({ dismissedFindings: 2, crossRepo: true, blockedBy: ['2151'] }), vals({ hasManifest: false, dismissedFindings: 0, crossRepo: false, blockedBy: [] }));
    expect(r.tampered).toBe(true);
    expect(r.reasons).toHaveLength(1);
    expect(r.reasons[0]).toMatch(/STRIPPED/);
  });
  it('dismissedFindings edited DOWN → tampered', () => {
    const r = diffBaseline(vals({ dismissedFindings: 2 }), vals({ dismissedFindings: 0 }));
    expect(r.tampered).toBe(true);
    expect(r.reasons[0]).toMatch(/dismissedFindings edited down \(2→0\)/);
  });
  it('dismissedFindings edited down into NEGATIVES (scores even lower) → tampered', () => {
    expect(diffBaseline(vals({ dismissedFindings: 0 }), vals({ dismissedFindings: -4 })).tampered).toBe(true);
  });
  it('crossRepo cleared (true→false) → tampered', () => {
    expect(diffBaseline(vals({ crossRepo: true }), vals({ crossRepo: false })).tampered).toBe(true);
  });
  it('a dropped blockedBy edge → tampered (falsely-ready ahead of its predecessor)', () => {
    const r = diffBaseline(vals({ blockedBy: ['2151', '2160'] }), vals({ blockedBy: ['2151'] }));
    expect(r.tampered).toBe(true);
    expect(r.reasons[0]).toMatch(/blockedBy dropped \[2160\]/);
  });
  it('multiple weakening edits at once → all reported', () => {
    const r = diffBaseline(vals({ dismissedFindings: 3, crossRepo: true, blockedBy: ['2151'] }), vals({ dismissedFindings: 0, crossRepo: false, blockedBy: [] }));
    expect(r.reasons).toHaveLength(3);
  });

  it('STRENGTHENING edits are NOT flagged — more dismissed findings', () => {
    expect(diffBaseline(vals({ dismissedFindings: 1 }), vals({ dismissedFindings: 5 })).tampered).toBe(false);
  });
  it('STRENGTHENING — crossRepo set (false→true)', () => {
    expect(diffBaseline(vals({ crossRepo: false }), vals({ crossRepo: true })).tampered).toBe(false);
  });
  it('STRENGTHENING — an ADDED blocker', () => {
    expect(diffBaseline(vals({ blockedBy: ['2151'] }), vals({ blockedBy: ['2151', '2160'] })).tampered).toBe(false);
  });
  it('a manifest ADDED where the baseline had none is not weakening', () => {
    expect(diffBaseline(vals({ hasManifest: false }), vals({ hasManifest: true })).tampered).toBe(false);
  });
});

// Finding A (PR #394 review) — pin the DURABLE cache-loss bypass so the trust-chain file proves the residual
// rather than hiding it behind a "re-captures a fresh baseline" undersell. This models the CLI sequence in
// merge-ai-prs.mjs (getBaseline → if null, recordBaseline(live) → diffBaseline(prior, live)) after the local
// cache is lost while a tamper is live. It is NOT desired behaviour — it documents an ACCEPTED, not-cleanly-
// closable residual (see review-baseline-state.mjs's module doc). If a future change defends cache loss, this
// test should flip, not be deleted.
describe('cache-loss residual — a lost baseline durably re-baselines to the tampered values (Finding A)', () => {
  it('honest capture then cache loss then land: the tampered body is re-captured AND passes the diff', () => {
    // 1) Honest first sighting captured dismissedFindings=3 (later persisted to the local cache).
    const honest = recordBaseline(emptyBaselineState(), { repo: 'org/we', num: 110 }, vals({ dismissedFindings: 3 }));
    expect(getBaseline(honest, { repo: 'org/we', num: 110 }).dismissedFindings).toBe(3);

    // 2) The local cache file is LOST (empty state) and, meanwhile, the PR body is edited DOWN to 0.
    const afterLoss = emptyBaselineState();
    const tamperedLive = vals({ dismissedFindings: 0 });
    const priorBaseline = getBaseline(afterLoss, { repo: 'org/we', num: 110 }); // null — cache is gone
    expect(priorBaseline).toBeNull();

    // 3) The land pass fails OPEN — the tamper is NOT flagged...
    expect(diffBaseline(priorBaseline, tamperedLive)).toEqual({ tampered: false, reasons: [] });

    // 4) ...AND recordBaseline (fired by the CLI on the null read) now trusts the tampered values as the NEW
    //    baseline — so it durably launders the tamper for every future pass, not just this one.
    const relaunder = recordBaseline(afterLoss, { repo: 'org/we', num: 110 }, tamperedLive);
    expect(getBaseline(relaunder, { repo: 'org/we', num: 110 }).dismissedFindings).toBe(0);
    // A subsequent pass reading the (still-tampered) body against this poisoned baseline sees no mismatch.
    expect(diffBaseline(getBaseline(relaunder, { repo: 'org/we', num: 110 }), tamperedLive).tampered).toBe(false);
  });
});
