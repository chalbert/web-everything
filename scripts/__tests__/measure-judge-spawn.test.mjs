/**
 * @file measure-judge-spawn.test.mjs — `--repeat` reuses one session id per arm, and the summary derives
 *   reads-per-write and cache hit rate stamped with the conditions block (#3514).
 *
 * No real `claude` is spawned. The end-to-end cases run the actual script against a fake CLI that reports a
 * cache WRITE the first time it sees a session id and a cache READ every time after — so a regression back to
 * a fresh id per iteration shows up as zero reads, exactly the symptom #3514 exists to end.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { armSessionIds, cacheSplit, cacheSummary, conditions, measure } from '../measure-judge-spawn.mjs';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'measure-judge-spawn.mjs');

const FAKE_CLI = `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const argv = process.argv.slice(2);
if (argv[0] === '--version') { process.stdout.write('0.0.0-fake\\n'); process.exit(0); }
const dir = process.env.FAKE_CLAUDE_STATE;
const sid = argv[argv.indexOf('--session-id') + 1];
const arm = argv.includes('--safe-mode') ? 'treatment' : 'control';
const marker = path.join(dir, sid);
const warm = fs.existsSync(marker);
fs.writeFileSync(marker, '');
fs.appendFileSync(path.join(dir, 'calls.log'), arm + ' ' + sid + '\\n');
process.stdin.resume();
process.stdin.on('end', () => {
  process.stdout.write(JSON.stringify({
    is_error: false, stop_reason: 'tool_use', session_id: sid, total_cost_usd: 0.001, duration_ms: 5, num_turns: 1,
    structured_output: { verdict: 'reject', finding: 'division by zero' },
    usage: { input_tokens: 10, cache_creation_input_tokens: warm ? 0 : 1000, cache_read_input_tokens: warm ? 1000 : 0, output_tokens: 7 },
  }));
});
`;

describe('cacheSplit', () => {
  it('reads both cache halves from a usage block', () => {
    expect(cacheSplit({ cache_read_input_tokens: 5, cache_creation_input_tokens: 3, input_tokens: 9 })).toEqual({ read: 5, write: 3 });
  });

  it('counts missing, null, non-numeric and non-finite fields as 0', () => {
    expect(cacheSplit()).toEqual({ read: 0, write: 0 });
    expect(cacheSplit(null)).toEqual({ read: 0, write: 0 });
    expect(cacheSplit({ cache_read_input_tokens: '5', cache_creation_input_tokens: NaN })).toEqual({ read: 0, write: 0 });
    expect(cacheSplit({ cache_read_input_tokens: Infinity })).toEqual({ read: 0, write: 0 });
  });
});

describe('cacheSummary', () => {
  const run = (read, write, input = 0) => ({ usage: { cache_read_input_tokens: read, cache_creation_input_tokens: write, input_tokens: input } });

  it('sums reads over writes and reads over loaded context', () => {
    const s = cacheSummary([run(0, 1000, 10), run(1000, 0, 10), run(1000, 0, 10)]);
    expect(s).toEqual({ cacheReadTokens: 2000, cacheWriteTokens: 1000, readsPerWrite: 2, cacheHitRate: Number((2000 / 3030).toFixed(3)) });
  });

  it('is null, not 0 or Infinity, when nothing was written or nothing was loaded', () => {
    expect(cacheSummary([run(500, 0, 10)]).readsPerWrite).toBeNull();
    expect(cacheSummary([run(500, 0, 10)]).cacheHitRate).toBeCloseTo(0.98, 2);
    expect(cacheSummary([])).toEqual({ cacheReadTokens: 0, cacheWriteTokens: 0, readsPerWrite: null, cacheHitRate: null });
    expect(cacheSummary([{ usage: {} }]).cacheHitRate).toBeNull();
  });

  it('reports a cold run as 0 reads per write rather than null', () => {
    expect(cacheSummary([run(0, 1000)]).readsPerWrite).toBe(0);
  });

  it('ignores errored, skipped and usage-less runs', () => {
    const s = cacheSummary([run(0, 100), null, { error: 'boom', usage: { cache_read_input_tokens: 9999 } }, {}]);
    expect(s.cacheReadTokens).toBe(0);
    expect(s.cacheWriteTokens).toBe(100);
  });
});

describe('session ids', () => {
  it('one id per arm per stamp: stable within a run, distinct across arms and runs', () => {
    const a = armSessionIds('2026-01-01T00:00:00.000Z');
    expect(armSessionIds('2026-01-01T00:00:00.000Z')).toEqual(a);
    expect(a.treatment).not.toBe(a.control);
    expect(armSessionIds('2026-01-01T00:00:00.001Z').treatment).not.toBe(a.treatment);
  });

  it('are recorded in the conditions block, with no control id when the control arm is skipped', () => {
    const base = { cwd: tmpdir(), model: 'haiku', effort: 'medium', budget: 0.5, cli: 'no-such-cli-3514', repeat: 2 };
    const now = new Date('2026-01-01T00:00:00.000Z');
    const both = conditions(base, now);
    expect(both.treatmentSessionId).toBe(armSessionIds(now.toISOString()).treatment);
    expect(both.controlSessionId).toBe(armSessionIds(now.toISOString()).control);
    expect(both.readsPerWriteDefinition).toMatch(/cache_read_input_tokens/);
    expect(conditions({ ...base, treatmentOnly: true }, now).controlSessionId).toBeNull();
  });
});

describe('measure — the loop, with the spawn substituted', () => {
  const opts = { cwd: tmpdir(), model: 'haiku', effort: 'medium', budget: 0.5, cli: 'no-such-cli-3514', repeat: 3, treatmentOnly: false };
  const sidOf = (argv) => argv[argv.indexOf('--session-id') + 1];

  it('hands every iteration of an arm the same session id', async () => {
    const seen = { treatment: [], control: [] };
    const run = async (argv) => {
      seen[argv.includes('--safe-mode') ? 'treatment' : 'control'].push(sidOf(argv));
      return { tokens: 1, wallMs: 1, usage: {} };
    };
    const { conditions: cond, pairs } = await measure(opts, { run });
    expect(pairs).toHaveLength(3);
    expect(seen.treatment).toEqual(Array(3).fill(cond.treatmentSessionId));
    expect(seen.control).toEqual(Array(3).fill(cond.controlSessionId));
  });

  it('never spawns the control arm under treatmentOnly', async () => {
    const calls = [];
    const { pairs, summary } = await measure({ ...opts, treatmentOnly: true }, { run: async (argv) => { calls.push(argv); return { tokens: 1, wallMs: 1, usage: {} }; } });
    expect(calls.every((a) => a.includes('--safe-mode'))).toBe(true);
    expect(pairs.every((p) => p.control === null)).toBe(true);
    expect(summary.control).toMatchObject({ runs: 0, readsPerWrite: null, cacheHitRate: null });
  });
});

describe('measure-judge-spawn.mjs end to end, against a fake CLI', () => {
  let dir;
  let cli;
  const runScript = (args) => execFileSync(process.execPath, [SCRIPT, `--cli=${cli}`, `--cwd=${dir}`, ...args], {
    encoding: 'utf8',
    env: { ...process.env, FAKE_CLAUDE_STATE: dir },
  });

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'measure-3514-'));
    cli = join(dir, 'fake-claude');
    writeFileSync(cli, FAKE_CLI);
    chmodSync(cli, 0o755);
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('--repeat=3 --json: iterations 2+ read the cache, and reads per write is derived per arm', () => {
    const { conditions: cond, pairs, summary } = JSON.parse(runScript(['--repeat=3', '--json']));

    const calls = readFileSync(join(dir, 'calls.log'), 'utf8').trim().split('\n').map((l) => l.split(' '));
    expect(new Set(calls.filter(([a]) => a === 'treatment').map(([, s]) => s))).toEqual(new Set([cond.treatmentSessionId]));
    expect(new Set(calls.filter(([a]) => a === 'control').map(([, s]) => s))).toEqual(new Set([cond.controlSessionId]));

    expect(pairs[0].treatment.usage.cache_read_input_tokens).toBe(0);
    expect(pairs[1].treatment.usage.cache_read_input_tokens).toBeGreaterThan(0);
    expect(pairs[2].control.usage.cache_read_input_tokens).toBeGreaterThan(0);
    for (const arm of [summary.treatment, summary.control]) {
      expect(arm).toMatchObject({ runs: 3, cacheReadTokens: 2000, cacheWriteTokens: 1000, readsPerWrite: 2 });
      expect(arm.cacheHitRate).toBeCloseTo(2000 / 3030, 3);
    }
  });

  it('human output: the conditions block precedes every figure, including the cache summary', () => {
    const text = runScript(['--repeat=2', '--treatment-only']);
    const block = text.indexOf('── conditions');
    expect(block).toBe(0);
    expect(text.indexOf('run 1  treatment')).toBeGreaterThan(block);
    expect(text).toMatch(/treatmentSessionId\s+[0-9a-f-]{36}/);
    expect(text).toMatch(/run 2 {2}treatment: \d+ tok \(cache read 1000, write 0\)/);
    expect(text).toMatch(/treatment {2}reads per write 1 {3}hit rate \d+\.\d%/);
    expect(text).toMatch(/control {4}no successful runs/);
  });
});
