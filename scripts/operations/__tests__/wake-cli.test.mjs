/**
 * @file wake-cli.test.mjs — the waker's CLI block, which nothing used to execute (#3037, PR #1211 review F2).
 *
 * WHAT WAS UNTESTED, AND WHY IT IS THE SAME DEFECT CLASS AS AN UNREGISTERED OPERATION. `wake.mjs`'s
 * `if (IS_CLI)` block is the ONLY place the dispatch observer is wired in production. `wake.test.mjs` imports
 * the pure functions; `__fixtures__/observe-dispatch.mjs` builds its own observer table. So
 * `const observers = createDispatchObservers()` could be replaced with `{}` and all 163 test files stayed
 * green — an observer nothing reaches is the same shape of defect as a declaration nothing can resolve, which
 * `gate-health` shipped with once and which `dispatch-lane.test.mjs` now has a named test against.
 *
 * SO THIS DRIVES THE REAL CLI, in a real child process, and asserts what it OBSERVED WITH. Only `claude` is
 * stubbed — a two-line `sh` script on the child's `PATH` that records its argv and prints a canned listing.
 * That makes the child's `PATH` carry no real `claude`: **no agent is started and no `claude` process runs.**
 * Stubbing it that way also pins, across a real process boundary, that the listing is read as
 * `claude agents --json` and NEVER with `--all` (review F6) — with `--all` a finished build reads `running`
 * forever, which the observer's own docblock calls the one mistake that makes an observer worse than none.
 *
 * The third case drives `--resolve`, the close-out surface the review's F1 said did not exist: until it did,
 * an operator's only remedy for a dispatch the observer can never call `succeeded` was hand-written node,
 * once per completed build, forever.
 */

import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';

import { advanceWhileRunning, runStatus, startRun } from '../engine.mjs';
import { applyPendingEffects } from '../effect-executor.mjs';
import { createFileRunStore } from '../run-store.mjs';
import { createRegistry } from '../registry.mjs';
import { DISPATCH_LANE_OP, dispatchLaneOperation } from '../dispatch-lane.mjs';
import { createDispatchSinks } from '../dispatch-lane-io.mjs';
import { closeOutEntry, flagValue } from '../wake.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const WAKE_CLI = resolve(HERE, '..', 'wake.mjs');
const RUN_ID = 'run-wake-cli';
const KEY = `${RUN_ID}#2#0`;
const HANDLE = 'ffffffff-1111-2222-3333-444444444444';
/** A PRIMARY checkout — the sink refuses to dispatch from a lane clone, which is what the default resolves to. */
const PRIMARY = '/primary/webeverything';
const BRIEF = 'build #{{ITEM_NUM}} at {{ITEM_SPEC_PATH}} in lane {{LANE}} as {{SESSION_SLUG}} scoped {{SCOPE}}';

let dir;
let binDir;
let argvFile;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'we-wake-cli-runs-'));
  binDir = mkdtempSync(join(tmpdir(), 'we-wake-cli-bin-'));
  argvFile = join(binDir, 'argv.txt');
  // THE STUB `claude`. `sh` builtins only, so it needs nothing on `PATH` itself — which lets the child run with
  // a `PATH` holding this directory and nothing else, and therefore with no way to reach a real `claude`.
  const stub = join(binDir, 'claude');
  writeFileSync(stub, '#!/bin/sh\nprintf \'%s\\n\' "$*" > "$STUB_ARGV_FILE"\nprintf \'%s\' "$STUB_AGENTS"\n');
  chmodSync(stub, 0o755);
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  rmSync(binDir, { recursive: true, force: true });
});

/** Park a real dispatch run on disk, aged past the observer's 2-minute listing grace and far short of escalation. */
async function parkOneDispatch() {
  const registry = createRegistry();
  registry.register(dispatchLaneOperation({
    readTick: () => ({
      resolvedNum: '3037',
      launch: { num: '3037', lane: 8 },
      suppressed: null,
      item: { num: '3037', slug: 'declare-dispatch', specPath: 'backlog/3037-declare-dispatch.md', scope: ['we:scripts/operations/'] },
      briefTemplate: BRIEF,
      nextState: { tick: 1, buildGuards: [{ num: '3037', lane: 8, spawnedTick: 0 }] },
      statusLine: 'conveyor · 1 building',
      notes: [],
      bookkeepingSource: 'file',
      observedAt: new Date().toISOString(),
    }),
  }));

  const store = createFileRunStore(dir);
  let run = advanceWhileRunning(startRun({ op: DISPATCH_LANE_OP, id: RUN_ID, input: { num: '3037' }, registry }), { registry });
  expect(runStatus(run, { registry })).toBe('awaiting-effect');
  // `claude --bg` is not run on this side either; the in-flight write, the handle and the deadline are real.
  const sinks = createDispatchSinks({ root: PRIMARY, spawnAgent: () => '', mintSessionId: () => HANDLE });
  run = (await applyPendingEffects(run, { sinks, store })).run;
  expect(run.effects[0].status).toBe('in-flight');

  // TEN MINUTES OLD: past `LISTING_GRACE_MS` (a just-started session is legitimately still `running` even when
  // absent), and nowhere near `STUCK_ESCALATION_HOURS`, which would make the CLI exit non-zero.
  const startedAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  run = { ...run, effects: run.effects.map((e) => ({ ...e, startedAt })) };
  store.write(run);
  return run;
}

/** Run the REAL `wake.mjs` CLI in a child whose `PATH` holds only the stub `claude`. */
function runWakeCli(args = [], { agents = '[]' } = {}) {
  return execFileSync(process.execPath, [WAKE_CLI, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      HOME: process.env.HOME,
      PATH: binDir,
      OPERATION_RUNS_DIR: dir,
      STUB_AGENTS: agents,
      STUB_ARGV_FILE: argvFile,
    },
  });
}

describe('the waker CLI registers the dispatch observer — the half of the feature no test reached', () => {
  it('OBSERVES a parked dispatch with the real observer, not with an empty table', async () => {
    await parkOneDispatch();
    const out = runWakeCli([], { agents: JSON.stringify([{ sessionId: HANDLE, kind: 'background' }]) });

    // The session is live, so the observer says `running`. An UNREGISTERED observer cannot produce this: the
    // entry would come back `skipped` with reason `no-observer`, which is the mutation the review ran (M23).
    expect(out).toMatch(/1 run\(s\) scanned, 1 parked/);
    expect(out).toMatch(new RegExp(`still running ${KEY.replace(/[#]/g, '#')}`));
    expect(out).not.toMatch(/SKIPPED/);
    expect(out).not.toMatch(/no-observer/);
    expect(out).toMatch(/now awaiting-effect/);
    // …and the record is untouched, because a live session resolves nothing.
    expect(createFileRunStore(dir).read(RUN_ID).effects[0]).toMatchObject({ status: 'in-flight', handle: HANDLE });
  });

  it('reads the live sessions as `claude agents --json`, and NEVER with `--all`', async () => {
    await parkOneDispatch();
    runWakeCli([], { agents: JSON.stringify([{ sessionId: HANDLE }]) });
    // The argv the CLI actually handed `claude`, recorded by the stub across a real process boundary.
    expect(readFileSync(argvFile, 'utf8').trim()).toBe('agents --json');
  });

  it('a session that is GONE is reported for a person, and the line NAMES the close-out command', async () => {
    await parkOneDispatch();
    const out = runWakeCli([], { agents: '[]' });
    expect(out).toMatch(/NEEDS A PERSON/);
    expect(out).toMatch(/liveness and not outcome/);
    expect(out).toMatch(new RegExp(`wake\\.mjs --resolve=${RUN_ID} --key=<effectKey>`));
    // `unresolved` WRITES NOTHING — the entry is still in flight, which is why a close-out surface has to exist.
    expect(createFileRunStore(dir).read(RUN_ID).effects[0].status).toBe('in-flight');
  });
});

describe('--resolve closes an in-flight entry out — the way out of a dispatch the observer can never settle', () => {
  it('records the operator\'s verdict on the entry and un-parks the run', async () => {
    await parkOneDispatch();
    const out = runWakeCli([`--resolve=${RUN_ID}`, `--key=${KEY}`, '--status=failed', '--note=the build never opened a PR']);
    expect(out).toMatch(new RegExp(`${RUN_ID}:${KEY.replace(/[#]/g, '#')} closed out as .failed.`));
    const entry = createFileRunStore(dir).read(RUN_ID).effects[0];
    expect(entry.status).toBe('failed');
    expect(entry.error).toMatch(/never opened a PR/);

    // AND THE WEDGE IS GONE: the next pass no longer sees the run parked at all, which is the whole remedy.
    expect(runWakeCli([], { agents: '[]' })).toMatch(/none parked on a dispatch/);
  });

  it('reports a refused close-out on stdout and exits non-zero rather than failing silently', async () => {
    await parkOneDispatch();
    // ONE child covers the CLI's own error path; the refusal RULES are `resolveInFlight`'s and are asserted
    // in-process below, because a `node` spawn per case costs seconds and proves nothing extra.
    let stdout = '';
    try { runWakeCli([`--resolve=${RUN_ID}`, `--key=${KEY}`, '--status=maybe']); expect.unreachable('must exit non-zero'); } catch (e) {
      stdout = String(e.stdout || '');
      expect(e.status).toBe(1);
    }
    expect(stdout).toMatch(/terminal status/);
    expect(createFileRunStore(dir).read(RUN_ID).effects[0].status).toBe('in-flight');
  });

  it('refuses an incomplete or unknown close-out rather than guessing', async () => {
    const run = await parkOneDispatch();
    const store = { read: (id) => (id === RUN_ID ? run : null), write: () => { throw new Error('must not write'); } };
    expect(() => closeOutEntry({ runId: RUN_ID, status: 'failed', store })).toThrow(/needs both --resolve=<runId> and --key=/);
    expect(() => closeOutEntry({ runId: 'nope', key: KEY, status: 'failed', store })).toThrow(/no run record for/);
    expect(() => closeOutEntry({ runId: RUN_ID, key: 'not-a-key', status: 'failed', store })).toThrow(/has no effect/);
    expect(() => closeOutEntry({ runId: RUN_ID, key: KEY, status: 'maybe', store })).toThrow(/terminal status/);
  });

  it('parses the flags the way the CLI branch reads them', () => {
    // `--resolve` PRESENT WITH NO VALUE must still take the close-out branch (and then refuse), rather than
    // silently falling through to a full waking pass the operator did not ask for.
    expect(flagValue(['--resolve=r1', '--key=k'], 'resolve')).toBe('r1');
    expect(flagValue(['--resolve'], 'resolve')).toBe('');
    expect(flagValue(['--key=k'], 'resolve')).toBeUndefined();
    expect(flagValue(['--note=a=b'], 'note')).toBe('a=b');
  });
});
