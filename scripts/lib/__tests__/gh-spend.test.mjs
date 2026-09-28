/**
 * @file scripts/lib/__tests__/gh-spend.test.mjs
 * @description #4309 — GitHub spend accounting from `calls.jsonl`: the three counts (invocations, HTTP responses,
 *   points) never mixed; attributed + estimated + unattributed = the bucket's `used` change for every observable
 *   window (estimates allocated INSIDE the residual, never on top); `unknown` never coerced; nested and retried
 *   calls counted once; hourly persistence idempotent and cursor-safe.
 */
import { describe, it, expect } from 'vitest';
import { appendFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  attributeSpend, rollupSpend, rollupSpendDetailed, persistSpendHours, collectSpendRows, summarizeSpendRows, renderSpendReport,
  readSpendRows, spendPaths, MAX_ATTRIBUTED_PER_RESPONSE,
} from '../gh-spend.mjs';

const T0 = Date.parse('2026-09-28T10:00:00Z');
const RESET = T0 / 1000 + 3600;
const at = (min) => new Date(T0 + min * 60_000).toISOString();
const rl = (used, res = 'graphql', reset = RESET) => ({ used, rem: 5000 - used, limit: 5000, reset, res });
/** A shim (passthrough) call line — measured. */
const shim = (min, used, extra = {}) => ({ ts: at(min), op: 'pr view', outcome: 'call', ok: true, caller: 'session:abcd1234', resource: 'graphql', id: 'app', inv: `s${min}-${used}`, rl: [rl(used)], ...extra });
/** A daemon call through runGhSync — no rl, estimate-only. */
const daemon = (min, op = 'pr list', extra = {}) => ({ ts: at(min), op, outcome: 'call', ok: true, caller: 'review-daemon.mjs', resource: 'graphql', id: 'app', inv: `d${min}-${Math.random()}`, ...extra });

const conserve = (row) => row.attributed + row.estimated + row.unattributed;

describe('rollupSpend — conservation (#4309)', () => {
  it('delta 10 = 9 spent by an unlogged daemon call + 1 by the shim: reported as 10 total, NEVER 10 + 9', () => {
    const entries = [shim(1, 100), daemon(2, 'pr list'), shim(3, 110)];
    const [row] = rollupSpend(entries, { now: T0 + HOURS(1) });
    expect(row.bucketUsed).toBe(10);
    expect(conserve(row)).toBe(10);
    expect(row.attributed).toBe(10); // the whole delta lands on the observed response (the documented over-attribution)
    expect(row.estimated).toBe(0); // the daemon's 3-point estimate is scaled INTO the (empty) residual
    expect(row.unattributed).toBe(0);
  });

  it('estimates are scaled DOWN to fit the residual when they exceed it', () => {
    // delta 100: the closing response is capped at 50, leaving a 50-point residual for 30 × ~3-point daemon lists.
    const entries = [shim(1, 100), ...Array.from({ length: 30 }, (_, i) => daemon(2 + i * 0.01)), shim(3, 200)];
    const [row] = rollupSpend(entries, { now: T0 + HOURS(1) });
    expect(row.attributed).toBe(MAX_ATTRIBUTED_PER_RESPONSE);
    expect(row.estimated).toBeCloseTo(50, 6);
    expect(row.unattributed).toBeCloseTo(0, 6);
    expect(conserve(row)).toBeCloseTo(100, 6);
    expect(row.byCaller['review-daemon.mjs'].estimated).toBeCloseTo(50, 6);
  });

  it('what the estimates do not cover stays UNATTRIBUTED (bypass traffic)', () => {
    const entries = [shim(1, 100), daemon(2), daemon(2.5), shim(3, 180)];
    const [row] = rollupSpend(entries, { now: T0 + HOURS(1) });
    expect(row.attributed).toBe(50);
    expect(row.estimated).toBe(6);
    expect(row.unattributed).toBe(24);
    expect(conserve(row)).toBe(80);
  });

  it('a window with ZERO header observations is UNKNOWN — never estimated, never a zero unattributed', () => {
    const entries = [daemon(1), daemon(2), { ts: at(3), op: 'pr view', outcome: 'call', ok: true }]; // + a pre-#4309 line
    const rows = rollupSpend(entries, { now: T0 + HOURS(1) });
    expect(rows.map((r) => r.identity)).toEqual(['?', 'app']); // the legacy line never logged its identity
    for (const row of rows) {
      expect(row.unknown).toBe(true);
      expect([row.bucketUsed, row.attributed, row.estimated, row.unattributed]).toEqual([null, null, null, null]);
    }
    expect(rows.reduce((s, r) => s + r.unknownRequests, 0)).toBe(3);
    expect(rows.reduce((s, r) => s + r.requests, 0)).toBe(3);
  });

  it('the first observation of a fresh window is a BASELINE (no implicit zero), and a carried baseline closes the gap', () => {
    const fresh = rollupSpend([shim(1, 900)], { now: T0 + HOURS(1) });
    expect(fresh[0].unknown).toBe(true); // 900 is NOT charged to that call
    const carried = rollupSpend([shim(1, 900)], { now: T0 + HOURS(1), baselines: { [`app|graphql|${RESET}`]: { used: 897, t: T0 - 60_000 } } });
    expect(carried[0].attributed).toBe(3);
  });

  it('the running baseline carries across an hour boundary inside one pass', () => {
    const entries = [shim(50, 100), shim(70, 104)]; // 10:50 and 11:10, same GitHub window
    const rows = rollupSpend(entries, { now: T0 + HOURS(2) });
    expect(rows.map((r) => r.hour)).toEqual(['2026-09-28T10:00:00.000Z', '2026-09-28T11:00:00.000Z']);
    expect(rows[0].unknown).toBe(true);
    expect(rows[1].attributed).toBe(4);
  });
});

describe('rollupSpend — the three counts, never mixed', () => {
  it('a nested call (runGhSync outer + shim inner with `outer`) is ONE invocation, measured, credited to the outer caller', () => {
    const outer = { ts: at(2), op: 'pr view', outcome: 'call', ok: true, caller: 'ci-heal-mark.mjs', resource: 'graphql', id: 'app', inv: 'OUT1' };
    const inner = { ...shim(2, 105), inv: 'IN1', outer: 'OUT1', caller: 'node' };
    const rows = rollupSpend([shim(1, 100), inner, outer], { now: T0 + HOURS(1) });
    expect(rows[0].requests).toBe(2);
    expect(rows[0].byCaller['ci-heal-mark.mjs']).toMatchObject({ requests: 1, attributed: 5, estimated: 0 });
    expect(rows[0].estimated).toBe(0); // the outer record is covered by its inner measurement — never estimated on top
  });

  it('retries share one `inv` → one invocation; a paginated call is one invocation with two HTTP responses', () => {
    const retry = [daemon(1, 'pr list', { inv: 'R' }), daemon(1.1, 'pr list', { inv: 'R' })];
    const paged = { ...shim(2, 110), inv: 'P', rl: [rl(106), rl(110)] };
    const rows = rollupSpend([shim(0.5, 100), ...retry, paged], { now: T0 + HOURS(1) });
    expect(rows[0].requests).toBe(3);
    expect(rows[0].responses).toBe(3);
    expect(rows[0].byCaller['review-daemon.mjs'].requests).toBe(1);
    expect(conserve(rows[0])).toBe(10);
  });

  it('learns a per-op average from measured calls and uses it for unmeasured ones', () => {
    const entries = [shim(1, 100), shim(2, 102), shim(3, 104), daemon(3.5, 'pr view'), shim(4, 110)];
    const { invocations } = attributeSpend(entries, { now: T0 + HOURS(1) });
    const d = invocations.find((i) => i.caller === 'review-daemon.mjs');
    // measured `pr view`s at 2 and 2 points (the first was a bare baseline); the 6-point gap is NOT learned from —
    // it contains the daemon's own call, so its closing response is over-attributed.
    expect(d.estimateRaw).toBe(2);
  });

  it('a response on another bucket lands on THAT resource\'s row', () => {
    const create = { ...shim(2, 101), op: 'pr create', rl: [rl(101), rl(7, 'core')] };
    const rows = rollupSpend([shim(1, 100), { ...shim(1, 5), rl: [rl(5, 'core')] }, create], { now: T0 + HOURS(1) });
    const core = rows.find((r) => r.resource === 'core');
    expect(core.attributed).toBe(2);
    expect(core.byCaller['session:abcd1234'].attributed).toBe(2);
  });
});

function HOURS(n) { return n * 60 * 60_000; }

describe('persistSpendHours — hourly persistence, idempotent and cursor-safe', () => {
  const setup = () => {
    const dir = mkdtempSync(join(tmpdir(), 'gh-spend-'));
    const logPath = join(dir, 'calls.jsonl');
    return { dir, logPath, ...spendPaths(logPath) };
  };
  const write = (logPath, entries) => appendFileSync(logPath, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');

  it('persists only CLOSED hours, once, and never re-reads what it consumed', () => {
    const { logPath, hourlyPath } = setup();
    write(logPath, [shim(10, 100), shim(20, 103), shim(70, 107)]); // 10:10, 10:20 closed; 11:10 still open at 11:30
    const first = persistSpendHours({ logPath, now: T0 + 90 * 60_000 });
    expect(first.rowsWritten).toBe(1);
    expect(first.consumedLines).toBe(2);
    expect(persistSpendHours({ logPath, now: T0 + 90 * 60_000 }).rowsWritten).toBe(0); // idempotent
    write(logPath, [shim(80, 110)]);
    const later = persistSpendHours({ logPath, now: T0 + 121 * 60_000 }); // 11:00 hour now closed
    expect(later.rowsWritten).toBe(1);
    const rows = readSpendRows(hourlyPath);
    expect(rows.map((r) => r.hour)).toEqual(['2026-09-28T10:00:00.000Z', '2026-09-28T11:00:00.000Z']);
    expect(rows[1].attributed).toBe(7); // baseline 103 carried across the persistence boundary via the cursor: 107-103 + 110-107
  });

  it('a crash between the append and the cursor write re-appends nothing (rows are keyed hour+identity+resource)', () => {
    const { logPath, hourlyPath, cursorPath } = setup();
    write(logPath, [shim(10, 100), shim(20, 103)]);
    persistSpendHours({ logPath, now: T0 + 90 * 60_000 });
    writeFileSync(cursorPath, '{"garbage":'); // the cursor is lost
    persistSpendHours({ logPath, now: T0 + 90 * 60_000 });
    expect(readSpendRows(hourlyPath)).toHaveLength(1);
  });

  it('a rotated (shrunk) log restarts from byte 0 instead of skipping the new file', () => {
    const { logPath, hourlyPath } = setup();
    write(logPath, [shim(10, 100), shim(20, 103), shim(30, 104)]);
    persistSpendHours({ logPath, now: T0 + 90 * 60_000 });
    writeFileSync(logPath, JSON.stringify(shim(130, 300)) + '\n'); // rotated: smaller than the old cursor
    persistSpendHours({ logPath, now: T0 + 181 * 60_000 });
    expect(readSpendRows(hourlyPath).map((r) => r.hour)).toContain('2026-09-28T12:00:00.000Z');
  });

  it('collectSpendRows merges persisted hours with the live, not-yet-persisted tail; the report shows every column', () => {
    const { logPath } = setup();
    write(logPath, [shim(10, 100), daemon(15), shim(20, 110), shim(70, 115)]);
    persistSpendHours({ logPath, now: T0 + 90 * 60_000 });
    const rows = collectSpendRows({ logPath, hours: 24, now: T0 + 90 * 60_000 });
    expect(rows).toHaveLength(2);
    expect(rows[1].attributed).toBe(5); // the live hour, diffed against the cursor's carried baseline
    const sections = summarizeSpendRows(rows, { by: 'caller' });
    const text = renderSpendReport(sections, { hours: 24, by: 'caller' });
    // 10:10 is a bare baseline; 10:20 closes a 10-point gap (under the cap, so the daemon's estimate scales to 0);
    // 11:10 closes a 5-point gap against the baseline carried in the cursor.
    expect(text).toMatch(/bucket used 15 = attributed 15 \+ estimated 0 \+ unattributed 0/);
    expect(text).toMatch(/1 invocations with UNKNOWN points/);
    // an all-unknown caller shows `—`, never a zero that reads as "cost nothing"
    const unknownOnly = renderSpendReport(summarizeSpendRows(rollupSpend([daemon(5)], { now: T0 + HOURS(1) }), { by: 'caller' }), { hours: 1, by: 'caller' });
    expect(unknownOnly).toMatch(/review-daemon\.mjs\s+—\s+—\s+1\s+1\s+0/);
    expect(unknownOnly).toMatch(/bucket used: unknown/);
    expect(text).toMatch(/attributed\*\s+estimated\s+unknown-inv\s+invocations\s+responses/);
    expect(text).toMatch(/review-daemon\.mjs/);
    expect(text).toMatch(/can include traffic that bypasses gh-throttle/);
    expect(JSON.parse(readFileSync(spendPaths(logPath).cursorPath, 'utf8')).offset).toBeGreaterThan(0);
  });

  it('rollupSpendDetailed hands back the last `used` per window for the next pass', () => {
    const { baselines } = rollupSpendDetailed([shim(1, 100), shim(2, 104)], { now: T0 + HOURS(1) });
    expect(baselines[`app|graphql|${RESET}`].used).toBe(104);
  });
});
