/**
 * @file scripts/backlog/__tests__/cost.test.mjs
 * Tests `accrueCost` — the close-time cost-on-card accumulator. The DURABLE record is the cumulative
 * token breakdown `costTokens` (`in:.. cw:.. cr:.. out:..`, raw integers); `costUsd` is strictly DERIVED
 * from those tokens through the one shared rate table (`cost-rates.mjs`) at every accrual, so it can never
 * drift from a stale hardcoded rate and is always regenerable. It folds as a pure splice: the body is
 * never touched, repeated calls accumulate the tokens (a decision worked across /prepare then /decide sums
 * into one total; a workflow even-split lands a share on each item), usd rounds to cents, and a doc with
 * no frontmatter yields null (never a half-write).
 */
import { describe, it, expect } from 'vitest';
import { accrueCost, readField } from '../frontmatter.mjs';
import { usdFromTokens, parseCostTokens, formatCostTokens, rateFor, RATES } from '../cost-rates.mjs';

const CARD = [
  '---',
  'kind: decision',
  'status: open',
  'dateOpened: "2026-07-01"',
  'tags: [cost, accounting]',
  '---',
  '',
  '# A decision whose body mentions costUsd: and must never change.',
  '',
].join('\n');

const T = (i, cw, cr, out) => ({ in: i, cw, cr, out });

describe('cost-rates — the canonical rate table + pricing', () => {
  it('prices opus tokens at current (2026) rates, 1h cache-write tier', () => {
    // 1M in @5 + 1M cw @10(1h) + 10M cr @0.5 + 1M out @25 = 5 + 10 + 5 + 25 = 45
    expect(usdFromTokens(T(1e6, 1e6, 10e6, 1e6))).toBeCloseTo(45, 6);
  });
  it('has NO long-context premium — opus in/out are flat 5/25', () => {
    const opus = rateFor('claude-opus-4-8[1m]');
    expect(opus.in).toBe(5);
    expect(opus.out).toBe(25);
    expect(opus.cr).toBe(0.5);
  });
  it('cache-write 1h tier = 2x input, 5m tier = 1.25x input', () => {
    for (const r of RATES) {
      expect(r.cw1h).toBeCloseTo(r.in * 2, 6);
      expect(r.cw5m).toBeCloseTo(r.in * 1.25, 6);
    }
  });
  it('returns null for an unknown model (no silent opus fallback)', () => {
    expect(rateFor('gpt-5')).toBeNull();
    expect(rateFor('gemini')).toBeNull();
  });
  it('parseCostTokens tolerates both : and = separators', () => {
    expect(parseCostTokens('in:1200000 cw:340000 cr:8100000 out:95000')).toEqual(T(1200000, 340000, 8100000, 95000));
    expect(parseCostTokens('in=100 cw=200 cr=300 out=400')).toEqual(T(100, 200, 300, 400));
    expect(parseCostTokens('')).toEqual(T(0, 0, 0, 0));
    expect(parseCostTokens(undefined)).toEqual(T(0, 0, 0, 0));
  });
  it('formatCostTokens round-trips through parseCostTokens', () => {
    const t = T(1, 2, 3, 4);
    expect(parseCostTokens(formatCostTokens(t))).toEqual(t);
  });
});

describe('accrueCost — cumulative token record, derived usd', () => {
  it('stores costTokens + derived costUsd + costSessions=1 on a fresh card', () => {
    const out = accrueCost(CARD, T(1e6, 1e6, 10e6, 1e6));
    expect(parseCostTokens(readField(out, 'costTokens'))).toEqual(T(1e6, 1e6, 10e6, 1e6));
    expect(readField(out, 'costUsd')).toBe('45'); // derived, not passed in
    expect(readField(out, 'costSessions')).toBe('1');
  });

  it('accumulates TOKENS across sessions and re-derives usd (prepare + decide → one running total)', () => {
    const afterPrepare = accrueCost(CARD, T(1e6, 0, 0, 1e6));   // 5 + 25 = 30
    const afterDecide = accrueCost(afterPrepare, T(1e6, 0, 0, 1e6)); // cumulative 2M in + 2M out = 10 + 50 = 60
    expect(parseCostTokens(readField(afterDecide, 'costTokens'))).toEqual(T(2e6, 0, 0, 2e6));
    expect(readField(afterDecide, 'costUsd')).toBe('60');
    expect(readField(afterDecide, 'costSessions')).toBe('2');
  });

  it('costUsd is regenerable — it always equals usdFromTokens(stored costTokens)', () => {
    const out = accrueCost(accrueCost(CARD, T(123456, 7890, 654321, 4321)), T(1000, 2000, 3000, 4000));
    const stored = parseCostTokens(readField(out, 'costTokens'));
    const expected = Math.round(usdFromTokens(stored) * 100) / 100;
    expect(readField(out, 'costUsd')).toBe(String(expected));
  });

  it('rounds derived usd to whole cents (diff-quiet, no float dust)', () => {
    const out = accrueCost(CARD, T(1, 0, 0, 0)); // 1 token in @ $5/Mtok = $0.000005 → $0.00
    expect(readField(out, 'costUsd')).toBe('0');
  });

  it('honours a --sessions override (workflow even-split share)', () => {
    const out = accrueCost(CARD, T(1e6, 0, 0, 0), { sessions: 1 });
    expect(readField(out, 'costSessions')).toBe('1');
  });

  it('never touches the body', () => {
    const out = accrueCost(CARD, T(1e6, 0, 0, 0));
    expect(out).toContain('# A decision whose body mentions costUsd: and must never change.');
  });

  it('returns null for a document with no frontmatter (never a half-write)', () => {
    expect(accrueCost('# just a body, no frontmatter\n', T(1e6, 0, 0, 0))).toBeNull();
  });
});
