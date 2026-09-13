/**
 * @file ci-heal-dispatch-wrapper.test.mjs — coverage for the `ci-heal` mechanical arc (#3642).
 *
 * The sibling of `./fix-dispatch-wrapper.test.mjs`, and deliberately the same shape: the load-bearing
 * contracts here are the exact CLI argv shelled, the outcome→stand-down mapping, the ordering of
 * started/done completion records around the rebase + agent spawn + gate + converge, and the ONE rule this
 * axis has that the other does not — **no review label is ever touched, on any path**.
 *
 * The reused half (`buildFixAgentEnv`'s `repair` stamp, `runFixGateWithOneRetry`, `standDown`,
 * `acquireLane --base=`, `runConverge`'s `dispatchKind`) is asserted HERE too rather than assumed to still
 * work because `fix`'s own suite covers it: what this file is proving is that the CI-HEAL arc reaches those
 * pieces correctly, which is a different claim from "they work".
 *
 * NOTHING HERE SPAWNS A PROCESS, shells `gh` or `git`, or starts a runner. Every process boundary is injected.
 */
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

// Same seam, same fix, as `fix-dispatch-wrapper.test.mjs`'s own: the default `readBrief` reads a real file off
// a `REPO_ROOT`-derived path, which does not resolve reliably inside vitest's SSR transform. Stub that ONE
// read; leave every other fs call genuinely real via the `actual` spread (this suite does real temp-dir work).
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal();
  const readFileSyncMock = vi.fn((path, ...rest) => {
    if (String(path).includes('ci-heal-agent-brief-v2.md')) return 'Read $LANE/.ci-heal-failure.md and repair it.';
    return actual.readFileSync(path, ...rest);
  });
  const mocked = { ...actual, readFileSync: readFileSyncMock };
  return { ...mocked, default: mocked };
});

import {
  CI_HEAL_DIAGNOSIS_SCRATCH_FILENAME, CI_HEAL_LANE_PURPOSE, CI_HEAL_LOG_TAIL_BYTES, CI_HEAL_REASONS,
  CI_HEAL_AGENT_PROVIDERS, resolveCiHealAgentProvider,
  buildCiHealAgentEnv, buildCiHealDiagnosis, ciHealMark, dispatchCiHeal, findFailingChecks,
  planCiHealDispatchWrapper, readFailedRunLog, readPrChecks, rebaseOntoMain, resolveCiHealTarget,
  runIdFromCheckLink,
} from '../ci-heal-dispatch-wrapper.mjs';
import { pushLaneRef, FIX_AGENT_SPAWN_TIMEOUT_MS } from '../fix-dispatch-wrapper.mjs';
import { newFixReport, writeFixReport } from '../fix-report-store.mjs';
import { REPAIR_AGENT_KIND } from '../dispatch-lane.mjs';
import { DELIVERY_AGENT_PROVIDER_NAMES } from '../deliver-item-wrapper.mjs';

describe('planCiHealDispatchWrapper', () => {
  it('derives the ci-heal-<pr> session slug and normalises item/reason', () => {
    expect(planCiHealDispatchWrapper({ pr: 743, repo: 'chalbert/web-everything', item: 2638, reason: 'red-ci' }))
      .toEqual({ pr: 743, repo: 'chalbert/web-everything', item: '2638', reason: 'red-ci', sessionSlug: 'ci-heal-743' });
    expect(planCiHealDispatchWrapper({ pr: '743', repo: 'a/b' }))
      .toEqual({ pr: 743, repo: 'a/b', item: null, reason: null, sessionSlug: 'ci-heal-743' });
  });

  it('refuses a non-positive-integer --pr and a malformed --repo', () => {
    expect(() => planCiHealDispatchWrapper({ pr: 0, repo: 'a/b' })).toThrow(/--pr must be a positive integer/);
    expect(() => planCiHealDispatchWrapper({ pr: 'nope', repo: 'a/b' })).toThrow(/--pr must be a positive integer/);
    expect(() => planCiHealDispatchWrapper({ pr: 1, repo: 'not-a-slug' })).toThrow(/--repo must be an `owner\/repo` slug/);
  });
});

describe('the CI-side resolver — the half that does NOT carry over from `fix`', () => {
  it('findFailingChecks keys on `bucket`, and falls back to `state` when a row has none', () => {
    const checks = [
      { name: 'test', bucket: 'fail' },
      { name: 'lint', bucket: 'pass' },
      { name: 'flaky', bucket: 'cancel' },
      { name: 'pending-one', bucket: 'pending' },
      { name: 'no-bucket', state: 'FAILURE' },
      { name: 'no-bucket-ok', state: 'SUCCESS' },
    ];
    expect(findFailingChecks(checks).map((c) => c.name)).toEqual(['test', 'flaky', 'no-bucket']);
    expect(findFailingChecks(null)).toEqual([]);
    expect(findFailingChecks(undefined)).toEqual([]);
  });

  it('runIdFromCheckLink pulls the Actions run id, and answers null for a non-Actions target URL', () => {
    expect(runIdFromCheckLink('https://github.com/o/r/actions/runs/123456/job/789')).toBe('123456');
    expect(runIdFromCheckLink('https://example.com/some/external/status')).toBeNull();
    expect(runIdFromCheckLink(null)).toBeNull();
  });

  it('readPrChecks RECOVERS the JSON from a non-zero `gh pr checks` — the exit code it always has here', () => {
    // `gh pr checks` exits non-zero (8) whenever any check is failing or pending, which is precisely the state
    // a CI heal is dispatched INTO. A naive `run()` call throws on every real heal and discards the JSON.
    const payload = JSON.stringify([{ name: 'test', bucket: 'fail' }]);
    const run = vi.fn(() => {
      const e = new Error('Command failed with exit code 8');
      e.stdout = payload;
      throw e;
    });
    expect(readPrChecks({ pr: 743, repo: 'a/b' }, { run }).map((c) => c.name)).toEqual(['test']);
    expect(run.mock.calls[0][1]).toEqual([
      'pr', 'checks', '743', '--repo', 'a/b', '--json', 'name,state,bucket,link,workflow,description',
    ]);
  });

  it('…but a throw carrying NO stdout is a genuine failure and is re-raised', () => {
    const run = vi.fn(() => { throw new Error('gh: could not resolve repository'); });
    expect(() => readPrChecks({ pr: 743, repo: 'a/b' }, { run })).toThrow(/could not resolve repository/);
  });

  it('readFailedRunLog tail-truncates a huge log and degrades to null rather than failing the heal', () => {
    const huge = 'x'.repeat(CI_HEAL_LOG_TAIL_BYTES + 500) + 'THE-REAL-ERROR';
    const out = readFailedRunLog({ runId: '1', repo: 'a/b' }, { run: () => huge });
    expect(out).toContain('THE-REAL-ERROR');            // the TAIL is what is kept
    expect(out).toContain('truncated');
    expect(out.length).toBeLessThan(huge.length);
    expect(readFailedRunLog({ runId: null, repo: 'a/b' }, { run: () => { throw new Error('nope'); } })).toBeNull();
    expect(readFailedRunLog({ runId: '1', repo: 'a/b' }, { run: () => { throw new Error('gone'); } })).toBeNull();
  });

  it('resolveCiHealTarget reads headRefName + mergeStateStatus + the failing checks + one run log', () => {
    const run = vi.fn(() => JSON.stringify({ headRefName: 'lane/2638-foo', mergeStateStatus: 'BLOCKED' }));
    const target = resolveCiHealTarget({ pr: 743, repo: 'a/b' }, {
      run,
      readChecks: () => [
        { name: 'lint', bucket: 'pass' },
        { name: 'test', bucket: 'fail', link: 'https://github.com/o/r/actions/runs/55/job/9' },
      ],
      readLog: ({ runId }) => `log for run ${runId}`,
    });
    expect(target.headRefName).toBe('lane/2638-foo');
    expect(target.mergeStateStatus).toBe('BLOCKED');
    expect(target.failingChecks.map((c) => c.name)).toEqual(['test']);
    expect(target.log).toBe('log for run 55');
    expect(run.mock.calls[0]).toEqual([
      'gh', ['pr', 'view', '743', '--json', 'headRefName,mergeStateStatus', '--repo', 'a/b'],
    ]);
  });
});

describe('buildCiHealDiagnosis — the ONLY place the failure reaches the agent', () => {
  it('names every failing check, the rebase result, and the log tail', () => {
    const md = buildCiHealDiagnosis({
      pr: 743,
      reason: 'red-ci',
      mergeStateStatus: 'BLOCKED',
      rebase: 'rebased',
      failingChecks: [{ name: 'test', workflow: 'CI', state: 'FAILURE', bucket: 'fail', description: 'boom', link: 'https://x/1' }],
      log: 'Error: expected 1 got 2',
    });
    expect(md).toContain('# CI failure on PR #743');
    expect(md).toContain('`red-ci`');
    expect(md).toContain('**test**');
    expect(md).toContain('boom');
    expect(md).toContain('https://x/1');
    expect(md).toContain('Error: expected 1 got 2');
    expect(md).toContain('**rebased**');
  });

  it('with nothing red it says so explicitly, so a rebase-only heal is not read as a missing diagnosis', () => {
    const md = buildCiHealDiagnosis({ pr: 743, reason: 'behind', mergeStateStatus: 'BEHIND', rebase: 'rebased', failingChecks: [], log: null });
    expect(md).toContain('No required check is currently RED');
    expect(md).not.toContain('## Failing checks');
  });
});

describe('rebaseOntoMain', () => {
  it('fetches then rebases, and reports `rebased` when HEAD actually moved', () => {
    const calls = [];
    let head = 'aaa';
    const run = vi.fn((cmd, args) => {
      calls.push([cmd, ...args]);
      if (args[0] === 'rev-parse') return head;
      if (args[0] === 'rebase') { head = 'bbb'; return ''; }
      return '';
    });
    expect(rebaseOntoMain({ lanePath: '/lane' }, { run })).toEqual({ status: 'rebased', detail: null });
    expect(calls[0]).toEqual(['git', 'fetch', 'origin', 'main']);
    expect(calls).toContainEqual(['git', 'rebase', 'origin/main']);
  });

  it('reports `already-current` when the rebase was a no-op — no code change is needed for that', () => {
    const run = vi.fn((cmd, args) => (args[0] === 'rev-parse' ? 'aaa' : ''));
    expect(rebaseOntoMain({ lanePath: '/lane' }, { run }).status).toBe('already-current');
  });

  it('ABORTS and reports `conflict` rather than handing an agent a half-rebased lane', () => {
    const calls = [];
    const run = vi.fn((cmd, args) => {
      calls.push(args.join(' '));
      if (args[0] === 'rebase' && args[1] === 'origin/main') throw new Error('CONFLICT (content): merge conflict in a.mjs');
      return 'aaa';
    });
    const out = rebaseOntoMain({ lanePath: '/lane' }, { run });
    expect(out.status).toBe('conflict');
    expect(out.detail).toMatch(/CONFLICT/);
    expect(calls).toContain('rebase --abort');
  });
});

describe('buildCiHealAgentEnv', () => {
  it('reuses `buildFixAgentEnv` VERBATIM — including its `repair` stamp, which is already the shared kind', () => {
    const env = buildCiHealAgentEnv({
      sessionSlug: 'ci-heal-743', pr: 743, item: '2638', lanePath: '/pool/lane-3', reportsDir: '/r', reason: 'behind',
    });
    // The whole reason this item needed NO new `WE_DISPATCH_KIND` value and NO `guard-bash.mjs` change.
    expect(env.WE_DISPATCH_KIND).toBe(REPAIR_AGENT_KIND);
    expect(env.FIX_SESSION).toBe('ci-heal-743');
    expect(env.FIX_PR).toBe('743');
    expect(env.FIX_ITEM).toBe('2638');
    expect(env.LANE).toBe('/pool/lane-3');
    expect(env.OPERATION_FIX_REPORTS_DIR).toBe('/r');
    expect(env.FIX_REPORT_CLI_PATH).toEqual(expect.stringContaining('fix-report-cli.mjs'));
    // …plus the one variable a CI heal has and a review repair does not.
    expect(env.CI_HEAL_REASON).toBe('behind');
  });

  it('CI_HEAL_REASON is an empty string rather than `undefined` when the dispatch carried no reason', () => {
    expect(buildCiHealAgentEnv({ sessionSlug: 's', pr: 1, item: null, lanePath: '/l', reportsDir: '/r' }).CI_HEAL_REASON).toBe('');
  });
});

describe('the hand-back — a healed CI run is NEVER a re-arm', () => {
  it('ciHealMark shells ci-heal-mark.mjs with the repo, the reason and a wrapper-named actor', () => {
    const run = vi.fn();
    ciHealMark({ pr: 743, repo: 'a/b', reason: 'red-ci' }, { run });
    expect(run).toHaveBeenCalledWith('node', [
      'scripts/conveyor/ci-heal-mark.mjs', '743', '--repo=a/b',
      '--actor=the #3642 mechanical CI-heal wrapper', '--reason=red-ci',
    ]);
  });

  it('an unrecognised reason is OMITTED rather than passed through — the marker CLI has its own fallback', () => {
    const run = vi.fn();
    ciHealMark({ pr: 743, repo: 'a/b', reason: 'something-else' }, { run });
    expect(run.mock.calls[0][1]).not.toContain('--reason=something-else');
    expect(CI_HEAL_REASONS).toEqual(['red-ci', 'behind']);
  });

  it('pushLaneRef takes `--force-with-lease` for this kind, and stays a plain push for `fix`', () => {
    const run = vi.fn();
    pushLaneRef({ lanePath: '/lane', laneRef: 'lane/2638-foo', forceWithLease: true }, { run });
    expect(run).toHaveBeenCalledWith('git', ['push', '--force-with-lease', 'origin', 'HEAD:refs/heads/lane/2638-foo'], { cwd: '/lane' });
    run.mockClear();
    // The DEFAULT is unchanged, which is what keeps `fix`'s own call byte-identical.
    pushLaneRef({ lanePath: '/lane', laneRef: 'lane/2108-bar' }, { run });
    expect(run).toHaveBeenCalledWith('git', ['push', 'origin', 'HEAD:refs/heads/lane/2108-bar'], { cwd: '/lane' });
  });
});

describe('dispatchCiHeal — the whole arc', () => {
  let reportsDir;
  let previousDir;
  let lane;

  beforeEach(() => {
    reportsDir = mkdtempSync(join(tmpdir(), 'we-op-ci-heal-'));
    previousDir = process.env.OPERATION_FIX_REPORTS_DIR;
    process.env.OPERATION_FIX_REPORTS_DIR = reportsDir;
    lane = mkdtempSync(join(tmpdir(), 'we-op-ci-heal-lane-'));
  });
  afterEach(() => {
    if (previousDir === undefined) delete process.env.OPERATION_FIX_REPORTS_DIR;
    else process.env.OPERATION_FIX_REPORTS_DIR = previousDir;
    rmSync(reportsDir, { recursive: true, force: true });
    rmSync(lane, { recursive: true, force: true });
  });

  /** A fake provider whose `spawn` writes a REAL fix-report record (through the real store, respecting the env
   *  override above) rather than needing a real `claude` process. */
  function fakeProvider(outcome = 'fixed', { reason, filesTouched = ['a.mjs'], learning } = {}) {
    return {
      spawn: vi.fn(({ sessionSlug, pr, item }) => {
        const record = newFixReport({ session: sessionSlug, pr, item });
        writeFixReport({
          ...record, status: 'done', outcome, reason: reason ?? (outcome === 'fixed' ? null : 'a specific reason'),
          filesTouched, learning: learning ?? null,
        });
      }),
    };
  }

  function fakeRun({
    headRefName = 'lane/2638-foo',
    mergeStateStatus = 'BLOCKED',
    checks = [{ name: 'test', bucket: 'fail', link: 'https://github.com/o/r/actions/runs/55/job/9' }],
    verify = () => JSON.stringify({ verdict: { ok: true } }),
    convergeInit = JSON.stringify({ action: 'land', round: 1, verdict: 'land', dismissed: [] }),
    lanePath = null,
    rebaseThrows = false,
  } = {}) {
    const resolvedLanePath = lanePath ?? lane;
    return vi.fn((cmd, args = [], opts) => {
      if (cmd === 'node' && args[0] === 'scripts/operations/completion-cli.mjs') return '{}';
      if (cmd === 'gh' && args[0] === 'pr' && args[1] === 'view') return JSON.stringify({ headRefName, mergeStateStatus });
      if (cmd === 'gh' && args[0] === 'pr' && args[1] === 'checks') return JSON.stringify(checks);
      if (cmd === 'gh' && args[0] === 'run' && args[1] === 'view') return 'the failing step log';
      if (cmd === 'node' && args[0] === 'scripts/lane-pool.mjs' && args[1] === 'acquire') return resolvedLanePath;
      if (cmd === 'node' && args[0] === 'scripts/lane-pool.mjs' && args[1] === 'release') return '';
      if (cmd === 'node' && args[0] === 'scripts/verify-lane.mjs') return JSON.stringify({ status: 'reset' });
      if (cmd === 'node' && args[0] === 'scripts/operations/run.mjs' && args[1] === 'verify') return verify();
      if (cmd === 'node' && args[0] === 'scripts/converge-cli.mjs' && args[1] === 'init') return convergeInit;
      if (cmd === 'git' && args[0] === 'fetch') return '';
      if (cmd === 'git' && args[0] === 'rev-parse') return 'aaa';
      if (cmd === 'git' && args[0] === 'rebase' && args[1] === '--abort') return '';
      if (cmd === 'git' && args[0] === 'rebase') {
        if (rebaseThrows) throw new Error('CONFLICT (content): merge conflict in a.mjs');
        return '';
      }
      if (cmd === 'git' && args[0] === 'push') return '';
      if (cmd === 'node' && args[0] === 'scripts/conveyor/ci-heal-mark.mjs') return '';
      if (cmd === 'node' && args[0] === 'scripts/conveyor/stand-down.mjs') return '';
      if (cmd === 'node' && args[0] === 'scripts/conveyor/learnings-drop.mjs') return '';
      throw new Error(`fakeRun: unexpected run(${cmd}, ${JSON.stringify(args)}) opts=${JSON.stringify(opts)}`);
    });
  }

  /** Every `run` call as a flat `cmd arg arg …` string, for order/absence assertions. */
  const shelled = (run) => run.mock.calls.map(([cmd, args = []]) => [cmd, ...args].join(' '));

  it('the happy path: resolves the failure, acquires with --base=<lane ref>, rebases, spawns once, gate green, '
    + 'converge lands, force-with-lease pushes, posts the CI-heal comment, reports done, releases', async () => {
    const run = fakeRun();
    const provider = fakeProvider('fixed');
    const result = await dispatchCiHeal(
      { pr: 743, repo: 'chalbert/web-everything', item: '2638', reason: 'red-ci' },
      provider,
      { run, newSessionId: () => 'sess-1' },
    );

    expect(result.result).toMatch(/ci-healed, re-pushed/);
    const cmds = shelled(run);
    // The acquire is the UNNUMBERED, `--base=<the PR's own ref>` shape — reconstituting, never rebuilding.
    expect(cmds).toContainEqual(expect.stringContaining(`scripts/lane-pool.mjs acquire --purpose=${CI_HEAL_LANE_PURPOSE}`));
    expect(cmds).toContainEqual(expect.stringContaining('--base=lane/2638-foo'));
    expect(cmds.join('\n')).not.toMatch(/lane-pool\.mjs acquire .*--lane=/);
    // The rebase happened BEFORE the agent was ever spawned.
    expect(cmds).toContainEqual('git rebase origin/main');
    expect(provider.spawn).toHaveBeenCalledTimes(1);
    // The push is force-with-lease, to the PR's OWN ref, and the durable comment follows it.
    expect(cmds).toContainEqual('git push --force-with-lease origin HEAD:refs/heads/lane/2638-foo');
    expect(cmds).toContainEqual(expect.stringContaining('scripts/conveyor/ci-heal-mark.mjs 743'));
    expect(cmds).toContainEqual(expect.stringContaining('completion-cli.mjs report --session=ci-heal-743 --status=done --outcome=ci-healed'));
    expect(cmds).toContainEqual(expect.stringContaining('scripts/lane-pool.mjs release'));
  });

  it('NO PATH EVER TOUCHES A REVIEW LABEL — the hardest rule on this axis, asserted as absence', async () => {
    // Every terminal outcome the arc can reach, each run to completion, with one shared assertion: nothing
    // in the whole call log re-arms a review or edits a label. This is the enforcement the wrapper buys by
    // simply not importing `rearmReview` — asserted here so a later "convenience" import trips.
    const cases = [
      ['healed', () => fakeRun(), fakeProvider('fixed')],
      ['gate-red', () => fakeRun({ verify: () => JSON.stringify({ verdict: { ok: false, detail: 'red' } }) }), fakeProvider('fixed')],
      ['agent-escalated', () => fakeRun(), fakeProvider('escalated-needs-judgment')],
      ['rebase-conflict', () => fakeRun({ rebaseThrows: true }), fakeProvider('fixed')],
      ['converge-escalated', () => fakeRun({ convergeInit: JSON.stringify({ action: 'escalate', round: 3, verdict: 'escalate', reason: 'no agreement' }) }), fakeProvider('fixed')],
    ];
    for (const [name, mkRun, provider] of cases) {
      const run = mkRun();
      await dispatchCiHeal({ pr: 743, repo: 'a/b', item: '2638', reason: 'red-ci' }, provider, { run, newSessionId: () => 's' });
      const log = shelled(run).join('\n');
      expect(log, name).not.toMatch(/rearm-review/);
      expect(log, name).not.toMatch(/--add-label|--remove-label|gh pr edit/);
      expect(log, name).not.toMatch(/review:(human|pending|changes|accepted)/);
      expect(log, name).not.toMatch(/ready-to-merge/);
    }
  });

  it('nothing red and not BEHIND is `not-applicable` — a healthy PR is never rebased or force-pushed', async () => {
    const run = fakeRun({ checks: [{ name: 'test', bucket: 'pass' }], mergeStateStatus: 'CLEAN' });
    const provider = fakeProvider('fixed');
    const result = await dispatchCiHeal({ pr: 743, repo: 'a/b', reason: 'red-ci' }, provider, { run, newSessionId: () => 's' });

    expect(result.result).toMatch(/^not-applicable/);
    expect(provider.spawn).not.toHaveBeenCalled();
    const log = shelled(run).join('\n');
    expect(log).not.toMatch(/lane-pool\.mjs acquire/);
    expect(log).not.toMatch(/git push/);
    expect(log).toMatch(/--outcome=not-applicable/);
  });

  it('nothing red but BEHIND still heals — the rebase IS the repair', async () => {
    const run = fakeRun({ checks: [], mergeStateStatus: 'BEHIND' });
    const provider = fakeProvider('fixed', { filesTouched: [] });
    const result = await dispatchCiHeal({ pr: 743, repo: 'a/b', reason: 'behind' }, provider, { run, newSessionId: () => 's' });

    expect(result.result).toMatch(/ci-healed/);
    expect(shelled(run)).toContainEqual('git rebase origin/main');
    expect(shelled(run)).toContainEqual('git push --force-with-lease origin HEAD:refs/heads/lane/2638-foo');
  });

  it('a rebase-only heal (no files touched) SKIPS the converge pass — the brief\'s own proportionality rule', async () => {
    const run = fakeRun();
    await dispatchCiHeal({ pr: 743, repo: 'a/b' }, fakeProvider('fixed', { filesTouched: [] }), { run, newSessionId: () => 's' });
    expect(shelled(run).join('\n')).not.toMatch(/converge-cli\.mjs/);
    // …and the heal still lands.
    expect(shelled(run)).toContainEqual('git push --force-with-lease origin HEAD:refs/heads/lane/2638-foo');
  });

  it('…but a heal that DID change code runs it, stamping the wrapper-agent kind on the converge editor', async () => {
    const run = fakeRun();
    await dispatchCiHeal({ pr: 743, repo: 'a/b' }, fakeProvider('fixed', { filesTouched: ['a.mjs'] }), { run, newSessionId: () => 's' });
    expect(shelled(run).join('\n')).toMatch(/converge-cli\.mjs init/);
  });

  it('the converge EDITOR spawn is stamped `repair`, never the `ci-heal` LAUNCH kind', async () => {
    // The #3640 axis rule, asserted for this kind: the converge editor is a wrapper-owned restricted agent, so
    // it must carry a WRAPPER-AGENT kind. Stamping the launch kind would put it under a guard contract written
    // for an agent that runs its own lifecycle.
    const claudeCalls = [];
    let step = 0;
    const run = vi.fn((cmd, args = [], opts) => {
      if (cmd === 'node' && args[0] === 'scripts/operations/completion-cli.mjs') return '{}';
      if (cmd === 'gh' && args[1] === 'view') return JSON.stringify({ headRefName: 'lane/2638-foo', mergeStateStatus: 'BLOCKED' });
      if (cmd === 'gh' && args[1] === 'checks') return JSON.stringify([{ name: 'test', bucket: 'fail' }]);
      if (cmd === 'node' && args[0] === 'scripts/lane-pool.mjs') return args[1] === 'acquire' ? lane : '';
      if (cmd === 'node' && args[0] === 'scripts/verify-lane.mjs') return JSON.stringify({ status: 'reset' });
      if (cmd === 'node' && args[0] === 'scripts/operations/run.mjs' && args[1] === 'verify') return JSON.stringify({ verdict: { ok: true } });
      if (cmd === 'node' && args[0] === 'scripts/converge-cli.mjs' && args[1] === 'init') {
        return JSON.stringify({ action: 'edit', round: 1, roundCap: 5, edit: { prompt: 'repair the check' } });
      }
      if (cmd === 'node' && args[0] === 'scripts/converge-cli.mjs' && args[1] === 'step') {
        step += 1;
        return JSON.stringify({ action: 'land', round: 2, verdict: 'land', dismissed: [] });
      }
      if (cmd === 'claude') {
        claudeCalls.push(opts);
        return JSON.stringify({ result: JSON.stringify({ revised: true, advanced: true, dismissed: [], filesTouched: ['a.mjs'] }) });
      }
      if (cmd === 'git') return 'aaa';
      if (cmd === 'node' && args[0] === 'scripts/conveyor/ci-heal-mark.mjs') return '';
      throw new Error(`unexpected run(${cmd}, ${JSON.stringify(args)})`);
    });
    await dispatchCiHeal({ pr: 743, repo: 'a/b' }, fakeProvider('fixed'), {
      run, newSessionId: () => 's', ensureSettingsFile: () => '/tmp/settings.json',
    });
    expect(step).toBeGreaterThan(0);
    expect(claudeCalls.length).toBeGreaterThan(0);
    expect(claudeCalls[0].env.WE_DISPATCH_KIND).toBe(REPAIR_AGENT_KIND);
    expect(claudeCalls[0].env.WE_DISPATCH_KIND).not.toBe('ci-heal');
  });

  it('a REBASE CONFLICT stands down as `conflict` and never spawns the agent at all', async () => {
    const run = fakeRun({ rebaseThrows: true });
    const provider = fakeProvider('fixed');
    const result = await dispatchCiHeal({ pr: 743, repo: 'a/b' }, provider, { run, newSessionId: () => 's' });

    expect(result.result).toMatch(/rebase conflict with main/);
    expect(provider.spawn).not.toHaveBeenCalled();
    const log = shelled(run).join('\n');
    expect(log).toMatch(/stand-down\.mjs 743 --repo=a\/b --reason=conflict/);
    expect(log).toMatch(/--outcome=escalated-conflict/);
    expect(log).not.toMatch(/git push/);
    expect(log).toMatch(/lane-pool\.mjs release/);
  });

  it('a GATE that stays red after the one retry stands down `gate-red` and never re-pushes', async () => {
    let verifyCalls = 0;
    const run = fakeRun({
      verify: () => { verifyCalls += 1; return JSON.stringify({ verdict: { ok: false, detail: 'the test job failed' } }); },
    });
    const provider = fakeProvider('fixed');
    const result = await dispatchCiHeal({ pr: 743, repo: 'a/b' }, provider, { run, newSessionId: () => 's' });

    expect(result.result).toBe('stood-down (gate-red)');
    // TWO verify runs and TWO spawns: the original turn plus exactly ONE resume-and-retry.
    expect(verifyCalls).toBe(2);
    expect(provider.spawn).toHaveBeenCalledTimes(2);
    expect(provider.spawn.mock.calls[1][0].resumeSessionId).toBe('s');
    const log = shelled(run).join('\n');
    expect(log).toMatch(/stand-down\.mjs 743 --repo=a\/b --reason=gate-red/);
    expect(log).not.toMatch(/git push/);
    expect(log).not.toMatch(/ci-heal-mark/);
  });

  it('a gate that goes GREEN on the retry proceeds normally — the one retry is a real second chance', async () => {
    let verifyCalls = 0;
    const run = fakeRun({
      verify: () => {
        verifyCalls += 1;
        return verifyCalls === 1
          ? JSON.stringify({ verdict: { ok: false, detail: 'red once' } })
          : JSON.stringify({ verdict: { ok: true } });
      },
    });
    const result = await dispatchCiHeal({ pr: 743, repo: 'a/b' }, fakeProvider('fixed'), { run, newSessionId: () => 's' });
    expect(result.result).toMatch(/ci-healed/);
  });

  it('an agent outcome of `escalated-conflict` stands down `conflict`; anything else `needs-judgment`', async () => {
    for (const [outcome, expected] of [
      ['escalated-conflict', 'conflict'],
      ['escalated-needs-judgment', 'needs-judgment'],
      ['blocked', 'needs-judgment'],
    ]) {
      const run = fakeRun();
      const result = await dispatchCiHeal({ pr: 743, repo: 'a/b' }, fakeProvider(outcome), { run, newSessionId: () => 's' });
      expect(result.result, outcome).toBe(`stood-down (${outcome})`);
      expect(shelled(run).join('\n'), outcome).toMatch(new RegExp(`stand-down\\.mjs 743 --repo=a/b --reason=${expected}`));
      expect(shelled(run).join('\n'), outcome).not.toMatch(/git push/);
    }
  });

  it('a CONVERGE escalation stands down `needs-judgment` and never pushes', async () => {
    const run = fakeRun({ convergeInit: JSON.stringify({ action: 'escalate', round: 3, verdict: 'escalate', reason: 'no agreement on the heal' }) });
    const result = await dispatchCiHeal({ pr: 743, repo: 'a/b' }, fakeProvider('fixed'), { run, newSessionId: () => 's' });
    expect(result.result).toBe('stood-down (converge-escalated)');
    expect(shelled(run).join('\n')).toMatch(/stand-down\.mjs 743 --repo=a\/b --reason=needs-judgment/);
    expect(shelled(run).join('\n')).not.toMatch(/git push/);
  });

  it('an ACQUIRE whose --base ref no longer resolves is `not-applicable`, not an infra failure', async () => {
    const run = vi.fn((cmd, args = []) => {
      if (cmd === 'node' && args[0] === 'scripts/operations/completion-cli.mjs') return '{}';
      if (cmd === 'gh' && args[1] === 'view') return JSON.stringify({ headRefName: 'lane/gone', mergeStateStatus: 'BLOCKED' });
      if (cmd === 'gh' && args[1] === 'checks') return JSON.stringify([{ name: 'test', bucket: 'fail' }]);
      if (cmd === 'node' && args[0] === 'scripts/lane-pool.mjs' && args[1] === 'acquire') {
        throw new Error('--base=lane/gone does not resolve in lane-3\'s clone');
      }
      if (cmd === 'node' && args[0] === 'scripts/lane-pool.mjs') return '';
      throw new Error(`unexpected run(${cmd}, ${JSON.stringify(args)})`);
    });
    const result = await dispatchCiHeal({ pr: 743, repo: 'a/b' }, fakeProvider('fixed'), { run, newSessionId: () => 's' });
    expect(result.result).toMatch(/not-applicable \(lane ref lane\/gone gone\)/);
    expect(shelled(run).join('\n')).toMatch(/--outcome=not-applicable/);
    expect(shelled(run).join('\n')).toMatch(/lane-pool\.mjs release/);
  });

  it('an acquire that crashes for any OTHER reason is `blocked-on-infra` and rethrows', async () => {
    const run = vi.fn((cmd, args = []) => {
      if (cmd === 'node' && args[0] === 'scripts/operations/completion-cli.mjs') return '{}';
      if (cmd === 'gh' && args[1] === 'view') return JSON.stringify({ headRefName: 'lane/x', mergeStateStatus: 'BLOCKED' });
      if (cmd === 'gh' && args[1] === 'checks') return JSON.stringify([{ name: 'test', bucket: 'fail' }]);
      if (cmd === 'node' && args[0] === 'scripts/lane-pool.mjs' && args[1] === 'acquire') throw new Error('the pool is wedged');
      if (cmd === 'node' && args[0] === 'scripts/lane-pool.mjs') return '';
      throw new Error(`unexpected run(${cmd}, ${JSON.stringify(args)})`);
    });
    await expect(dispatchCiHeal({ pr: 743, repo: 'a/b' }, fakeProvider('fixed'), { run, newSessionId: () => 's' }))
      .rejects.toThrow(/the pool is wedged/);
    expect(shelled(run).join('\n')).toMatch(/--outcome=blocked-on-infra/);
  });

  it('no free lane after the bounded wait is `blocked-on-infra`, without a throw', async () => {
    const run = fakeRun({ lanePath: '' });
    const result = await dispatchCiHeal({ pr: 743, repo: 'a/b' }, fakeProvider('fixed'), { run, newSessionId: () => 's' });
    expect(result.result).toBe('blocked-on-infra (no free lane)');
  });

  it('the diagnosis scratch file is written into the lane and DELETED before the gate can see it', async () => {
    const run = fakeRun();
    let sawScratch = false;
    const provider = {
      spawn: vi.fn(({ sessionSlug, pr, item, lanePath }) => {
        sawScratch = existsSync(join(lanePath, CI_HEAL_DIAGNOSIS_SCRATCH_FILENAME));
        const record = newFixReport({ session: sessionSlug, pr, item });
        writeFixReport({ ...record, status: 'done', outcome: 'fixed', filesTouched: [] });
      }),
    };
    await dispatchCiHeal({ pr: 743, repo: 'a/b' }, provider, { run, newSessionId: () => 's' });
    expect(sawScratch).toBe(true);
    expect(existsSync(join(lane, CI_HEAL_DIAGNOSIS_SCRATCH_FILENAME))).toBe(false);
  });

  it('an agent that exits with NO done report is `blocked-on-infra` and rethrows — never a silent success', async () => {
    const run = fakeRun();
    const provider = { spawn: vi.fn(() => {}) }; // writes nothing
    await expect(dispatchCiHeal({ pr: 743, repo: 'a/b' }, provider, { run, newSessionId: () => 's' }))
      .rejects.toThrow(/exited with no done report/);
    expect(shelled(run).join('\n')).toMatch(/--outcome=blocked-on-infra/);
    expect(shelled(run).join('\n')).toMatch(/lane-pool\.mjs release/);
  });

  it('forwards the agent\'s optional learning on both the healed and the stood-down paths', async () => {
    const learning = { kind: 'friction', summary: 's', area: 'ci-heal', suggestion: 'x' };
    for (const outcome of ['fixed', 'blocked']) {
      const run = fakeRun();
      await dispatchCiHeal({ pr: 743, repo: 'a/b' }, fakeProvider(outcome, { learning }), { run, newSessionId: () => 's' });
      expect(shelled(run).join('\n'), outcome).toMatch(/learnings-drop\.mjs --kind=friction .*--session=ci-heal-743/);
    }
  });

  it('the durable `started` trace is written BEFORE anything that can fail', async () => {
    const run = vi.fn((cmd, args = []) => {
      if (cmd === 'node' && args[0] === 'scripts/operations/completion-cli.mjs') return '{}';
      throw new Error('gh exploded');
    });
    await expect(dispatchCiHeal({ pr: 743, repo: 'a/b' }, fakeProvider('fixed'), { run, newSessionId: () => 's' }))
      .rejects.toThrow(/gh exploded/);
    expect(shelled(run)[0]).toMatch(/completion-cli\.mjs report --session=ci-heal-743 --kind=ci-heal --pr=743 --status=started/);
  });
});

// ================================================================================================
// mechanical-dispatcher (epic #3383, Part 1) — the `ci-heal` kind's OWN provider registry, mirroring
// `fix-dispatch-wrapper.test.mjs`'s identical suite for its own registry.
// ================================================================================================
describe('CI_HEAL_AGENT_PROVIDERS registry / resolveCiHealAgentProvider (#3383)', () => {
  it('names the same two providers `build`/`fix` do, matching vocabulary', () => {
    expect(Object.keys(CI_HEAL_AGENT_PROVIDERS)).toEqual(DELIVERY_AGENT_PROVIDER_NAMES);
    expect(CI_HEAL_AGENT_PROVIDERS['claude-restricted'].name).toBe('claude-restricted-ci-heal');
    expect(CI_HEAL_AGENT_PROVIDERS.codex.name).toBe('codex');
    expect(typeof CI_HEAL_AGENT_PROVIDERS.codex.spawn).toBe('function');
  });

  it('resolves by name, defaults to claude-restricted, and refuses an unknown name by NAME', () => {
    expect(resolveCiHealAgentProvider()).toBe(CI_HEAL_AGENT_PROVIDERS['claude-restricted']);
    expect(resolveCiHealAgentProvider('codex')).toBe(CI_HEAL_AGENT_PROVIDERS.codex);
    expect(() => resolveCiHealAgentProvider('gemini')).toThrow(/unknown delivery agent provider "gemini"/);
    expect(() => resolveCiHealAgentProvider('gemini')).toThrow(/claude-restricted\|codex/);
  });

  // #3383 mechanical-dispatcher fix — the #3476 regression test for the CLAUDE ci-heal provider.
  it('claude-restricted-ci-heal.spawn resolves the reports dir WITH the (already-resolved) lane path — never bare', () => {
    const io = {
      ensureSettingsFile: vi.fn(() => '/fake/.operations/ci-heal-agent-hooks-settings.json'),
      spawnAgent: vi.fn(),
      persistFailure: vi.fn(),
      resolveReportsDir: vi.fn(() => '/tmp/ci-heal-reports'),
    };
    CI_HEAL_AGENT_PROVIDERS['claude-restricted'].spawn(
      {
        sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', prompt: 'p', lanePath: '/tmp/ci-heal-lane-3',
        sessionSlug: 'ci-heal-743', pr: 743, item: '2638', reason: 'red-ci',
      },
      io,
    );
    expect(io.resolveReportsDir).toHaveBeenCalledWith('/tmp/ci-heal-lane-3');
  });
});

// #3383 — CI_HEAL_CODEX_PROVIDER.spawn, mirroring `fix-dispatch-wrapper.test.mjs`'s own `FIX_CODEX_PROVIDER`
// suite, plus the one thing only this kind's env carries: `CI_HEAL_REASON`.
describe('CI_HEAL_CODEX_PROVIDER.spawn (#3383 — reusing the live-verified Codex spawn mechanics for `ci-heal`)', () => {
  const LANE_PATH = '/tmp/ci-heal-lane-9';
  const THREAD_EVENT = '{"type":"thread.started","thread_id":"01a0-ci-heal-thread"}\n{"type":"turn.completed"}\n';

  const io = (over = {}) => ({
    spawnAgent: vi.fn(() => THREAD_EVENT),
    persistFailure: vi.fn(),
    resolveReportsDir: vi.fn(() => '/tmp/fix-reports'),
    readThreadId: vi.fn(() => null),
    writeThreadId: vi.fn(),
    denyPaths: ['/tmp/primary/**'],
    ...over,
  });

  const REQ = {
    sessionId: 'claude-uuid', prompt: 'HEAL IT', lanePath: LANE_PATH, sessionSlug: 'ci-heal-743', pr: '743',
    item: '2638', reason: 'red-ci',
  };

  it('spawns `codex exec` in the ALREADY-RESOLVED lane clone', () => {
    const o = io();
    CI_HEAL_AGENT_PROVIDERS.codex.spawn(REQ, o);
    const [argv, opts] = o.spawnAgent.mock.calls[0];
    expect(argv.slice(0, 3)).toEqual(['exec', '-C', LANE_PATH]);
    expect(opts.cwd).toBe(LANE_PATH);
  });

  it('stamps the SAME real ci-heal env vars the Claude ci-heal provider does, including CI_HEAL_REASON', () => {
    const o = io();
    CI_HEAL_AGENT_PROVIDERS.codex.spawn(REQ, o);
    expect(o.spawnAgent.mock.calls[0][1].env).toMatchObject({
      WE_DISPATCH_KIND: REPAIR_AGENT_KIND,
      FIX_SESSION: 'ci-heal-743',
      FIX_PR: '743',
      FIX_ITEM: '2638',
      LANE: LANE_PATH,
      CI_HEAL_REASON: 'red-ci',
    });
  });

  // #3383 mechanical-dispatcher fix — the #3476 regression test (mirrors `fix-dispatch-wrapper.test.mjs`'s
  // own equivalent test): `resolveReportsDir` must be called WITH the (already-resolved) lane path, never
  // bare — bare, it silently names the primary checkout regardless of `lanePath`.
  it('resolves the reports dir WITH the (already-resolved) lane path — never bare', () => {
    const o = io();
    CI_HEAL_AGENT_PROVIDERS.codex.spawn(REQ, o);
    expect(o.resolveReportsDir).toHaveBeenCalledWith(LANE_PATH);
  });

  it('blocks on the fix/delivery-shared budget', () => {
    const o = io();
    CI_HEAL_AGENT_PROVIDERS.codex.spawn(REQ, o);
    expect(o.spawnAgent.mock.calls[0][1].timeout).toBe(FIX_AGENT_SPAWN_TIMEOUT_MS);
  });

  it('records the thread id Codex minted, keyed by sessionSlug (ci-heal-<pr>, never fix-<pr>)', () => {
    const o = io();
    CI_HEAL_AGENT_PROVIDERS.codex.spawn(REQ, o);
    expect(o.writeThreadId).toHaveBeenCalledWith('ci-heal-743', '01a0-ci-heal-thread');
  });

  it('resumes on the RECORDED Codex thread id — never on the Claude UUID the port hands it', () => {
    const o = io({ readThreadId: vi.fn(() => 'recorded-tid') });
    CI_HEAL_AGENT_PROVIDERS.codex.spawn({ ...REQ, resumeSessionId: 'claude-uuid' }, o);
    expect(o.readThreadId).toHaveBeenCalledWith('ci-heal-743');
    const argv = o.spawnAgent.mock.calls[0][0];
    expect(argv.slice(0, 3)).toEqual(['exec', 'resume', 'recorded-tid']);
    expect(o.writeThreadId).not.toHaveBeenCalled();
  });

  it('REFUSES to resume when no thread id was recorded, instead of silently starting a new session', () => {
    const o = io({ readThreadId: vi.fn(() => null) });
    expect(() => CI_HEAL_AGENT_PROVIDERS.codex.spawn({ ...REQ, resumeSessionId: 'claude-uuid' }, o))
      .toThrow(/cannot resume session ci-heal-743/);
    expect(o.spawnAgent).not.toHaveBeenCalled();
  });

  it('captures the child\'s output on a spawn failure and rethrows untouched, under ci-heal\'s own sidecar name', () => {
    const boom = new Error('spawnSync codex ETIMEDOUT');
    const o = io({ spawnAgent: vi.fn(() => { throw boom; }) });
    expect(() => CI_HEAL_AGENT_PROVIDERS.codex.spawn(REQ, o)).toThrow(boom);
    expect(o.persistFailure).toHaveBeenCalledWith('ci-heal-spawn-failures', 'ci-heal-743', boom, { resumeSessionId: null });
  });
});
