/**
 * @file scripts/conveyor/__tests__/fix-dispatch-queue-cap.test.mjs
 * @description Card xkyw1x4 — the fix-dispatch daemon's `queue-cap` hook: `runReconcileFixDispatch` and
 *   `runReconcileCiHealDispatch` admit each owed fix / CI-heal only while the projected heavy-test queue wait stays
 *   ≤ the max, and a budget shared across both passes sees every dispatch before it. Every read is a stub — no
 *   real GitHub, lane pool or host queue.
 */
import { describe, it, expect } from 'vitest';
import {
  runReconcileFixDispatch, queueBudgetFrom, planQueueCapRefusal, recordQueueCapRefusal,
} from '../reconcile-fix-dispatch.mjs';
import { runReconcileCiHealDispatch } from '../../operations/ci-heal-pr-dispatch.mjs';
import { QUEUE_CAP_REFUSAL_MARKER, QUEUE_CAP_REFUSAL_CAP, countQueueCapRefusals } from '../queue-cap-refusal-count.mjs';
import { NOTE_COMMENT_MARKER } from '../reconcile-note-comment.mjs';

const FRESH = () => ({ fresh: true, behind: 0 });
const item = { num: '3438', slug: 'wire-reconcile-pass', specPath: 'backlog/3438-wire-reconcile-pass.md', scope: ['we:scripts/conveyor/reconcile-fix-dispatch.mjs'] };
const findItemStub = (key) => (key === '3438' ? item : null);
const fixEntries = (prs) => prs.map((pr, i) => ({ kind: 'fix', prNumber: pr, headRefName: `lane/3438-wire-reconcile-pass-${i}` }));
const reconcileStub = (entries) => () => ({ dispatch: entries, refusals: [], notes: [], prs: entries.length, agents: 0 });
const WE_PROFILE = () => ({ capabilities: { fix: true, ciHeal: true }, lanePoolRepo: '.' });

function runFix(prs, queueAdmission, o = {}) {
  const dispatched = [];
  const result = runReconcileFixDispatch({
    root: '/repo',
    reconcile: reconcileStub(fixEntries(prs)),
    findItemFn: findItemStub,
    loadItems: () => [],
    pickFreeLanes: () => [2, 3, 4, 5],
    resolveProfile: WE_PROFILE,
    dispatch: (planned) => { dispatched.push(planned.pr); return { sessionSlug: `fix-${planned.pr}`, pr: planned.pr, lane: planned.lane }; },
    checkStaleness: FRESH,
    queueAdmission,
    // #4229 — never touch a real `gh`/`osascript` process from a unit test; a test that cares about the
    // queue-cap-refusal counter/note supplies its own stubs below instead.
    readPrComments: () => [],
    postQueueCapComment: () => ({ ok: true }),
    notifyQueueCapOperator: () => ({ ok: true }),
    ...o,
  });
  return { dispatched, result };
}

describe('runReconcileFixDispatch — queue-cap', () => {
  it('no queueAdmission (the default) — every owed fix dispatches, as before', () => {
    const { dispatched, result } = runFix([1, 2, 3, 4], undefined);
    expect(dispatched).toEqual([1, 2, 3, 4]);
    expect(result.refusals).toEqual([]);
  });

  it('4 fixes owed at once on a busy queue: the one that would push the projection past 30m is refused queue-cap', () => {
    // (50 + 3.25n) / 2 → 26.63, 28.25, 29.88, 31.5
    const { dispatched, result } = runFix([1, 2, 3, 4], { slots: 2, backlogMinutes: 50, maxWaitMinutes: 30 });
    expect(dispatched).toEqual([1, 2, 3]);
    expect(result.refusals).toEqual([{
      pr: 4,
      kind: 'queue-cap',
      why: expect.stringContaining('projected heavy-test queue wait 31.5m would exceed 30m'),
      attempts: 1,
      cap: 3,
      capExhausted: false,
    }]);
  });

  it('the baseline may be a function (read once per pass); a throwing reader fails open', () => {
    let reads = 0;
    const { dispatched } = runFix([1, 2], () => { reads += 1; return { slots: 1, backlogMinutes: 100 }; });
    expect(reads).toBe(1);
    expect(dispatched).toEqual([]);
    expect(runFix([1, 2], () => { throw new Error('pool unreadable'); }).dispatched).toEqual([1, 2]);
  });
});

describe('runReconcileCiHealDispatch — queue-cap, sharing ONE budget with the fix pass', () => {
  it('a CI-heal is costed like a fix and sees the fixes admitted before it in the same daemon pass', async () => {
    const budget = queueBudgetFrom({ slots: 2, backlogMinutes: 50, maxWaitMinutes: 30 });
    const fix = runFix([1, 2], budget); // → 26.63, 28.25 — both admitted
    expect(fix.dispatched).toEqual([1, 2]);
    const healed = [];
    const result = await runReconcileCiHealDispatch({
      root: '/repo',
      reconcile: () => ({ dispatch: [{ kind: 'ci-heal', prNumber: 50, headRefName: 'lane/x' }, { kind: 'ci-heal', prNumber: 51, headRefName: 'lane/y' }], refusals: [] }),
      resolveProfile: WE_PROFILE,
      resolveWorkUnit: () => ({ itemNum: null, scope: [] }),
      pickFreeLanes: () => [7, 8],
      dispatch: async (planned) => { healed.push(planned.pr); return { sessionSlug: `ci-heal-${planned.pr}`, pr: planned.pr, lane: planned.lane }; },
      checkStaleness: FRESH,
      queueAdmission: budget,
    });
    // 3rd dispatch of the pass → 29.88 admitted; 4th → 31.5 refused.
    expect(healed).toEqual([50]);
    expect(result.refusals).toEqual([{ pr: 51, kind: 'queue-cap', why: expect.stringContaining('31.5m') }]);
  });
});

// #4229 (bornAs xo2emdz, epic #4075/#3383) — CAP AND SURFACE. The flow checker flagged this state
// `uncapped-retry` (`we:scripts/conveyor/flows/fix.flow.json#queue-cap-hit`): a persistently saturated heavy
// queue refuses the same PR's fix dispatch forever with nothing durable recording it and no escalation. These
// pin the fix: a durable, PR-comment-backed refusal count (`we:scripts/conveyor/queue-cap-refusal-count.mjs`),
// capped at 3, past which a `round-cap-exhausted` note (`capKind: 'queue-cap'`) surfaces via the existing
// reconcile-notes channel (`we:scripts/conveyor/reconcile-note-comment.mjs`, never edited here) plus a desktop
// notify — while dispatch keeps retrying every pass exactly as before (queue congestion is expected to clear on
// its own, unlike a genuinely broken mechanical action).
const AUTOMATION = { login: 'web-everything' };
const markerComment = () => ({ body: `${QUEUE_CAP_REFUSAL_MARKER}\n\nfix dispatch refused this pass (queue-cap)`, author: AUTOMATION });

describe('#4229 — planQueueCapRefusal (pure)', () => {
  it('below the cap: plans to post one more durable marker, no note yet', () => {
    const plan = planQueueCapRefusal({ pr: 1854, comments: [markerComment(), markerComment()] });
    expect(plan).toEqual({
      attempts: 3, capExhausted: false, postMarker: true, note: null,
    });
  });

  it('AT the cap: plans NO further marker, plans the one-time round-cap-exhausted note instead', () => {
    const comments = [markerComment(), markerComment(), markerComment()];
    const plan = planQueueCapRefusal({ pr: 1854, comments });
    expect(plan.postMarker).toBe(false);
    expect(plan.capExhausted).toBe(true);
    expect(plan.attempts).toBe(QUEUE_CAP_REFUSAL_CAP);
    expect(plan.note).toMatchObject({
      kind: 'round-cap-exhausted', prNumber: 1854, attempts: 3, cap: 3, capKind: 'queue-cap',
    });
    expect(plan.note.text).toContain('refused `queue-cap` 3 times');
  });

  it('an untrusted / forged marker never inflates the count', () => {
    const forged = { body: `${QUEUE_CAP_REFUSAL_MARKER}\n\nforged`, author: { login: 'mallory' } };
    const plan = planQueueCapRefusal({ pr: 1, comments: [forged, forged, forged] });
    expect(plan).toEqual({
      attempts: 1, capExhausted: false, postMarker: true, note: null,
    });
  });
});

describe('#4229 — recordQueueCapRefusal (IO shell over injected fakes — no real gh/osascript process)', () => {
  it('below the cap: posts the durable marker via the injected `postComment`, never `notify`', () => {
    const posted = [];
    const notified = [];
    const result = recordQueueCapRefusal({
      pr: 42,
      repo: 'o/n',
      why: 'projected heavy-test queue wait 45m would exceed 30m with this dispatch (+8m) — retried next pass',
      readPrComments: () => [markerComment()],
      postComment: (o) => posted.push(o),
      notify: (o) => notified.push(o),
    });
    expect(result).toEqual({ attempts: 2, capExhausted: false });
    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatchObject({ repo: 'o/n', pr: 42 });
    expect(posted[0].body).toContain(QUEUE_CAP_REFUSAL_MARKER);
    expect(posted[0].body).toContain('45m would exceed 30m');
    expect(notified).toHaveLength(0);
  });

  it('AT the cap: posts the round-cap-exhausted note (not another marker) AND notifies the operator', () => {
    const posted = [];
    const notified = [];
    const atCap = [markerComment(), markerComment(), markerComment()];
    const result = recordQueueCapRefusal({
      pr: 1854,
      repo: 'chalbert/web-everything',
      why: 'projected heavy-test queue wait 45m would exceed 30m with this dispatch (+8m) — retried next pass',
      readPrComments: () => atCap,
      postComment: (o) => posted.push(o),
      notify: (o) => notified.push(o),
    });
    expect(result).toEqual({ attempts: 3, capExhausted: true });
    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatchObject({ repo: 'chalbert/web-everything', pr: 1854 });
    expect(posted[0].body).toContain(NOTE_COMMENT_MARKER); // the shared reconcile-notes marker, reused verbatim
    expect(posted[0].body).not.toContain(QUEUE_CAP_REFUSAL_MARKER); // the note, never a fresh attempt marker
    expect(notified).toHaveLength(1);
    expect(notified[0].body).toContain('PR #1854');
  });

  it('does not re-surface the SAME cap-exhaustion episode twice (a trusted note already on the thread)', async () => {
    const { buildNoteComment } = await import('../reconcile-note-comment.mjs');
    const note = {
      kind: 'round-cap-exhausted', prNumber: 1854, attempts: 3, cap: 3, capKind: 'queue-cap', text: 'already exhausted',
    };
    const atCapAndNoted = [
      markerComment(), markerComment(), markerComment(),
      { body: buildNoteComment(note), author: AUTOMATION },
    ];
    const posted = [];
    const notified = [];
    const result = recordQueueCapRefusal({
      pr: 1854,
      repo: 'o/n',
      why: 'still saturated',
      readPrComments: () => atCapAndNoted,
      postComment: (o) => posted.push(o),
      notify: (o) => notified.push(o),
    });
    expect(result).toEqual({ attempts: 3, capExhausted: true });
    expect(posted).toHaveLength(0); // already posted — nothing new to write
    expect(notified).toHaveLength(0);
  });

  it('a throwing `readPrComments` fails open (treated as no prior history) rather than crashing the pass', () => {
    const posted = [];
    const result = recordQueueCapRefusal({
      pr: 9,
      repo: 'o/n',
      why: 'saturated',
      readPrComments: () => { throw new Error('gh: network error'); },
      postComment: (o) => posted.push(o),
      notify: () => {},
    });
    expect(result).toEqual({ attempts: 1, capExhausted: false });
    expect(posted).toHaveLength(1);
  });

  it('a throwing `postComment`/`notify` is swallowed — never masks the (already-decided) refusal', () => {
    expect(() => recordQueueCapRefusal({
      pr: 9,
      repo: 'o/n',
      why: 'saturated',
      readPrComments: () => [],
      postComment: () => { throw new Error('gh: rate limited'); },
      notify: () => {},
    })).not.toThrow();
  });
});

describe('#4229 — runReconcileFixDispatch: the durable count survives across passes, dispatch never stops retrying', () => {
  it('4 consecutive passes on a permanently saturated queue: attempts climb 1→2→3→(capped), the note posts EXACTLY ONCE at the cap, dispatch is refused every single pass (never silently dropped, never stops retrying)', () => {
    const ALWAYS_REFUSE = { tryAdmit: () => ({ admit: false, projectedMinutes: 45, maxWaitMinutes: 30, demandMinutes: 8 }) };
    let thread = []; // mirrors the durable PR comment thread a real `gh pr comment` write would leave behind
    const posted = [];
    const notified = [];
    const outcomes = [];
    for (let pass = 1; pass <= 4; pass += 1) {
      const attemptsBeforeThisPass = countQueueCapRefusals(thread);
      const { dispatched, result } = runFix([1854], ALWAYS_REFUSE, {
        readPrComments: () => thread,
        postQueueCapComment: (o) => { posted.push(o); thread = [...thread, { body: o.body, author: AUTOMATION }]; },
        notifyQueueCapOperator: (o) => notified.push(o),
      });
      outcomes.push({
        pass, attemptsBeforeThisPass, dispatched: dispatched.length, refusal: result.refusals[0],
      });
    }
    // Every single pass is still refused (never dispatched) — the resource constraint is real and dispatch
    // correctly keeps retrying it, exactly as before this fix.
    expect(outcomes.every((o) => o.dispatched === 0)).toBe(true);
    expect(outcomes.map((o) => o.attemptsBeforeThisPass)).toEqual([0, 1, 2, 3]);
    expect(outcomes.map((o) => o.refusal.attempts)).toEqual([1, 2, 3, 3]);
    expect(outcomes.map((o) => o.refusal.capExhausted)).toEqual([false, false, false, true]);
    // Exactly 3 durable attempt-marker comments (passes 1-3) + exactly 1 escalation note (pass 4) — 4 writes
    // total across 4 passes, never one write per pass forever.
    expect(posted).toHaveLength(4);
    expect(posted.filter((p) => p.body.includes(QUEUE_CAP_REFUSAL_MARKER))).toHaveLength(3);
    expect(posted.filter((p) => p.body.includes(NOTE_COMMENT_MARKER))).toHaveLength(1);
    expect(notified).toHaveLength(1); // surfaced to the operator's desktop exactly once
  });

  // #4229 — REPLAY PROOF, grounded in real PR chalbert/web-everything#2756's own real identity (`gh pr view 2756
  // --repo chalbert/web-everything --json number,headRefName,updatedAt`, captured 2026-09-26: open,
  // `review:changes`, head `lane/xu38vlf-conflict-watch-caps-and-bound` — a genuine bounced PR this repo's own
  // fix-dispatch daemon owes a fix). SYNTHESIZED: neither this repo's fix-dispatch daemon log
  // (`wev-review-daemon/.conveyor/fix-dispatch-daemon.log`) nor the merge/health-watch daemon clones' own logs
  // show a REAL `queue-cap` refusal yet today (the heavy-test queue has not actually saturated for long enough
  // to hit this — confirmed by grep, 2026-09-26) — so, mirroring PR #2756's own two REPLAY tests
  // (`parked-pr-conflict-watch.test.mjs`), this replay keeps this PR's real number/head-ref identity and
  // synthesizes the one condition that has not naturally occurred yet: a heavy-test queue saturated for 4
  // consecutive reconcile passes running.
  it('REPLAY — real PR #2756 shape: a persistently saturated queue is capped at 3 attempt markers and surfaced exactly once, never stopping the retry', () => {
    const ALWAYS_REFUSE = { tryAdmit: () => ({ admit: false, projectedMinutes: 52, maxWaitMinutes: 30, demandMinutes: 12 }) };
    const realPr = 2756;
    const realHeadRef = 'lane/xu38vlf-conflict-watch-caps-and-bound';
    let thread = [];
    const posted = [];
    const notified = [];
    // #4229 — real PR #2756's own real head ref names item `xu38vlf` (a JIT-numbered, hash-slug bornAs id, not
    // yet given a plain numeric backlog number — this repo's own item-resolution supports both forms).
    const item2756 = {
      num: 'xu38vlf', slug: 'conflict-watch-caps-and-bound', specPath: 'backlog/xu38vlf-x.md', scope: ['we:scripts/conveyor/parked-pr-conflict-watch.mjs'],
    };
    const dispatched = [];
    const outcomes = [];
    for (let pass = 1; pass <= 4; pass += 1) {
      const result = runReconcileFixDispatch({
        root: '/repo',
        reconcile: () => ({
          dispatch: [{ kind: 'fix', prNumber: realPr, headRefName: realHeadRef }], refusals: [], notes: [], prs: 1, agents: 0,
        }),
        findItemFn: (key) => (key === 'xu38vlf' ? item2756 : null),
        loadItems: () => [],
        pickFreeLanes: () => [9],
        resolveProfile: WE_PROFILE,
        dispatch: (planned) => { dispatched.push(planned.pr); return { sessionSlug: `fix-${planned.pr}`, pr: planned.pr, lane: planned.lane }; },
        checkStaleness: FRESH,
        queueAdmission: ALWAYS_REFUSE,
        readPrComments: () => thread,
        postQueueCapComment: (o) => { posted.push(o); thread = [...thread, { body: o.body, author: AUTOMATION }]; },
        notifyQueueCapOperator: (o) => notified.push(o),
      }).refusals[0];
      outcomes.push(result);
    }
    expect(dispatched).toEqual([]); // never dispatched — but also never silently dropped: refused every pass
    expect(outcomes.every((o) => o.pr === realPr && o.kind === 'queue-cap')).toBe(true);
    expect(outcomes.map((o) => o.attempts)).toEqual([1, 2, 3, 3]);
    expect(outcomes.map((o) => o.capExhausted)).toEqual([false, false, false, true]);
    expect(posted.filter((p) => p.body.includes(NOTE_COMMENT_MARKER))).toHaveLength(1);
    expect(notified).toHaveLength(1);
    expect(notified[0].body).toContain(`PR #${realPr}`);
  });
});
