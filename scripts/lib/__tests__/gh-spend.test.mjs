/**
 * @file scripts/lib/__tests__/gh-spend.test.mjs
 * @description #4309 — GitHub spend accounting from `calls.jsonl`: the three counts (invocations, HTTP responses,
 *   points) never mixed; attributed + estimated + unattributed = the bucket's `used` change for every observable
 *   window (estimates allocated INSIDE the residual, never on top); `unknown` never coerced; nested and retried
 *   calls counted once; hourly persistence idempotent and cursor-safe.
 */
import { describe, it, expect, vi } from 'vitest';
import { appendFileSync, mkdtempSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  attributeSpend, rollupSpend, rollupSpendDetailed, persistSpendHours, collectSpendRows, summarizeSpendRows, renderSpendReport,
  readSpendRows, spendPaths, collectSpendReport,
} from '../gh-spend.mjs';
import { runGhSync, ghThrottleLogPath } from '../gh-throttle.mjs';

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
    expect(row.attributed).toBe(0); // legacy shared-counter movement is never measured caller cost
    expect(row.estimated).toBe(3); // estimate consumes the observed residual
    expect(row.unattributed).toBe(7);
  });

  it('estimates are scaled DOWN to fit the residual when they exceed it', () => {
    // delta 100: an explicit 50-point response leaves 50 for 30 × 3-point estimates.
    const entries = [shim(1, 100), ...Array.from({ length: 30 }, (_, i) => daemon(2 + i * 0.01)), shim(3, 200, { rl: [{ ...rl(200), cost: 50 }] })];
    const [row] = rollupSpend(entries, { now: T0 + HOURS(1) });
    expect(row.attributed).toBe(50);
    expect(row.estimated).toBeCloseTo(50, 6);
    expect(row.unattributed).toBeCloseTo(0, 6);
    expect(conserve(row)).toBeCloseTo(100, 6);
    expect(row.byCaller['review-daemon.mjs'].estimated).toBeCloseTo(50, 6);
  });

  it('what the estimates do not cover stays UNATTRIBUTED (bypass traffic)', () => {
    const entries = [shim(1, 100), daemon(2), daemon(2.5), shim(3, 180)];
    const [row] = rollupSpend(entries, { now: T0 + HOURS(1) });
    expect(row.attributed).toBe(0);
    expect(row.estimated).toBe(6);
    expect(row.unattributed).toBe(74);
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
    expect(carried[0]).toMatchObject({ bucketUsed: 3, attributed: 0, unattributed: 3, unknownRequests: 1 });
  });

  it('the running baseline carries across an hour boundary inside one pass', () => {
    const entries = [shim(50, 100), shim(70, 104)]; // 10:50 and 11:10, same GitHub window
    const rows = rollupSpend(entries, { now: T0 + HOURS(2) });
    expect(rows.map((r) => r.hour)).toEqual(['2026-09-28T10:00:00.000Z', '2026-09-28T11:00:00.000Z']);
    expect(rows[0].unknown).toBe(true);
    expect(rows[1]).toMatchObject({ bucketUsed: 4, attributed: 0, unattributed: 4 });
  });
});

describe('rollupSpend — the three counts, never mixed', () => {
  it('a nested call (runGhSync outer + shim inner with `outer`) is ONE invocation, measured, credited to the outer caller', () => {
    const outer = { ts: at(2), op: 'pr view', outcome: 'call', ok: true, caller: 'ci-heal-mark.mjs', resource: 'graphql', id: 'app', inv: 'OUT1' };
    const inner = { ...shim(2, 105), inv: 'IN1', outer: 'OUT1', caller: 'node' };
    const rows = rollupSpend([shim(1, 100), inner, outer], { now: T0 + HOURS(1) });
    expect(rows[0].requests).toBe(2);
    expect(rows[0].byCaller['ci-heal-mark.mjs']).toMatchObject({ requests: 1, attributed: 0, estimated: 0, unknown: 1 });
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
    const entries = [shim(1, 100), shim(2, 102, { rl: [{ ...rl(102), cost: 2 }] }), shim(3, 104, { rl: [{ ...rl(104), cost: 2 }] }), daemon(3.5, 'pr view'), shim(4, 110)];
    const { invocations } = attributeSpend(entries, { now: T0 + HOURS(1) });
    const d = invocations.find((i) => i.caller === 'review-daemon.mjs');
    // measured `pr view`s at 2 and 2 points (the first was a bare baseline); the 6-point gap is NOT learned from —
    // it contains the daemon's own call, so its closing response is over-attributed.
    expect(d.estimateRaw).toBe(2);
  });

  it('a response on another bucket lands on THAT resource\'s row', () => {
    const create = { ...shim(2, 101), op: 'pr create', rl: [{ ...rl(101), cost: 1 }, { ...rl(7, 'core'), cost: 2 }] };
    const rows = rollupSpend([shim(1, 100), { ...shim(1, 5), rl: [rl(5, 'core')] }, create], { now: T0 + HOURS(1) });
    const core = rows.find((r) => r.resource === 'core');
    expect(core.attributed).toBe(2);
    expect(core.byCaller['session:abcd1234'].attributed).toBe(2);
  });

  it('counts ALL of an invocation\'s responses on its head resource row; a baseline-only resource adds no row (#4428)', () => {
    const create = { ...shim(2, 101), op: 'pr create', rl: [{ ...rl(101), cost: 1 }, { ...rl(7, 'core'), cost: 2 }] };
    const rows = rollupSpend([shim(1, 100), { ...shim(1, 5), rl: [rl(5, 'core')] }, create], { now: T0 + HOURS(1) });
    // 1 (baseline call) + 1 (core-only baseline, head resource graphql) + the create's 2 responses, all on graphql
    expect(rows.find((r) => r.resource === 'graphql').responses).toBe(4);
    expect(rows.find((r) => r.resource === 'core').responses).toBe(0);
    const baselineOnly = rollupSpend([{ ...shim(1, 5), rl: [rl(5, 'core')] }], { now: T0 + HOURS(1) });
    expect(baselineOnly.find((r) => r.resource === 'core')).toBeUndefined();
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
    expect(rows[1].bucketUsed).toBe(7); // baseline 103 carried across the persistence boundary via the cursor: 107-103 + 110-107
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
    expect(rows[1]).toMatchObject({ bucketUsed: 5, attributed: 0 }); // the live hour, diffed against the cursor's carried baseline
    const sections = summarizeSpendRows(rows, { by: 'caller' });
    const text = renderSpendReport(sections, { hours: 24, by: 'caller' });
    // 10:10 is a bare baseline; 10:20 closes a 10-point gap (under the cap, so the daemon's estimate scales to 0);
    // 11:10 closes a 5-point gap against the baseline carried in the cursor.
    expect(text).toMatch(/bucket used 15 = attributed 0 \+ estimated 3 \+ unattributed 12/);
    expect(text).toMatch(/3 invocations with UNKNOWN points/);
    // an all-unknown caller shows `—`, never a zero that reads as "cost nothing"
    const unknownOnly = renderSpendReport(summarizeSpendRows(rollupSpend([daemon(5)], { now: T0 + HOURS(1) }), { by: 'caller' }), { hours: 1, by: 'caller' });
    expect(unknownOnly).toMatch(/review-daemon\.mjs\s+—\s+—\s+1\s+1\s+0/);
    expect(unknownOnly).toMatch(/bucket used: unknown/);
    expect(text).toMatch(/attributed\*\s+estimated\s+unknown-inv\s+invocations\s+responses/);
    expect(text).toMatch(/review-daemon\.mjs/);
    expect(text).toMatch(/not a complete installation budget/);
    expect(JSON.parse(readFileSync(spendPaths(logPath).cursorPath, 'utf8')).offset).toBeGreaterThan(0);
  });

  it('rollupSpendDetailed hands back the last `used` per window for the next pass', () => {
    const { baselines } = rollupSpendDetailed([shim(1, 100), shim(2, 104)], { now: T0 + HOURS(1) });
    expect(baselines[`app|graphql|${RESET}`].used).toBe(104);
  });
  it('keeps one invocation together across the hour boundary (#4428)', () => {
    const { logPath, hourlyPath } = setup();
    const a = { ...shim(59, 100), inv: 'X', rl: [rl(100)] };
    const b = { ...shim(61, 103), inv: 'X', rl: [rl(103)] };
    write(logPath, [a, b]);
    persistSpendHours({ logPath, now: T0 + 70 * 60_000 }); // 10:00 closed; X straddles into 11:00
    write(logPath, [shim(130, 110)]);
    persistSpendHours({ logPath, now: T0 + 190 * 60_000 });
    const rows = readSpendRows(hourlyPath);
    // X counts once (not once per tick) plus the later, separate invocation; all 3 responses are preserved
    expect(rows.reduce((n, r) => n + r.requests, 0)).toBe(2);
    expect(rows.reduce((n, r) => n + r.responses, 0)).toBe(3);
  });
});

// ── PR #2851 review round 1 ────────────────────────────────────────────────────────────────────────────────────
describe('hostile caller/op keys never write onto Object.prototype (PR #2851 review)', () => {
  it.each(['__proto__', 'constructor', 'toString'])('caller %s is an ordinary own key', (name) => {
    const entries = [shim(1, 100, { caller: name }), daemon(2, 'pr list', { caller: name }), shim(3, 110, { caller: name, op: name })];
    const rows = rollupSpend(entries, { now: T0 + HOURS(1) });
    const sections = summarizeSpendRows(rows, { by: 'caller' });
    summarizeSpendRows(rows, { by: 'op' });
    expect(({}).requests).toBeUndefined();
    expect(({}).attributed).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(rows[0].byCaller, name)).toBe(true);
    expect(rows[0].byCaller[name].requests).toBe(3);
    expect(sections[0].dims.find((d) => d.name === name).requests).toBe(3);
  });
});

describe('an rl with no usable observation is never "attributed zero" (PR #2851 review)', () => {
  const cases = {
    absent: {},
    empty: { rl: [] },
    invalid: { rl: [{ used: null, rem: null, limit: null, reset: null, res: 'graphql' }] },
  };
  it.each(Object.keys(cases))('%s rl outside every gap is UNKNOWN', (k) => {
    const { invocations } = attributeSpend([shim(1, 0, { rl: undefined, ...cases[k] })], { now: T0 + HOURS(1) });
    expect(invocations[0].kind).toBe('unknown');
    const [row] = rollupSpend([shim(1, 0, { rl: undefined, ...cases[k] })], { now: T0 + HOURS(1) });
    expect(row.unknownRequests).toBe(1);
  });
  it.each(Object.keys(cases))('%s rl inside an observed gap is ESTIMATED from the residual', (k) => {
    const entries = [shim(1, 100), shim(2, 0, { inv: 'mid', rl: undefined, ...cases[k] }), shim(3, 200)];
    const { invocations } = attributeSpend(entries, { now: T0 + HOURS(1) });
    expect(invocations.find((i) => i.key === 'inv:mid').kind).toBe('estimated');
  });
  it('a baseline-only rl stays UNKNOWN', () => {
    const { invocations } = attributeSpend([shim(1, 100)], { now: T0 + HOURS(1) });
    expect(invocations[0].kind).toBe('unknown');
  });
});

describe('the persistence cursor detects rotation by file identity, not size alone (PR #2851 review)', () => {
  const setup = () => {
    const dir = mkdtempSync(join(tmpdir(), 'gh-spend-rot-'));
    const logPath = join(dir, 'calls.jsonl');
    return { dir, logPath, ...spendPaths(logPath) };
  };
  const lines = (entries) => entries.map((e) => JSON.stringify(e)).join('\n') + '\n';
  it.each([['equal-sized', 0], ['larger', 3]])('a %s replacement log is read from byte 0', (_label, extra) => {
    const { logPath, hourlyPath } = setup();
    const old = [shim(10, 100), shim(20, 103), shim(30, 104)];
    writeFileSync(logPath, lines(old));
    persistSpendHours({ logPath, now: T0 + 90 * 60_000 });
    // The replacement: a new hour (12:00) whose first lines sit BEFORE the old cursor offset.
    const fresh = [shim(125, 300), shim(126, 305), shim(127, 309)];
    for (let i = 0; i < extra; i += 1) fresh.push(shim(128 + i, 310 + i));
    let text = lines(fresh);
    const oldSize = Buffer.byteLength(lines(old));
    if (Buffer.byteLength(text) < oldSize) text = text + ' '.repeat(oldSize - Buffer.byteLength(text) - 1) + '\n';
    writeFileSync(`${logPath}.new`, text);
    renameSync(`${logPath}.new`, logPath);
    persistSpendHours({ logPath, now: T0 + 181 * 60_000 });
    const row = readSpendRows(hourlyPath).find((r) => r.hour === '2026-09-28T12:00:00.000Z');
    expect(row).toBeDefined();
    expect(row.requests).toBe(fresh.length);
    const live = collectSpendRows({ logPath, hours: 24, now: T0 + 181 * 60_000 });
    expect(live.find((r) => r.hour === '2026-09-28T12:00:00.000Z').requests).toBe(fresh.length);
  });
  it('an in-place truncate-and-rewrite (same inode) past the old offset is detected too', () => {
    const { logPath, hourlyPath } = setup();
    writeFileSync(logPath, lines([shim(10, 100), shim(20, 103)]));
    persistSpendHours({ logPath, now: T0 + 90 * 60_000 });
    writeFileSync(logPath, lines([shim(125, 300), shim(126, 305), shim(127, 309), shim(128, 310)]));
    persistSpendHours({ logPath, now: T0 + 181 * 60_000 });
    expect(readSpendRows(hourlyPath).find((r) => r.hour === '2026-09-28T12:00:00.000Z').requests).toBe(4);
  });
  it('a plain append keeps the cursor (no re-read)', () => {
    const { logPath } = setup();
    writeFileSync(logPath, lines([shim(10, 100), shim(20, 103)]));
    const first = persistSpendHours({ logPath, now: T0 + 90 * 60_000 });
    appendFileSync(logPath, lines([shim(125, 300)]));
    const second = persistSpendHours({ logPath, now: T0 + 181 * 60_000 });
    expect(second.consumedLines).toBe(1);
    expect(second.offset).toBeGreaterThan(first.offset);
  });
});

// ── #4375 — a daemon's runGhSync calls now carry `rl`, so the UNCHANGED rollup ranks their real spend ─────────────
describe('rollupSpend over real runGhSync log lines (#4375)', () => {
  const trace = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'gh-debug', 'pr-view-success.debug.stderr'), 'utf8');
  const withUsed = (used) => Buffer.from(trace.replace('X-Ratelimit-Used: 36', `X-Ratelimit-Used: ${used}`));

  it('two legacy daemon calls expose counter movement with UNKNOWN caller costs', () => {
    const lockRoot = mkdtempSync(join(tmpdir(), 'gh-spend-sync-'));
    const spawn = vi.fn()
      .mockReturnValueOnce({ status: 0, stdout: Buffer.from('[]'), stderr: withUsed(36), output: [], error: null })
      .mockReturnValueOnce({ status: 0, stdout: Buffer.from('[]'), stderr: withUsed(40), output: [], error: null });
    const throttle = { lockRoot, cap: 2, sleep: () => {}, spawn, caller: 'reconcile-fix-dispatch-daemon.mjs', env: { GH_TOKEN: 'ghs_x' } };
    runGhSync(['pr', 'list'], { stdio: 'pipe', throttle });
    runGhSync(['pr', 'view', '1'], { stdio: 'pipe', throttle });
    const entries = readFileSync(ghThrottleLogPath(lockRoot), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    const [row] = rollupSpend(entries, { now: Date.now() + HOURS(1) });
    expect(row).toMatchObject({ identity: 'app', resource: 'graphql', requests: 2, responses: 2, bucketUsed: 4, attributed: 0, unattributed: 4 });
    expect(row.byCaller['reconcile-fix-dispatch-daemon.mjs']).toMatchObject({ requests: 2, attributed: 0, unknown: 2 }); // the first is the window baseline
  });
});

describe('installation and legacy evidence (#4652)', () => {
  it('keeps two installations separate through mixed nested wrappers and deduplicates echoes', () => {
    const one = shim(2, 110, { id: 'app-installation-1', inv: 'inner', outer: 'outer', rl: [{ ...rl(110), cost: 1 }] });
    const two = shim(2, 900, { id: 'app-installation-2', inv: 'outer', rl: [{ ...rl(900), cost: 3 }] });
    const echo = { ...one, inv: 'echo' };
    const rows = rollupSpend([one, two, echo]);
    expect(rows.map((r) => [r.identity, r.attributed, r.responses])).toEqual([
      ['app-installation-1', 1, 1], ['app-installation-2', 3, 1],
    ]);
    expect(rows.reduce((sum, r) => sum + r.requests, 0)).toBe(1);
  });

  it('does not credit interleaved invisible traffic to legacy callers or learn its cost', () => {
    const result = rollupSpendDetailed([shim(1, 100), shim(2, 140)]);
    expect(result.rows[0]).toMatchObject({ bucketUsed: 40, attributed: 0, unattributed: 40, unknownRequests: 2 });
    expect(result.opCost).toEqual({});
  });

  it('does not sort stale counters into apparent new spending or regress a carried baseline', () => {
    const result = rollupSpendDetailed([shim(1, 110), shim(2, 90), shim(3, 112)], {
      baselines: { [`app|graphql|${RESET}`]: { used: 100, t: T0 } },
    });
    expect(result.rows[0].bucketUsed).toBe(12);
    expect(result.baselines[`app|graphql|${RESET}`].used).toBe(112);
    expect(result.rows[0].unknownRequests).toBe(3);
  });
});

describe('bounded interval replay and coverage (#4654)', () => {
  function log(entries) {
    const logPath = join(mkdtempSync(join(tmpdir(), 'spend-interval-')), 'calls.jsonl');
    writeFileSync(logPath, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');
    return logPath;
  }
  it('distinguishes clock hour from trailing duration and excludes the end and future records', () => {
    // Same shape as 17:48–18:48Z, using the suite clock at 10:00Z.
    const logPath = log([shim(40, 100), shim(49, 103), shim(65, 107), shim(107, 110), shim(108, 120), shim(120, 150)]);
    const now = T0 + 108 * 60_000;
    const clock = collectSpendReport({ logPath, hours: 1, now });
    const trailing = collectSpendReport({ logPath, start: at(48), end: at(108) });
    expect(clock.interval).toEqual({ start: at(60), end: at(108), semantics: 'UTC-clock-hours-half-open' });
    expect(trailing.interval).toEqual({ start: at(48), end: at(108), semantics: 'explicit-half-open' });
    expect(clock.rows.reduce((s, r) => s + r.requests, 0)).toBe(2);
    expect(trailing.rows.reduce((s, r) => s + r.requests, 0)).toBe(3);
    expect(trailing.rows.reduce((s, r) => s + r.bucketUsed, 0)).toBe(10);
    const full = rollupSpend([shim(49, 103), shim(65, 107), shim(107, 110)], {
      baselines: attributeSpend([shim(40, 100)]).baselines,
    });
    expect(trailing.rows.map(({ provenance, ...row }) => row)).toEqual(full);
    expect(trailing.coverage.baselines[`app|graphql|${RESET}`].used).toBe(100);
    expect(trailing.coverage.captureComplete).toBe(false);
  });

  it('exposes skipped, invalid and unread bytes instead of claiming a complete zero', () => {
    const logPath = log([shim(1, 100), shim(2, 100)]);
    appendFileSync(logPath, 'invalid\n{"partial":');
    const report = collectSpendReport({ logPath, start: at(0), end: at(10), maxBytes: 100 });
    expect(report.coverage).toMatchObject({ readComplete: false, captureComplete: false, total: 'unknown', invalidLines: 1 });
    expect(report.coverage.skippedBytes).toBeGreaterThan(0);
    expect(report.coverage.unreadBytes).toBeGreaterThan(0);
    const text = renderSpendReport([], { hours: 1, by: 'caller', ...report });
    expect(text).toContain(logPath);
    expect(text).toContain(at(10));
    expect(text).toContain('INCOMPLETE');
    expect(text).toContain('spend unknown');
  });

  it('replays late appends over persisted overlap and marks old row cost as unknown', () => {
    const logPath = log([shim(1, 100), shim(2, 101)]);
    persistSpendHours({ logPath, now: T0 + HOURS(2) });
    appendFileSync(logPath, JSON.stringify(shim(3, 105)) + '\n');
    const report = collectSpendReport({ logPath, hours: 3, now: T0 + HOURS(2) });
    expect(report.rows[0]).toMatchObject({ bucketUsed: 5, requests: 3, provenance: 'live' });
    expect(report.coverage.persistedLiveOverlap).toBe(1);
    const legacy = { ...report.rows[0], accountingVersion: undefined, attributed: 5 };
    writeFileSync(spendPaths(logPath).hourlyPath, JSON.stringify(legacy) + '\n');
    writeFileSync(logPath, '');
    const old = collectSpendReport({ logPath, hours: 3, now: T0 + HOURS(2) });
    expect(old.rows[0]).toMatchObject({ identity: 'app', provenance: 'persisted-legacy', attributed: 0, unattributed: 5, unknownRequests: 3 });
  });

  it('keeps reset windows independent and observed zero distinct from missing baselines', () => {
    const logPath = log([shim(1, 100), shim(2, 100), shim(3, 5, { rl: [rl(5, 'graphql', RESET + 3600)] })]);
    const report = collectSpendReport({ logPath, start: at(1.5), end: at(4) });
    expect(report.rows[0]).toMatchObject({ bucketUsed: 0, unknown: false, unknownRequests: 2 });
    expect(Object.keys(report.coverage.resetWindows)).toHaveLength(2);
    const missing = collectSpendReport({ logPath, start: at(3), end: at(4) });
    expect(missing.rows[0]).toMatchObject({ bucketUsed: null, unknown: true });
  });
});
