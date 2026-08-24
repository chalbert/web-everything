/**
 * @file record-verdict.test.mjs — carrying a verdict from a credential-less host (#xrk6hmj).
 *
 * THE DEFECT IT CLOSES is retyping, not tedium. Every hand-rolled request restated the PR number, the repo,
 * the actor and the session id in a fresh `JSON.stringify` next to a body path copied from a directory
 * listing — eight times in one session. A wrong number there records a verdict on the WRONG PR, which is the
 * class #1466 fixed on the reading side.
 *
 * So the assertions below are mostly about PROVENANCE: every fact in the request has to come out of the run
 * record the review itself wrote, and the operation has to refuse rather than invent when the record cannot
 * supply one.
 */
import { describe, it, expect } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importGraph } from './import-graph.mjs';
import { recordVerdictOperation, factsFromRun, buildRequest, RECORD_VERDICT_OP, STAGE_REQUEST_EFFECT } from '../record-verdict.mjs';
import { writeUpName, TRANSPORT_BRANCH, createRecordVerdictSinks, resolveTransportRoot } from '../record-verdict-io.mjs';
import { validateRequest, APPLIABLE_TARGETS } from '../../apply-review-request.mjs';

const run = (over = {}) => ({
  id: 'review-pr-abc',
  op: 'review-pr',
  input: { pr: 1496, repo: 'chalbert/web-everything', lens: 'correctness', actor: 'operator' },
  verdict: { verdict: 'accept' },
  telemetry: [{ step: 'judge', sessionId: 'sess-123' }],
  ...over,
});
const ops = (readRun) => recordVerdictOperation({ readRun }, { validateRequest, appliableTargets: APPLIABLE_TARGETS });
/**
 * `steps` is an ARRAY of `{ name, index, step }`, not a map, and the callable body is the INNER `step` —
 * looked up rather than indexed so a rename or a reorder surfaces here as a missing step instead of as an
 * off-by-one calling the wrong function.
 */
const step = (decl, name) => decl.steps.find((s) => s.name === name).step;

describe('the declaration', () => {
  // THE POINT OF THE WHOLE OPERATION: there is no `--pr`, so it cannot be mistyped onto another PR.
  it('takes a run id and NOT a PR number — the subject is read, never retyped', () => {
    const decl = ops(() => ({ record: run(), body: 'x' }));
    expect(decl.name).toBe(RECORD_VERDICT_OP);
    expect(Object.keys(decl.input)).toEqual(['runId', 'to', 'actor', 'operatorInstruction', 'repoRoot']);
    expect(Object.keys(decl.input)).not.toContain('pr');
    expect(Object.keys(decl.input)).not.toContain('repo');
  });

  it('takes its target enum from the APPLIER, so the two cannot disagree about what is legal', () => {
    expect(ops(() => ({ record: run(), body: 'x' })).input.to.enum).toEqual([...APPLIABLE_TARGETS]);
  });

  it('refuses to build without the applier\'s own validator — it states no request rule of its own', () => {
    expect(() => recordVerdictOperation({ readRun: () => ({}) }, {})).toThrow(/validateRequest/);
    expect(() => recordVerdictOperation({}, { validateRequest, appliableTargets: APPLIABLE_TARGETS })).toThrow(/readRun/);
  });

  /**
   * THE DECLARATION REACHES NOTHING THAT CAN ACT — the #3036 property, asserted here because this operation
   * PUSHES. `record-verdict` is not read-only and never will be, so `http-adapter.test.mjs`'s pinned
   * read-only list cannot make this claim on its behalf; without this test the module could quietly grow a
   * `child_process` import and stage-and-push straight out of a `compute` step, where no effect ledger and
   * no `--json` `applied` list would ever show it happened.
   */
  it('imports nothing that can act — every git call lives in the io shell', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    expect(importGraph(resolve(here, '..', 'record-verdict.mjs')).external).toEqual([]);
    // …and the boundary of that guarantee, stated rather than implied: the shell it delegates to DOES act.
    expect(importGraph(resolve(here, '..', 'record-verdict-io.mjs')).external).toContain('node:child_process');
  });
});

describe('factsFromRun — provenance, or a refusal', () => {
  it('reads the subject and the juror session out of the record', () => {
    expect(factsFromRun(run())).toMatchObject({ pr: 1496, repo: 'chalbert/web-everything', sessionId: 'sess-123', reduced: 'accept' });
  });

  /**
   * Recording a verdict for a run that never produced one is not a partial success — it is a fabricated
   * review, and the staged file would be indistinguishable from a real one on the transport branch.
   */
  it('refuses a run whose judge step never produced a verdict', () => {
    expect(() => factsFromRun(run({ verdict: null }))).toThrow(/no verdict/);
  });

  it('refuses a run that is not a review at all', () => {
    expect(() => factsFromRun(run({ op: 'verify' }))).toThrow(/not a review/);
  });

  it('refuses a missing record rather than defaulting a subject', () => {
    expect(() => factsFromRun(null, { runId: 'nope' })).toThrow(/no run record/);
  });

  it('refuses a record whose subject is unusable', () => {
    for (const input of [{ pr: 0, repo: 'a/b' }, { pr: 5, repo: 'not-a-slug' }, {}]) {
      expect(() => factsFromRun(run({ input }))).toThrow(/no usable subject/);
    }
  });

  // Absent is honest: without it the durable comment records independence as UNPROVEN, which is the truth.
  it('carries no session id rather than inventing one', () => {
    expect(factsFromRun(run({ telemetry: [] })).sessionId).toBeUndefined();
  });
});

describe('buildRequest — the applier\'s rules, applied here', () => {
  const facts = { pr: 1496, repo: 'chalbert/web-everything', sessionId: 'sess-123', reduced: 'accept' };

  it('builds a request the applier accepts', () => {
    const out = buildRequest({ facts, to: 'accepted', body: 'the write-up', actor: 'claude-review-pr' }, validateRequest);
    expect(out.request).toMatchObject({ pr: 1496, repo: 'chalbert/web-everything', to: 'accepted', sessionId: 'sess-123' });
    expect(out.path).toBe('ops/review-requests/1496-accepted.json');
  });

  // The applier's own refusals reach the caller unchanged — not re-worded, not re-derived.
  it('surfaces the APPLIER\'s refusal for a clear-human with no operator instruction', () => {
    expect(() => buildRequest({ facts, to: 'clear-human', body: 'b', actor: 'a' }, validateRequest)).toThrow(/operatorInstruction/);
  });

  it('surfaces the applier\'s refusal for an empty `changes` body', () => {
    expect(() => buildRequest({ facts, to: 'changes', body: '   ', actor: 'a' }, validateRequest)).toThrow(/non-empty `body`/);
  });

  it('surfaces the applier\'s refusal for a stray instruction on an ordinary verdict', () => {
    expect(() => buildRequest({ facts, to: 'accepted', body: 'b', actor: 'a', operatorInstruction: 'go' }, validateRequest))
      .toThrow(/belongs only on a `clear-human`/);
  });

  /**
   * An operator recording `changes` over a panel that reduced to `accept` is a legitimate override — #2409's
   * arc has always allowed it. It is SURFACED rather than blocked, so the record shows the disagreement
   * instead of hiding it.
   */
  it('flags a verdict that overrides the panel, without refusing it', () => {
    expect(buildRequest({ facts, to: 'changes', body: 'b', actor: 'a' }, validateRequest).disagreesWithPanel).toBe(true);
    expect(buildRequest({ facts, to: 'accepted', body: 'b', actor: 'a' }, validateRequest).disagreesWithPanel).toBe(false);
  });
});

describe('the read step refuses a verdict with nothing to say', () => {
  it('refuses when the run staged no write-up — the comment IS the review', () => {
    const decl = ops(() => ({ record: run(), body: '  ' }));
    expect(() => step(decl, 'read').fn({ input: { runId: 'review-pr-abc' } })).toThrow(/staged no write-up/);
  });
});

describe('the stage effect', () => {
  it('declares one idempotent effect carrying bytes the plan already computed', () => {
    const decl = ops(() => ({ record: run(), body: 'x' }));
    const effects = step(decl, 'stage').effects({ verdict: { path: 'ops/review-requests/1496-accepted.json', request: { pr: 1496, to: 'accepted', repo: 'chalbert/web-everything' } } });
    expect(effects).toHaveLength(1);
    expect(effects[0]).toMatchObject({ type: STAGE_REQUEST_EFFECT, idempotent: true });
    expect(JSON.parse(effects[0].payload.content)).toMatchObject({ pr: 1496 });
  });
});

describe('the sink — a worktree, never a branch switch in the caller\'s lane', () => {
  /**
   * EVERY side effect is stubbed, filesystem included, and that is not belt-and-braces.
   *
   * The first version of this helper injected `run` only. The sink's own `mkdirSync` therefore ran for real
   * against the fixture root `/repo` — and as root it SUCCEEDED, creating a directory at the filesystem root
   * while the suite reported green. CI, running as an ordinary user, failed it `EACCES` and reddened four
   * tests. The red was the honest result; the local green was a suite asserting a sink's behaviour while that
   * sink wrote outside its checkout, unnoticed.
   *
   * `fs` records into the same `calls` array as `run`, so a test can assert on where the sink writes as
   * readily as on what it shells.
   */
  const stub = (calls, over = {}, onRun) => createRecordVerdictSinks({
    root: '/repo',
    // #3261 — the board is chosen by matching the checkout's origin to the request's repo, and a mismatch is
    // REFUSED rather than defaulted. These stubs push for `chalbert/web-everything`, so the fixture checkout
    // claims to be that repo. Injected, so no test shells `git remote`.
    originRepo: () => 'chalbert/web-everything',
    now: () => 111,
    run: (args, opts) => {
      calls.push({ args, cwd: opts?.cwd });
      if (onRun) { const r = onRun(args); if (r !== undefined) return r; }
      return over[args[0]] ?? '';
    },
    mkdir: (p, o) => calls.push({ fs: 'mkdir', path: p, opts: o }),
    write: (p, c) => calls.push({ fs: 'write', path: p, content: c }),
    rm: (p, o) => calls.push({ fs: 'rm', path: p, opts: o }),
  });
  const sink = (calls, over = {}) => stub(calls, over)[STAGE_REQUEST_EFFECT];

  /**
   * THE REGRESSION GUARD for the above: a sink built with no fs stubs must not be what these tests exercise.
   * Asserted by construction — the builder accepts the three, and passing them is what keeps the suite
   * hermetic. If someone removes the parameters, this stops compiling against the real signature.
   */
  it('takes its filesystem calls as injected parameters, so a test never writes for real', async () => {
    const calls = [];
    await sink(calls, { diff: '' })({ path: 'ops/review-requests/1-accepted.json', content: '{}\n', pr: 1, to: 'accepted', repo: 'chalbert/web-everything' });
    const writes = calls.filter((c) => c.fs);
    expect(writes.length).toBeGreaterThan(0);
    // …and every path it touched is under the worktree it created, never the caller's root itself.
    for (const w of writes) expect(w.path.startsWith('/repo/.operations/transport')).toBe(true);
  });

  /**
   * Checking the transport branch out over the caller's lane would take their uncommitted work with it. I did
   * the equivalent by hand earlier and it disrupted a running juror mid-review, which is why this is a
   * worktree and why it is asserted rather than assumed.
   */
  it('never runs a checkout in the caller\'s root — only inside its own worktree', async () => {
    const calls = [];
    await sink(calls, { diff: 'ops/review-requests/1496-accepted.json' })({ path: 'ops/review-requests/1496-accepted.json', content: '{}\n', pr: 1496, to: 'accepted', repo: 'chalbert/web-everything' })
      .catch(() => {});
    const checkouts = calls.filter((c) => c.args?.[0] === 'checkout');
    expect(checkouts.length).toBeGreaterThan(0);
    for (const c of checkouts) expect(c.cwd).not.toBe('/repo');
  });

  it('always prunes the worktree, even when the push throws', async () => {
    const calls = [];
    const sinks = stub(calls, { diff: 'ops/review-requests/1496-accepted.json' }, (args) => {
      if (args[0] === 'push') throw new Error('network');
      return undefined;
    });
    await expect(sinks[STAGE_REQUEST_EFFECT]({ path: 'ops/review-requests/1496-accepted.json', content: '{}\n', pr: 1496, to: 'accepted', repo: 'chalbert/web-everything' })).rejects.toThrow(/network/);
    expect(calls.some((c) => c.args?.[0] === 'worktree' && c.args?.[1] === 'prune')).toBe(true);
    // The DIRECTORY removal too, not just the registration prune — a `finally` that dropped one of the two
    // would still pass a check for the other.
    expect(calls.some((c) => c.fs === 'rm')).toBe(true);
  });

  // A replay that stages identical bytes has nothing to commit, and that is the `idempotent: true` promise
  // being kept rather than an error to report.
  it('treats "nothing to commit" as success, not failure', async () => {
    const calls = [];
    const out = await sink(calls, { diff: '' })({ path: 'ops/review-requests/1496-accepted.json', content: '{}\n', pr: 1496, to: 'accepted', repo: 'chalbert/web-everything' });
    expect(out).toMatchObject({ pushed: false });
    expect(calls.some((c) => c.args?.[0] === 'push')).toBe(false);
  });

  it('pushes to the branch CI actually watches', async () => {
    const calls = [];
    await sink(calls, { diff: 'x' })({ path: 'ops/review-requests/1496-accepted.json', content: '{}\n', pr: 1496, to: 'accepted', repo: 'chalbert/web-everything' });
    const push = calls.find((c) => c.args?.[0] === 'push');
    expect(push.args).toContain(`HEAD:${TRANSPORT_BRANCH}`);
  });
});

describe('the write-up name matches what review-pr stages', () => {
  it('is repo-and-pr keyed, with the slash flattened', () => {
    expect(writeUpName('chalbert/web-everything', 1496)).toBe('chalbert-web-everything-1496-verdict.md');
  });
});

// ── #3261: each repo owns its own notes, and the wrong board is REFUSED ──────────────────────────────────────
describe('#3261 — resolveTransportRoot picks the board, and refuses the wrong one', () => {
  it('returns the checkout whose origin IS the request repo', () => {
    expect(resolveTransportRoot({ repo: 'o/x', root: '/co', originRepo: () => 'o/x' })).toBe('/co');
  });

  it('REFUSES a verdict for another repo rather than defaulting to this checkout', () => {
    // THE WHOLE POINT. Before the ruling this pushed a plateau-app verdict onto web-everything's board, where
    // the applier's repo-scoped token could not resolve the repository — one failure in fifty applier runs,
    // and it was the only cross-repo request. Defaulting is what stranded it; refusing names both repos.
    expect(() => resolveTransportRoot({ repo: 'o/other', root: '/co', originRepo: () => 'o/x' }))
      .toThrow(/refusing to stage a verdict for o\/other on o\/x's transport branch/);
  });

  it('the refusal names the flag that fixes it', () => {
    expect(() => resolveTransportRoot({ repo: 'o/other', root: '/co', originRepo: () => 'o/x' }))
      .toThrow(/--repoRoot=<path to a o\/other checkout>/);
  });

  it('an explicit repoRoot wins over the driver checkout', () => {
    const seen = [];
    const got = resolveTransportRoot({
      repo: 'o/other', root: '/driver', repoRoot: '/sibling',
      originRepo: (cwd) => { seen.push(cwd); return cwd === '/sibling' ? 'o/other' : 'o/x'; },
    });
    expect(got).toBe('/sibling');
    expect(seen).toEqual(['/sibling']); // it never probes the driver when told where to look
  });

  it('refuses a request with no repo at all — no board can be chosen', () => {
    expect(() => resolveTransportRoot({ repo: '', root: '/co' })).toThrow(/no `repo` on the request/);
  });

  it('an unreadable origin refuses rather than guessing', () => {
    // `defaultOriginRepo` returns '' when git cannot answer. That must not compare equal to anything.
    expect(() => resolveTransportRoot({ repo: 'o/x', root: '/co', originRepo: () => '' }))
      .toThrow(/refusing to stage a verdict for o\/x on \(unknown\)/);
  });
});
