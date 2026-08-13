/**
 * @file dispatch-lane-defaults.test.mjs — the DEFAULT spawners, which nothing used to execute (#3037).
 *
 * WHY THIS FILE EXISTS. `dispatch-lane-io.mjs` injects every subprocess call, and every other test overrides
 * every one of them — which is exactly right for testing the logic and exactly wrong for testing the DEFAULTS.
 * PR #1211's review made the point with mutations: all three timeouts (F5) and the observer's deliberate
 * absence of `--all` (F6) could be deleted with the whole suite green, because the code carrying them ran in no
 * test at all. Those are among the most emphatic claims the module makes — the `--all` docblock calls passing it
 * *"the one mistake that makes an observer worse than none"* — and a claim asserted by nothing is a claim the
 * next refactor removes for free.
 *
 * NO PROCESS IS STARTED HERE. The three default functions take an `execFileSync`-shaped call for exactly this
 * reason; each test hands them a spy and asserts the argv and the option bag they build.
 */

import { describe, it, expect } from 'vitest';

import {
  DISPATCH_EFFECT,
} from '../dispatch-lane.mjs';
import {
  LIST_TIMEOUT_MS,
  SPAWN_TIMEOUT_MS,
  TICK_TIMEOUT_MS,
  createDispatchObservers,
  createDispatchSinks,
  defaultListAgents,
  defaultRunNode,
  defaultSpawnAgent,
  readTick,
} from '../dispatch-lane-io.mjs';

/** An `execFileSync`-shaped spy that records its call and answers with `out`. */
function spyExec(out = '[]') {
  const calls = [];
  const exec = (file, argv, opts) => { calls.push({ file, argv, opts }); return out; };
  return { exec, calls };
}

describe('the default subprocess calls are BOUNDED — every one of them', () => {
  it('the tick read is bounded, and it is the only network-bound call in the module', () => {
    // `tick-core` shells `conveyor-state`, `dispatch-plan`, the free-lane picker and one `gh pr view` per
    // bounced PR, and it runs synchronously inside the CLI. A wedged `gh` must not hang a caller forever.
    const { exec, calls } = spyExec('{}');
    defaultRunNode(['/repo/scripts/conveyor/tick-core.mjs'], { cwd: '/repo', input: '{}' }, { exec });
    expect(calls).toHaveLength(1);
    expect(calls[0].file).toBe(process.execPath);
    expect(calls[0].opts).toMatchObject({ timeout: TICK_TIMEOUT_MS, killSignal: 'SIGKILL', encoding: 'utf8' });
    // The caller's own opts still ride, and still cannot be silently dropped by the default.
    expect(calls[0].opts).toMatchObject({ cwd: '/repo', input: '{}' });
  });

  it('the agent spawn is bounded — `claude --bg` returns immediately, so a hang here is a hang in the executor', () => {
    const { exec, calls } = spyExec('');
    defaultSpawnAgent(['--bg', '--session-id', 'sess-x', '-n', 'conveyor-3037', 'go'], { cwd: '/repo' }, { exec });
    expect(calls[0].file).toBe('claude');
    expect(calls[0].opts).toMatchObject({ timeout: SPAWN_TIMEOUT_MS, killSignal: 'SIGKILL' });
    expect(calls[0].opts.cwd).toBe('/repo');
  });

  it('the agent listing is bounded — it sits inside a waker pass that promises to be fail-soft per run', () => {
    const { exec, calls } = spyExec('[]');
    defaultListAgents({ exec });
    expect(calls[0].opts).toMatchObject({ timeout: LIST_TIMEOUT_MS, killSignal: 'SIGKILL' });
  });
});

describe('the observer reads LIVE sessions only', () => {
  it('does NOT pass `--all` — with it, every finished build would read `running` forever', () => {
    // The module's most emphatic negative claim, and it was protected by nothing: `--all` also lists COMPLETED
    // sessions, so the observer's "absent means gone" branch would never be reached again.
    const { exec, calls } = spyExec('[]');
    defaultListAgents({ exec });
    expect(calls[0].file).toBe('claude');
    expect(calls[0].argv).toEqual(['agents', '--json']);
    expect(calls[0].argv).not.toContain('--all');
  });

  it('parses the listing, and an empty answer is an empty array rather than a throw', () => {
    expect(defaultListAgents({ exec: () => '[{"sessionId":"s1"}]' })).toEqual([{ sessionId: 's1' }]);
    expect(defaultListAgents({ exec: () => '' })).toEqual([]);
  });
});

describe('the PRODUCTION callers reach those defaults — a tested default nothing uses is the same defect', () => {
  // THE SECOND HALF OF F5, found by mutating this fix rather than the original code: asserting
  // `defaultRunNode` builds a timeout proves nothing if `readTick`'s own default quietly stopped being it.
  // Each of these drives the real factory with NOTHING overridden except the process boundary itself.

  it('the tick reader goes through `defaultRunNode`, timeout and all', () => {
    const { exec, calls } = spyExec('{"decisions":{},"nextState":{}}');
    readTick({
      num: '3037',
      exec,
      readText: () => 'brief {{ITEM_NUM}}',
      loadItems: () => [],
      listInFlightDispatches: () => ({ runs: [], unreadable: 0 }),
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].opts).toMatchObject({ timeout: TICK_TIMEOUT_MS, killSignal: 'SIGKILL' });
  });

  it('the sink goes through `defaultSpawnAgent`, timeout and all', async () => {
    const { exec, calls } = spyExec('');
    const sinks = createDispatchSinks({ root: '/primary/webeverything', exec, mintSessionId: () => 'sess-z9' });
    await sinks[DISPATCH_EFFECT]({ num: '3037', sessionSlug: 'conveyor-3037', prompt: '# go', expectedWithinMinutes: 90 });
    expect(calls[0].file).toBe('claude');
    expect(calls[0].argv.slice(0, 3)).toEqual(['--bg', '--session-id', 'sess-z9']);
    expect(calls[0].opts).toMatchObject({ timeout: SPAWN_TIMEOUT_MS, killSignal: 'SIGKILL' });
  });

  it('the observer goes through `defaultListAgents` — same argv, still no `--all`', async () => {
    const { exec, calls } = spyExec('[]');
    const observers = createDispatchObservers({ exec, now: () => new Date('2026-08-13T12:00:00.000Z') });
    await observers[DISPATCH_EFFECT]({ handle: 'sess-gone', startedAt: '2026-08-13T10:00:00.000Z' }, { handle: 'sess-gone' });
    expect(calls[0].argv).toEqual(['agents', '--json']);
    expect(calls[0].opts).toMatchObject({ timeout: LIST_TIMEOUT_MS, killSignal: 'SIGKILL' });
  });
});
