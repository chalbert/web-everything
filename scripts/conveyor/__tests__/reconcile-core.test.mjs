/**
 * @file scripts/conveyor/__tests__/reconcile-core.test.mjs
 * @description Pins the resident reconcile pass (WE #3296) — the dispatch and, mostly, its FOUR REFUSALS.
 *
 *   Nothing in the tree compared desired delivery state against actual: `planTick` spawns only for PRs the
 *   CURRENT session launched (`tick-core.mjs:396`), and that bookkeeping is piped in over STDIN, so it dies with
 *   the session. `planReconcile` is the pass that closes it, and the dispatch is the easy half. These cases are
 *   weighted the way the item is: one for the dispatch and its KEY, one per refusal, and one for the argv —
 *   because every refusal is a place where a plausible simplification silently re-opens the defect.
 *
 *   THE ARGV CASE IS NOT CEREMONY. Every other case here runs on injected fixtures and would stay green while
 *   the pass read the wrong PRs and reconciled nothing in production. A wrong discovery query fails SILENTLY —
 *   an empty listing reads exactly like a fleet with nothing owed.
 *
 *   THE MUTATIONS THIS FILE IS BUILT TO KILL (one per refusal, each named with the case it reddens):
 *     • drop the `stood-down` check                       → reddens case 2 only.
 *     • drop the empty-findings check                     → reddens case 3 only.
 *     • read the attempt count from an in-process tally    → reddens case 4 only.
 *     • accept a fresh transcript mtime as liveness       → reddens case 5(c) ONLY, and must leave 5(a) green.
 *
 *   That last asymmetry is the whole of refusal 4 and it is easy to get backwards: 5(a) is a LIVE pid with a
 *   STALE transcript, so a mutant that grants liveness on freshness never fires on it — the live pid refuses
 *   either way. 5(c) is a FRESH transcript with NO agent entry, which is exactly what that mutant breaks.
 *   Freshness never grants liveness; staleness never withdraws it. A mutation that reddens BOTH has removed the
 *   wrong thing. 5(b) and 5(d) carry a stale mtime too, so what their refusal turns on is the entry's own fields
 *   and nothing else.
 *
 *   Every fixture below is a shape MEASURED on 2026-08-26, not an invented one; the timestamps in the case names
 *   say when.
 */
import { describe, it, expect } from 'vitest';
import {
  planReconcile, countFindings, bindAgents, assessLiveness, isAwaitingPermission, startedAtMs,
  REFUSAL_KINDS, DISPATCH_KINDS,
} from '../reconcile-core.mjs';
import { STAND_DOWN_MARKER } from '../stand-down.mjs';
import { REARM_COMMENT_MARKER } from '../rearm-review.mjs';
import { laneRefItemNum } from '../lease-reaper.mjs';
import { NEGOTIATION_ROUND_CAP } from '../../lib/jury-core.mjs';
import { defaultReadPrs, defaultReadAgents, PR_LIST_JSON_FIELDS, PR_LIST_LIMIT } from '../reconcile-pass.mjs';

// ── fixtures — measured shapes, 2026-08-26 ───────────────────────────────────────────────────────────────────
const NOW = Date.parse('2026-08-26T17:34:00Z');
const HOUR = 3_600_000;
/** The three permission-blocked sessions started 2026-08-17T22:10–22:12Z — 211.4 h before the 17:34Z reading. */
const BLOCKED_SINCE = '2026-08-17T22:10:00Z';
/** THE SHAPE THE TOOL ACTUALLY RETURNS. Read off a live `claude agents --json` on 2026-08-26: `startedAt` is an
 *  epoch NUMBER, not the ISO string it reads like. This is `conveyor-3151`'s (pid 18278) real value. */
const BLOCKED_SINCE_EPOCH = 1787004649412; // === 2026-08-17T22:10:49.412Z
const STALE_MTIME = NOW - 211.4 * HOUR;   // a transcript nobody has written to in 211 hours.
const FRESH_MTIME = NOW - 30_000;         // written 30 s ago.

const lbl = (...names) => names.map((name) => ({ name }));
const greenRollup = [{ name: 'gate', status: 'completed', conclusion: 'success' }];
const pendingRollup = [{ name: 'gate', status: 'in_progress', conclusion: null }];
const finding = (text = 'the cap is not derived from the PR; derive it from the comment thread') =>
  ({ body: `🔁 human review — changes requested\n\n${text}` });

/** PR #1563 — open 2026-08-25T22:00:51Z, merged 16:39:23Z, 18 h 39 m and TWELVE review rounds against a cap of 5. */
const pr1563 = (over = {}) => ({
  number: 1563,
  state: 'OPEN',
  headRefName: 'lane/2612-converge-pr-drive',
  headRefOid: 'aa11bb22cc33dd44ee55ff6677889900aabbccdd',
  labels: lbl('review:changes'),
  mergeStateStatus: 'CLEAN',
  statusCheckRollup: greenRollup,
  comments: [finding()],
  ...over,
});

/** The four PRs actually open at 17:34Z, with the labels and comment counts measured then. */
const OPEN_AT_1734 = [
  { number: 1576, headRefName: 'lane/review-slice-scopes', labels: lbl('review:changes', 'checking'), nComments: 2 },
  { number: 1572, headRefName: 'lane/review-pr-override-reason', labels: lbl('review:accepted'), nComments: 9 },
  { number: 1571, headRefName: 'lane/review-corpus-replay', labels: lbl('ready-to-merge', 'review:accepted', 'checking'), nComments: 6 },
  { number: 1569, headRefName: 'lane/review-efficacy-watch', labels: lbl('ready-to-merge', 'review:accepted', 'checking'), nComments: 9 },
].map((p) => ({
  number: p.number,
  state: 'OPEN',
  headRefName: p.headRefName,
  headRefOid: `${p.number}`.repeat(10),
  labels: p.labels,
  mergeStateStatus: 'CLEAN',
  statusCheckRollup: pendingRollup,
  comments: Array.from({ length: p.nComments }, (_, i) => finding(`round ${i + 1}`)),
}));

/** A spy for the injected `exec`, so a discovery query is assertable with no `gh` and no credential. */
const spyExec = (stdout = '[]') => {
  const calls = [];
  return { calls, exec: (file, argv, opts) => { calls.push({ file, argv, opts }); return stdout; } };
};

// ── CASE 1 — THE DISPATCH, AND ITS KEY ────────────────────────────────────────────────────────────────────────
describe('case 1 — the dispatch, keyed by PR NUMBER (#3296)', () => {
  it('a bounced PR with a finding and nothing live on it returns exactly one `fix` dispatch', () => {
    const plan = planReconcile({ prs: [pr1563()], agents: [], durableCounts: {}, now: NOW });
    expect(plan.dispatch).toHaveLength(1);
    expect(plan.dispatch[0].kind).toBe('fix');
    expect(plan.dispatch[0].prNumber).toBe(1563);
    expect(plan.refusals).toHaveLength(0);
  });

  it('an agent listing with no entry BOUND to the PR does not suppress the dispatch', () => {
    // Live sessions, in real lanes, on OTHER heads. Being alive somewhere is not being alive HERE — the whole
    // reason the binding is derived rather than assumed.
    const agents = [
      { sessionId: 's1', cwd: '/lanes/lane-37', pid: 111, pidAlive: true, laneHeadOid: 'ffff'.repeat(10) },
      { sessionId: 's2', cwd: '/lanes/lane-39', pid: 222, pidAlive: true, laneHeadOid: 'eeee'.repeat(10) },
    ];
    const plan = planReconcile({ prs: [pr1563()], agents, durableCounts: {}, now: NOW });
    expect(plan.dispatch.map((d) => d.kind)).toEqual(['fix']);
  });

  it('THE KEY: the four real head refs open at 17:34Z produce FOUR rows — an item-keyed pass produces ZERO', () => {
    // Measured 2026-08-26 17:34Z: `laneRefItemNum` returns null on every one of the four. Its grammar is
    // `^lane/(x[a-z0-9]{5,7}|\d+)[a-z]?-`, and none of today's review lanes match it. A pass keyed by ITEM
    // number would therefore have seen none of the PRs it exists to reconcile. That difference is this test.
    const refs = OPEN_AT_1734.map((p) => p.headRefName);
    expect(refs).toEqual([
      'lane/review-slice-scopes', 'lane/review-pr-override-reason',
      'lane/review-corpus-replay', 'lane/review-efficacy-watch',
    ]);
    expect(refs.map(laneRefItemNum)).toEqual([null, null, null, null]);
    expect(refs.map(laneRefItemNum).filter(Boolean)).toHaveLength(0); // the item-keyed pass: zero rows.

    const plan = planReconcile({ prs: OPEN_AT_1734, agents: [], durableCounts: {}, now: NOW });
    const rows = [...plan.dispatch, ...plan.refusals];
    expect(rows).toHaveLength(4);
    expect(rows.map((r) => r.prNumber).sort()).toEqual([1569, 1571, 1572, 1576]);
    // #1576 was the only one of the four with work owed; the other three were reviewed and queued to land.
    expect(plan.dispatch.map((d) => [d.prNumber, d.kind])).toEqual([[1576, 'fix']]);
    expect(plan.refusals.map((r) => r.kind)).toEqual(['nothing-owed', 'nothing-owed', 'nothing-owed']);
  });

  it('EVERY PR yields exactly one row — a pass that drops a PR silently is the original defect one level up', () => {
    const prs = [...OPEN_AT_1734, pr1563(), pr1563({ number: 9001, comments: [] })];
    const plan = planReconcile({ prs, agents: [], durableCounts: {}, now: NOW });
    expect(plan.dispatch.length + plan.refusals.length).toBe(prs.length);
    const keyed = [...plan.dispatch, ...plan.refusals].map((r) => r.prNumber);
    expect(new Set(keyed).size).toBe(prs.length);
  });

  it('every refusal kind this pass can emit is on the frozen REFUSAL_KINDS list', () => {
    const prs = [...OPEN_AT_1734, pr1563(), pr1563({ number: 9001, comments: [] })];
    const plan = planReconcile({ prs, agents: [], durableCounts: {}, now: NOW });
    for (const r of plan.refusals) expect(REFUSAL_KINDS).toContain(r.kind);
    for (const d of plan.dispatch) expect(DISPATCH_KINDS).toContain(d.kind);
  });
});

// ── CASE 2 — REFUSAL 1: `stood-down` IS TERMINAL ──────────────────────────────────────────────────────────────
describe('case 2 — refusal 1: a fixer that stopped to ASK is never restarted (#3296)', () => {
  const stoodDown = pr1563({ comments: [finding(), { body: `${STAND_DOWN_MARKER}\n\nthe finding needs a judgment.` }] });

  it('returns ZERO dispatches and one `stood-down` refusal', () => {
    const plan = planReconcile({ prs: [stoodDown], agents: [], durableCounts: {}, now: NOW });
    expect(plan.dispatch).toHaveLength(0);
    expect(plan.refusals).toHaveLength(1);
    expect(plan.refusals[0].kind).toBe('stood-down');
    expect(plan.refusals[0].prNumber).toBe(1563);
    expect(plan.refusals[0].standDowns).toBe(1);
  });

  it('TERMINAL — a week later the answer is byte-identical: no decay, no clock', () => {
    const a = planReconcile({ prs: [stoodDown], agents: [], durableCounts: {}, now: NOW });
    const b = planReconcile({ prs: [stoodDown], agents: [], durableCounts: {}, now: NOW + 7 * 24 * HOUR });
    expect(b).toEqual(a);
  });

  it('a human QUOTING the stand-down comment does not mark the PR stood down', () => {
    // The marker counts only as a LEADING line — the same narrowing `countRearmComments` applies, and for the
    // same reason: a person replying to the escalation is raising a finding, not posting a marker.
    const quoted = pr1563({ comments: [{ body: `> ${STAND_DOWN_MARKER}\n\nI disagree — here is the call.` }] });
    const plan = planReconcile({ prs: [quoted], agents: [], durableCounts: {}, now: NOW });
    expect(plan.refusals.map((r) => r.kind)).not.toContain('stood-down');
    expect(plan.dispatch.map((d) => d.kind)).toEqual(['fix']);
  });
});

// ── CASE 3 — REFUSAL 2: NO FINDINGS, NO FIXER ─────────────────────────────────────────────────────────────────
describe('case 3 — refusal 2: a PR with nothing to fix never gets a fixer (#3296)', () => {
  /** #1576 as measured at 17:21Z: `review:pending`, ZERO comments, head ref `lane/review-slice-scopes`. */
  const pr1576 = (over = {}) => ({
    number: 1576, state: 'OPEN',
    headRefName: 'lane/review-slice-scopes', headRefOid: '1576'.repeat(10),
    labels: lbl('review:pending', 'checking'), mergeStateStatus: 'CLEAN',
    statusCheckRollup: pendingRollup, comments: [], ...over,
  });

  it('#1576 at 17:21Z — no `fix` dispatch, and a `no-findings` refusal', () => {
    const plan = planReconcile({ prs: [pr1576()], agents: [], durableCounts: {}, now: NOW });
    expect(plan.dispatch.map((d) => d.kind)).not.toContain('fix');
    expect(plan.refusals.map((r) => r.kind)).toEqual(['no-findings']);
    expect(plan.refusals[0].prNumber).toBe(1576);
    expect(plan.refusals[0].findings).toBe(0);
  });

  it('the SAME fixture returns a `review` dispatch — "nothing to fix" is not "nothing to do"', () => {
    const plan = planReconcile({ prs: [pr1576()], agents: [], durableCounts: {}, now: NOW });
    expect(plan.dispatch).toHaveLength(1);
    expect(plan.dispatch[0].kind).toBe('review');
    expect(plan.dispatch[0].prNumber).toBe(1576);
  });

  it('a BOUNCED PR with zero findings gets NOTHING — the sharper half of the same refusal', () => {
    // A supervisor that refused to dispatch a fixer at a comment-less PR was right to refuse. Without the
    // empty-findings check this is where a fix agent gets handed a PR and invents work to justify itself.
    const plan = planReconcile({ prs: [pr1563({ comments: [] })], agents: [], durableCounts: {}, now: NOW });
    expect(plan.dispatch).toHaveLength(0);
    expect(plan.refusals.map((r) => r.kind)).toEqual(['no-findings']);
  });

  it('the conveyor\'s OWN marker comments are not findings — three re-arms is still zero findings', () => {
    const onlyBookkeeping = pr1563({ comments: [{ body: REARM_COMMENT_MARKER }, { body: REARM_COMMENT_MARKER }] });
    expect(countFindings(onlyBookkeeping.comments)).toBe(0);
    const plan = planReconcile({ prs: [onlyBookkeeping], agents: [], durableCounts: {}, now: NOW });
    expect(plan.dispatch).toHaveLength(0);
    expect(plan.refusals[0].kind).toBe('no-findings');
    expect(plan.refusals[0].comments).toBe(2); // two comments, zero findings — the distinction is the point.
  });
});

// ── CASE 4 — REFUSAL 3: THE CAP SURVIVES A RESTART, OR IT IS NOT A CAP ────────────────────────────────────────
describe('case 4 — refusal 3: the round cap is derived from the PR and ONLY from the PR (#3296)', () => {
  it('a fresh pass carrying NOTHING in refuses on the PR\'s own count', () => {
    // `durableCounts` is what the shell read back off the PR's comment thread. No in-process state exists here:
    // this pass is one-shot. #1563 ran to TWELVE rounds against a cap of 5 with a durable count of 0 — the cap
    // never bound because it was held in process memory that kept dying.
    const plan = planReconcile({ prs: [pr1563()], agents: [], durableCounts: { 1563: 5 }, now: NOW });
    expect(plan.dispatch).toHaveLength(0);
    expect(plan.refusals).toHaveLength(1);
    expect(plan.refusals[0]).toMatchObject({ kind: 'cap-exhausted', prNumber: 1563, attempts: 5, cap: NEGOTIATION_ROUND_CAP });
  });

  it('AN IN-MEMORY TALLY CANNOT SATISFY IT — a tally of 9 on a PR whose own count is 0 still dispatches', () => {
    // The criterion is not "a cap exists", it is "the cap is PR-sourced". A pass that read a process tally would
    // refuse here, and would then reset to zero on the next restart — which is what "not a cap" means.
    const plan = planReconcile({
      prs: [pr1563()], agents: [], durableCounts: {}, now: NOW,
      attemptTally: { 1563: 9 }, // deliberately supplied, and deliberately never read.
    });
    expect(plan.refusals.map((r) => r.kind)).not.toContain('cap-exhausted');
    expect(plan.dispatch.map((d) => [d.prNumber, d.kind, d.attempts])).toEqual([[1563, 'fix', 0]]);
  });

  it('the PR\'s own re-arm comments bind the cap even when the shell supplied no map at all', () => {
    const burned = pr1563({ comments: [finding(), ...Array.from({ length: 5 }, () => ({ body: REARM_COMMENT_MARKER }))] });
    const plan = planReconcile({ prs: [burned], agents: [], durableCounts: {}, now: NOW });
    expect(plan.refusals[0]).toMatchObject({ kind: 'cap-exhausted', attempts: 5 });
  });

  it('one attempt below the cap still dispatches — the cap binds AT the cap, not before it', () => {
    const plan = planReconcile({ prs: [pr1563()], agents: [], durableCounts: { 1563: 4 }, now: NOW });
    expect(plan.dispatch.map((d) => d.attempts)).toEqual([4]);
  });
});

// ── CASE 5 — REFUSAL 4: LIVENESS COMES FROM A LIVE PROCESS ────────────────────────────────────────────────────
describe('case 5 — refusal 4: liveness from a live PROCESS, and the listing is thinner than it looks (#3296)', () => {
  const SHA = pr1563().headRefOid;

  it('5(a) a LIVE pid refuses — however stale the transcript is (211 h stale here)', () => {
    // Freshness never grants liveness, and STALENESS NEVER WITHDRAWS IT. A transcript stops being written when
    // an agent FINISHES exactly as when it dies, so a 211-hour-old transcript says nothing about the process.
    const agents = [{ sessionId: 's-a', cwd: '/lanes/lane-37', pid: 18278, pidAlive: true, laneHeadOid: SHA }];
    const plan = planReconcile({ prs: [pr1563({ transcriptMtimeMs: STALE_MTIME })], agents, durableCounts: {}, now: NOW });
    expect(plan.dispatch).toHaveLength(0);
    expect(plan.refusals).toHaveLength(1);
    expect(plan.refusals[0]).toMatchObject({ kind: 'live-process', pid: 18278, prNumber: 1563 });
  });

  it('5(b) a session blocked on a PERMISSION PROMPT refuses under its OWN kind, and is SURFACED', () => {
    // The fifth state: neither alive nor dead. Three sessions have held one for 211.4 h. Folded into
    // `live-process` it reads as "busy" and stays invisible for another 211 hours.
    const agents = [{
      sessionId: 's-b', cwd: '/lanes/lane-31', pid: 32933, pidAlive: true, laneHeadOid: SHA,
      status: 'waiting', waitingFor: 'permission prompt', startedAt: BLOCKED_SINCE,
    }];
    const plan = planReconcile({ prs: [pr1563({ transcriptMtimeMs: STALE_MTIME })], agents, durableCounts: {}, now: NOW });
    expect(plan.dispatch).toHaveLength(0);
    expect(plan.refusals[0].kind).toBe('awaiting-permission');
    expect(plan.refusals[0].kind).not.toBe('live-process'); // outranks a live pid ON PURPOSE.
    expect(plan.notes).toHaveLength(1);
    expect(plan.notes[0]).toMatchObject({ kind: 'awaiting-permission', prNumber: 1563, heldHours: 211.4 });
    expect(plan.notes[0].text).toContain('nobody is there to answer it');
  });

  it('5(b\u2032) the SAME block, with `startedAt` in the shape the tool really returns — an epoch NUMBER', () => {
    // Measured off a live listing: `startedAt` comes back as `1787004649412`, and `Date.parse` of that is NaN.
    // A parser that accepted only the ISO string would compute NO age — silently dropping the one figure that
    // makes a 217-hour block impossible to overlook, while every other assertion stayed green.
    const agents = [{
      sessionId: 's-b2', cwd: '/lanes/lane-31', pid: 18278, pidAlive: true, laneHeadOid: SHA,
      status: 'waiting', waitingFor: 'permission prompt', startedAt: BLOCKED_SINCE_EPOCH,
    }];
    const plan = planReconcile({ prs: [pr1563({ transcriptMtimeMs: STALE_MTIME })], agents, durableCounts: {}, now: NOW });
    expect(plan.refusals[0].kind).toBe('awaiting-permission');
    expect(plan.notes[0].heldHours).toBe(211.4);          // NOT null — the whole point of this case.
    expect(plan.notes[0].text).toContain('211.4h');
  });

  it('`startedAt` is read in every shape the listing produces, and unreadable ones do not throw', () => {
    expect(startedAtMs(BLOCKED_SINCE_EPOCH)).toBe(BLOCKED_SINCE_EPOCH);
    expect(startedAtMs('2026-08-17T22:10:49.412Z')).toBe(BLOCKED_SINCE_EPOCH);
    expect(startedAtMs(String(BLOCKED_SINCE_EPOCH))).toBe(BLOCKED_SINCE_EPOCH); // a numeric STRING is an epoch too
    expect(startedAtMs(null)).toBeNaN();
    expect(startedAtMs(undefined)).toBeNaN();
    expect(startedAtMs('not a date')).toBeNaN();
  });

  it('an unreadable `startedAt` still SURFACES the block — it just cannot age it', () => {
    // The note is the point; the hour count is the detail. Losing the detail must never lose the note.
    const agents = [{
      sessionId: 's-b3', cwd: '/lanes/lane-31', pid: 18278, pidAlive: true, laneHeadOid: SHA,
      status: 'waiting', waitingFor: 'permission prompt',
    }];
    const plan = planReconcile({ prs: [pr1563()], agents, durableCounts: {}, now: NOW });
    expect(plan.refusals[0].kind).toBe('awaiting-permission');
    expect(plan.notes).toHaveLength(1);
    expect(plan.notes[0].heldHours).toBeNull();
    expect(plan.notes[0].text).toContain('nobody is there to answer it');
  });

  it('5(c) NO agent entry plus a FRESH transcript still DISPATCHES — no timestamp grants liveness', () => {
    // THE MUTATION TARGET. A pass that accepted a fresh mtime as liveness reddens exactly here and nowhere else.
    const plan = planReconcile({ prs: [pr1563({ transcriptMtimeMs: FRESH_MTIME })], agents: [], durableCounts: {}, now: NOW });
    expect(plan.refusals).toHaveLength(0);
    expect(plan.dispatch.map((d) => d.kind)).toEqual(['fix']);
    // The mtime rides along as EVIDENCE and is reported — it is just never authoritative.
    expect(plan.dispatch[0].transcriptMtimeMs).toBe(FRESH_MTIME);
  });

  it('5(d) a bound entry with NO `pid` refuses as UNKNOWN, not as idle — with the bind evidence attached', () => {
    // `pid` is on 13 of 17 entries. Absence of a field is not evidence of death, and the binding itself is a
    // proxy that has been observed to be WRONG (it bound the preparing session to #1571 at 17:34Z), so the
    // refusal carries the `cwd` and sha it turned on and a reader can audit the bind rather than inherit it.
    const agents = [{ sessionId: 's-d', cwd: '/lanes/lane-39', laneHeadOid: SHA, kind: 'conveyor', name: 'ci-heal' }];
    const plan = planReconcile({ prs: [pr1563({ transcriptMtimeMs: STALE_MTIME })], agents, durableCounts: {}, now: NOW });
    expect(plan.dispatch).toHaveLength(0);
    expect(plan.refusals[0]).toMatchObject({
      kind: 'liveness-unknown', prNumber: 1563, pid: null, cwd: '/lanes/lane-39', sha: SHA,
    });
  });

  it('a PROVABLY dead pid is not a blocker — `pidAlive:false` is the only thing that clears the way', () => {
    const agents = [{ sessionId: 's-e', cwd: '/lanes/lane-40', pid: 4242, pidAlive: false, laneHeadOid: SHA }];
    const plan = planReconcile({ prs: [pr1563({ transcriptMtimeMs: STALE_MTIME })], agents, durableCounts: {}, now: NOW });
    expect(plan.dispatch.map((d) => d.kind)).toEqual(['fix']);
  });

  it('the binding needs BOTH shas — two unknowns are not a match', () => {
    expect(bindAgents({ headRefOid: '' }, [{ cwd: '/x', laneHeadOid: '' }])).toEqual([]);
    expect(bindAgents({ headRefOid: SHA }, [{ cwd: '/x' }])).toEqual([]);
    expect(bindAgents({ headRefOid: SHA }, [{ cwd: '/x', laneHeadOid: SHA }])).toHaveLength(1);
  });

  it('the fifth state is recognised by status+waitingFor, and nothing else is mistaken for it', () => {
    expect(isAwaitingPermission({ status: 'waiting', waitingFor: 'permission prompt' })).toBe(true);
    expect(isAwaitingPermission({ status: 'waiting', waitingFor: 'a subagent' })).toBe(false);
    expect(isAwaitingPermission({ status: 'running' })).toBe(false);
    expect(isAwaitingPermission({})).toBe(false);
  });

  it('worst-first across MANY bound sessions — lane-35 held two at 17:34Z (#3283 observed live)', () => {
    const agents = [
      { sessionId: 's-live', cwd: '/lanes/lane-35', pid: 100, pidAlive: true, laneHeadOid: SHA },
      { sessionId: 's-blocked', cwd: '/lanes/lane-35', pid: 101, pidAlive: true, laneHeadOid: SHA, status: 'waiting', waitingFor: 'permission prompt', startedAt: BLOCKED_SINCE },
    ];
    expect(assessLiveness(bindAgents(pr1563(), agents)).kind).toBe('awaiting-permission');
  });
});

// ── CASE 6 — THE ARGV, PINNED ─────────────────────────────────────────────────────────────────────────────────
//
// The one thing fixtures cannot prove. A wrong discovery query does not throw — it returns nothing, and nothing
// is exactly what a perfectly reconciled fleet looks like. Every case above would stay green.
describe('case 6 — the discovery queries, pinned literally (#3296)', () => {
  it('the session listing is `claude agents --json`, byte-for-byte what dispatch-lane-io already builds', () => {
    const { exec, calls } = spyExec('[]');
    defaultReadAgents({ exec, env: {} });
    expect(calls[0].file).toBe('claude');
    expect(calls[0].argv).toEqual(['agents', '--json']);
  });

  it('the PR query asks `--state open`; NOT `--state all` — the opposite reader\'s flag hides nothing here, this one hides everything', () => {
    // `dispatch-lane-defaults.test.mjs` pins `--state all` for an observer that resolves on MERGED PRs. This
    // pass reconciles OPEN ones. Copying that flag across would drown four open PRs in 29 merged ones and, worse,
    // would look like it was working.
    const { exec, calls } = spyExec('[]');
    defaultReadPrs({ exec });
    expect(calls[0].file).toBe('gh');
    const stateAt = calls[0].argv.indexOf('--state');
    expect(stateAt).toBeGreaterThan(-1);
    expect(calls[0].argv[stateAt + 1]).toBe('open');
    expect(calls[0].argv[stateAt + 1]).not.toBe('all');
  });

  it('`headRefOid` is in `--json` — without it NOTHING binds and every PR reads as unowned', () => {
    const { exec, calls } = spyExec('[]');
    defaultReadPrs({ exec });
    const jsonAt = calls[0].argv.indexOf('--json');
    expect(jsonAt).toBeGreaterThan(-1);
    const fields = String(calls[0].argv[jsonAt + 1]).split(',');
    expect(fields).toEqual(expect.arrayContaining([
      'number', 'headRefName', 'headRefOid', 'labels', 'statusCheckRollup', 'mergeStateStatus', 'comments',
    ]));
    expect(PR_LIST_JSON_FIELDS.split(',')).toEqual(fields);
  });

  it('the whole argv, in one assertion — a rename or a dropped flag reddens exactly here', () => {
    const { exec, calls } = spyExec('[]');
    defaultReadPrs({ exec });
    expect(calls[0].argv).toEqual([
      'pr', 'list', '--state', 'open', '--limit', String(PR_LIST_LIMIT), '--json', PR_LIST_JSON_FIELDS,
    ]);
  });

  it('an empty listing is an empty array, not a throw — and yields an empty plan, not a silent one', () => {
    expect(defaultReadPrs({ exec: () => '' })).toEqual([]);
    expect(planReconcile({ prs: [], agents: [], durableCounts: {}, now: NOW }))
      .toEqual({ dispatch: [], refusals: [], notes: [] });
  });
});
