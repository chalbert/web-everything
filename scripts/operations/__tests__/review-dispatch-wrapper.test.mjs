/**
 * @file review-dispatch-wrapper.test.mjs — coverage for the PURELY MECHANICAL review-dispatch wrapper
 * (#xu2pp2m, downstream of #3627/#3628). The file is NOT wired into `review-dispatch.mjs`/the conveyor's
 * dispatch decision and NOT imported by production code — this suite exists so the one thing that is a real,
 * load-bearing contract (the exact CLI argv it shells, and the classification of `review-loop-cli.mjs`'s own
 * structured output) cannot silently drift, mirroring `deliver-item-wrapper.test.mjs`'s own stated purpose for
 * its sibling prototype.
 */
import { describe, it, expect, vi } from 'vitest';

import {
  REVIEW_LOOP_LANE_PURPOSE, REVIEW_LOOP_ACQUIRE_WAIT_MS, planReviewDispatchWrapper,
  classifyReviewLoopOutcome, dispatchReviewMechanical,
} from '../review-dispatch-wrapper.mjs';

describe('planReviewDispatchWrapper', () => {
  it('accepts a positive integer PR and an owner/repo slug, deriving the review-<pr> session slug', () => {
    const planned = planReviewDispatchWrapper({ pr: 1234, repo: 'chalbert/web-everything' });
    expect(planned).toEqual({ pr: 1234, repo: 'chalbert/web-everything', sessionSlug: 'review-1234' });
  });

  it('coerces a numeric string --pr into a number', () => {
    expect(planReviewDispatchWrapper({ pr: '5678', repo: 'a/b' }).pr).toBe(5678);
  });

  it('refuses a non-positive-integer --pr', () => {
    expect(() => planReviewDispatchWrapper({ pr: 0, repo: 'a/b' })).toThrow(/--pr must be a positive integer/);
    expect(() => planReviewDispatchWrapper({ pr: -1, repo: 'a/b' })).toThrow(/--pr must be a positive integer/);
    expect(() => planReviewDispatchWrapper({ pr: 'not-a-number', repo: 'a/b' })).toThrow(/--pr must be a positive integer/);
  });

  it('refuses a malformed --repo', () => {
    expect(() => planReviewDispatchWrapper({ pr: 1, repo: 'not-a-slug' })).toThrow(/--repo must be an `owner\/repo` slug/);
    expect(() => planReviewDispatchWrapper({ pr: 1, repo: '' })).toThrow(/--repo must be an `owner\/repo` slug/);
  });
});

describe('classifyReviewLoopOutcome', () => {
  it('a queued-accept stop (review:pending, clean verdict, needs a human to clear) classifies as parked', () => {
    const parsed = { queued: 'accept-needs-human', runId: 'run-1', verdict: { verdict: 'accept', loop: { outcome: 'converged' } } };
    expect(classifyReviewLoopOutcome(parsed)).toEqual({ outcome: 'parked', verdict: 'accept', loopOutcome: 'converged', runId: 'run-1' });
  });

  it('a prevention-outstanding auto-clear (guards filed, verdict already accept) classifies as auto-cleared', () => {
    const parsed = { preventionFiled: ['learnings/foo.md'], runId: 'run-2', verdict: { verdict: 'prevention-outstanding', loop: { outcome: 'converged' } } };
    expect(classifyReviewLoopOutcome(parsed).outcome).toBe('auto-cleared');
  });

  it('a completed run with verdict accept classifies as auto-cleared', () => {
    const parsed = { stopped: 'complete', runId: 'run-3', verdict: { verdict: 'accept', loop: { outcome: 'converged' } } };
    expect(classifyReviewLoopOutcome(parsed)).toEqual({ outcome: 'auto-cleared', verdict: 'accept', loopOutcome: 'converged', runId: 'run-3' });
  });

  it('a completed run with verdict changes classifies as bounced', () => {
    const parsed = { stopped: 'complete', runId: 'run-4', verdict: { verdict: 'changes', loop: { outcome: 'in-progress' } } };
    expect(classifyReviewLoopOutcome(parsed)).toEqual({ outcome: 'bounced', verdict: 'changes', loopOutcome: 'in-progress', runId: 'run-4' });
  });

  it('an effect-in-flight stop is treated the same as complete', () => {
    const parsed = { stopped: 'effect-in-flight', runId: 'run-5', verdict: { verdict: 'changes' } };
    expect(classifyReviewLoopOutcome(parsed).outcome).toBe('bounced');
  });

  it('a confirm stop (review:human / gate-self — a HUMAN-addressed park) classifies as parked', () => {
    const parsed = { stopped: 'confirm', runId: 'run-6', verdict: { verdict: 'needs-human' } };
    expect(classifyReviewLoopOutcome(parsed).outcome).toBe('parked');
  });

  it('a refused/help stop, or anything this reading does not cover, classifies as blocked-on-infra — the '
    + 'SAME word the review-agent-brief uses when no lane is available', () => {
    expect(classifyReviewLoopOutcome({ stopped: 'refused' }).outcome).toBe('blocked-on-infra');
    expect(classifyReviewLoopOutcome({ stopped: 'help' }).outcome).toBe('blocked-on-infra');
    expect(classifyReviewLoopOutcome({}).outcome).toBe('blocked-on-infra');
    expect(classifyReviewLoopOutcome(null).outcome).toBe('blocked-on-infra');
  });

  it('never throws on a malformed/partial payload', () => {
    expect(() => classifyReviewLoopOutcome(undefined)).not.toThrow();
    expect(() => classifyReviewLoopOutcome({ verdict: 'not-an-object' })).not.toThrow();
  });
});

describe('dispatchReviewMechanical', () => {
  const okReviewLoopJson = () => JSON.stringify({
    runId: 'run-9', op: 'review-pr', stopped: 'complete',
    verdict: { verdict: 'changes', loop: { outcome: 'in-progress', why: 'x' } },
  });

  function fakeRun({ acquireOut = '/pool/lane-9', reviewLoopOut = okReviewLoopJson() } = {}) {
    return vi.fn((cmd, args) => {
      if (args[0] === 'scripts/operations/completion-cli.mjs') return '{}';
      if (args[0] === 'scripts/lane-pool.mjs' && args[1] === 'acquire') return acquireOut;
      if (args[0] === 'scripts/lane-pool.mjs' && args[1] === 'release') return '';
      if (args[0] === 'scripts/verify-lane.mjs') return JSON.stringify({ status: 'reset' });
      if (args[0] === 'scripts/operations/review-loop-cli.mjs') return reviewLoopOut;
      throw new Error(`unexpected: ${cmd} ${JSON.stringify(args)}`);
    });
  }

  it('never spawns a `claude` process anywhere — the verified zero-LLM-turn critical path (no `claude`/`--bg`/ '
    + '`--restricted` argv appears in ANY call this function makes)', () => {
    const run = fakeRun();
    dispatchReviewMechanical({ pr: 1234, repo: 'chalbert/web-everything' }, { run, newActorId: () => 'actor-1' });
    for (const call of run.mock.calls) {
      const [cmd, args] = call;
      expect(cmd).not.toBe('claude');
      expect(JSON.stringify(args)).not.toMatch(/--restricted|--bg|--session-id/);
    }
  });

  it('reports started BEFORE acquiring a lane (the durable trace exists even if the acquire itself fails)', () => {
    const order = [];
    const run = vi.fn((cmd, args) => {
      if (args[0] === 'scripts/operations/completion-cli.mjs') {
        order.push(args.includes('--status=started') ? 'completion:started' : 'completion:done');
        return '{}';
      }
      if (args[0] === 'scripts/lane-pool.mjs' && args[1] === 'acquire') return '/pool/lane-9';
      if (args[0] === 'scripts/verify-lane.mjs') return JSON.stringify({ status: 'reset' });
      if (args[0] === 'scripts/lane-pool.mjs' && args[1] === 'release') return '';
      if (args[0] === 'scripts/operations/review-loop-cli.mjs') return okReviewLoopJson();
      throw new Error(`unexpected: ${cmd} ${JSON.stringify(args)}`);
    });
    dispatchReviewMechanical({ pr: 1234, repo: 'chalbert/web-everything' }, { run, newActorId: () => 'actor-1' });
    expect(order[0]).toBe('completion:started');
  });

  it('acquires with --purpose=review-loop and --wait-ms=<REVIEW_LOOP_ACQUIRE_WAIT_MS> — never conveyor-delivery', () => {
    const run = fakeRun();
    dispatchReviewMechanical({ pr: 1234, repo: 'chalbert/web-everything' }, { run, newActorId: () => 'actor-1' });
    const acquireCall = run.mock.calls.find((c) => c[1]?.[1] === 'acquire');
    expect(acquireCall[1]).toEqual([
      'scripts/lane-pool.mjs', 'acquire', `--purpose=${REVIEW_LOOP_LANE_PURPOSE}`, '--session=review-1234',
      `--wait-ms=${REVIEW_LOOP_ACQUIRE_WAIT_MS}`, '--adopt',
    ]);
  });

  it('runs review-loop-cli.mjs exactly once with --pr/--repo/--cwd=<acquired lane>/--json, and stamps a FRESH '
    + 'CLAUDE_CODE_SESSION_ID on that subprocess\'s own env — never the wrapper\'s own inherited one', () => {
    const run = fakeRun({ acquireOut: '/pool/lane-9' });
    dispatchReviewMechanical({ pr: 1234, repo: 'chalbert/web-everything' }, { run, newActorId: () => 'fresh-actor-id' });
    const loopCalls = run.mock.calls.filter((c) => c[1]?.[0] === 'scripts/operations/review-loop-cli.mjs');
    expect(loopCalls).toHaveLength(1);
    const [, args, opts] = loopCalls[0];
    expect(args).toEqual([
      'scripts/operations/review-loop-cli.mjs', '--pr=1234', '--repo=chalbert/web-everything', '--cwd=/pool/lane-9', '--json',
    ]);
    expect(opts.env.CLAUDE_CODE_SESSION_ID).toBe('fresh-actor-id');
  });

  it('classifies the review-loop result and reports it via completion-cli --status=done', () => {
    const run = fakeRun();
    const result = dispatchReviewMechanical({ pr: 1234, repo: 'chalbert/web-everything' }, { run, newActorId: () => 'actor-1' });
    expect(result.classified.outcome).toBe('bounced');
    const doneCall = run.mock.calls.find((c) => c[1]?.[0] === 'scripts/operations/completion-cli.mjs' && c[1]?.includes('--status=done'));
    expect(doneCall[1]).toEqual(expect.arrayContaining(['--outcome=bounced', '--runId=run-9', '--verdict=in-progress']));
  });

  it('releases the lane via --all-pools --session=<slug> AFTER reporting done', () => {
    const order = [];
    const run = vi.fn((cmd, args) => {
      if (args[0] === 'scripts/operations/completion-cli.mjs' && args.includes('--status=done')) order.push('done');
      if (args[0] === 'scripts/lane-pool.mjs' && args[1] === 'release') order.push('release');
      if (args[0] === 'scripts/operations/completion-cli.mjs') return '{}';
      if (args[0] === 'scripts/lane-pool.mjs' && args[1] === 'acquire') return '/pool/lane-9';
      if (args[0] === 'scripts/verify-lane.mjs') return JSON.stringify({ status: 'reset' });
      if (args[0] === 'scripts/operations/review-loop-cli.mjs') return okReviewLoopJson();
      throw new Error(`unexpected: ${cmd} ${JSON.stringify(args)}`);
    });
    dispatchReviewMechanical({ pr: 1234, repo: 'chalbert/web-everything' }, { run, newActorId: () => 'actor-1' });
    const releaseCall = run.mock.calls.find((c) => c[1]?.[1] === 'release');
    expect(releaseCall[1]).toEqual(['scripts/lane-pool.mjs', 'release', '--all-pools', '--session=review-1234']);
    expect(order).toEqual(['done', 'release']);
  });

  it('when no lane is available (acquire returns an empty path), reports blocked-on-infra and never calls '
    + 'review-loop-cli.mjs at all', () => {
    const run = vi.fn((cmd, args) => {
      if (args[0] === 'scripts/operations/completion-cli.mjs') return '{}';
      if (args[0] === 'scripts/lane-pool.mjs' && args[1] === 'acquire') return '';
      throw new Error(`unexpected: ${cmd} ${JSON.stringify(args)}`);
    });
    const result = dispatchReviewMechanical({ pr: 1234, repo: 'chalbert/web-everything' }, { run, newActorId: () => 'actor-1' });
    expect(result.classified.outcome).toBe('blocked-on-infra');
    expect(result.lanePath).toBe(null);
    expect(run.mock.calls.some((c) => c[1]?.[0] === 'scripts/operations/review-loop-cli.mjs')).toBe(false);
  });

  it('when review-loop-cli.mjs itself throws (a refusal/crash), reports blocked-on-infra rather than crashing '
    + 'the wrapper, and still releases the lane', () => {
    const run = vi.fn((cmd, args) => {
      if (args[0] === 'scripts/operations/completion-cli.mjs') return '{}';
      if (args[0] === 'scripts/lane-pool.mjs' && args[1] === 'acquire') return '/pool/lane-9';
      if (args[0] === 'scripts/verify-lane.mjs') return JSON.stringify({ status: 'reset' });
      if (args[0] === 'scripts/lane-pool.mjs' && args[1] === 'release') return '';
      if (args[0] === 'scripts/operations/review-loop-cli.mjs') {
        const err = new Error('review-pr refused');
        err.stdout = 'error: something refused';
        throw err;
      }
      throw new Error(`unexpected: ${cmd} ${JSON.stringify(args)}`);
    });
    const result = dispatchReviewMechanical({ pr: 1234, repo: 'chalbert/web-everything' }, { run, newActorId: () => 'actor-1' });
    expect(result.classified.outcome).toBe('blocked-on-infra');
    expect(result.raw.error).toContain('something refused');
    expect(run.mock.calls.some((c) => c[1]?.[1] === 'release')).toBe(true);
  });

  it('when review-loop-cli.mjs prints unparseable JSON, reports blocked-on-infra rather than throwing', () => {
    const run = fakeRun({ reviewLoopOut: 'not json' });
    const result = dispatchReviewMechanical({ pr: 1234, repo: 'chalbert/web-everything' }, { run, newActorId: () => 'actor-1' });
    expect(result.classified.outcome).toBe('blocked-on-infra');
  });

  // #xu2pp2m secondary finding (live #2108 run) — `reportStarted` runs before `acquireLane`, so a THROWN
  // acquire (lane-pool.mjs itself crashed/refused — distinct from the clean "no free lane" `!lanePath` case
  // above) used to propagate straight out of `dispatchReviewMechanical` with nothing catching it, leaving that
  // `started` completion record stranded forever with no matching done/failed write.
  it('when acquireLane THROWS (lane-pool.mjs crashed/refused, not just "no free lane"), still reports a done '
    + 'completion record (blocked-on-infra, never left stranded at started) carrying the real error, releases '
    + 'whatever might have been partially claimed, and rethrows rather than swallowing the failure', () => {
    const run = vi.fn((cmd, args) => {
      if (args[0] === 'scripts/operations/completion-cli.mjs') return '{}';
      if (args[0] === 'scripts/lane-pool.mjs' && args[1] === 'acquire') throw new Error('lane-pool.mjs: no lanes provisioned for "web-everything" under /scratch/.lanes');
      if (args[0] === 'scripts/lane-pool.mjs' && args[1] === 'release') return '';
      throw new Error(`unexpected: ${cmd} ${JSON.stringify(args)}`);
    });
    expect(() => dispatchReviewMechanical({ pr: 1234, repo: 'chalbert/web-everything' }, { run, newActorId: () => 'actor-1' }))
      .toThrow(/no lanes provisioned/);

    // review-loop-cli.mjs must never have been reached — the acquire never produced a lane to run it in.
    expect(run.mock.calls.some((c) => c[1]?.[0] === 'scripts/operations/review-loop-cli.mjs')).toBe(false);

    // A done record WAS written (never left stranded at started), reporting blocked-on-infra with the real
    // error message attached as `label`.
    const doneCall = run.mock.calls.find((c) => c[1]?.[0] === 'scripts/operations/completion-cli.mjs' && c[1]?.includes('--status=done'));
    expect(doneCall).toBeTruthy();
    expect(doneCall[1]).toEqual(expect.arrayContaining(['--outcome=blocked-on-infra']));
    expect(doneCall[1].some((a) => a.startsWith('--label=') && a.includes('no lanes provisioned'))).toBe(true);

    // Whatever the acquire attempt might have partially claimed is still best-effort released.
    expect(run.mock.calls.some((c) => c[1]?.[1] === 'release')).toBe(true);
  });
});
