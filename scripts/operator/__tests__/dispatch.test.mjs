import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  didAgentDoSomething, parseHolderSlug, leaseLane, unleaseLane,
  buildFixPrompt, buildCiHealPrompt, buildReviewPrompt,
  runAgent, isTransientCiFailure, runIdsFromFailingChecks, healCi,
} from '../dispatch.mjs';

describe('didAgentDoSomething (converge.py:176-189 — a clean exit is not a done job)', () => {
  it('false at and under the 400-byte threshold', () => {
    expect(didAgentDoSomething(400)).toBe(false);
    expect(didAgentDoSomething(0)).toBe(false);
  });
  it('true just over the threshold', () => {
    expect(didAgentDoSomething(401)).toBe(true);
  });
});

describe('parseHolderSlug (converge.py:91-110 — lease() stderr parse)', () => {
  it('extracts the slug between "holder slug:" and the em-dash', () => {
    const stderr = 'acquired lane-5\n  holder slug: port-converge-lane-5-9845a925 — if a SIBLING agent...\n';
    expect(parseHolderSlug(stderr)).toBe('port-converge-lane-5-9845a925');
  });
  it('null when the line is absent (acquire failed or refused)', () => {
    expect(parseHolderSlug('some other error\n')).toBeNull();
  });
});

describe('leaseLane / unleaseLane', () => {
  it('leaseLane returns the parsed slug on success', () => {
    const calls = [];
    const exec = (cmd, argv, opts) => {
      calls.push({ cmd, argv, opts });
      return { stdout: '', stderr: 'holder slug: my-slug-123 — prove it\n' };
    };
    const slug = leaseLane({ lane: 5, purpose: 'conv-1671-fix-r1', repo: '/repo', exec });
    expect(slug).toBe('my-slug-123');
    expect(calls[0].argv).toEqual(['scripts/lane-pool.mjs', 'acquire', '--lane=5', '--purpose=conv-1671-fix-r1', '--no-reset']);
    expect(calls[0].opts.cwd).toBe('/repo');
  });

  it('leaseLane reports UNLEASED via onUnleased and returns null on a failed acquire', () => {
    const exec = () => ({ stdout: '', stderr: 'lane-5 is contested by another holder\n' });
    const reports = [];
    const slug = leaseLane({ lane: 5, purpose: 'x', exec, onUnleased: (m) => reports.push(m) });
    expect(slug).toBeNull();
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatch(/UNLEASED/);
  });

  it('unleaseLane is a no-op when slug is null', () => {
    const calls = [];
    unleaseLane({ lane: 5, slug: null, exec: (...a) => calls.push(a) });
    expect(calls).toHaveLength(0);
  });

  it('unleaseLane releases by lane and session when a slug is held', () => {
    const calls = [];
    const exec = (cmd, argv, opts) => { calls.push({ cmd, argv, opts }); return {}; };
    unleaseLane({ lane: 5, slug: 'my-slug-123', repo: '/repo', exec });
    expect(calls[0].argv).toEqual(['scripts/lane-pool.mjs', 'release', '--lane=5', '--session=my-slug-123']);
    expect(calls[0].opts.cwd).toBe('/repo');
  });
});

describe('prompt builders (converge.py FIX/CI_HEAL/REVIEW templates, ported verbatim)', () => {
  it('buildFixPrompt interpolates pr/branch/lanePath and carries the bar-setting rules', () => {
    const p = buildFixPrompt({ pr: 1671, branch: 'lane/x', lanePath: '/lanes/lane-5' });
    expect(p).toContain('pull request #1671');
    expect(p).toContain('git fetch origin lane/x');
    expect(p).toContain('cd /lanes/lane-5');
    expect(p).toContain('git push origin HEAD:lane/x');
    expect(p).toContain('DO NOT BUNDLE A STRANDED-HASH HEAL');
  });

  it('buildCiHealPrompt interpolates and stays narrowly scoped to CI, not a re-review', () => {
    const p = buildCiHealPrompt({ pr: 42, branch: 'lane/y', lanePath: '/lanes/lane-7' });
    expect(p).toContain('pull request #42');
    expect(p).toContain('gh pr checks 42 --repo chalbert/web-everything');
    expect(p).toContain('Do NOT touch anything the accepted review did not ask you to touch');
  });

  it('buildReviewPrompt interpolates pr/drvPath/jurorPath and requires --cwd', () => {
    const p = buildReviewPrompt({ pr: 9, drvPath: '/lanes/lane-1', jurorPath: '/lanes/lane-2' });
    expect(p).toContain('--pr=9');
    expect(p).toContain('--cwd=/lanes/lane-2');
    expect(p).toContain('You work in `/lanes/lane-1`');
    expect(p).toContain('POLL IN THIS TURN');
  });
});

// A fake `child_process.spawn` child: an EventEmitter with `.kill`/`.pid`, driven by the test.
function fakeChild() {
  const child = new EventEmitter();
  child.pid = 4242;
  child.killed = false;
  child.kill = (sig) => { child.killed = true; child.killSignal = sig; };
  return child;
}

describe('runAgent (converge.py run_agent, ported)', () => {
  let scratch;
  beforeEach(() => { scratch = mkdtempSync(join(tmpdir(), 'dispatch-test-')); });
  afterEach(() => { rmSync(scratch, { recursive: true, force: true }); });

  const baseExec = (responses = {}) => (cmd, argv) => {
    if (cmd === 'gh' && argv[0] === 'pr' && argv[1] === 'view') {
      return { stdout: (responses.prState ?? 'OPEN') + '\n' };
    }
    if (cmd === 'node' && argv[1] === 'acquire') return { stdout: '', stderr: 'holder slug: s-1 — prove it\n' };
    if (cmd === 'node' && argv[1] === 'release') return {};
    if (cmd === 'git') return {};
    return { stdout: '' };
  };

  it('skips dispatch when the PR is already MERGED/CLOSED, without leasing a lane', () => {
    const leaseCalls = [];
    const exec = (cmd, argv) => {
      if (cmd === 'node' && argv[1] === 'acquire') leaseCalls.push(argv);
      return baseExec({ prState: 'MERGED' })(cmd, argv);
    };
    return runAgent({
      prompt: 'x', lane: 5, tag: '1671-fix-r1', repo: '/repo', lanesDir: '/lanes', scratchDir: scratch,
      execFn: exec, spawnFn: () => { throw new Error('must not spawn'); },
    }).then((st) => {
      expect(st).toBe('skipped (MERGED)');
      expect(leaseCalls).toHaveLength(0);
    });
  });

  it('ok: exits 0 and wrote enough to the log', async () => {
    let child;
    const spawnFn = () => { child = fakeChild(); return child; };
    const p = runAgent({
      prompt: 'x', lane: 5, tag: '1671-fix-r1', repo: '/repo', lanesDir: '/lanes', scratchDir: scratch,
      execFn: baseExec(), spawnFn,
    });
    // give the promise a tick to reach the spawn + write, then simulate the child finishing.
    await new Promise((r) => setTimeout(r, 10));
    writeFileSync(join(scratch, 'conv-1671-fix-r1.log'), 'x'.repeat(500));
    child.emit('close', 0);
    expect(await p).toBe('ok');
    expect(existsSync(join(scratch, '.worker-lane-5.json'))).toBe(false); // claim removed
  });

  it('no-op: exits 0 but the log stayed under the threshold', async () => {
    let child;
    const spawnFn = () => { child = fakeChild(); return child; };
    const p = runAgent({
      prompt: 'x', lane: 5, tag: '1671-fix-r1', repo: '/repo', lanesDir: '/lanes', scratchDir: scratch,
      execFn: baseExec(), spawnFn,
    });
    await new Promise((r) => setTimeout(r, 10));
    writeFileSync(join(scratch, 'conv-1671-fix-r1.log'), 'too short');
    child.emit('close', 0);
    expect(await p).toBe('no-op (agent exited without working — see the log)');
  });

  it('unverified: did something, exited 0, but the caller verify() says the outcome is absent', async () => {
    let child;
    const spawnFn = () => { child = fakeChild(); return child; };
    const p = runAgent({
      prompt: 'x', lane: 5, tag: '1671-fix-r1', repo: '/repo', lanesDir: '/lanes', scratchDir: scratch,
      execFn: baseExec(), spawnFn, verify: () => false,
    });
    await new Promise((r) => setTimeout(r, 10));
    writeFileSync(join(scratch, 'conv-1671-fix-r1.log'), 'x'.repeat(500));
    child.emit('close', 0);
    expect(await p).toBe('unverified (agent finished but the outcome it was sent to produce is absent)');
  });

  it('exit<N> on a non-zero exit', async () => {
    let child;
    const spawnFn = () => { child = fakeChild(); return child; };
    const p = runAgent({
      prompt: 'x', lane: 5, tag: '1671-fix-r1', repo: '/repo', lanesDir: '/lanes', scratchDir: scratch,
      execFn: baseExec(), spawnFn,
    });
    await new Promise((r) => setTimeout(r, 10));
    child.emit('close', 2);
    expect(await p).toBe('exit2');
  });

  it('timeout: kills the child and stashes the lane before returning', async () => {
    let child;
    const stashCalls = [];
    const exec = (cmd, argv, opts) => {
      if (cmd === 'git' && argv.includes('stash')) { stashCalls.push({ argv, opts }); return {}; }
      return baseExec()(cmd, argv, opts);
    };
    const spawnFn = () => { child = fakeChild(); return child; };
    const p = runAgent({
      prompt: 'x', lane: 5, tag: '1671-fix-r1', timeoutMs: 5,
      repo: '/repo', lanesDir: '/lanes', scratchDir: scratch, execFn: exec, spawnFn,
    });
    // Let the timeout fire (5ms) and kill the child; then the harness's own `close(null)` follows the kill.
    await new Promise((r) => setTimeout(r, 20));
    expect(child.killed).toBe(true);
    child.emit('close', null);
    expect(await p).toBe('timeout(work stashed)');
    expect(stashCalls).toHaveLength(1);
    expect(stashCalls[0].argv).toEqual(['-C', '/lanes/lane-5', 'stash', 'push', '-u', '-m', 'salvaged from timed-out 1671-fix-r1']);
    expect(stashCalls[0].opts.env.LANE_SESSION).toBe('salvage');
  });
});

describe('isTransientCiFailure (converge.py:497-499 — classify by conclusion, not log text)', () => {
  it('true when every job conclusion is a no-fix-needed one', () => {
    expect(isTransientCiFailure([{ conclusion: 'startup_failure' }, { conclusion: 'success' }])).toBe(true);
    expect(isTransientCiFailure([{ conclusion: 'cancelled' }])).toBe(true);
    expect(isTransientCiFailure([{ conclusion: 'timed_out' }])).toBe(true);
    expect(isTransientCiFailure([{ conclusion: null }])).toBe(true);
    expect(isTransientCiFailure([])).toBe(true);
  });
  it('false when any job actually failed', () => {
    expect(isTransientCiFailure([{ conclusion: 'failure' }])).toBe(false);
    expect(isTransientCiFailure([{ conclusion: 'success' }, { conclusion: 'failure' }])).toBe(false);
  });
});

describe('runIdsFromFailingChecks (converge.py regex, ported)', () => {
  it('extracts run ids only from FAILURE rows, deduplicated, in order', () => {
    const rows = [
      { state: 'SUCCESS', link: 'https://github.com/x/y/actions/runs/1/job/9' },
      { state: 'FAILURE', link: 'https://github.com/x/y/actions/runs/2/job/9' },
      { state: 'FAILURE', link: 'https://github.com/x/y/actions/runs/2/job/10' },
      { state: 'FAILURE', link: 'https://github.com/x/y/actions/runs/3/job/9' },
    ];
    expect(runIdsFromFailingChecks(rows)).toEqual(['2', '3']);
  });
  it('empty when no failing row has a parseable run id', () => {
    expect(runIdsFromFailingChecks([{ state: 'FAILURE', link: 'not-a-url' }])).toEqual([]);
  });
});

describe('healCi (converge.py heal_ci, ported)', () => {
  it('clears a stale ci:failed label when every check is now green', async () => {
    const calls = [];
    const exec = (cmd, argv) => {
      calls.push(argv);
      if (argv[0] === 'pr' && argv[1] === 'checks') return { stdout: JSON.stringify([{ name: 'test', state: 'SUCCESS' }]) };
      return { stdout: '' };
    };
    const st = await healCi({ pr: 9, branch: 'lane/x', lane: 5, execFn: exec });
    expect(st).toBe('cleared stale ci:failed (every check passed)');
    expect(calls.some((a) => a.includes('--remove-label'))).toBe(true);
  });

  it('reruns transient failures without dispatching a fix agent', async () => {
    const runAgentFn = () => { throw new Error('must not dispatch a fixer for a transient failure'); };
    const rerunCalls = [];
    const exec = (cmd, argv) => {
      if (argv[0] === 'pr' && argv[1] === 'checks') {
        return { stdout: JSON.stringify([{ name: 'test', state: 'FAILURE', link: 'https://x/actions/runs/7/job/1' }]) };
      }
      if (argv[0] === 'run' && argv[1] === 'view') return { stdout: JSON.stringify({ jobs: [{ conclusion: 'startup_failure' }] }) };
      if (argv[0] === 'run' && argv[1] === 'rerun') { rerunCalls.push(argv); return {}; }
      return { stdout: '' };
    };
    const st = await healCi({ pr: 9, branch: 'lane/x', lane: 5, execFn: exec, runAgentFn });
    expect(st).toContain('transient');
    expect(rerunCalls).toHaveLength(1);
  });

  it('dispatches a CI_HEAL fix agent for a real failure', async () => {
    const dispatched = [];
    const runAgentFn = async (o) => { dispatched.push(o); return 'ok'; };
    const exec = (cmd, argv) => {
      if (argv[0] === 'pr' && argv[1] === 'checks') {
        return { stdout: JSON.stringify([{ name: 'test', state: 'FAILURE', link: 'https://x/actions/runs/7/job/1' }]) };
      }
      if (argv[0] === 'run' && argv[1] === 'view') return { stdout: JSON.stringify({ jobs: [{ conclusion: 'failure' }] }) };
      return { stdout: '' };
    };
    const st = await healCi({ pr: 9, branch: 'lane/x', lane: 5, execFn: exec, runAgentFn });
    expect(st).toContain('real failure');
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].tag).toBe('9-ci-heal');
    expect(dispatched[0].prompt).toContain('pull request #9');
  });
});
