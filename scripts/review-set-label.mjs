/**
 * review-set-label.mjs — swap a PR's review label, INVARIANT-2 guarded (#2470, increment 2 of 2). Also the
 * SINGLE HOME of the shared review-label CLI harness (#2644): a PURE `decideSetLabel` decides the swap for a
 * reviewer verdict (`accepted` / `changes`) OR the fix-agent re-arm (`rearm`), and a thin `runReviewLabelCli`
 * does the `gh` observe→edit→comment→re-read arc. The conveyor's `rearm-review.mjs` is now a THIN shim over
 * both (it used to clone this file byte-for-byte). Single-sourced in WE (Native-First / zero standard-impl here
 * — this is a definition + write tool, not product code) so the plateau console and the conveyor fix agent both
 * shell/import it rather than re-implementing how a label swap lands.
 *
 * #2844 — INVARIANT 2 says a `review:human` PR may not be machine-cleared; it says NOTHING about who clears a
 * `review:pending` one, and before #2844 nothing else did either. This CLI now REFUSES an acceptance whose
 * clearing actor is provably the PR's own author (`we:scripts/lib/review-independence.mjs`), stamps the clearing
 * actor's id into the durable comment, and — when independence could not be established — says so in that
 * comment rather than leaving a silence a reader would misread as independence.
 *
 * INVARIANT 2 (the whole point): a `review:human` PR is NEVER cleared to `review:accepted` by anything but a
 * human's /review ceremony. `decideSetLabel` REFUSES `to==='accepted'` when the PR carries `review:human`
 * (`gate-self` is human-ceremony-only). The refusal lives in the PURE core so it is unbypassable — the CLI
 * cannot route around it. Do NOT weaken it. The `rearm` target carries the sibling #2630 invariant: an auto-fix
 * re-arms `review:changes → review:pending` but NEVER emits `review:accepted` and NEVER removes `review:human`.
 *
 * #2895 — INVARIANT 2 says who may NOT clear a gate-self PR; the `clear-human` target says how the one who MAY
 * actually does it. Before this, #2882 closed the raw label edit without opening a replacement, so the single
 * act the `review:human` tier exists to enable had no sanctioned way to perform it and the operator was pushed
 * to an unrecorded `gh` call — losing the `reviewed-sha` stamp and the attributed comment. `clear-human` is the
 * ONLY target that removes `review:human`, and `accepted` stays unconditionally refused on a `review:human` PR
 * — see `decideSetLabel` for why this is a target rather than a flag.
 *
 * WHAT THIS TARGET DOES NOT DO, stated up front so nobody re-derives it: it does NOT verify that a human ran
 * it. #2895 RULED that the unforgeable actor signal is DEFERRED — no local construct survives an agent with
 * shell access on the same machine (a flag is trivially passed; a local console's token is scrapeable; a tty
 * check is satisfied by `script`/`expect`). So this ships as the raw command with better manners, and the
 * manners are the point: the `reviewed-sha` stamp, an attributed comment, a stated reason, one documented path
 * instead of an ad-hoc paste. The mitigation that replaces the missing signal is the HONESTY TAX — `--actor`
 * and `--reason` are both REQUIRED, so misuse takes a lie rather than a silence, and every surface that reports
 * a clearance says what the record proves (the sanctioned path was followed) and not what it does not (that a
 * human followed it). The durable fix is #2946 (a hardware human-presence gesture), filed `someday`.
 *
 * Split mirrors `we:scripts/review-detail.mjs`: a PURE decider that takes the already-observed labels and
 * returns the swap, plus a thin impure CLI that does the `gh` calls and prints. REUSES
 * `we:scripts/lib/review-escalation.mjs` (`REVIEW_LABELS`, `hasReviewLabel`) — it never re-hardcodes the
 * label strings.
 */
import { execFileSync } from 'node:child_process';
import { resolve, sep } from 'node:path';
import { writeFileSync, unlinkSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REVIEW_LABELS, hasReviewLabel, buildReviewedShaMarker, buildReviewedDiffMarker } from './lib/review-escalation.mjs';
// #2844 — WHO cleared this verdict, and the refusal when that is the PR's own author. See that module's header
// for what the id rests on (the harness session identity, NOT the free-text `--actor`) and for the residual.
import {
  currentActorId, parseAuthorActorId, buildClearerActorMarker, decideClearerIndependence, INDEPENDENCE,
} from './lib/review-independence.mjs';
// #2979 — the NET diff vs current main, NOT `gh pr diff`'s three-dot output (see the fingerprint block in
// `runReviewLabelCli` for why that distinction is the whole point). Imported from the CLI that owns it, the same
// way `we:scripts/fetch-parked.mjs` already does — it is the single home of the #2450 net-diff basis.
import { computeNetDiffText } from './merge-ai-prs.mjs';

/**
 * we:scripts/review-set-label.mjs#REVIEW_LABEL_TARGETS — the CLOSED set of label-swap targets `decideSetLabel`
 * understands. Exported so anything that must be TOTAL over the targets (the comment-size projection below, and
 * its enum-totality test) enumerates this one list instead of hardcoding a member — PR #1056 review, M2: the
 * `GH_COMMENT_MAX` pre-flight hardcoded `to: 'accepted'` and therefore under-counted a `clear-human` comment by
 * the 132 chars of extra chrome, so a body in the 65,405–65,536 band passed the check, the label swap landed,
 * and `gh pr comment` then failed — leaving an ACCEPTED PR with no `reviewed-sha` marker, which
 * `acceptanceCoversHead` fails OPEN on. Add a member here and the projection covers it automatically.
 */
export const REVIEW_LABEL_TARGETS = Object.freeze(['accepted', 'changes', 'rearm', 'clear-human']);

/**
 * we:scripts/review-set-label.mjs#decideSetLabel — the PURE verdict-label decision. Given the target `to` and
 * the PR's OBSERVED labels, return the label swap. FOUR targets (the closed set is `REVIEW_LABEL_TARGETS`), each
 * with its invariant enforced HERE (unbypassable): the reviewer verdicts `accepted` / `changes`, the conveyor
 * fix-agent `rearm` (#2644, was `decideRearm`), and the #2895 gate-self `clear-human`. Every return carries
 * `keepsHuman` — whether the swap leaves `review:human` in place.
 *   • `accepted` — INVARIANT 2: REFUSED on a `review:human` PR (only a human's /review may clear the gate);
 *     otherwise adds `review:accepted`, drops the parked `review:pending` AND a stale `review:changes` (#2974 —
 *     a bounce that was fixed and re-verdicted straight to `accepted` must not still read as awaiting changes).
 *   • `changes` — always allowed (a bounce lands nothing); adds `review:changes`, drops `review:pending` AND a
 *     stale `review:accepted`, but NEVER `review:human`.
 *   • `rearm` — the #2630 invariant: ONLY a live `review:changes` is re-armable (idempotent — a second call
 *     refuses cleanly); the swap is ALWAYS `review:changes → review:pending`, NEVER `review:accepted`, and
 *     NEVER removes `review:human`. The strongest thing an auto-fix can do is re-arm the review, never clear it.
 *   • `clear-human` — the #2895 gate-self clearance: the ONLY target that removes `review:human` (and the only
 *     one refused when the PR does NOT carry it). Nothing here checks WHO is asking — see below.
 * @param {{to:('accepted'|'changes'|'rearm'|'clear-human'), currentLabels?:Array}} o - `currentLabels` is the
 *   observed label array (string or `{name}` shape, per `hasReviewLabel`).
 * @returns {{allowed:boolean, addLabel:string, removeLabels:string[], keepsHuman:boolean, reason:string}}
 */
export function decideSetLabel({ to, currentLabels = [] } = {}) {
  // we:scripts/review-set-label.mjs#decideSetLabel — only the targets in the closed set are valid.
  if (!REVIEW_LABEL_TARGETS.includes(to)) {
    throw new Error(
      `decideSetLabel: unknown verdict '${to}' — expected ${REVIEW_LABEL_TARGETS.map((t) => `'${t}'`).join(', ')}`,
    );
  }

  const isHuman = hasReviewLabel(currentLabels, REVIEW_LABELS.human);

  // we:scripts/review-set-label.mjs#decideSetLabel — clear-human (#2895): the ONE target that removes
  // `review:human`, and the only sanctioned way to clear a gate-self PR. It exists because #2882 closed the raw
  // label edit (rightly) without opening a replacement, leaving the single act the `review:human` tier exists to
  // enable with no way to perform it — the operator was pushed to an unrecorded `gh` call outside the flow,
  // which is exactly the attribution loss the single home was built to prevent.
  //
  // WHY A TARGET, NOT A FLAG ON `accepted` (#2895 asked for this to be decided, not defaulted): a
  // `--clear-human` flag would make INVARIANT 2 conditional — `accepted` would sometimes clear a gate-self PR —
  // so every future reader of the `accepted` branch would have to check whether the lift was passed. As its own
  // target, `accepted` stays UNCONDITIONALLY refused on a `review:human` PR (the branch below is unchanged), and
  // the clearance is impossible to reach by fumbling a flag on the ordinary accept path. A member added to a
  // single-sourced decider is hard to remove later, so the narrower shape wins.
  //
  // Nothing here checks WHO is asking, and nothing anywhere else does either — #2895 ruled the unforgeable
  // actor signal deferred (see the file header). What stands in the way of a clearance nobody asked for is the
  // honesty tax in `runReviewLabelCli` (`--actor` + `--reason` are required and are quoted verbatim into the
  // durable comment, so misuse takes a written lie rather than a silent label add) and the explicit-instruction
  // rule in `we:skills-src/review/SKILL.md`. The `allowClearHuman` opt-in is a much smaller thing than either —
  // it binds importers only, and today it binds none (see its doc on `runReviewLabelCli`). None of the three is
  // a barrier.
  if (to === 'clear-human') {
    if (!isHuman) {
      return {
        allowed: false,
        addLabel: '',
        removeLabels: [],
        keepsHuman: false,
        reason: 'no review:human label — nothing to clear (use --to=accepted for an ordinary parked PR)',
      };
    }
    return {
      allowed: true,
      addLabel: REVIEW_LABELS.accepted,
      // Drops the human gate AND any parked/bounced state: a cleared gate-self PR must not still read as
      // awaiting review or as a live bounce. `presentRemoveLabels` narrows this superset to what the PR carries.
      removeLabels: [REVIEW_LABELS.human, REVIEW_LABELS.pending, REVIEW_LABELS.changes],
      keepsHuman: false,
      reason: 'gate-self CLEARED via --to=clear-human — review:human dropped, review:accepted added; drain may merge',
    };
  }

  // we:scripts/review-set-label.mjs#decideSetLabel — rearm (#2644, folded in from the old conveyor decideRearm).
  // The conveyor fix agent hands a repaired review:changes bounce back for re-review. ONLY a live review:changes
  // is re-armable (idempotent no-op otherwise — what makes a second call after the swap safe). The swap is ALWAYS
  // changes→pending, NEVER adds review:accepted, and NEVER removes review:human — the #2630 invariant, enforced
  // HERE in the pure core so the CLI cannot route around it.
  if (to === 'rearm') {
    if (!hasReviewLabel(currentLabels, REVIEW_LABELS.changes)) {
      return {
        allowed: false,
        addLabel: '',
        removeLabels: [],
        keepsHuman: isHuman,
        reason: 'no review:changes label — nothing to re-arm (the PR is not a bounce awaiting repair)',
      };
    }
    return {
      allowed: true,
      addLabel: REVIEW_LABELS.pending,
      removeLabels: [REVIEW_LABELS.changes],
      keepsHuman: isHuman,
      reason: isHuman
        ? 're-armed — review:changes→review:pending; review:human KEPT (gate-self stays human-ceremony-only)'
        : 're-armed — review:changes→review:pending; drain AI-review (or a human) re-verdicts',
    };
  }

  // we:scripts/review-set-label.mjs#decideSetLabel — INVARIANT 2: never clear review:human to accepted here.
  if (to === 'accepted' && isHuman) {
    return {
      allowed: false,
      addLabel: '',
      removeLabels: [],
      keepsHuman: isHuman,
      reason: 'gate-self: review:human is human-ceremony-only — clear via /review in a session',
    };
  }

  // we:scripts/review-set-label.mjs#decideSetLabel — accepted (no human gate): the reviewer accepted →
  // add review:accepted, drop the parked review:pending AND a stale review:changes (#2974). A PR reaching
  // `accepted` may have gotten there straight from `pending`, OR via a bounce that was fixed and re-verdicted
  // without going through `rearm` first — in either case `review:changes` must not survive next to
  // `review:accepted`. `changes` (below) already strips a stale `accepted`; `accepted` was the one asymmetric
  // target, under-clearing and leaving a self-contradictory label pair that three consumers
  // (`lane-resume.mjs#land`, `pr-watch.mjs`'s `PARK_LABELS`/`isReadyToLand`, `status-board.mjs#reviewLabelOf`)
  // read raw with no accepted-first ordering of their own. `presentRemoveLabels` narrows this to labels the PR
  // actually carries, so listing `changes` unconditionally never risks an absent-label error from `gh`.
  if (to === 'accepted') {
    return {
      allowed: true,
      addLabel: REVIEW_LABELS.accepted,
      removeLabels: [REVIEW_LABELS.pending, REVIEW_LABELS.changes],
      keepsHuman: isHuman,
      reason: 'accepted — reviewer accepted; drain may merge',
    };
  }

  // we:scripts/review-set-label.mjs#decideSetLabel — changes: a bounce is always allowed (regardless of
  // human/pending). It adds review:changes and drops BOTH review:pending AND a stale review:accepted (a bounce
  // must never leave the PR looking accepted), but NEVER removes review:human — a bounce lands nothing, so the
  // human gate stays until a human clears it.
  return {
    allowed: true,
    addLabel: REVIEW_LABELS.changes,
    removeLabels: [REVIEW_LABELS.pending, REVIEW_LABELS.accepted],
    keepsHuman: isHuman,
    reason: 'changes — author lane fixes hot-context and re-pushes',
  };
}

/**
 * we:scripts/review-set-label.mjs#presentRemoveLabels — narrow a decision's `removeLabels` to only those the PR
 * ACTUALLY carries, so `gh pr edit --remove-label` is never handed an absent label (which errors). Pure — the
 * CLI intersects the decider's superset of removals against the observed labels before shelling out. Order and
 * de-dup follow `removeLabels`.
 * @param {string[]} removeLabels - the decision's requested removals
 * @param {Array} currentLabels - the PR's OBSERVED labels (string or `{name}` shape, per `hasReviewLabel`)
 * @returns {string[]}
 */
export function presentRemoveLabels(removeLabels, currentLabels) {
  return (Array.isArray(removeLabels) ? removeLabels : []).filter((l) => hasReviewLabel(currentLabels, l));
}

/**
 * we:scripts/review-set-label.mjs#runReviewLabelCli — the SHARED review-label CLI harness (#2644). Both this
 * file's reviewer-verdict CLI and the conveyor `rearm-review.mjs` run this SAME observe→decide→edit→comment→
 * re-read arc against `gh`; only three things differ and they arrive as config (exactly the deltas #2644 names):
 *   • `defaultActor` — who the durable comment is attributed to;
 *   • `buildComment({ to, actor, decision }) => string` — the comment body;
 *   • `repoOptional` — when true a missing `--repo` is derived from the cwd repo (`gh repo view`; the fix agent
 *     runs inside its own lane clone, so cwd IS the PR's repo); when false `--repo` is required.
 * `fixedTo` pins the verdict (rearm) or, when null, the harness parses + validates `--to` (accepted/changes).
 * The printed payload shapes stay the caller's, via `successResult`/`refusalResult`. Impure (shells gh); the
 * PURE `decideSetLabel` above owns every invariant, so this harness only moves bytes. Fails closed — every input
 * is validated BEFORE any gh mutation, and any gh error exits non-zero without a partial swap.
 *
 * `allowClearHuman` is the opt-in for the #2895 gate-self clearance. SAY WHAT IT ACTUALLY IS (PR #1056 review,
 * round 4 — the earlier wording over-claimed): it binds IMPORTERS ONLY, and today it binds nobody. This file's
 * own `IS_CLI` block passes `true` unconditionally, so EVERY shell caller of this CLI is opted in and the flag
 * constrains nothing on a command line. The one importer of this harness, `we:scripts/conveyor/rearm-review.mjs`,
 * pins `fixedTo: 'rearm'` and so could never reach `clear-human` by relaying an argv anyway; and nothing else
 * reaches the target at all — `we:scripts/lib/auto-land-seam.mjs#buildSetLabelArgs` builds a literal
 * `--to=accepted`. What the boolean buys is narrow and forward-looking: a FUTURE importer that forwards argv it
 * did not vet (the #2945 console is the next candidate) cannot land on `clear-human` unless it names the
 * capability in its own source, where a reviewer reads it. It is NOT a trust boundary and NOT a barrier — it is
 * an ordinary parameter of an exported function, so an importer that wants it just passes it. That is accepted,
 * because #2895 ruled the unforgeable signal deferred (file header); the mitigation is the honesty tax below,
 * not this boolean. It is deliberately a DUMB BOOLEAN rather than an injected predicate — a caller may declare a
 * capability, never supply a verdict (PR #1056 review, B2).
 * @param {{argv?:string[], fixedTo?:string|null, defaultActor:string, repoOptional?:boolean, usage:string,
 *   allowClearHuman?:boolean,
 *   buildComment:(o:{to:string,actor:string,decision:object,headSha:string,reason:string})=>string,
 *   successResult:(o:{pr:number,to:string,decision:object,labels:string[]})=>object,
 *   refusalResult:(o:{pr:number,decision:object})=>object}} cfg
 */
export function runReviewLabelCli({
  argv = process.argv.slice(2),
  fixedTo = null,
  defaultActor,
  repoOptional = false,
  usage,
  buildComment,
  successResult,
  refusalResult,
  allowClearHuman = false,
} = {}) {
  let repo = (argv.find((a) => a.startsWith('--repo=')) || '').slice('--repo='.length);
  const actorArg = (argv.find((a) => a.startsWith('--actor=')) || '').slice('--actor='.length);
  const actor = actorArg || defaultActor;
  const clearReason = (argv.find((a) => a.startsWith('--reason=')) || '').slice('--reason='.length).trim();
  const pr = argv.find((a) => /^\d+$/.test(a));
  const to = fixedTo || (argv.find((a) => a.startsWith('--to=')) || '').slice('--to='.length);

  // we:scripts/review-set-label.mjs#runReviewLabelCli — validate every input BEFORE any gh call (fail closed).
  const REPO_RE = /^[\w.-]+\/[\w.-]+$/;
  if (!pr || !/^\d+$/.test(pr) || Number(pr) <= 0) {
    fail(usage);
  }
  // A PRESENT --repo is ALWAYS validated up front (a typo fails closed before any gh call), whether or not
  // --repo is optional. An ABSENT --repo fails here only when it is REQUIRED; when optional it is derived below.
  if (repo ? !REPO_RE.test(repo) : !repoOptional) {
    fail('invalid --repo — expected <owner/name>');
  }
  // #2895 — every `clear-human` precondition is checked HERE: unconditionally, at the point of use, BEFORE any
  // gh call, and refusing through the `{"error":…}` JSON contract every other refusal here honours. Not folded
  // into the `!fixedTo &&` argv branch below — PR #1056 review, m1: a caller pinning `fixedTo: 'clear-human'`
  // skipped that branch entirely and blew up later with a TypeError instead of a clean refusal.
  if (to === 'clear-human') {
    // The opt-in. An accident guard — see `allowClearHuman` above for exactly how far it goes (not far).
    if (!allowClearHuman) {
      fail(
        '--to=clear-human is for the operator-run CLI in review-set-label.mjs (#2895) — this caller did not '
        + 'opt in, and nothing was changed',
      );
    }
    // THE HONESTY TAX (#2895). The unforgeable actor signal is deferred, so the only thing standing between a
    // clearance and a fabricated one is that the record has to be WRITTEN. Both fields are mandatory and both
    // land in the durable comment: a clearance nobody authorised now requires inventing a name AND inventing a
    // quoted instruction, which is a far brighter line than quietly adding a label. `we:skills-src/review/`
    // `SKILL.md` binds the agent side: `--reason` must quote the operator's in-conversation instruction.
    if (!actorArg.trim()) {
      fail(
        '--to=clear-human requires an explicit --actor=<name> — the clearance record must name who asked for '
        + 'it, and the default actor is not an answer (#2895)',
      );
    }
    if (!clearReason) {
      fail(
        '--to=clear-human requires --reason=<stated reason> — quote the operator instruction authorising this '
        + 'clearance; it is posted verbatim in the durable comment (#2895)',
      );
    }
  }
  const targets = allowClearHuman ? "'accepted', 'changes', or 'clear-human'" : "'accepted' or 'changes'";
  const targetOk = to === 'accepted' || to === 'changes' || to === 'clear-human';
  if (!fixedTo && !targetOk) {
    fail(`invalid --to — expected ${targets}`);
  }
  // #2974 — `rearm` is DELIBERATELY still absent from this list. Before this item, a reviewer clearing a
  // bounced-but-now-fixed PR had no sanctioned path: `--to=accepted` left the stale `review:changes` behind
  // (the bug this item fixes), and `rearm` only swaps `changes → pending` (an independent re-review owed, per
  // the #2630 invariant) — it can never emit `review:accepted`, so exposing it here would not have solved the
  // reviewer's problem even if it had been reachable. Now that `accepted` drops `changes` itself, the reviewer's
  // actual want — "clear this fixed, bounced PR" — is `--to=accepted`, same as any other parked PR; no second
  // path is needed. `rearm` stays reachable only where it already was: `scripts/conveyor/rearm-review.mjs`
  // (`fixedTo: 'rearm'`), for the conveyor fix agent handing a repair back for re-review, a DIFFERENT actor and
  // a different intent (never-accept) from a reviewer's verdict. Opening `--to=rearm` here would let this CLI's
  // caller re-park an accepted-track PR without ever verdicting it — a capability nobody asked for and the item
  // said not to add both.

  // we:scripts/review-set-label.mjs#runReviewLabelCli — --repo optional: default to the cwd repo (the fix agent
  // runs inside its WE lane clone, so the current repo IS the PR's repo). Derived once, up front.
  if (repoOptional && !repo) {
    try {
      repo = execFileSync('gh', ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'], {
        encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
      }).trim();
    } catch (e) {
      fail(ghErr(e, 'gh repo view failed (pass --repo=<owner/name> explicitly)'), 1);
    }
    if (!REPO_RE.test(repo)) {
      fail('invalid --repo — expected <owner/name>');
    }
  }

  // we:scripts/review-set-label.mjs#runReviewLabelCli — observe the PR's current labels + head SHA (the I/O
  // boundary). #2409 — `headRefOid` is the tree the reviewer is looking at RIGHT NOW; on an `accepted` verdict
  // the reviewer-verdict comment stamps it (`buildReviewedShaMarker`) so the drain can refuse to honour the
  // acceptance later if the head advances past it. #2953 — `state` rides the SAME call (one more json field, no
  // extra gh hop) so a verdict on an already-merged/closed PR can fail closed below instead of silently reporting
  // `{"ok":true}` for a label write that landed on an inert, already-decided PR.
  let currentLabels;
  let headSha = '';
  let headRefName = '';
  let prState = '';
  let prBody = '';
  try {
    const parsed = JSON.parse(execFileSync('gh', [
      'pr', 'view', pr, '--repo', repo, '--json', 'labels,headRefOid,headRefName,state,body',
    ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
    currentLabels = Array.isArray(parsed.labels) ? parsed.labels : [];
    headSha = typeof parsed.headRefOid === 'string' ? parsed.headRefOid : '';
    // #2979 — the branch name the NET diff is resolved against (see the fingerprint block below). Same gh call,
    // one more json field, no extra hop.
    headRefName = typeof parsed.headRefName === 'string' ? parsed.headRefName : '';
    prState = typeof parsed.state === 'string' ? parsed.state : '';
    // #2844 — the PR body carries the `authored-by-actor` stamp pr-land wrote at open. Same gh call, one more
    // json field, no extra hop — the same "ride the existing read" pattern #2953 used for `state`.
    prBody = typeof parsed.body === 'string' ? parsed.body : '';
  } catch (e) {
    fail(ghErr(e, 'gh pr view failed'), 1);
  }

  // #2953 — FAIL CLOSED on anything but an OPEN PR. Every sanctioned caller (the hand-run `/review` skill, the
  // conveyor's `rearm-review.mjs`, and `auto-land-seam.mjs`'s `defaultWriteAccept`, which applies `accepted`
  // BEFORE the merge itself) only ever swaps a label on a PR that is still open — so this cannot break a
  // legitimate caller. What it stops: a verdict posted on a PR the drain already merged (observed on WE PR #1073
  // — `review:changes` landed six minutes after `mergedAt`) used to report `{"ok":true}`, which reads as a live
  // bounce the drain ignored when in fact the merge gate was never involved. The findings belong on a NEW PR, not
  // on the merged one.
  if (prState !== 'OPEN') {
    fail(`PR ${pr} is ${prState}, not OPEN — a review verdict here would be inert (the merge, if any, already `
      + 'happened); open a new PR for the findings instead of relabeling this one', 1);
  }

  // #2844 — THE SELF-CLEAR REFUSAL, on the two targets that RECORD AN ACCEPTANCE (`accepted`, `clear-human`);
  // a `changes` bounce and a `rearm` land nothing, so neither needs an independence bar. Checked HERE: after the
  // OPEN-state gate, BEFORE the pure decision and therefore before ANY gh mutation, and refusing through the same
  // `{"error":…}` JSON contract every other refusal here honours.
  //
  // ONLY a PROVEN self-clear is refused — the two "cannot establish it" statuses proceed, and say so verbatim in
  // the durable comment (`buildVerdictComment`). That asymmetry with the autonomous seam
  // (`we:scripts/lib/auto-land-seam.mjs`, which refuses all three) is deliberate and is argued in full in
  // `we:scripts/lib/review-independence.mjs`'s header: refusing `unknown-author` HERE would strand every PR
  // opened before the stamp existed with no way for a HUMAN to clear it, which trades a real hole for a worse
  // one. The honest record is the mitigation, exactly the #2895 honesty-tax choice.
  const clearerId = currentActorId();
  const stampsAcceptance = to === 'accepted' || to === 'clear-human';
  const independence = stampsAcceptance
    ? decideClearerIndependence({ authorId: parseAuthorActorId(prBody), clearerId })
    : null;
  if (independence && independence.status === INDEPENDENCE.SELF_CLEAR) {
    fail(`${independence.reason} — nothing was changed (#2844)`, 1);
  }

  // we:scripts/review-set-label.mjs#runReviewLabelCli — the PURE decision. A refusal (INVARIANT 2, or nothing to
  // re-arm) changes NOTHING and exits non-zero.
  const decision = decideSetLabel({ to, currentLabels });
  if (!decision.allowed) {
    process.stdout.write(`${JSON.stringify(refusalResult({ pr: Number(pr), decision }))}\n`);
    process.exit(1);
  }

  // #x169fqe — capture the DIFF this verdict is being formed against, so the accept records WHAT was reviewed
  // and not merely WHICH COMMIT carried it. Without this the drain's own content-preserving rebase (the
  // manifest-drop pass, which fires within seconds of an accept) advances the head and invalidates the accept,
  // putting the queue in a re-review treadmill.
  //
  // THE NET DIFF, NOT `gh pr diff` (#2979 — the defect that made the first cut of this barely work). `gh pr diff`
  // returns the THREE-DOT diff, which still lists a sibling lane's file that has ALREADY landed on main as if
  // this PR added it (#2450 — the same phantom that burns negotiation rounds). Fingerprinting that means the
  // fingerprint changes every time ANY OTHER LANE LANDS, so an accept went stale for reasons having nothing to do
  // with this PR's content — measured on PR #1080, whose three-dot diff had grown to include four backlog items
  // and three script files from other PRs. `computeNetDiffText` is the repo's existing answer: the two-tree
  // `git diff <forkpoint> <head>`, content-only and ancestry-independent. Both SIDES of the comparison must use
  // it — this stamp and the drain's live read — or they are not comparing the same thing.
  //
  // FAIL-SOFT, DELIBERATELY: an unscored basis leaves `reviewedDiff` empty, so no marker is stamped and the gate
  // falls back to SHA identity — exactly the pre-#x169fqe behaviour, which is the STRICTER one. A read failure
  // can therefore only ever cost a false re-park, never honour an accept it should not. Computed only for a
  // verdict that actually records an acceptance, so a `changes` verdict pays nothing.
  let reviewedDiff = '';
  if (to === 'accepted' || to === 'clear-human') {
    try {
      // `exec` MUST be execFileSync-shaped — `(cmd, argsArray, opts)`. Passing a shell-exec here is the exact
      // caller bug #2952 exists to make diagnosable: it throws a TypeError inside the try and degrades to an
      // unscored basis, which here silently costs the fingerprint.
      //
      // NO EXPLICIT `cwd` HERE, AND THAT IS AN INVARIANT, NOT AN OVERSIGHT (PR #1087 review, note 2). This CLI is
      // single-PR and operator-invoked, so it runs from the PR's own repo — unlike the drain, which sweeps three
      // repos in one process and therefore MUST pin every git read to `escCwd` (see the matching block in
      // merge-ai-prs.mjs, where omitting it was a real defect). If this CLI ever grows a `--repo` that can name a
      // repo other than the cwd's, this call has to take a `cwd` with it, or it will fingerprint the wrong tree.
      const net = computeNetDiffText({
        exec: (cmd, args, opts) => execFileSync(cmd, args, opts),
        rev: headRefName,
        fetchExtraRefs: headRefName ? [headRefName] : [],
      });
      reviewedDiff = net && net.scored ? net.text : '';
    } catch { reviewedDiff = ''; /* miss → no marker → SHA-identity fallback (the stricter path) */ }
  }

  // we:scripts/review-set-label.mjs#runReviewLabelCli — render the durable comment ONCE, here, so the bytes
  // that are size-checked, written and posted are the same bytes.
  const commentBody = buildComment({
    to, actor, decision, headSha, reason: clearReason, reviewedDiff, clearerId, independence,
  });

  // we:scripts/review-set-label.mjs#runReviewLabelCli — THE SIZE GUARD, on the RENDERED bytes, before the swap.
  // GitHub rejects a comment over `GH_COMMENT_MAX`, and the swap lands FIRST — so an oversize comment leaves the
  // PR `review:accepted` with NO `reviewed-sha` marker, which `acceptanceCoversHead` fails OPEN on, and the drain
  // then merges with the staleness gate disarmed. PR #1057 review: the only guard used to be an argv projection
  // sitting inside the CLI's `if (bodyFileArg)` branch, so a long `--reason` with no `--body-file` walked straight
  // around it (reproduced: `gh pr edit` succeeded, `gh pr comment` 422'd, and re-running `clear-human` then
  // refused — "nothing to clear" — so recovery needed the raw `gh pr comment` this whole item exists to forbid).
  // Checking HERE, where the bytes are produced, is what makes it unskippable: no call path — this CLI, the
  // `npm run review:clear` wrapper, or an importer supplying its own `buildComment` — can route around it. The
  // argv projection stays as belt-and-braces only because it can name the offending flag before any gh call.
  if (commentBody.length > GH_COMMENT_MAX) {
    fail(`the rendered comment is ${commentBody.length} chars, over GitHub's ${GH_COMMENT_MAX} limit — trim the body/--reason/--actor (nothing was changed)`);
  }

  // we:scripts/review-set-label.mjs#runReviewLabelCli — apply the swap: add the verdict label, remove the stale
  // ones (argv array, no shell). Intersect the decision's removals with the labels the PR ACTUALLY carries so
  // `gh pr edit --remove-label` is never handed an absent label (which errors).
  const removals = presentRemoveLabels(decision.removeLabels, currentLabels);
  const editArgs = ['pr', 'edit', pr, '--repo', repo, '--add-label', decision.addLabel];
  for (const rm of removals) { editArgs.push('--remove-label', rm); }
  try {
    execFileSync('gh', editArgs, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  } catch (e) {
    fail(ghErr(e, 'gh pr edit failed'), 1);
  }

  // we:scripts/review-set-label.mjs#runReviewLabelCli — post a DURABLE comment. Write the body to a temp file to
  // dodge shell-quoting pitfalls (emoji/newlines), then `--body-file`.
  const tmp = join(tmpdir(), `review-label-${pr}-${Date.now()}.md`);
  try {
    writeFileSync(tmp, commentBody, 'utf8');
    execFileSync('gh', ['pr', 'comment', pr, '--repo', repo, '--body-file', tmp], {
      encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
    });
  } catch (e) {
    fail(ghErr(e, 'gh pr comment failed'), 1);
  } finally {
    try { unlinkSync(tmp); } catch { /* best-effort cleanup */ }
  }

  // we:scripts/review-set-label.mjs#runReviewLabelCli — re-read the labels so the printed result reflects the
  // true post-swap state (tolerant: fall back to a locally-derived set if the re-read fails).
  let newLabels;
  try {
    const out = execFileSync('gh', ['pr', 'view', pr, '--repo', repo, '--json', 'labels'], {
      encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    });
    newLabels = (JSON.parse(out).labels || []).map((l) => (typeof l === 'string' ? l : l && l.name)).filter(Boolean);
  } catch {
    const names = (Array.isArray(currentLabels) ? currentLabels : [])
      .map((l) => (typeof l === 'string' ? l : l && l.name)).filter(Boolean)
      .filter((n) => !removals.includes(n));
    newLabels = [...new Set([...names, decision.addLabel])];
  }

  process.stdout.write(`${JSON.stringify(successResult({ pr: Number(pr), to, decision, labels: newLabels }))}\n`);
  process.exit(0);
}

/**
 * we:scripts/review-set-label.mjs#buildVerdictComment — the reviewer-verdict comment body. PURE, so the one
 * place the `reviewed-sha` marker is attached to an accept is unit-testable.
 *
 * #2882 — `body` is the OPTIONAL caller-supplied write-up. The loop console records a one-line verdict and
 * passes nothing; `/review` (`we:skills-src/review/SKILL.md`) passes its full findings + verdict via
 * `--body-file`. Before this, the CLI could only emit the fixed one-liner, so `/review` hand-rolled
 * `gh pr edit` + `gh pr comment` to get a detailed comment — and thereby lost the marker AND bypassed
 * INVARIANT 2, which lives in `decideSetLabel` and only binds callers that come through here. Accepting a body
 * removes the reason to route around the single home.
 *
 * #2409 — on `accepted` the reviewed head SHA is stamped (`buildReviewedShaMarker`) so the drain can later
 * refuse to honour the acceptance if the head advanced past the reviewed tree.
 *
 * THE STAMP MUST WIN, AND THE READER DECIDES WHAT WINNING MEANS. `parseReviewedSha` is LAST-match-wins (it
 * scans every marker in a body and keeps the final one), so this builder does two things, belt and braces:
 *   1. it STRIPS any `reviewed-sha` marker out of the caller's body — a `/review` write-up legitimately quotes
 *      a prior round's marker while explaining why the head moved (#983's re-accept comment did exactly that),
 *      and a quoted marker must never be mistaken for this verdict's claim; and
 *   2. it appends its own marker LAST, so even a marker this strip failed to recognise cannot outrank it.
 * The first cut of #2882 put the marker FIRST and reasoned backwards about the reader — which silently
 * REGRESSED the pre-#2882 behaviour, because a quoted marker then overwrote the stamp. Caught in review on
 * PR #1005. The pin for this is a ROUND-TRIP assertion through the real `parseReviewedSha`, never a
 * string-position one: verifying producer and consumer independently is exactly how the inversion hid.
 *
 * The marker is omitted on `changes`, and when the head SHA is unavailable (`buildReviewedShaMarker` → '') the
 * gate fails open rather than reading a garbage marker.
 * #2844 — an acceptance also stamps WHO cleared it (`cleared-by-actor`, the harness session id — NOT the
 * free-text `--actor`, which is the point) and, when independence could NOT be established, says so in the
 * attribution. A clearance record that names only a self-declared actor is the "asserted but unenforced" state
 * this item exists to end; naming the id makes a later self-clear audit a machine read, not an archaeology.
 *
 * @param {{to:string, actor:string, headSha?:string, body?:string, reason?:string, reviewedDiff?:string,
 *   clearerId?:string, independence?:{independent:boolean,status:string,reason:string}|null}} o -
 *   #x169fqe: `reviewedDiff` is the raw diff (or a precomputed fingerprint) the verdict was formed against.
 *   Omitted → no diff marker → the gate falls back to SHA identity, i.e. pre-#x169fqe behaviour.
 * @returns {string}
 */
export function buildVerdictComment({
  to, actor, headSha = '', body = '', reason = '', reviewedDiff = '', clearerId = '', independence = null,
} = {}) {
  // #2895 — `clear-human` stamps the marker for the same reason `accepted` does: it IS an acceptance (it adds
  // review:accepted), so the drain must be able to refuse it later if the head advances past the cleared tree.
  // #x169fqe — the reviewed DIFF is stamped alongside the reviewed SHA, so a later content-preserving rebase
  // (the drain's own manifest-drop pass) can be recognised as covered instead of invalidating this accept.
  // `buildReviewedDiffMarker` returns '' when no diff was supplied, in which case the record carries only the
  // SHA and the gate behaves exactly as it did before this change.
  const stampsAcceptance = to === 'accepted' || to === 'clear-human';
  const marker = stampsAcceptance
    ? [buildReviewedShaMarker(headSha), buildReviewedDiffMarker(reviewedDiff), buildClearerActorMarker(clearerId)]
      .filter(Boolean).join('\n')
    : '';
  // #2844 — the independence line. Printed ONLY when the bar was not met, so a clean record stays terse; a
  // proven self-clear never reaches here (the CLI refuses it before any write), so this only ever explains an
  // UNPROVEN clearance. Silence would be the failure mode: a reader must not infer independence from its absence.
  const independenceNote = (stampsAcceptance && independence && independence.independent === false)
    ? `\n\n⚠️ Independence NOT established for this clearance (#2844): ${independence.reason}. `
      + 'This record does not show that a party other than the author cleared it.'
    : '';
  const text = stripReviewedShaMarkers(typeof body === 'string' ? body : '');
  const heading = to === 'clear-human'
    ? '✅ review — `review:human` cleared via the sanctioned path'
    : to === 'accepted' ? '✅ review — accepted' : '🔁 review — changes requested';
  // #2895 — the attribution is the point of the whole item: a raw `gh` call recorded none of this. On the
  // gate-self path it must state EXACTLY what the record proves and no more. It proves the sanctioned path was
  // followed; it does NOT prove a human followed it, because `--actor` and `--reason` are free text and nothing
  // here verifies either. Saying so in the durable record is the honesty tax, and it is not optional: a reader
  // who trusts this further than it earns is the failure mode the deferral of the actor signal creates.
  const attribution = to === 'clear-human'
    ? `Cleared by ${actor} via \`review-set-label.mjs --to=clear-human\` (#2895).\n\n`
      + `> ${String(reason || '').split('\n').join('\n> ')}\n\n`
      + 'What this record proves: the clearance went through the sanctioned tool, so the label swap, the '
      + '`reviewed-sha` stamp and this comment exist and agree. What it does NOT prove: that a human performed '
      + 'it. The actor name and the reason above are free text and nothing verifies who supplied them — #2895 '
      + 'deferred the unforgeable actor signal (no local construct survives an agent with shell access on the '
      + 'same machine), and #2946 is the durable fix.'
    : `Recorded by ${actor} via the Plateau Loop review console.`;
  return [
    heading,
    '',
    attribution + independenceNote,
    ...(text ? ['', text] : []),
    ...(marker ? ['', marker] : []),
  ].join('\n');
}

/**
 * we:scripts/review-set-label.mjs#stripReviewedShaMarkers — remove every `reviewed-sha` marker from a
 * caller-supplied body, replacing each with a visible placeholder so the write-up still reads correctly where
 * it was quoting one. PURE. Mirrors `REVIEWED_SHA_RE` in `we:scripts/lib/review-escalation.mjs` — the marker
 * SHAPE is defined there; this only has to recognise the same thing, and over-matching is the safe direction
 * (a stripped marker is inert text, an un-stripped one can outrank the real stamp).
 */
/** GitHub's hard cap on an issue/PR comment body. Checked BEFORE the label swap, on the rendered bytes in
 *  `runReviewLabelCli` (unskippable) and again from argv in the CLI block below (names the flag to trim). */
export const GH_COMMENT_MAX = 65536;

/** Who the durable comment is attributed to when `--actor` is absent. `clear-human` REFUSES this default. */
export const DEFAULT_ACTOR = 'loop-console operator';

export function stripReviewedShaMarkers(body) {
  return String(body || '')
    .replace(/<!--\s*reviewed-sha:\s*([0-9a-fA-F]{7,40})\s*-->/g, '`reviewed-sha: $1` (quoted, not this verdict\'s)')
    .trim();
}

/**
 * we:scripts/review-set-label.mjs#projectVerdictCommentLength — the WORST-CASE rendered length of the durable
 * comment, taken over EVERY member of `REVIEW_LABEL_TARGETS` with the ACTUAL caller-supplied variable-length
 * inputs (body, actor, reason) and a full-length SHA. PURE.
 *
 * Total over the target set, and over every unbounded input, on purpose (PR #1056 review, M2). The first cut
 * projected `to: 'accepted'` only, while `clear-human` renders a longer heading plus its attribution — a body in
 * the 65,405–65,536 band therefore PASSED the pre-flight, the label swap landed, and `gh pr comment` then failed
 * on GitHub's cap, leaving an ACCEPTED PR with no `reviewed-sha` marker. `acceptanceCoversHead` fails OPEN on a
 * missing marker, so that silently disarms the staleness gate — exactly the partial-swap state the pre-flight
 * exists to prevent. `actor` and `reason` are argv and therefore unbounded too, so they are projected from what
 * was actually passed rather than from a fixed-width placeholder that a long one would overrun. Over-estimating
 * is the safe direction: the cost is asking the operator to trim a body that would just barely have fitted.
 * #2844 — the projection is ALSO total over the independence outcomes, for the same reason it is total over the
 * targets: the `⚠️ Independence NOT established` note is extra chrome the earlier projection would have missed,
 * and under-counting it is precisely the 65,405–65,536 band failure M2 documents. Both unproven statuses render
 * a FIXED-length message (the proven `self-clear` never renders — the CLI refuses it before any write), so the
 * worst case is computed here from the real decider rather than guessed at with a placeholder width.
 * @param {{body?:string, actor?:string, reason?:string, clearerId?:string}} o - the caller-supplied
 *   variable-length inputs
 * @returns {number} the largest length any target renders to
 */
export function projectVerdictCommentLength({ body = '', actor = '', reason = '', clearerId = '' } = {}) {
  // The unproven-independence outcomes, worst case. `unknown-clearer` fires on an empty clearer id;
  // `unknown-author` on a present clearer with no author stamp — and its message embeds the clearer id, so it
  // is projected with the REAL one rather than a fixed-width stand-in.
  const outcomes = [
    null,
    decideClearerIndependence({ authorId: '', clearerId: '' }),
    decideClearerIndependence({ authorId: '', clearerId: clearerId || 'x' }),
  ];
  return Math.max(...REVIEW_LABEL_TARGETS.flatMap((to) => outcomes.map((independence) => buildVerdictComment({
    to, actor, headSha: 'f'.repeat(40), body, reason, clearerId, independence,
  }).length)));
}

// we:scripts/review-set-label.mjs — allow importing the pure decider + shared harness without running the CLI
// (the test file and rearm-review.mjs import this module). The standard main check used in review-detail.mjs.
const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (IS_CLI) {
  // #2882 — the OPTIONAL `--body-file=<path>` carries the caller's write-up (see `buildVerdictComment`). Every
  // check happens HERE, before any gh mutation, because this flag fails in the worst direction: the label is
  // applied first and the comment posted second, so a body problem discovered late leaves an ACCEPTED PR with
  // no marker — and `acceptanceCoversHead` fails open on a missing marker, so the drain then lands it. That
  // would contradict this module's own "no partial swap" promise. PR #1005 review, minors 2-4.
  const argvRest = process.argv.slice(2);
  // The bare `--body-file <path>` form is REJECTED, not silently ignored: ignoring it posts a verdict with the
  // findings missing and still exits 0. Every other flag in the harness is `=`-form; say so rather than no-op.
  const bareIdx = argvRest.indexOf('--body-file');
  if (bareIdx !== -1) fail('use --body-file=<path> (the =-form) — the space-separated form is not accepted');
  const bodyFileArg = (argvRest.find((a) => a.startsWith('--body-file=')) || '').slice('--body-file='.length);
  // The other two variable-length inputs the durable comment renders. Read here ONLY so the size pre-flight
  // below can be a real upper bound (#1056 M2) — `runReviewLabelCli` re-parses them and owns their validation.
  const projActor = (argvRest.find((a) => a.startsWith('--actor=')) || '').slice('--actor='.length) || DEFAULT_ACTOR;
  const projReason = (argvRest.find((a) => a.startsWith('--reason=')) || '').slice('--reason='.length);
  let verdictBody = '';
  if (bodyFileArg) {
    // Constrain the path: this file's contents are published to a PUBLIC PR and cannot be unpublished. A stale
    // shell variable or a wrong path would otherwise leak whatever it points at, with the CLI reporting success.
    const abs = resolve(bodyFileArg);
    const allowed = [resolve(process.cwd()), resolve(tmpdir())];
    if (!allowed.some((root) => abs === root || abs.startsWith(root + sep))) {
      fail(`--body-file must live under the repo root or the temp dir (got ${abs}) — its contents are published to a public PR`);
    }
    try { verdictBody = readFileSync(abs, 'utf8'); }
    catch (e) { fail(`--body-file=${bodyFileArg} is unreadable (${String((e && e.message) || e).split('\n')[0]})`); }
    if (!verdictBody.trim()) fail(`--body-file=${bodyFileArg} is empty — pass the verdict write-up, or omit the flag for the one-line record`);
  }
  // GitHub rejects a comment body over 65536 chars, and it rejects it AFTER the swap has landed. The authoritative
  // guard is on the RENDERED bytes in `runReviewLabelCli`; this argv projection is belt-and-braces, kept because it
  // fires before ANY gh call and can name the flag to trim. UNCONDITIONAL — PR #1057 review: it used to sit inside
  // the `if (bodyFileArg)` branch above, so `--reason`, added later and just as unbounded, was unguarded whenever
  // no `--body-file` was passed. Projected over the WHOLE target set AND every free-text argv input; see
  // `projectVerdictCommentLength`.
  const projected = projectVerdictCommentLength({
    body: verdictBody, actor: projActor, reason: projReason, clearerId: currentActorId(),
  });
  if (projected > GH_COMMENT_MAX) {
    const flag = [[verdictBody.length, `--body-file=${bodyFileArg}`], [projReason.length, '--reason'],
      [projActor.length, '--actor']].sort((a, b) => b[0] - a[0])[0][1];
    fail(`${flag} renders a ${projected}-char comment, over GitHub's ${GH_COMMENT_MAX} limit — trim it (the label is not applied)`);
  }
  runReviewLabelCli({
    defaultActor: DEFAULT_ACTOR,
    usage: 'usage: review-set-label.mjs <pr> --repo=<owner/name> --to=accepted|changes|clear-human [--actor=<name>] [--body-file=<path>]  (pr must be a positive integer; clear-human additionally requires --actor and --reason=<stated reason>)',
    buildComment: ({ to, actor, headSha, reason, reviewedDiff, clearerId, independence }) => buildVerdictComment({
      to, actor, headSha, reason, reviewedDiff, clearerId, independence, body: verdictBody,
    }),
    successResult: ({ pr, to, labels }) => ({ ok: true, pr, to, labels }),
    refusalResult: ({ decision }) => ({ error: decision.reason }),
    // #2895 — UNCONDITIONAL, so every shell invocation of this CLI is opted in, including one run for
    // `--to=accepted`. The opt-in therefore constrains nothing here; it exists so an IMPORTER of
    // `runReviewLabelCli` has to name the capability in its own source. See `allowClearHuman` on that function
    // for exactly how far that goes (not far — it is not a barrier).
    allowClearHuman: true,
  });
}

/** we:scripts/review-set-label.mjs#fail — print a machine-readable error and exit non-zero. */
function fail(message, code = 2) {
  process.stdout.write(`${JSON.stringify({ error: message })}\n`);
  process.exit(code);
}

/** we:scripts/review-set-label.mjs#ghErr — the last non-empty line of a `gh` failure (stderr wins). */
function ghErr(e, fallback) {
  return String((e && (e.stderr || e.message)) || e).split('\n').filter(Boolean).pop() || fallback;
}
