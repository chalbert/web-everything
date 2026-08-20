/**
 * @file open-pr.test.mjs — opening a PR THROUGH the home that gates it.
 *
 * THE DEFECT UNDER TEST is a bypass, not a bug. `pr-land.mjs` already refuses a non-lane ref, refuses a
 * bodyless PR, resolves the park label and applies the #2833 verify finish-guard. Three PRs in one session
 * skipped every one of those by calling the GitHub connector directly, and one shipped with a red suite.
 *
 * So these assertions are mostly NEGATIVE SPACE: what this operation must NOT do. It must not re-decide the
 * verify marker, must not reach the network itself, and must not turn a home that could not run into a home
 * that refused. Several exist purely to stop a later "helpful" fallback from reopening the bypass.
 */
import { describe, it, expect } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importGraph } from './import-graph.mjs';
import {
  openPrOperation, planOpen, classifySubmit, defaultParkLabel,
  OPEN_PR_OP, SUBMIT_PR_EFFECT, OPEN_MODES, SUBMIT_OUTCOMES, HOME_REASONS,
} from '../open-pr.mjs';
import { createPrLandRunner, createOpenPrSinks, PR_LAND_CLI } from '../open-pr-io.mjs';
import { PARK_LABELS } from '../../pr-land.mjs';

const good = (over = {}) => ({
  ref: 'lane/open-pr-operation', base: 'main', title: 'a title', bodyFile: '/tmp/body.md',
  mode: 'park', parkLabel: 'review:pending', ...over,
});
const ops = () => openPrOperation({ parkLabels: PARK_LABELS });
const step = (decl, name) => decl.steps.find((s) => s.name === name).step;

describe('the declaration', () => {
  it('derives its command line, and takes the park labels from the HOME', () => {
    const decl = ops();
    expect(decl.name).toBe(OPEN_PR_OP);
    expect(decl.input.parkLabel.enum).toEqual([...PARK_LABELS]);
    expect(decl.input.mode.enum).toEqual([...OPEN_MODES]);
  });

  it('refuses to build without the home\'s own park-label list', () => {
    expect(() => openPrOperation({})).toThrow(/PARK_LABELS/);
    expect(() => openPrOperation({ parkLabels: [] })).toThrow(/PARK_LABELS/);
  });

  /**
   * THE DEFAULT PARK IS `pending`, NOT `human`, and this is the assertion that keeps it that way. Defaulting
   * to the human-only gate would push every routine agent PR into the one queue the AI review pass cannot
   * clear — the dilution #2563 caps the scored rubric to avoid. `PARK_LABELS[0]` happens to BE the human
   * label, so the obvious implementation is the wrong one.
   */
  it('defaults the park to the PENDING label, never the human-only gate', () => {
    expect(ops().input.parkLabel.default).toBe('review:pending');
    expect(ops().input.parkLabel.default).not.toBe(PARK_LABELS[0]);
    expect(defaultParkLabel(['review:human', 'review:pending'])).toBe('review:pending');
  });

  it('refuses to guess a default park when the home offers no pending label', () => {
    expect(() => defaultParkLabel(['review:human'])).toThrow(/no safe default park/);
  });

  // Parking is the default MODE too: an agent PR that marches to ready-to-merge unreviewed is the shape park
  // exists to stop, so the un-parked modes must be a deliberate flag rather than an omission.
  it('parks by default', () => {
    expect(ops().input.mode.default).toBe('park');
  });
});

describe('planOpen — the home\'s rules as a pre-flight, and nothing more', () => {
  it('builds the argv the home takes', () => {
    expect(planOpen(good()).argv).toEqual([
      '--ref=lane/open-pr-operation', '--base=main', '--title=a title', '--body-file=/tmp/body.md',
      '--park=review:pending',
    ]);
  });

  it('uses the home\'s own flag for each non-park mode', () => {
    expect(planOpen(good({ mode: 'label-on-green' })).argv).toContain('--label-on-green');
    expect(planOpen(good({ mode: 'no-wait' })).argv).toContain('--no-wait');
    // …and does not smuggle a park label in when it was not asked for.
    expect(planOpen(good({ mode: 'no-wait' })).argv.some((a) => a.startsWith('--park'))).toBe(false);
  });

  it('refuses a ref that is not a lane ref', () => {
    for (const ref of ['main', 'feature/x', '', null]) {
      expect(() => planOpen(good({ ref }))).toThrow(/lane\/\* ref/);
    }
  });

  it('refuses an empty title and a missing body file', () => {
    expect(() => planOpen(good({ title: '  ' }))).toThrow(/`title` must be non-empty/);
    expect(() => planOpen(good({ bodyFile: '' }))).toThrow(/bodyless PR/);
  });

  it('names every problem at once rather than one per attempt', () => {
    expect(() => planOpen({ ref: 'main', base: 'main', title: '', bodyFile: '', mode: 'park' }))
      .toThrow(/lane\/\* ref.*must be non-empty.*bodyless/s);
  });

  /**
   * THE LOAD-BEARING NEGATIVE. The verify marker has ONE home — `verifyGateDecision`, which `pr-land.mjs`
   * already calls. If this operation ever grows its own check, it becomes a second answer that can disagree
   * with the one that actually blocks the land, which is the exact defect `verify` committed against
   * `verify-lane.mjs`. Asserted structurally: the planner takes no marker, reads no sha, and its output
   * mentions no verification at all.
   */
  it('does NOT re-decide the lane-verification gate — that has one home', () => {
    const plan = planOpen(good());
    expect(Object.keys(plan).sort()).toEqual(['argv', 'base', 'bodyFile', 'mode', 'parkLabel', 'ref', 'title']);
    expect(JSON.stringify(plan)).not.toMatch(/verif/i);
    // …and the argv carries no flag that would turn the home's guard off.
    expect(plan.argv.some((a) => /break-glass|require-verified|no-verify/.test(a))).toBe(false);
  });
});

describe('classifySubmit — refused and could-not-run are different facts', () => {
  it('reports an opened PR', () => {
    const r = classifySubmit({ status: 0, stdout: JSON.stringify({ pr: 1500, url: 'https://x/1500', parked: 'review:pending' }) });
    expect(r).toMatchObject({ outcome: 'opened', pr: 1500 });
  });

  /**
   * A refusal is an ANSWER: the home looked and said no, and it said why. #2833's stall guard is the one that
   * matters most — it is exactly the guard the bypass skipped — so its detail has to survive to the caller.
   */
  it('reports the home\'s refusal, carrying the guard that fired', () => {
    const r = classifySubmit({
      status: 3,
      stdout: JSON.stringify({ reason: 'verify-unfinished', detail: 'refusing to land lane/x — verification is UNFINISHED', verifyStatus: 'running' }),
    });
    expect(r).toMatchObject({ outcome: 'refused', reason: 'verify-unfinished', verifyStatus: 'running' });
  });

  /**
   * FOUND BY RUNNING IT, not by reading it. `gh pr create` failing for want of a credential comes back from
   * the home as a STRUCTURED `reason: 'gh-error'`, and the first cut of this function treated any structured
   * reason as a refusal. That sent the caller off to fix a request that was never the problem — the request
   * was fine and the host had no credential. The home's own word decides, not the exit code, because pr-land
   * exits 3 for both kinds.
   */
  it('calls a missing credential unrun, not a refusal — the request was never what was wrong', () => {
    const r = classifySubmit({ status: 3, stdout: JSON.stringify({ reason: 'gh-error', detail: 'gh pr create failed' }) });
    expect(r.outcome).toBe('unrun');
    expect(r.reason).toBe('gh-error');
  });

  it('splits the home\'s vocabulary by what the caller should DO about it', () => {
    const outcomeFor = (reason) => classifySubmit({ status: 3, stdout: JSON.stringify({ reason }) }).outcome;
    // A guard answered — editing the request or the lane is the fix.
    for (const reason of ['bad-ref', 'empty-body', 'no-such-src', 'behind', 'conflict', 'check-red', 'locus-prefix',
      // the #2833 guard's own vocabulary, from `lib/lane-verify.mjs` — the reasons this operation exists for
      'verify-unfinished', 'verify-red', 'verify-corrupt', 'unverified', 'untracked', 'red-ci-gated']) {
      expect({ reason, outcome: outcomeFor(reason) }).toEqual({ reason, outcome: 'refused' });
    }
    // The environment could not complete — the request is not what is wrong.
    for (const reason of ['gh-error', 'push-failed', 'check-timeout', 'blocked-on-infra', 'fallback-failed']) {
      expect({ reason, outcome: outcomeFor(reason) }).toEqual({ reason, outcome: 'unrun' });
    }
    for (const reason of ['opened', 'parked', 'merged-git-fallback']) {
      expect({ reason, outcome: outcomeFor(reason) }).toEqual({ reason, outcome: 'opened' });
    }
    // Every key of the table is one of the three, so a typo'd value cannot slip in.
    for (const v of Object.values(HOME_REASONS)) expect(SUBMIT_OUTCOMES).toContain(v);
  });

  /**
   * A reason the table has not learned is `unrun`, and flagged. The home may grow one, and "we cannot tell
   * whether a guard fired" is not "a guard fired" — reporting `refused` there would claim an answer nobody
   * gave, which is the exact failure this family of operations exists to refuse.
   */
  it('treats an unrecognised reason as unrun and marks it unclassified', () => {
    const r = classifySubmit({ status: 3, stdout: JSON.stringify({ reason: 'some-new-guard' }) });
    expect(r).toMatchObject({ outcome: 'unrun', reason: 'some-new-guard', unclassified: true });
  });

  it('reports a home that could not run as unrun, NOT as a refusal', () => {
    for (const r of [
      classifySubmit({ error: new Error('ENOENT') }),
      classifySubmit({ status: null, signal: 'SIGKILL', stdout: '' }),
      classifySubmit({ status: 1, stdout: 'gh: not authenticated' }),
    ]) {
      expect(r.outcome).toBe('unrun');
      expect(r.outcome).not.toBe('refused');
    }
    expect(SUBMIT_OUTCOMES).toEqual(['opened', 'refused', 'unrun']);
  });

  // The no-credential case specifically: it must never read as an open, and never as a refusal to fix.
  it('a kill says plainly that it is not a refusal', () => {
    expect(classifySubmit({ status: null, signal: 'SIGKILL' }).reason).toMatch(/NOT a refusal/);
  });
});

describe('the submit effect', () => {
  it('declares one NON-idempotent effect carrying the planned argv', () => {
    const effects = step(ops(), 'submit').effects({ verdict: planOpen(good()) });
    expect(effects).toHaveLength(1);
    expect(effects[0]).toMatchObject({ type: SUBMIT_PR_EFFECT, idempotent: false });
    expect(effects[0].payload.argv).toContain('--ref=lane/open-pr-operation');
  });

  /**
   * NOT idempotent, asserted rather than assumed. Opening a PR twice for one ref does not converge — the home
   * may already have created one and the second call's outcome depends on state this operation does not own.
   * Marking it idempotent would let the engine blind-retry a PR creation.
   */
  it('never claims the submission is safe to replay', () => {
    expect(step(ops(), 'submit').effects({ verdict: planOpen(good()) })[0].idempotent).toBe(false);
  });
});

describe('the io shell — one spawn of the home, and no second route', () => {
  it('spawns pr-land.mjs with the planned argv and --json', () => {
    const calls = [];
    const run = createPrLandRunner({
      spawn: (cmd, argv) => { calls.push(argv); return { status: 0, stdout: JSON.stringify({ pr: 7, url: 'u' }) }; },
    });
    expect(run({ argv: ['--ref=lane/x'] })).toMatchObject({ outcome: 'opened', pr: 7 });
    expect(calls[0][0]).toBe(PR_LAND_CLI);
    expect(calls[0]).toContain('--json');
  });

  it('resolves the home from its own location, not the lane being opened', () => {
    expect(PR_LAND_CLI).toMatch(/scripts\/pr-land\.mjs$/);
    expect(PR_LAND_CLI.startsWith('/')).toBe(true);
  });

  // A refusal belongs in the run record where the caller can read which guard fired — not thrown away as an
  // error indistinguishable from a crash.
  it('returns a refusal rather than throwing on it', async () => {
    const sinks = createOpenPrSinks({ run: () => ({ outcome: 'refused', reason: 'verify-not-green' }) });
    await expect(sinks[SUBMIT_PR_EFFECT]({ argv: [] })).resolves.toMatchObject({ outcome: 'refused' });
  });

  it('throws on unrun, and hands the caller the argv to submit elsewhere', async () => {
    const sinks = createOpenPrSinks({ run: () => ({ outcome: 'unrun', reason: 'gh not authenticated' }) });
    await expect(sinks[SUBMIT_PR_EFFECT]({ argv: ['--ref=lane/x'] })).rejects.toThrow(/--ref=lane\/x/);
  });

  /**
   * THE ANTI-BYPASS ASSERTION. The whole point of routing through the home is undone the moment this shell
   * learns to talk to GitHub itself. It may reach `child_process` (to spawn the home) and nothing else that
   * can make a request.
   */
  it('reaches no network of its own — the home is the only route', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const { external } = importGraph(resolve(here, '..', 'open-pr-io.mjs'));
    expect(external).toContain('node:child_process');
    for (const forbidden of ['node:https', 'node:http', 'node:net', 'undici', 'node-fetch']) {
      expect(external).not.toContain(forbidden);
    }
    // …and the declaration itself reaches nothing at all.
    expect(importGraph(resolve(here, '..', 'open-pr.mjs')).external).toEqual([]);
  });
});
