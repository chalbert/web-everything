/**
 * @file fix-dispatch-wrapper.test.mjs — coverage for the AGENTIC fix-dispatch wrapper (#xu2pp2m, downstream of
 * #3627/#3628). NOT wired into any live dispatch decision, NOT imported by production code — this suite
 * exists so the real, load-bearing contracts (exact CLI argv shelled, the outcome→stand-down/rearm mapping,
 * the ordering of started/done completion records around the agent spawn + gate + converge) cannot silently
 * drift, mirroring `deliver-item-wrapper.test.mjs`/`review-dispatch-wrapper.test.mjs`'s own stated purpose for
 * their sibling prototypes.
 */
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

// `dispatchFix`'s default `readBrief` (inside `runFixAgentToCompletion`) reads the real brief file off
// `REPO_ROOT`-derived `import.meta.url` — the SAME seam `deliver-item-wrapper.test.mjs` documents as not
// resolving reliably inside vitest's SSR transform for a real `readFileSync` call. Mirrors that file's own
// fix EXACTLY: mock `node:fs` at the module boundary, stub the read for the one file this concerns, and leave
// every other fs call (the real temp-dir writes/reads this suite otherwise depends on) genuinely real via the
// `actual` spread.
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal();
  const readFileSyncMock = vi.fn((path, ...rest) => {
    if (String(path).includes('fix-agent-brief-v2.md')) return 'Read $LANE/.fix-review-finding.md and repair it.';
    return actual.readFileSync(path, ...rest);
  });
  const mocked = { ...actual, readFileSync: readFileSyncMock };
  return { ...mocked, default: mocked };
});

import {
  FIX_LANE_PURPOSE, FIX_LOOP_ACQUIRE_WAIT_MS, FIX_FINDING_SCRATCH_FILENAME, CHANGES_REQUESTED_MARKERS,
  FIX_REPORT_CLI_PATH, FIX_AGENT_SPAWN_TIMEOUT_MS, FIX_AGENT_PROVIDERS, resolveFixAgentProvider,
  planFixDispatchWrapper, findLatestChangesRequestedComment, resolveFixTarget, buildFixAgentEnv,
  pushLaneRef, rearmReview, standDown, runFixGateWithOneRetry, dispatchFix,
} from '../fix-dispatch-wrapper.mjs';
import { newFixReport, writeFixReport, tryReadFixReport } from '../fix-report-store.mjs';
import { REPAIR_AGENT_KIND } from '../dispatch-lane.mjs';
import { DELIVERY_AGENT_PROVIDER_NAMES } from '../deliver-item-wrapper.mjs';

describe('planFixDispatchWrapper', () => {
  it('accepts a positive integer PR and an owner/repo slug, deriving the fix-<pr> session slug', () => {
    const planned = planFixDispatchWrapper({ pr: 2108, repo: 'chalbert/web-everything', item: '3629' });
    expect(planned).toEqual({ pr: 2108, repo: 'chalbert/web-everything', item: '3629', sessionSlug: 'fix-2108' });
  });

  it('coerces a numeric string --pr into a number, and trims/stringifies item', () => {
    const planned = planFixDispatchWrapper({ pr: '5678', repo: 'a/b', item: 3629 });
    expect(planned.pr).toBe(5678);
    expect(planned.item).toBe('3629');
  });

  it('defaults item to null when omitted', () => {
    expect(planFixDispatchWrapper({ pr: 1, repo: 'a/b' }).item).toBe(null);
  });

  it('refuses a non-positive-integer --pr', () => {
    expect(() => planFixDispatchWrapper({ pr: 0, repo: 'a/b' })).toThrow(/--pr must be a positive integer/);
    expect(() => planFixDispatchWrapper({ pr: -1, repo: 'a/b' })).toThrow(/--pr must be a positive integer/);
    expect(() => planFixDispatchWrapper({ pr: 'nope', repo: 'a/b' })).toThrow(/--pr must be a positive integer/);
  });

  it('refuses a malformed --repo', () => {
    expect(() => planFixDispatchWrapper({ pr: 1, repo: 'not-a-slug' })).toThrow(/--repo must be an `owner\/repo` slug/);
    expect(() => planFixDispatchWrapper({ pr: 1, repo: '' })).toThrow(/--repo must be an `owner\/repo` slug/);
  });
});

describe('findLatestChangesRequestedComment', () => {
  it('finds a human-review changes-requested comment', () => {
    const comments = [{ body: 'unrelated' }, { body: '🔁 human review — changes requested\n\nfix the thing' }];
    expect(findLatestChangesRequestedComment(comments).body).toContain('fix the thing');
  });

  it('finds an AI-review changes-requested comment', () => {
    const comments = [{ body: '🔁 review — changes requested\n\nfix the other thing' }];
    expect(findLatestChangesRequestedComment(comments).body).toContain('fix the other thing');
  });

  it('returns the LATEST matching comment, not the first', () => {
    const comments = [
      { body: '🔁 review — changes requested\n\nold finding' },
      { body: 'unrelated in between' },
      { body: '🔁 review — changes requested\n\nnew finding' },
    ];
    expect(findLatestChangesRequestedComment(comments).body).toContain('new finding');
  });

  it('returns null when nothing matches, or input is not an array', () => {
    expect(findLatestChangesRequestedComment([{ body: 'unrelated' }])).toBeNull();
    expect(findLatestChangesRequestedComment([])).toBeNull();
    expect(findLatestChangesRequestedComment(null)).toBeNull();
    expect(findLatestChangesRequestedComment(undefined)).toBeNull();
  });

  it('matches both documented marker shapes exactly', () => {
    expect(CHANGES_REQUESTED_MARKERS).toEqual(['🔁 human review — changes requested', '🔁 review — changes requested']);
  });

  it('a comment that merely mentions the marker mid-sentence does not match — only a LEADING marker does', () => {
    const comments = [{ body: 'someone quoted "🔁 review — changes requested" in a reply' }];
    expect(findLatestChangesRequestedComment(comments)).toBeNull();
  });
});

describe('resolveFixTarget', () => {
  it('reads headRefName + the latest changes-requested comment via gh pr view --json headRefName,comments', () => {
    const run = vi.fn(() => JSON.stringify({
      headRefName: 'lane/2108-foo',
      comments: [{ body: '🔁 review — changes requested\n\nfix it' }],
    }));
    const target = resolveFixTarget({ pr: 2108, repo: 'chalbert/web-everything' }, { run });
    expect(target).toEqual({ headRefName: 'lane/2108-foo', findingBody: '🔁 review — changes requested\n\nfix it' });
    expect(run.mock.calls[0]).toEqual(['gh', ['pr', 'view', '2108', '--json', 'headRefName,comments', '--repo', 'chalbert/web-everything']]);
  });

  it('findingBody is null when no changes-requested comment exists', () => {
    const run = vi.fn(() => JSON.stringify({ headRefName: 'lane/2108-foo', comments: [{ body: 'unrelated' }] }));
    expect(resolveFixTarget({ pr: 2108, repo: 'a/b' }, { run }).findingBody).toBeNull();
  });

  it('#Part-3 autofix — findingOverride SKIPS the comment scan and is used verbatim, headRefName is still real', () => {
    const run = vi.fn(() => JSON.stringify({
      headRefName: 'lane/2108-foo',
      // NO changes-requested comment at all — the advisory-note population this override exists for never
      // carries one (review:human posts an advisory note, not a changes-requested bounce).
      comments: [{ body: 'some unrelated PR chatter' }],
    }));
    const target = resolveFixTarget({ pr: 2108, repo: 'a/b', findingOverride: 'fix only src/foo.mjs:12' }, { run });
    expect(target).toEqual({ headRefName: 'lane/2108-foo', findingBody: 'fix only src/foo.mjs:12' });
  });
});

describe('buildFixAgentEnv', () => {
  it('returns all real env vars the brief reads, plus the WE_DISPATCH_KIND=repair stamp, reports-dir override, '
    + 'and the absolute fix-report-cli.mjs path (bug #xu2pp2m/1)', () => {
    const env = buildFixAgentEnv({ sessionSlug: 'fix-2108', pr: 2108, item: '3629', lanePath: '/pool/lane-3', reportsDir: '/repo/.operations/fix-reports' });
    expect(env).toEqual({
      // `repair`, NOT the LAUNCH kind `fix` — #3640's two-spawner resolution. The whole regression, and why a
      // `fix` stamp here is a real defect rather than a naming preference, is `./dispatch-kind-axes.test.mjs`.
      WE_DISPATCH_KIND: 'repair', FIX_SESSION: 'fix-2108', FIX_PR: '2108', FIX_ITEM: '3629',
      LANE: '/pool/lane-3', OPERATION_FIX_REPORTS_DIR: '/repo/.operations/fix-reports',
      FIX_REPORT_CLI_PATH,
    });
  });

  it('FIX_ITEM is an empty string, never "null"/"undefined", when item is not given', () => {
    const env = buildFixAgentEnv({ sessionSlug: 'fix-1', pr: 1, item: null, lanePath: '/p', reportsDir: '/r' });
    expect(env.FIX_ITEM).toBe('');
  });
});

describe('FIX_REPORT_CLI_PATH — bug #xu2pp2m/1 regression', () => {
  // NOTE, mirroring `minimal-context-provider.test.mjs`'s own documented convention: `REPO_ROOT`'s
  // `import.meta.url`-derived value does not resolve reliably inside vitest's SSR transform, so this suite
  // never asserts real-fs existence against a REPO_ROOT-relative path directly (that would pass under plain
  // `node` and fail here for reasons unrelated to the fix). Real existence is instead confirmed against a
  // `process.cwd()`-relative path (which DOES resolve correctly under vitest — see below), while the exported
  // constant itself is asserted at the shape/source level.
  it('is an ABSOLUTE path derived from REPO_ROOT, not the lane-relative literal the brief used to hardcode', () => {
    expect(FIX_REPORT_CLI_PATH.startsWith('/')).toBe(true);
    expect(FIX_REPORT_CLI_PATH).not.toBe('scripts/operations/fix-report-cli.mjs');
    expect(FIX_REPORT_CLI_PATH.endsWith('scripts/operations/fix-report-cli.mjs')).toBe(true);
  });

  it('the file it points at genuinely exists in THIS checkout — the whole point of resolving it in the '
    + 'wrapper\'s own process rather than leaving the agent to find it lane-relatively (structurally absent '
    + 'pre-merge from the target PR\'s own lane clone, which is based on ordinary `main`)', () => {
    const realAbsolutePath = join(process.cwd(), 'scripts', 'operations', 'fix-report-cli.mjs');
    expect(existsSync(realAbsolutePath)).toBe(true);
  });

  it('the brief no longer tells the agent to invoke the CLI via a lane-relative path', async () => {
    // `node:fs` is mocked at the top of this file so `readFileSync` on `fix-agent-brief-v2.md` returns a fake
    // stub (mirroring `deliver-item-wrapper.test.mjs`'s own convention) — bypass it here via `importActual` so
    // this assertion reads the REAL brief text, not the stub. `process.cwd()` (not an `import.meta.url`-derived
    // path) resolves correctly under vitest's SSR transform — see this describe block's own top note.
    const { readFileSync: actualReadFileSync } = await vi.importActual('node:fs');
    const briefPath = join(process.cwd(), 'skills-src', 'conveyor', 'fix-agent-brief-v2.md');
    const brief = actualReadFileSync(briefPath, 'utf8');
    expect(brief).not.toContain('node scripts/operations/fix-report-cli.mjs');
    expect(brief).toContain('$FIX_REPORT_CLI_PATH');
  });
});

describe('pushLaneRef / rearmReview / standDown — the hand-back mechanics', () => {
  it('pushLaneRef pushes HEAD to the existing lane ref, from the lane\'s own cwd', () => {
    const run = vi.fn();
    pushLaneRef({ lanePath: '/pool/lane-3', laneRef: 'lane/2108-foo' }, { run });
    expect(run.mock.calls[0]).toEqual(['git', ['push', 'origin', 'HEAD:refs/heads/lane/2108-foo'], { cwd: '/pool/lane-3' }]);
  });

  it('rearmReview shells rearm-review.mjs <pr> --repo=<repo>', () => {
    const run = vi.fn();
    rearmReview({ pr: 2108, repo: 'chalbert/web-everything' }, { run });
    expect(run.mock.calls[0]).toEqual(['node', ['scripts/conveyor/rearm-review.mjs', '2108', '--repo=chalbert/web-everything']]);
  });

  it('standDown shells stand-down.mjs <pr> --repo=<repo> --reason=<reason> --detail=<detail>', () => {
    const run = vi.fn();
    standDown({ pr: 2108, repo: 'chalbert/web-everything', reason: 'needs-judgment', detail: 'ambiguous finding' }, { run });
    expect(run.mock.calls[0]).toEqual([
      'node', ['scripts/conveyor/stand-down.mjs', '2108', '--repo=chalbert/web-everything', '--reason=needs-judgment', '--detail=ambiguous finding'],
    ]);
  });

  it('standDown omits --detail when none is given', () => {
    const run = vi.fn();
    standDown({ pr: 1, repo: 'a/b', reason: 'gate-red' }, { run });
    expect(run.mock.calls[0][1]).toEqual(['scripts/conveyor/stand-down.mjs', '1', '--repo=a/b', '--reason=gate-red']);
  });
});

describe('runFixGateWithOneRetry', () => {
  const okVerify = () => JSON.stringify({ verdict: { ok: true } });

  it('returns green on a first-try pass, never resuming the agent', async () => {
    const run = vi.fn(() => okVerify());
    const provider = { spawn: vi.fn() };
    const result = await runFixGateWithOneRetry({ lanePath: '/pool/lane-3', pr: 1, item: null, sessionSlug: 'fix-1', provider, claudeSessionId: 'id-1' }, { run });
    expect(result.status).toBe('green');
    expect(provider.spawn).not.toHaveBeenCalled();
  });

  it('resumes the agent once on a red gate; a passing second verify returns green', async () => {
    let calls = 0;
    const run = vi.fn(() => {
      calls += 1;
      return calls === 1 ? JSON.stringify({ verdict: { ok: false, failed: 1, blocking: ['x'] } }) : okVerify();
    });
    const provider = { spawn: vi.fn() };
    const result = await runFixGateWithOneRetry({ lanePath: '/pool/lane-3', pr: 1, item: null, sessionSlug: 'fix-1', provider, claudeSessionId: 'id-1' }, { run });
    expect(result.status).toBe('green');
    expect(provider.spawn).toHaveBeenCalledTimes(1);
    const [spawnArgs] = provider.spawn.mock.calls[0];
    expect(spawnArgs.resumeSessionId).toBe('id-1');
    expect(spawnArgs.sessionId).toBe('id-1');
  });

  it('a still-red second verify with no honest blocked self-diagnosis reports red', async () => {
    const run = vi.fn(() => JSON.stringify({ verdict: { ok: false, failed: 1, blocking: ['x'] } }));
    const provider = { spawn: vi.fn() };
    const result = await runFixGateWithOneRetry(
      { lanePath: '/pool/lane-3', pr: 1, item: null, sessionSlug: 'fix-1', provider, claudeSessionId: 'id-1' },
      { run, readReport: () => ({ status: 'done', outcome: 'fixed' }) },
    );
    expect(result.status).toBe('red');
  });

  it('an honest `outcome !== fixed` resumed report classifies as gate-blocked, never red', async () => {
    const run = vi.fn(() => JSON.stringify({ verdict: { ok: false, unrun: 1, failed: 0 } }));
    const provider = { spawn: vi.fn() };
    const result = await runFixGateWithOneRetry(
      { lanePath: '/pool/lane-3', pr: 1, item: null, sessionSlug: 'fix-1', provider, claudeSessionId: 'id-1' },
      { run, readReport: () => ({ status: 'done', outcome: 'blocked', reason: 'nothing wrong in my own diff' }) },
    );
    expect(result.status).toBe('gate-blocked');
    expect(result.reason).toBe('nothing wrong in my own diff');
  });
});

// ================================================================================================
// dispatchFix — end-to-end integration, mirroring deliver-item-wrapper.test.mjs's own deliverItem coverage
// shape (a scripted fake `run`, a fake agent-spawning provider that writes a real fix-report record on disk
// so the wrapper's own `tryReadFixReport` read is exercised for real, not stubbed away).
// ================================================================================================
describe('dispatchFix', () => {
  let reportsDir;
  let previousDir;
  let lane; // a REAL temp directory — the wrapper does real fs writes (the finding scratch file) into it.

  beforeEach(() => {
    reportsDir = mkdtempSync(join(tmpdir(), 'we-op-fix-dispatch-'));
    previousDir = process.env.OPERATION_FIX_REPORTS_DIR;
    process.env.OPERATION_FIX_REPORTS_DIR = reportsDir;
    lane = mkdtempSync(join(tmpdir(), 'we-op-fix-dispatch-lane-'));
  });
  afterEach(() => {
    if (previousDir === undefined) delete process.env.OPERATION_FIX_REPORTS_DIR;
    else process.env.OPERATION_FIX_REPORTS_DIR = previousDir;
    rmSync(reportsDir, { recursive: true, force: true });
    rmSync(lane, { recursive: true, force: true });
  });

  /** A fake provider whose `spawn` writes a real fix-report record (via the real store, respecting the env
   *  override above) rather than needing a real `claude` process — mirrors `deliver-item-wrapper.test.mjs`'s
   *  own fake-provider convention. */
  function fakeProvider(outcome = 'fixed', { reason, filesTouched = ['a.mjs'], learning } = {}) {
    return {
      spawn: vi.fn(({ sessionId, resumeSessionId, sessionSlug, pr, item, lanePath }) => {
        const record = newFixReport({ session: sessionSlug, pr, item });
        writeFixReport({
          ...record, status: 'done', outcome, reason: reason ?? (outcome === 'fixed' ? null : 'a specific reason'),
          filesTouched, learning: learning ?? null,
        });
        void sessionId; void resumeSessionId; void lanePath;
      }),
    };
  }

  function fakeRun({
    lanePath, findingBody = '🔁 review — changes requested\n\nfix it', headRefName = 'lane/2108-foo',
    verify = () => JSON.stringify({ verdict: { ok: true } }),
    convergeInit = JSON.stringify({ action: 'land', round: 1, roundCap: 5, verdict: 'land', dismissed: [] }),
  } = {}) {
    const resolvedLanePath = lanePath ?? lane; // defaults to the REAL per-test temp dir from beforeEach.
    return vi.fn((cmd, args = [], opts) => {
      if (cmd === 'node' && args[0] === 'scripts/operations/completion-cli.mjs') return '{}';
      if (cmd === 'gh' && args[0] === 'pr' && args[1] === 'view') {
        return JSON.stringify({ headRefName, comments: findingBody ? [{ body: findingBody }] : [] });
      }
      if (cmd === 'node' && args[0] === 'scripts/lane-pool.mjs' && args[1] === 'acquire') return resolvedLanePath;
      if (cmd === 'node' && args[0] === 'scripts/lane-pool.mjs' && args[1] === 'release') return '';
      if (cmd === 'node' && args[0] === 'scripts/verify-lane.mjs') return JSON.stringify({ status: 'reset' });
      if (cmd === 'node' && args[0] === 'scripts/operations/run.mjs' && args[1] === 'verify') return verify();
      if (cmd === 'node' && args[0] === 'scripts/converge-cli.mjs' && args[1] === 'init') return convergeInit;
      if (cmd === 'git' && args[0] === 'push') return '';
      if (cmd === 'node' && args[0] === 'scripts/conveyor/rearm-review.mjs') return '';
      if (cmd === 'node' && args[0] === 'scripts/conveyor/stand-down.mjs') return '';
      if (cmd === 'node' && args[0] === 'scripts/conveyor/learnings-drop.mjs') return '';
      throw new Error(`fakeRun: unexpected run(${cmd}, ${JSON.stringify(args)}) opts=${JSON.stringify(opts)}`);
    });
  }

  it('the full happy path: resolves the finding, acquires with --base=<lane ref>, spawns once, gate green, '
    + 'converge lands, pushes HEAD, re-arms review, reports done re-armed, releases', async () => {
    const run = fakeRun();
    const provider = fakeProvider('fixed');
    const result = await dispatchFix({ pr: 2108, repo: 'chalbert/web-everything', item: '3629' }, provider, { run, newSessionId: () => 'sess-1' });

    expect(result.result).toBe('PR #2108 (re-armed review:pending)');
    expect(provider.spawn).toHaveBeenCalledTimes(1);

    const acquireCall = run.mock.calls.find((c) => c[1]?.[1] === 'acquire');
    expect(acquireCall[1]).toEqual([
      'scripts/lane-pool.mjs', 'acquire', `--purpose=${FIX_LANE_PURPOSE}`, '--session=fix-2108',
      `--wait-ms=${FIX_LOOP_ACQUIRE_WAIT_MS}`, '--base=lane/2108-foo', '--adopt',
    ]);

    const pushCall = run.mock.calls.find((c) => c[0] === 'git' && c[1][0] === 'push');
    expect(pushCall[1]).toEqual(['push', 'origin', 'HEAD:refs/heads/lane/2108-foo']);

    const rearmCall = run.mock.calls.find((c) => c[1]?.[0] === 'scripts/conveyor/rearm-review.mjs');
    expect(rearmCall[1]).toEqual(['scripts/conveyor/rearm-review.mjs', '2108', '--repo=chalbert/web-everything']);

    const doneCall = run.mock.calls.find((c) => c[1]?.[0] === 'scripts/operations/completion-cli.mjs' && c[1]?.includes('--status=done'));
    expect(doneCall[1]).toEqual(expect.arrayContaining(['--outcome=re-armed']));

    expect(run.mock.calls.some((c) => c[1]?.[1] === 'release')).toBe(true);
  });

  it('reports started BEFORE resolving the PR target (the durable trace exists even if gh itself fails)', async () => {
    const order = [];
    const run = vi.fn((cmd, args = []) => {
      if (cmd === 'node' && args[0] === 'scripts/operations/completion-cli.mjs') {
        order.push(args.includes('--status=started') ? 'started' : 'done');
        return '{}';
      }
      if (cmd === 'gh') {
        order.push('gh');
        throw new Error('gh: not found');
      }
      throw new Error(`unexpected: ${cmd} ${JSON.stringify(args)}`);
    });
    await expect(dispatchFix({ pr: 1, repo: 'a/b' }, {}, { run })).rejects.toThrow(/gh: not found/);
    expect(order[0]).toBe('started');
    expect(order[1]).toBe('gh');
  });

  it('deletes the scratch finding file after the agent\'s turn, before the gate/converge pass runs', async () => {
    const run = fakeRun();
    const provider = {
      spawn: vi.fn(({ sessionSlug, pr, item, lanePath }) => {
        expect(existsSync(join(lanePath, FIX_FINDING_SCRATCH_FILENAME))).toBe(true);
        expect(readFileSync(join(lanePath, FIX_FINDING_SCRATCH_FILENAME), 'utf8')).toContain('fix it');
        writeFixReport({ ...newFixReport({ session: sessionSlug, pr, item }), status: 'done', outcome: 'fixed', filesTouched: ['a.mjs'] });
      }),
    };
    await dispatchFix({ pr: 2108, repo: 'chalbert/web-everything' }, provider, { run, newSessionId: () => 's' });
    expect(existsSync(join(lane, FIX_FINDING_SCRATCH_FILENAME))).toBe(false);
  });

  it('when no changes-requested comment exists on the PR, reports not-applicable and never acquires a lane', async () => {
    const run = fakeRun({ findingBody: null });
    const result = await dispatchFix({ pr: 2108, repo: 'chalbert/web-everything' }, {}, { run, newSessionId: () => 's' });
    expect(result.result).toBe('not-applicable (no changes-requested comment found)');
    expect(run.mock.calls.some((c) => c[1]?.[1] === 'acquire')).toBe(false);
    const doneCall = run.mock.calls.find((c) => c[1]?.includes('--status=done'));
    expect(doneCall[1]).toEqual(expect.arrayContaining(['--outcome=not-applicable']));
  });

  it('#Part-3 autofix — findingOverride dispatches even when the PR carries NO changes-requested comment '
    + '(the review:human advisory-note population this exists for never has one), scoped to the override text', async () => {
    const run = fakeRun({ findingBody: null }); // no changes-requested comment on the PR at all
    const provider = {
      spawn: vi.fn(({ sessionSlug, pr, item, lanePath }) => {
        expect(readFileSync(join(lanePath, FIX_FINDING_SCRATCH_FILENAME), 'utf8')).toContain('fix only src/foo.mjs:12 — off-by-one');
        writeFixReport({ ...newFixReport({ session: sessionSlug, pr, item }), status: 'done', outcome: 'fixed', filesTouched: ['a.mjs'] });
      }),
    };
    const result = await dispatchFix(
      { pr: 2108, repo: 'chalbert/web-everything', findingOverride: 'fix only src/foo.mjs:12 — off-by-one' },
      provider,
      { run, newSessionId: () => 'sess-override' },
    );
    expect(result.result).toBe('PR #2108 (re-armed review:pending)');
    expect(provider.spawn).toHaveBeenCalledTimes(1);
    expect(existsSync(join(lane, FIX_FINDING_SCRATCH_FILENAME))).toBe(false); // cleaned up after the turn
  });

  it('when acquire fails because --base does not resolve (the lane ref is gone), reports not-applicable, '
    + 'not blocked-on-infra, and does not rethrow', async () => {
    const run = vi.fn((cmd, args = []) => {
      if (cmd === 'node' && args[0] === 'scripts/operations/completion-cli.mjs') return '{}';
      if (cmd === 'gh') return JSON.stringify({ headRefName: 'lane/2108-gone', comments: [{ body: '🔁 review — changes requested\n\nfix it' }] });
      if (cmd === 'node' && args[1] === 'acquire') {
        throw new Error('--base=lane/2108-gone does not resolve in lane-3\'s clone (tried "origin/lane/2108-gone" and "lane/2108-gone")');
      }
      if (cmd === 'node' && args[1] === 'release') return '';
      throw new Error(`unexpected: ${cmd} ${JSON.stringify(args)}`);
    });
    const result = await dispatchFix({ pr: 2108, repo: 'chalbert/web-everything' }, {}, { run, newSessionId: () => 's' });
    expect(result.result).toBe('not-applicable (lane ref lane/2108-gone gone)');
    const doneCall = run.mock.calls.find((c) => c[1]?.includes('--status=done'));
    expect(doneCall[1]).toEqual(expect.arrayContaining(['--outcome=not-applicable']));
  });

  it('when acquire throws for an unrelated infra reason, reports blocked-on-infra and RETHROWS', async () => {
    const run = vi.fn((cmd, args = []) => {
      if (cmd === 'node' && args[0] === 'scripts/operations/completion-cli.mjs') return '{}';
      if (cmd === 'gh') return JSON.stringify({ headRefName: 'lane/2108-foo', comments: [{ body: '🔁 review — changes requested\n\nfix it' }] });
      if (cmd === 'node' && args[1] === 'acquire') throw new Error('lane-pool.mjs: no lanes provisioned');
      if (cmd === 'node' && args[1] === 'release') return '';
      throw new Error(`unexpected: ${cmd} ${JSON.stringify(args)}`);
    });
    await expect(dispatchFix({ pr: 2108, repo: 'chalbert/web-everything' }, {}, { run, newSessionId: () => 's' })).rejects.toThrow(/no lanes provisioned/);
    const doneCall = run.mock.calls.find((c) => c[1]?.includes('--status=done'));
    expect(doneCall[1]).toEqual(expect.arrayContaining(['--outcome=blocked-on-infra']));
  });

  it('when the agent reports blocked, stands down with reason=needs-judgment and reports the agent\'s own outcome', async () => {
    const run = fakeRun();
    const provider = fakeProvider('blocked', { reason: 'already fixed on main' });
    const result = await dispatchFix({ pr: 2108, repo: 'chalbert/web-everything' }, provider, { run, newSessionId: () => 's' });
    expect(result.result).toBe('stood-down (blocked)');
    const standDownCall = run.mock.calls.find((c) => c[1]?.[0] === 'scripts/conveyor/stand-down.mjs');
    expect(standDownCall[1]).toEqual(expect.arrayContaining(['--reason=needs-judgment', '--detail=already fixed on main']));
    const doneCall = run.mock.calls.find((c) => c[1]?.includes('--status=done'));
    expect(doneCall[1]).toEqual(expect.arrayContaining(['--outcome=blocked']));
    expect(run.mock.calls.some((c) => c[1]?.[0] === 'scripts/conveyor/rearm-review.mjs')).toBe(false);
    expect(run.mock.calls.some((c) => c[0] === 'git' && c[1][0] === 'push')).toBe(false);
  });

  it('when the agent reports escalated-conflict, stands down with reason=conflict', async () => {
    const run = fakeRun();
    const provider = fakeProvider('escalated-conflict', { reason: 'main rewrote the same lines' });
    await dispatchFix({ pr: 2108, repo: 'chalbert/web-everything' }, provider, { run, newSessionId: () => 's' });
    const standDownCall = run.mock.calls.find((c) => c[1]?.[0] === 'scripts/conveyor/stand-down.mjs');
    expect(standDownCall[1]).toEqual(expect.arrayContaining(['--reason=conflict']));
  });

  it('when the agent reports escalated-needs-judgment, stands down with reason=needs-judgment', async () => {
    const run = fakeRun();
    const provider = fakeProvider('escalated-needs-judgment', { reason: 'two valid treatments' });
    await dispatchFix({ pr: 2108, repo: 'chalbert/web-everything' }, provider, { run, newSessionId: () => 's' });
    const standDownCall = run.mock.calls.find((c) => c[1]?.[0] === 'scripts/conveyor/stand-down.mjs');
    expect(standDownCall[1]).toEqual(expect.arrayContaining(['--reason=needs-judgment']));
  });

  it('when the gate stays red after the one retry, stands down with reason=gate-red — never pushes or re-arms', async () => {
    const run = fakeRun({ verify: () => JSON.stringify({ verdict: { ok: false, failed: 1, blocking: ['x'] } }) });
    const provider = fakeProvider('fixed');
    const result = await dispatchFix({ pr: 2108, repo: 'chalbert/web-everything' }, provider, { run, newSessionId: () => 's' });
    expect(result.result).toBe('stood-down (gate-red)');
    const standDownCall = run.mock.calls.find((c) => c[1]?.[0] === 'scripts/conveyor/stand-down.mjs');
    expect(standDownCall[1]).toEqual(expect.arrayContaining(['--reason=gate-red']));
    expect(run.mock.calls.some((c) => c[0] === 'git' && c[1][0] === 'push')).toBe(false);
    // the gate's OWN one resume call is the SECOND provider.spawn (the first was the initial repair turn).
    expect(provider.spawn).toHaveBeenCalledTimes(2);
  });

  it('when the converge pass escalates, stands down with reason=needs-judgment and outcome=escalated-needs-judgment '
    + '— never pushes or re-arms (the ratified replacement for the old brief\'s own self-review subagent)', async () => {
    const run = fakeRun({
      convergeInit: JSON.stringify({ action: 'escalate', round: 3, roundCap: 5, verdict: 'escalate', reason: 'panel could not agree', dismissed: [] }),
    });
    const provider = fakeProvider('fixed');
    const result = await dispatchFix({ pr: 2108, repo: 'chalbert/web-everything' }, provider, { run, newSessionId: () => 's' });
    expect(result.result).toBe('stood-down (converge-escalated)');
    const standDownCall = run.mock.calls.find((c) => c[1]?.[0] === 'scripts/conveyor/stand-down.mjs');
    expect(standDownCall[1]).toEqual(expect.arrayContaining(['--reason=needs-judgment', '--detail=panel could not agree']));
    const doneCall = run.mock.calls.find((c) => c[1]?.includes('--status=done'));
    expect(doneCall[1]).toEqual(expect.arrayContaining(['--outcome=escalated-needs-judgment']));
    expect(run.mock.calls.some((c) => c[0] === 'git' && c[1][0] === 'push')).toBe(false);
    expect(run.mock.calls.some((c) => c[1]?.[0] === 'scripts/conveyor/rearm-review.mjs')).toBe(false);
  });

  it('forwards the agent\'s optional learning via learnings-drop.mjs on the happy path', async () => {
    const run = fakeRun();
    const provider = fakeProvider('fixed', { learning: { kind: 'friction', summary: 's', area: 'a', suggestion: 'sg' } });
    await dispatchFix({ pr: 2108, repo: 'chalbert/web-everything' }, provider, { run, newSessionId: () => 's' });
    const dropCall = run.mock.calls.find((c) => c[1]?.[0] === 'scripts/conveyor/learnings-drop.mjs');
    expect(dropCall[1]).toEqual(expect.arrayContaining(['--kind=friction', '--summary=s', '--area=a', '--suggestion=sg']));
  });

  it('never spawns the fix agent more than once on the happy path (no gate retry needed)', async () => {
    const run = fakeRun();
    const provider = fakeProvider('fixed');
    await dispatchFix({ pr: 2108, repo: 'chalbert/web-everything' }, provider, { run, newSessionId: () => 's' });
    expect(provider.spawn).toHaveBeenCalledTimes(1);
  });

  it('when the agent never writes a done report (crash), reports blocked-on-infra and RETHROWS, still '
    + 'releasing the lane', async () => {
    const run = fakeRun();
    const provider = { spawn: vi.fn() }; // never writes a report
    await expect(dispatchFix({ pr: 2108, repo: 'chalbert/web-everything' }, provider, { run, newSessionId: () => 's' }))
      .rejects.toThrow(/exited with no done report/);
    const doneCall = run.mock.calls.find((c) => c[1]?.includes('--status=done'));
    expect(doneCall[1]).toEqual(expect.arrayContaining(['--outcome=blocked-on-infra']));
    expect(run.mock.calls.some((c) => c[1]?.[1] === 'release')).toBe(true);
  });

  // ==============================================================================================
  // Bug #xu2pp2m/2 regression (confirmed live on real PR #2027, 2026-09-09): a report left over from a PRIOR
  // dispatch attempt at the SAME PR (same `sessionSlug`, `fix-2108`) must never be mistaken for the CURRENT
  // attempt's outcome when the current attempt's agent fails to write a fresh one.
  // ==============================================================================================
  describe('stale fix-report staleness guard', () => {
    it('a report left over from a prior attempt is cleared before dispatch — a crashing CURRENT agent still '
      + 'reports blocked-on-infra (never the stale prior outcome)', async () => {
      // Simulate attempt 1: it wrote a `fixed` report for this exact session slug.
      writeFixReport({
        ...newFixReport({ session: 'fix-2108', pr: 2108, item: null }),
        status: 'done', outcome: 'fixed', filesTouched: ['unrelated-attempt-1-file.mjs'],
      });
      expect(tryReadFixReport('fix-2108')).not.toBeNull();

      const run = fakeRun();
      const provider = { spawn: vi.fn() }; // attempt 2's agent never writes a fresh report (the bug-1 failure mode)
      await expect(dispatchFix({ pr: 2108, repo: 'chalbert/web-everything' }, provider, { run, newSessionId: () => 's2' }))
        .rejects.toThrow(/exited with no done report/);

      // The wrapper must report ITS OWN attempt as blocked-on-infra — never re-report attempt 1's stale
      // `fixed` outcome as if it belonged to attempt 2.
      const doneCall = run.mock.calls.find((c) => c[1]?.includes('--status=done'));
      expect(doneCall[1]).toEqual(expect.arrayContaining(['--outcome=blocked-on-infra']));
      expect(doneCall[1]).not.toEqual(expect.arrayContaining(['--outcome=re-armed']));
      // Never pushed/re-armed on the strength of the stale report.
      expect(run.mock.calls.some((c) => c[0] === 'git' && c[1][0] === 'push')).toBe(false);
      expect(run.mock.calls.some((c) => c[1]?.[0] === 'scripts/conveyor/rearm-review.mjs')).toBe(false);
    });

    it('the stale report is gone from disk once the new attempt starts, even before the agent spawns', async () => {
      writeFixReport({
        ...newFixReport({ session: 'fix-2108', pr: 2108, item: null }),
        status: 'done', outcome: 'fixed', filesTouched: ['unrelated-attempt-1-file.mjs'],
      });
      const run = fakeRun();
      const provider = fakeProvider('fixed'); // attempt 2 succeeds for real this time
      const result = await dispatchFix({ pr: 2108, repo: 'chalbert/web-everything' }, provider, { run, newSessionId: () => 's2' });
      expect(result.result).toBe('PR #2108 (re-armed review:pending)');
      // The report now on disk is attempt 2's own fresh one, not a leftover mix.
      const finalReport = tryReadFixReport('fix-2108');
      expect(finalReport.outcome).toBe('fixed');
      expect(finalReport.filesTouched).toEqual(['a.mjs']); // fakeProvider's default, not attempt 1's file
    });

    it('a genuine first attempt (no pre-existing report) is unaffected — deleteFixReport is a no-op', async () => {
      expect(tryReadFixReport('fix-2108')).toBeNull();
      const run = fakeRun();
      const provider = fakeProvider('fixed');
      const result = await dispatchFix({ pr: 2108, repo: 'chalbert/web-everything' }, provider, { run, newSessionId: () => 's1' });
      expect(result.result).toBe('PR #2108 (re-armed review:pending)');
    });
  });
});

describe('#3640 — the wrapper arc, with a converge round that actually EDITS', () => {
  // The pre-existing `./fix-dispatch-wrapper.test.mjs` drives `dispatchFix` with a converge `init` that lands
  // immediately, so the converge EDITOR spawn — the third thing that stamps `WE_DISPATCH_KIND` on this path —
  // never runs there. This drives a real edit round through the real `runConverge` loop so the stamp that spawn
  // carries is OBSERVED rather than assumed.
  it('stamps `repair` on the converge editor too, not the launch kind `fix`', async () => {
    const reportsDir = mkdtempSync(join(tmpdir(), 'we-op-fix-axes-'));
    const lane = mkdtempSync(join(tmpdir(), 'we-op-fix-axes-lane-'));
    const previous = process.env.OPERATION_FIX_REPORTS_DIR;
    process.env.OPERATION_FIX_REPORTS_DIR = reportsDir;
    try {
      const claudeCalls = [];
      let convergeStep = 0;
      const run = vi.fn((cmd, args = [], opts) => {
        if (cmd === 'node' && args[0] === 'scripts/operations/completion-cli.mjs') return '{}';
        if (cmd === 'gh') return JSON.stringify({ headRefName: 'lane/2108-foo', comments: [{ body: '🔁 review — changes requested\n\nfix it' }] });
        if (cmd === 'node' && args[0] === 'scripts/lane-pool.mjs') return args[1] === 'acquire' ? lane : '';
        if (cmd === 'node' && args[0] === 'scripts/verify-lane.mjs') return JSON.stringify({ status: 'reset' });
        if (cmd === 'node' && args[0] === 'scripts/operations/run.mjs' && args[1] === 'verify') return JSON.stringify({ verdict: { ok: true } });
        if (cmd === 'node' && args[0] === 'scripts/converge-cli.mjs' && args[1] === 'init') {
          return JSON.stringify({ action: 'edit', round: 1, roundCap: 5, edit: { prompt: 'apply the finding' } });
        }
        if (cmd === 'node' && args[0] === 'scripts/converge-cli.mjs' && args[1] === 'step') {
          convergeStep += 1;
          return JSON.stringify({ action: 'land', round: 2, verdict: 'land', dismissed: [] });
        }
        if (cmd === 'claude') {
          claudeCalls.push(opts);
          return JSON.stringify({ result: JSON.stringify({ revised: true, advanced: true, dismissed: [], filesTouched: ['a.mjs'] }) });
        }
        if (cmd === 'git') return '';
        if (cmd === 'node' && args[0] === 'scripts/conveyor/rearm-review.mjs') return '';
        throw new Error(`unexpected run(${cmd}, ${JSON.stringify(args)})`);
      });

      const provider = {
        spawn: vi.fn(({ sessionSlug, pr, item }) => {
          writeFixReport({
            ...newFixReport({ session: sessionSlug, pr, item }),
            status: 'done', outcome: 'fixed', reason: null, filesTouched: ['a.mjs'], learning: null,
          });
        }),
      };

      const result = await dispatchFix(
        { pr: 2108, repo: 'chalbert/web-everything', item: '3629' }, provider,
        // `ensureSettingsFile` injected: its real default writes into `${REPO_ROOT}.operations`, which vitest's
        // SSR-transformed `REPO_ROOT` makes an unwritable `/@fs/...` path — the same seam this file's own
        // `node:fs` mock exists for. Nothing about the assertion below depends on the settings file's content.
        { run, newSessionId: () => 'sess-1', ensureSettingsFile: () => '/fake/fix-hooks.json' },
      );

      expect(result.result).toBe('PR #2108 (re-armed review:pending)');
      expect(convergeStep).toBe(1);
      // THE ASSERTION: the converge editor's own env stamp. `fix` here would put that spawn under a guard
      // contract written for an agent that runs its own lifecycle.
      expect(claudeCalls).toHaveLength(1);
      expect(claudeCalls[0].env.WE_DISPATCH_KIND).toBe(REPAIR_AGENT_KIND);
      // …and so does the fixer agent's own spawn, through the provider the wrapper installs by default.
      expect(provider.spawn).toHaveBeenCalledTimes(1);
    } finally {
      if (previous === undefined) delete process.env.OPERATION_FIX_REPORTS_DIR;
      else process.env.OPERATION_FIX_REPORTS_DIR = previous;
      rmSync(reportsDir, { recursive: true, force: true });
      rmSync(lane, { recursive: true, force: true });
    }
  });
});

// ================================================================================================
// mechanical-dispatcher (epic #3383, Part 1) — the `fix` kind's OWN provider registry, reusing the CODEX spawn
// mechanics `codex-delivery-provider.mjs` already proved live for `build`, never re-derived.
// ================================================================================================
describe('FIX_AGENT_PROVIDERS registry / resolveFixAgentProvider (#3383)', () => {
  it('names the same two providers `build` does, matching vocabulary', () => {
    expect(Object.keys(FIX_AGENT_PROVIDERS)).toEqual(DELIVERY_AGENT_PROVIDER_NAMES);
    expect(FIX_AGENT_PROVIDERS['claude-restricted'].name).toBe('claude-restricted-fix');
    expect(FIX_AGENT_PROVIDERS.codex.name).toBe('codex');
    expect(typeof FIX_AGENT_PROVIDERS.codex.spawn).toBe('function');
  });

  it('resolves by name, defaults to claude-restricted, and refuses an unknown name by NAME', () => {
    expect(resolveFixAgentProvider()).toBe(FIX_AGENT_PROVIDERS['claude-restricted']);
    expect(resolveFixAgentProvider('codex')).toBe(FIX_AGENT_PROVIDERS.codex);
    expect(resolveFixAgentProvider(' codex ')).toBe(FIX_AGENT_PROVIDERS.codex);
    expect(() => resolveFixAgentProvider('gemini')).toThrow(/unknown delivery agent provider "gemini"/);
    expect(() => resolveFixAgentProvider('gemini')).toThrow(/claude-restricted\|codex/);
  });

  // #3383 mechanical-dispatcher fix — the #3476 regression test for the CLAUDE fix provider (mirrors the
  // `codex` describe block's own equivalent test, above): `resolveReportsDir` must be called WITH the
  // (already-resolved) lane path, never bare.
  it('claude-restricted-fix.spawn resolves the reports dir WITH the (already-resolved) lane path — never bare', () => {
    const io = {
      ensureSettingsFile: vi.fn(() => '/fake/.operations/fix-agent-hooks-settings.json'),
      spawnAgent: vi.fn(),
      persistFailure: vi.fn(),
      resolveReportsDir: vi.fn(() => '/tmp/fix-reports'),
    };
    FIX_AGENT_PROVIDERS['claude-restricted'].spawn(
      { sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', prompt: 'p', lanePath: '/tmp/fix-lane-3', sessionSlug: 'fix-2108', pr: 2108, item: '3629' },
      io,
    );
    expect(io.resolveReportsDir).toHaveBeenCalledWith('/tmp/fix-lane-3');
  });
});

// #3383 — FIX_CODEX_PROVIDER.spawn. Same port contract `CODEX_PROVIDER.spawn` satisfies for `build`
// (`deliver-item-wrapper.test.mjs`'s own suite), mirrored here for the `fix` kind: `lanePath` arrives already
// resolved (no `resolveLane` call, unlike `build`'s provider, which takes a bare lane NUMBER).
describe('FIX_CODEX_PROVIDER.spawn (#3383 — reusing the live-verified Codex spawn mechanics for `fix`)', () => {
  const LANE_PATH = '/tmp/fix-lane-9';
  const THREAD_EVENT = '{"type":"thread.started","thread_id":"01a0-fix-thread"}\n{"type":"turn.completed"}\n';

  const io = (over = {}) => ({
    spawnAgent: vi.fn(() => ({ stdout: THREAD_EVENT, resourceUsage: null })),
    persistFailure: vi.fn(),
    resolveReportsDir: vi.fn(() => '/tmp/fix-reports'),
    readThreadId: vi.fn(() => null),
    writeThreadId: vi.fn(),
    denyPaths: ['/tmp/primary/**'],
    ...over,
  });

  const REQ = { sessionId: 'claude-uuid', prompt: 'REPAIR IT', lanePath: LANE_PATH, sessionSlug: 'fix-2108', pr: '2108', item: '3629' };

  it('spawns `codex exec` in the ALREADY-RESOLVED lane clone, no `resolveLane` call needed', async () => {
    const o = io();
    await FIX_AGENT_PROVIDERS.codex.spawn(REQ, o);
    const [argv, opts] = o.spawnAgent.mock.calls[0];
    expect(argv.slice(0, 3)).toEqual(['exec', '-C', LANE_PATH]);
    expect(opts.cwd).toBe(LANE_PATH);
  });

  it('stamps the SAME real fix env vars the Claude fix provider does', async () => {
    const o = io();
    await FIX_AGENT_PROVIDERS.codex.spawn(REQ, o);
    expect(o.spawnAgent.mock.calls[0][1].env).toMatchObject({
      WE_DISPATCH_KIND: REPAIR_AGENT_KIND,
      FIX_SESSION: 'fix-2108',
      FIX_PR: '2108',
      FIX_ITEM: '3629',
      LANE: LANE_PATH,
      OPERATION_FIX_REPORTS_DIR: '/tmp/fix-reports',
    });
  });

  it('blocks on the fix/delivery-shared budget, never dispatch-lane-io\'s 60s fire-and-forget one', async () => {
    const o = io();
    await FIX_AGENT_PROVIDERS.codex.spawn(REQ, o);
    expect(o.spawnAgent.mock.calls[0][1].timeout).toBe(FIX_AGENT_SPAWN_TIMEOUT_MS);
  });

  // #3383 mechanical-dispatcher fix — the #3476 regression test: `resolveReportsDir` must be called WITH the
  // (already-resolved) lane path, never bare. Bare, it silently falls back to the SCRIPT-LOCATION default,
  // which always names the primary checkout regardless of `lanePath` — invisible under Claude's soft,
  // hook-based `--restricted` sandbox, but a hard `EPERM` under Codex's real OS-level lane jail (see
  // `deliver-item-wrapper.test.mjs`'s own equivalent regression test for the full root-cause account).
  it('resolves the reports dir WITH the (already-resolved) lane path — never bare', async () => {
    const o = io();
    await FIX_AGENT_PROVIDERS.codex.spawn(REQ, o);
    expect(o.resolveReportsDir).toHaveBeenCalledWith(LANE_PATH);
  });

  it('records the thread id Codex minted, keyed by sessionSlug, on a FRESH spawn', async () => {
    const o = io();
    await FIX_AGENT_PROVIDERS.codex.spawn(REQ, o);
    expect(o.writeThreadId).toHaveBeenCalledWith('fix-2108', '01a0-fix-thread');
  });

  it('resumes on the RECORDED Codex thread id — never on the Claude UUID the port hands it', async () => {
    const o = io({ readThreadId: vi.fn(() => 'recorded-tid') });
    await FIX_AGENT_PROVIDERS.codex.spawn({ ...REQ, resumeSessionId: 'claude-uuid' }, o);
    expect(o.readThreadId).toHaveBeenCalledWith('fix-2108');
    const argv = o.spawnAgent.mock.calls[0][0];
    expect(argv.slice(0, 3)).toEqual(['exec', 'resume', 'recorded-tid']);
    expect(o.writeThreadId).not.toHaveBeenCalled();
  });

  it('REFUSES to resume when no thread id was recorded, instead of silently starting a new session', async () => {
    const o = io({ readThreadId: vi.fn(() => null) });
    await expect(FIX_AGENT_PROVIDERS.codex.spawn({ ...REQ, resumeSessionId: 'claude-uuid' }, o))
      .rejects.toThrow(/cannot resume session fix-2108/);
    expect(o.spawnAgent).not.toHaveBeenCalled();
  });

  it('captures the child\'s output on a spawn failure and rethrows untouched, under fix\'s own sidecar name', async () => {
    const boom = new Error('spawnSync codex ETIMEDOUT');
    const o = io({ spawnAgent: vi.fn(() => { throw boom; }) });
    await expect(FIX_AGENT_PROVIDERS.codex.spawn(REQ, o)).rejects.toThrow(boom);
    expect(o.persistFailure).toHaveBeenCalledWith('fix-spawn-failures', 'fix-2108', boom, { resumeSessionId: null });
  });
});
