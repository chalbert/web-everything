/**
 * reconcile-core.mjs — the PURE reconcile pass (#3296): compare DESIRED delivery state against ACTUAL, for
 * every open PR, and return what to dispatch plus every refusal and the fact each turned on.
 *
 * WHY THIS EXISTS. Nothing in the tree reconciles an open PR against a live process. `planTick`'s two spawns are
 * gated on `if (!launched.has(normNum(p.num))) continue; // only PRs THIS conveyor launched`
 * (`we:scripts/conveyor/tick-core.mjs:396` for fixes, `:495` for CI-heals), and `launchedNums` is
 * SESSION-EPHEMERAL bookkeeping piped in over STDIN — so the moment the supervising session exits, every PR it
 * launched becomes a PR no conveyor launched, owned by nothing. `planTick`'s `decisions`
 * (`we:scripts/conveyor/tick-core.mjs:855-866`) contain no review spawn at all, so a `review:pending` PR is
 * WATCHED and never WORKED. The residue is a person: a human dispatched every reviewer and every healer that ran
 * today.
 *
 * THE COMMON THREAD, and the reason this is one item rather than six fixes: every failure is **a proxy standing
 * in for a fact nobody checks**. A session's `launchedNums` stands in for ownership. A label stands in for a
 * process. A file mtime stands in for liveness. A resolved card stands in for an idle lane. This pass replaces
 * the proxies with the facts, and where it cannot get a fact it says so out loud instead of guessing.
 *
 * KEYED BY PR NUMBER, NEVER BY ITEM NUMBER. This is not a preference. Measured 2026-08-26 17:34Z, all four open
 * PRs' head refs (`lane/review-slice-scopes`, `lane/review-pr-override-reason`, `lane/review-corpus-replay`,
 * `lane/review-efficacy-watch`) return `null` from `laneRefItemNum`
 * (`we:scripts/conveyor/lease-reaper.mjs`), whose grammar is `^lane/(x[a-z0-9]{5,7}|\d+)[a-z]?-`. An item-keyed
 * pass would therefore have seen ZERO of the four PRs it exists to reconcile. `reconcile-core.test.mjs` pins that
 * difference as an assertion rather than leaving it as a design note.
 *
 * PHASE IS BORROWED, NOT RE-DERIVED. `classifyPr` (`we:scripts/progress-board.mjs`) gives the label phase and
 * `reduceCheckState` (`we:scripts/operations/pr-status.mjs`, #3247) gives CI truth. A second derivation is the
 * defect, not the feature — it is how the board and the reconciler come to disagree about what a PR is doing. If
 * this pass ever needs a fact those two do not expose, WIDEN THEM; do not grow a private copy here.
 *
 * ON `pr-status`'s OWN WORDING: its `CHECK_STATES` is a frozen list of FOUR — `green`, `red`, `pending`,
 * `unchecked` — while the docblock above it says "three-valued". Four is what it freezes and four is what this
 * file consumes, because the distinction that matters here is exactly the fourth: `unchecked` is NOT a flavour of
 * `pending`. Zero check runs on a head means nothing has been asked about that commit, which never satisfies a
 * gate. Do not inherit the "three-valued" phrasing.
 *
 * THE DISPATCH IS THE EASY HALF — THE FOUR REFUSALS ARE THE ITEM:
 *
 *   1. `stood-down` is TERMINAL. An agent that stopped to ask a question is never restarted; re-running it
 *      re-asks the question forever and burns tokens. Read from the durable marker
 *      `we:scripts/conveyor/stand-down.mjs` posts — no decay, no clock, so the verdict is identical a week later.
 *   2. NO FINDINGS, NO FIXER. A PR with nothing to fix must never receive a fix agent; it will invent work. The
 *      right answer for a `review:pending` PR with no findings is a REVIEW, not a fix.
 *   3. THE ROUND CAP SURVIVES A RESTART, OR IT IS NOT A CAP. The attempt count is derived from the PR and ONLY
 *      from the PR. No in-process tally is read here — not as a floor, not as an overlay, not at all. Measured:
 *      `countRearmComments` read `0` on all four open PRs, and read `0` on `#1563` through all TWELVE of its
 *      review rounds against a `NEGOTIATION_ROUND_CAP` of 5. A cap that resets on restart is not a cap.
 *   4. LIVENESS COMES FROM A LIVE PROCESS — AND THE LISTING IS THINNER THAN IT LOOKS. See below; this is the one
 *      that pins cause 6, and the one most likely to be "simplified" into a bug.
 *
 * REFUSAL 4 IN FULL, because every part of it was measured and every part of it is a trap.
 *
 *   • THE LISTING IS PARTIAL. Over the 17 live sessions `claude agents --json` returned at 17:34Z, the union of
 *     keys is exactly `cwd, id, kind, name, pid, sessionId, startedAt, state, status, waitingFor`. Only
 *     `cwd`/`kind`/`name`/`sessionId`/`startedAt` appear on all 17. `pid` appears on 13, `state` on 7, and
 *     `status` + `waitingFor` on 3. **A missing `pid` is not a dead process and a missing `state` is not a
 *     healthy one.** Absence is UNKNOWN, and unknown refuses — it never reads as idle.
 *   • THE LISTING CARRIES NO PR. There is no `pr`, `item`, `num`, `branch` or `ref` field on ANY entry, so the
 *     PR↔session binding must be DERIVED. The only derivation available today is `cwd` → that lane's `HEAD` →
 *     the PR's `headRefOid`, and that rule PRODUCED A FALSE POSITIVE while #3296 was being prepared: it bound the
 *     preparing session to PR `#1571`, because a second agent had reset the shared `lane-35` checkout to
 *     `#1571`'s head underneath it (`#3283`, observed live rather than argued). So the binding is ITSELF a proxy.
 *     Every liveness refusal therefore carries the `cwd` and the `sha` it turned on, so a false bind is visible
 *     to a reader instead of silently authoritative. Widening the listing to carry a PR field would fix this
 *     properly — it is a change to a tool this repo does not own, so it is named, not absorbed.
 *   • `waitingFor: 'permission prompt'` IS A FIFTH STATE, neither alive nor dead. Three sessions have held one
 *     for 211.4 hours. It refuses dispatch AND surfaces under its own kind, or the 211-hour case repeats
 *     silently.
 *   • A TIMESTAMP IS NOT A HEARTBEAT. `we:scripts/readiness/conveyor-state.mjs` treats a transcript's mtime as
 *     its last-activity clock, and it is right to within what a timestamp can mean — but a transcript stops
 *     being written when an agent FINISHES exactly as it does when an agent DIES. So `transcriptMtimeMs` is
 *     carried through this file as EVIDENCE ONLY and is never read by any decision: **freshness never grants
 *     liveness, and staleness never withdraws it.** A live `pid` refuses however stale its transcript is; a fresh
 *     transcript with no agent entry behind it still dispatches. That asymmetry is load-bearing and
 *     `reconcile-core.test.mjs` pins both halves — a change that reddens both has removed the wrong thing.
 *
 * EVERY PR PRODUCES A ROW. A pass that refuses four PRs and prints one line has reproduced the original defect
 * one level up, so nothing is dropped silently: each open PR yields either a dispatch or a refusal, and each
 * refusal names its kind, its PR, and the fact it turned on. {@link planReconcile} guarantees the row count
 * equals the PR count.
 *
 * WHAT THIS PASS DOES NOT DO: it does not RUN a review (the review loop and its converged / exhausted / stuck
 * vocabulary are #3072); it does not spawn the reviewer session (#3279 declares that operation — this decides
 * that a review is owed and calls it); it does not dispose a `review:pending` PR from a jury ledger
 * (`we:scripts/review-runner.mjs` owns that, and its shadow→enforce flip is #2572 part 2); it does not reap a
 * permission-blocked session (it SURFACES the 211-hour case; clearing it is a separate job); and it changes no
 * label's meaning and adds no label — the stand-down signal is a comment marker.
 *
 * PURE: no fs, no clock, no process, no network. Every impure fact (a `pid`'s liveness, a lane's `HEAD`, a
 * transcript's mtime) is INJECTED on the input records by `we:scripts/conveyor/reconcile-pass.mjs`, so every
 * branch below is reachable in a test with no network and no credential.
 */
import { classifyPr } from '../progress-board.mjs';
import { reduceCheckState } from '../operations/pr-status.mjs';
import { NEGOTIATION_ROUND_CAP } from '../lib/jury-core.mjs';
import { countRearmComments, REARM_COMMENT_MARKER } from './rearm-review.mjs';
import { countCiHealComments, CI_HEAL_COMMENT_MARKER } from './ci-heal-mark.mjs';
import { countStandDownComments, STAND_DOWN_MARKER } from './stand-down.mjs';

/**
 * we:scripts/conveyor/reconcile-core.mjs#DISPATCH_KINDS — the only two things this pass ever asks for. Frozen,
 * because the list being SHORT is the design: the pass decides that work is owed and who owes it, and it runs
 * nothing itself. `fix` re-dispatches the fix-agent brief at a bounced PR; `review` calls the independent-review
 * operation (#3279). A CI-heal is deliberately NOT here — `planTick` already plans those, and a second planner
 * for the same job is the drift this file's phase-borrowing rule exists to prevent.
 */
export const DISPATCH_KINDS = Object.freeze(['fix', 'review']);

/**
 * we:scripts/conveyor/reconcile-core.mjs#REFUSAL_KINDS — every reason this pass declines to dispatch. Frozen and
 * exhaustive: a refusal that is not on this list is a bug, because a refusal this file cannot NAME is a refusal a
 * reader cannot audit.
 *
 *   `stood-down`         — a fixer already stopped to ask here (terminal; a person clears it).
 *   `no-findings`        — nothing to fix; a fixer would invent work.
 *   `cap-exhausted`      — the PR's own durable attempt count is at or above the cap.
 *   `live-process`       — a bound session has a LIVE pid. Something is already working this PR.
 *   `awaiting-permission`— a bound session is blocked on a permission prompt: the fifth state, neither alive nor
 *                          dead. Refuses AND surfaces, because nobody is coming to answer it.
 *   `liveness-unknown`   — a session is bound but its `pid` is absent or unprobed. Absence of a field is never
 *                          evidence of death, so this refuses rather than dispatching over a possibly-live agent.
 *   `owed-elsewhere`     — real work is owed, by a job this pass does not run (a human clear, a CI heal, a
 *                          rebase). Named rather than dropped, so the PR is visible in the report.
 *   `nothing-owed`       — the PR is reviewed and queued, or already landed. Genuinely nothing to do.
 */
export const REFUSAL_KINDS = Object.freeze([
  'stood-down', 'no-findings', 'cap-exhausted',
  'live-process', 'awaiting-permission', 'liveness-unknown',
  'owed-elsewhere', 'nothing-owed',
]);

/**
 * we:scripts/conveyor/reconcile-core.mjs#BOOKKEEPING_MARKERS — the durable conveyor marker comments, which are
 * this loop's OWN bookkeeping and must never be mistaken for a reviewer's finding. A PR whose only comments are
 * three re-arm markers has had zero findings raised on it, and dispatching a fixer at it is exactly the
 * invent-work failure refusal 2 exists to prevent. Single-sourced from the three files that POST them so this
 * list cannot drift from what is actually on a PR.
 */
export const BOOKKEEPING_MARKERS = Object.freeze([
  REARM_COMMENT_MARKER, CI_HEAL_COMMENT_MARKER, STAND_DOWN_MARKER,
]);

/**
 * The label phases where this pass has something to dispatch, and what it dispatches. Everything else is a
 * refusal — `owed-elsewhere` when a phase means real work by someone else, `nothing-owed` when it does not.
 * `classifyPr` produces the keys; they are not re-derived here.
 */
const OWED = Object.freeze({ bounced: 'fix', 'needs-review': 'review' });
const OWED_ELSEWHERE = Object.freeze({
  'needs-human': 'a human must clear the review gate on this PR',
  'ci-red': 'a required check is failing — the conveyor tick plans CI-heals, this pass does not',
  conflicted: 'the branch needs a rebase before it can merge',
});

/** Narrow a raw `gh` label array (`[{name}]`, or bare strings) to the names it carries. Pure. */
const labelNames = (labels) => (Array.isArray(labels) ? labels : [])
  .map((l) => (typeof l === 'string' ? l : l?.name))
  .filter(Boolean);

/** The body of one comment, as `gh pr view --json comments` returns it (`[{ body }]`); bare strings tolerated. */
const commentBody = (c) => (typeof c === 'string' ? c : c?.body);

/**
 * we:scripts/conveyor/reconcile-core.mjs#countFindings — how many comments on this PR are a REVIEWER speaking,
 * rather than the conveyor talking to itself. A comment whose LEADING line is one of
 * {@link BOOKKEEPING_MARKERS} is this loop's own record and is not a finding. Pure.
 *
 * The leading-line narrowing matches `countRearmComments`'s, and for the same reason: a human who QUOTES a
 * marker comment in their reply is raising a finding, not posting a marker, and must not be discounted.
 * @param {Array<{body?:string}|string>|null|undefined} comments
 * @returns {number}
 */
export function countFindings(comments) {
  if (!Array.isArray(comments)) return 0;
  let n = 0;
  for (const c of comments) {
    const body = commentBody(c);
    if (typeof body !== 'string') continue;
    const head = body.trimStart();
    if (BOOKKEEPING_MARKERS.some((m) => head.startsWith(m))) continue;
    n += 1;
  }
  return n;
}

/**
 * we:scripts/conveyor/reconcile-core.mjs#bindAgents — derive which live sessions are working THIS PR, and return
 * them with the evidence the derivation turned on. Pure.
 *
 * THE BINDING IS A PROXY AND IT IS RETURNED AS ONE. `claude agents --json` carries no `pr`, `item`, `num`,
 * `branch` or `ref` field on any entry — measured over all 17 live sessions — so the only available rule is
 * `cwd` → that lane's `HEAD` → the PR's `headRefOid`. `laneHeadOid` is resolved by the IO shell (this file
 * cannot read a git ref) and compared here. The rule is known to produce false positives when two agents share a
 * checkout and one resets it under the other (#3283, observed live at 17:34Z), which is precisely why each
 * binding carries its `cwd` and `sha` out to the refusal: a reader must be able to audit the bind, not just
 * inherit its verdict.
 *
 * A blank/absent `headRefOid` or `laneHeadOid` binds NOTHING. Two unknowns are not a match, and treating them as
 * one would bind every session to every PR.
 * @param {{headRefOid?:string}} pr
 * @param {Array<object>} agents
 * @returns {Array<{agent:object, cwd:string, sha:string}>}
 */
export function bindAgents(pr, agents) {
  const sha = String(pr?.headRefOid ?? '');
  if (!sha) return [];
  return (Array.isArray(agents) ? agents : [])
    .filter((a) => a && String(a.laneHeadOid ?? '') && String(a.laneHeadOid) === sha)
    .map((a) => ({ agent: a, cwd: String(a.cwd ?? ''), sha }));
}

/**
 * we:scripts/conveyor/reconcile-core.mjs#isAwaitingPermission — the FIFTH state. `status: 'waiting'` with
 * `waitingFor` naming a permission prompt is neither alive nor dead: the process exists and will never advance,
 * because a background agent has nobody to ask. Three sessions have been in it for 211.4 hours. Pure.
 * @param {{status?:string, waitingFor?:string}} agent
 * @returns {boolean}
 */
export function isAwaitingPermission(agent) {
  return String(agent?.status ?? '').toLowerCase() === 'waiting'
    && /permission/i.test(String(agent?.waitingFor ?? ''));
}

/**
 * we:scripts/conveyor/reconcile-core.mjs#assessLiveness — the liveness verdict for ONE PR, over the sessions
 * bound to it. Pure, and it is refusal 4 in code.
 *
 * ORDER IS THE SAFETY PROPERTY, worst-first, and it is not the order that reads most naturally:
 *   1. `awaiting-permission` OUTRANKS a live pid. Those three sessions have live pids; reporting them as merely
 *      "busy" is how a 211-hour block stays invisible. The distinct kind is the whole point.
 *   2. `live-process` — a bound session with a probed-live pid. Something IS working this PR; do not pile on.
 *   3. `liveness-unknown` — bound, but the `pid` is absent (4 of 17 entries carry none) or was not probed.
 *      Absence of a field is never evidence of death, so this REFUSES. It does not read as idle.
 *   4. Only when every bound session is probed DEAD (`pidAlive === false`) does this return `null`, meaning
 *      "nothing live here, the caller may dispatch".
 *
 * `transcriptMtimeMs` is not consulted anywhere in this function, ON PURPOSE. A transcript stops being written
 * when an agent finishes exactly as when it dies, so freshness cannot grant liveness and staleness cannot
 * withdraw it. It rides along as evidence only.
 * @param {Array<{agent:object, cwd:string, sha:string}>} bound
 * @returns {{kind:string, pid:number|null, cwd:string, sha:string, sessionId:string|null, why:string}|null}
 */
export function assessLiveness(bound) {
  const list = Array.isArray(bound) ? bound : [];
  const ev = (b, kind, why) => ({
    kind,
    pid: Number.isInteger(b.agent?.pid) ? b.agent.pid : null,
    cwd: b.cwd,
    sha: b.sha,
    sessionId: b.agent?.sessionId ?? null,
    why,
  });

  for (const b of list) {
    if (isAwaitingPermission(b.agent)) {
      return {
        ...ev(b, 'awaiting-permission', `session is blocked on "${String(b.agent.waitingFor)}" — a background agent has nobody to ask, so it will never advance on its own`),
        startedAt: b.agent?.startedAt ?? null,
        waitingFor: String(b.agent.waitingFor),
      };
    }
  }
  for (const b of list) {
    if (b.agent?.pidAlive === true) {
      return ev(b, 'live-process', 'a bound session has a LIVE pid — something is already working this PR, however stale its transcript looks');
    }
  }
  for (const b of list) {
    if (b.agent?.pidAlive !== false) {
      return ev(b, 'liveness-unknown', 'a session is bound to this PR but its liveness could not be established (no `pid` on the listing, or the probe did not run) — absence of a field is not evidence of death');
    }
  }
  return null;
}

/**
 * we:scripts/conveyor/reconcile-core.mjs#planReconcile — THE PASS. Given every open PR, every live session, and
 * the durable per-PR attempt counts, return what to dispatch and every refusal with the fact it turned on. Pure,
 * total, and keyed by PR number throughout.
 *
 * EVERY PR YIELDS EXACTLY ONE ROW — a dispatch or a refusal, never neither. Silence is the defect this pass
 * exists to remove, so it is not allowed to reappear in this pass's own output.
 *
 * THE ORDER OF THE CHECKS, and why each sits where it does:
 *   1. `stood-down` FIRST, because it is terminal. Nothing that follows can revive a PR a fixer walked away
 *      from, so nothing that follows should even be computed.
 *   2. LIVENESS SECOND. If something is already working this PR, no further question is worth asking — and
 *      asking anyway is how two agents end up in one lane.
 *   3. PHASE, borrowed from `classifyPr`. What is owed, and by whom.
 *   4. FINDINGS, before the cap: a PR with nothing to fix gets a review or nothing, never a fixer, whatever its
 *      attempt count says.
 *   5. THE CAP, from the PR and only from the PR.
 *
 * @param {object} o
 * @param {Array<object>} [o.prs] - open PRs as `gh pr list --json number,headRefName,headRefOid,labels,
 *   statusCheckRollup,mergeStateStatus,comments` returns them, each optionally carrying `transcriptMtimeMs`
 *   (EVIDENCE ONLY — no decision reads it).
 * @param {Array<object>} [o.agents] - `claude agents --json` entries, each optionally carrying the two facts the
 *   listing cannot supply and the IO shell resolves: `laneHeadOid` (the `HEAD` of the lane at `cwd`) and
 *   `pidAlive` (`process.kill(pid, 0)` → `true`/`false`; absent = not probed = UNKNOWN).
 * @param {object} [o.durableCounts] - `{ [prNumber]: n }`, the PR-derived attempt count the shell reads back
 *   with `countRearmComments`. There is NO in-process tally parameter and none is consulted: a cap that a
 *   restart can reset is not a cap.
 * @param {number} [o.now] - epoch ms, used ONLY to age the surfaced permission-block notes. No decision reads it,
 *   so the plan for a given input is stable over time — a `stood-down` PR returns an identical result a week on.
 * @param {number} [o.roundCap] - the attempt cap; defaults to `NEGOTIATION_ROUND_CAP` (5), single-sourced from
 *   `we:scripts/lib/jury-core.mjs` rather than re-declared here.
 * @returns {{dispatch:Array<object>, refusals:Array<object>, notes:Array<object>}}
 */
export function planReconcile({ prs = [], agents = [], durableCounts = {}, now = 0, roundCap = NEGOTIATION_ROUND_CAP } = {}) {
  const dispatch = [];
  const refusals = [];
  const notes = [];
  const counts = durableCounts && typeof durableCounts === 'object' ? durableCounts : {};

  for (const pr of Array.isArray(prs) ? prs : []) {
    const prNumber = Number(pr?.number);
    if (!Number.isInteger(prNumber) || prNumber <= 0) continue; // not a PR record; nothing to key on.

    // The evidence every row carries, so a reader never has to go back to the listing to audit a verdict.
    const base = {
      prNumber,
      headRefName: pr?.headRefName ?? null,
      headRefOid: pr?.headRefOid ?? null,
      // EVIDENCE ONLY. No decision in this file reads it — see the liveness block in the file docblock.
      transcriptMtimeMs: Number.isFinite(pr?.transcriptMtimeMs) ? pr.transcriptMtimeMs : null,
    };
    const refuse = (kind, extra) => { refusals.push({ ...base, kind, ...extra }); };

    // ── REFUSAL 1 — `stood-down` is TERMINAL. No decay, no clock: `now` is not read on this path, so the same
    // PR returns the same refusal a week later. A person clearing the marker is the intended exit.
    const stoodDown = countStandDownComments(pr?.comments);
    if (stoodDown > 0) {
      refuse('stood-down', {
        standDowns: stoodDown,
        why: 'a fix agent already stopped here to ask a question — re-dispatching would re-ask it forever. Terminal for this pass; a human clears the marker.',
      });
      continue;
    }

    // ── REFUSAL 4 — liveness, from a live process. The binding is derived and its evidence travels with the
    // refusal, because the derivation itself has been observed to be wrong (#3283).
    const live = assessLiveness(bindAgents(pr, agents));
    if (live) {
      refuse(live.kind, {
        pid: live.pid, cwd: live.cwd, sha: live.sha, sessionId: live.sessionId, why: live.why,
        ...(live.waitingFor ? { waitingFor: live.waitingFor, startedAt: live.startedAt } : {}),
      });
      // The permission block is the case that must never be merely refused. Three sessions have held one for
      // 211.4 hours; a refusal buried in a list is how that stayed invisible. It gets its own surfaced note.
      if (live.kind === 'awaiting-permission') {
        const startedMs = live.startedAt ? Date.parse(live.startedAt) : NaN;
        const heldHours = Number.isFinite(startedMs) && now ? Math.round(((now - startedMs) / 3_600_000) * 10) / 10 : null;
        notes.push({
          kind: 'awaiting-permission', prNumber, pid: live.pid, cwd: live.cwd, sessionId: live.sessionId,
          waitingFor: live.waitingFor, startedAt: live.startedAt, heldHours,
          text: `PR #${prNumber}: a session in ${live.cwd} is blocked on "${live.waitingFor}"`
            + `${heldHours == null ? '' : ` for ${heldHours}h`} and nobody is there to answer it — nothing here will advance until a person clears it`,
        });
      }
      continue;
    }

    // ── PHASE, BORROWED. `classifyPr` for the labels, `reduceCheckState` for CI truth. Not re-derived.
    const phase = classifyPr({
      state: pr?.state, labels: pr?.labels, mergeStateStatus: pr?.mergeStateStatus,
      statusCheckRollup: pr?.statusCheckRollup,
    });
    const check = reduceCheckState(pr?.statusCheckRollup);
    const withPhase = { phase, check: check.state, labels: labelNames(pr?.labels) };

    if (!OWED[phase]) {
      if (OWED_ELSEWHERE[phase]) refuse('owed-elsewhere', { ...withPhase, why: OWED_ELSEWHERE[phase] });
      else refuse('nothing-owed', { ...withPhase, why: `phase \`${phase}\` — reviewed and queued, or already landed; this pass has nothing to dispatch` });
      continue;
    }

    // ── REFUSAL 2 — no findings, no fixer. A fix agent handed a PR with nothing to fix invents work. When a
    // review is what the phase asks for, the review still goes out: "nothing to FIX" is not "nothing to do".
    const findings = countFindings(pr?.comments);
    if (findings === 0) {
      refuse('no-findings', {
        ...withPhase, findings: 0, comments: Array.isArray(pr?.comments) ? pr.comments.length : 0,
        why: 'no reviewer finding on this PR — a fix agent would invent work. A review, not a fix, is what an unreviewed PR is owed.',
      });
      if (OWED[phase] === 'review') {
        dispatch.push({ ...base, ...withPhase, kind: 'review', findings: 0, attempts: 0, why: 'parked for an independent review and no finding has been raised yet — a review is owed (#3279 runs it)' });
      }
      continue;
    }

    // ── REFUSAL 3 — the cap, from the PR and ONLY from the PR. `durableCounts` is what the shell read back off
    // the PR's comment thread; `countRearmComments` re-reads the same thread here so a shell that forgot to
    // supply the map cannot silently reset a burned PR to zero. NO in-process tally is consulted, by design:
    // this pass is one-shot, it carries nothing in, and a cap a restart can reset is not a cap.
    const attempts = Math.max(Number(counts[prNumber]) || 0, countRearmComments(pr?.comments));
    if (attempts >= roundCap) {
      refuse('cap-exhausted', {
        ...withPhase, attempts, cap: roundCap,
        why: `the PR's own durable attempt count is ${attempts} against a cap of ${roundCap} — auto-repair is exhausted here and a person must take it`,
      });
      continue;
    }

    dispatch.push({
      ...base, ...withPhase, kind: OWED[phase], findings, attempts,
      why: OWED[phase] === 'fix'
        ? `bounced with ${findings} finding(s), nothing live is working it, and ${attempts} of ${roundCap} attempts are spent`
        : `parked for an independent review with ${findings} finding(s) on the thread and nothing live working it`,
    });
  }

  return { dispatch, refusals, notes };
}
