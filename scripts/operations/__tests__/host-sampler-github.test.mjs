import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { GH_BUDGET_EVERY_SEC, credentialOf, ghBudgetDue, parseRateLimit } from '../host-sampler-github.mjs';
import { runOnce } from '../host-sampler.mjs';
import { METRIC_NAMES } from '../telemetry.mjs';
import { createFileTelemetryStore } from '../telemetry-store.mjs';

const T0 = Date.parse('2026-09-23T20:00:00.000Z');
const DOC = JSON.stringify({ resources: {
  core: { limit: 5000, used: 4990, remaining: 10, reset: T0 / 1000 + 600 },
  graphql: { limit: 5000, used: 12, remaining: 4988, reset: T0 / 1000 + 3000 },
  search: { limit: 30, used: 0, remaining: 30, reset: T0 / 1000 + 60 },
} });

describe('parseRateLimit — the recorded buckets of a `gh api rate_limit` document', () => {
  it('reads core and graphql, leaves the others out', () => {
    expect(parseRateLimit(DOC)).toEqual([
      { bucket: 'core', limit: 5000, used: 4990, remaining: 10, resetAtMs: T0 + 600_000 },
      { bucket: 'graphql', limit: 5000, used: 12, remaining: 4988, resetAtMs: T0 + 3_000_000 },
    ]);
  });
  it('a bucket missing from the document is left out, never reported as 0', () => {
    expect(parseRateLimit(JSON.stringify({ resources: { graphql: { limit: 1, used: 0, remaining: 1 } } }))).toEqual([{ bucket: 'graphql', limit: 1, used: 0, remaining: 1, resetAtMs: null }]);
  });
  it('anything that is not a rate-limit document is null', () => {
    expect(parseRateLimit('')).toBeNull();
    expect(parseRateLimit('{"message":"Bad credentials"}')).toBeNull();
    expect(parseRateLimit('not json')).toBeNull();
  });
});

describe('ghBudgetDue and credentialOf', () => {
  it('is due on the first sample and every GH_BUDGET_EVERY_SEC after', () => {
    expect(ghBudgetDue({ lastAtMs: undefined, nowMs: T0 })).toBe(true);
    expect(ghBudgetDue({ lastAtMs: T0, nowMs: T0 + (GH_BUDGET_EVERY_SEC - 1) * 1000 })).toBe(false);
    expect(ghBudgetDue({ lastAtMs: T0, nowMs: T0 + GH_BUDGET_EVERY_SEC * 1000 })).toBe(true);
  });
  it('names the credential, never its value', () => {
    expect(credentialOf({ GH_TOKEN: 'secret' })).toBe('env:GH_TOKEN');
    expect(credentialOf({ GITHUB_TOKEN: 'secret' })).toBe('env:GITHUB_TOKEN');
    expect(credentialOf({})).toBe('gh-auth');
  });
  it('both metric names are in the closed vocabulary', () => {
    expect(METRIC_NAMES).toEqual(expect.arrayContaining(['gh.rate_limit.remaining', 'gh.rate_limit.error']));
  });
});

describe('the sampler records the budget (injected gh, real sampler otherwise)', () => {
  let dir; let stateDir; let env;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'hs-gh-tel-'));
    stateDir = mkdtempSync(join(tmpdir(), 'hs-gh-state-'));
    env = { ...process.env, HOST_SAMPLER_DIR: stateDir, WE_TELEMETRY: '1', OPERATION_TELEMETRY_DIR: dir };
    delete env.GH_TOKEN; delete env.GITHUB_TOKEN;
  });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); rmSync(stateDir, { recursive: true, force: true }); });
  const run = (execGh, github = true) => runOnce({ env, store: createFileTelemetryStore({ dir }), rollover: false, github, io: { sessions: { agents: [], facts: {} }, execGh } });
  const written = (name) => readdirSync(dir).filter((f) => f.endsWith('.jsonl')).flatMap((f) => readFileSync(join(dir, f), 'utf8').split('\n')).filter((l) => l.includes(`"${name}"`)).map((l) => JSON.parse(l));

  it('writes one gh.rate_limit.remaining per bucket, then waits GH_BUDGET_EVERY_SEC before the next read', async () => {
    let calls = 0;
    const execGh = () => { calls += 1; return DOC; };
    const a = await run(execGh);
    expect(a.sample.github).toMatchObject({ credential: 'gh-auth', buckets: [{ bucket: 'core', remaining: 10 }, { bucket: 'graphql', remaining: 4988 }] });
    const recs = written('gh.rate_limit.remaining');
    expect(recs.map((r) => [r.attributes.bucket, r.value, r.attributes.used, r.attributes.credential])).toEqual([['core', 10, 4990, 'gh-auth'], ['graphql', 4988, 12, 'gh-auth']]);
    const b = await run(execGh);
    expect(b.sample.github).toBeNull();
    expect(calls).toBe(1);
  });

  it('a failed read is recorded as an error, never as a remaining of 0', async () => {
    const a = await run(() => { throw Object.assign(new Error('boom'), { code: 1 }); });
    expect(a.sample.github).toEqual({ buckets: null, error: 'gh-failed', credential: 'gh-auth' });
    expect(written('gh.rate_limit.remaining')).toEqual([]);
    expect(written('gh.rate_limit.error').map((r) => r.attributes.reason)).toEqual(['gh-failed']);
  });

  it('is never read unless the caller opts in (a test never reaches the network)', async () => {
    let calls = 0;
    const a = await run(() => { calls += 1; return DOC; }, false);
    expect(a.sample.github).toBeNull();
    expect(calls).toBe(0);
  });
});
