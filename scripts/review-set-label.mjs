/**
 * review-set-label.mjs — swap a PR's review label, INVARIANT-2 guarded (#2470, increment 2 of 2). Also the
 * SINGLE HOME of the shared review-label CLI harness (#2644): a PURE `decideSetLabel` decides the swap for a
 * reviewer verdict (`accepted` / `changes`) OR the fix-agent re-arm (`rearm`), and a thin `runReviewLabelCli`
 * does the `gh` observe→edit→comment→re-read arc. The conveyor's `rearm-review.mjs` is now a THIN shim over
 * both (it used to clone this file byte-for-byte). Single-sourced in WE (Native-First / zero standard-impl here
 * — this is a definition + write tool, not product code) so the plateau console and the conveyor fix agent both
 * shell/import it rather than re-implementing how a label swap lands.
 *
 * INVARIANT 2 (the whole point): a `review:human` PR is NEVER cleared to `review:accepted` by anything but a
 * human's /review ceremony. `decideSetLabel` REFUSES `to==='accepted'` when the PR carries `review:human`
 * (`gate-self` is human-ceremony-only). The refusal lives in the PURE core so it is unbypassable — the CLI
 * cannot route around it. Do NOT weaken it. The `rearm` target carries the sibling #2630 invariant: an auto-fix
 * re-arms `review:changes → review:pending` but NEVER emits `review:accepted` and NEVER removes `review:human`.
 *
 * Split mirrors `we:scripts/review-detail.mjs`: a PURE decider that takes the already-observed labels and
 * returns the swap, plus a thin impure CLI that does the `gh` calls and prints. REUSES
 * `we:scripts/lib/review-escalation.mjs` (`REVIEW_LABELS`, `hasReviewLabel`) — it never re-hardcodes the
 * label strings.
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { writeFileSync, unlinkSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REVIEW_LABELS, hasReviewLabel, buildReviewedShaMarker } from './lib/review-escalation.mjs';

/**
 * we:scripts/review-set-label.mjs#decideSetLabel — the PURE verdict-label decision. Given the target `to` and
 * the PR's OBSERVED labels, return the label swap. Three targets, each with its invariant enforced HERE
 * (unbypassable): the reviewer verdicts `accepted` / `changes`, and the conveyor fix-agent `rearm` (#2644, was
 * `decideRearm`). Every return carries `keepsHuman` — whether the swap leaves `review:human` in place.
 *   • `accepted` — INVARIANT 2: REFUSED on a `review:human` PR (only a human's /review may clear the gate);
 *     otherwise adds `review:accepted`, drops the parked `review:pending`.
 *   • `changes` — always allowed (a bounce lands nothing); adds `review:changes`, drops `review:pending` AND a
 *     stale `review:accepted`, but NEVER `review:human`.
 *   • `rearm` — the #2630 invariant: ONLY a live `review:changes` is re-armable (idempotent — a second call
 *     refuses cleanly); the swap is ALWAYS `review:changes → review:pending`, NEVER `review:accepted`, and
 *     NEVER removes `review:human`. The strongest thing an auto-fix can do is re-arm the review, never clear it.
 * @param {{to:('accepted'|'changes'|'rearm'), currentLabels?:Array}} o - `currentLabels` is the observed label
 *   array (string or `{name}` shape, per `hasReviewLabel`).
 * @returns {{allowed:boolean, addLabel:string, removeLabels:string[], keepsHuman:boolean, reason:string}}
 */
export function decideSetLabel({ to, currentLabels = [] } = {}) {
  // we:scripts/review-set-label.mjs#decideSetLabel — only the three verdict targets are valid.
  if (to !== 'accepted' && to !== 'changes' && to !== 'rearm') {
    throw new Error(`decideSetLabel: unknown verdict '${to}' — expected 'accepted', 'changes', or 'rearm'`);
  }

  const isHuman = hasReviewLabel(currentLabels, REVIEW_LABELS.human);

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
  // add review:accepted, drop the parked review:pending.
  if (to === 'accepted') {
    return {
      allowed: true,
      addLabel: REVIEW_LABELS.accepted,
      removeLabels: [REVIEW_LABELS.pending],
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
 * @param {{argv?:string[], fixedTo?:string|null, defaultActor:string, repoOptional?:boolean, usage:string,
 *   buildComment:(o:{to:string,actor:string,decision:object,headSha:string})=>string,
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
} = {}) {
  let repo = (argv.find((a) => a.startsWith('--repo=')) || '').slice('--repo='.length);
  const actorArg = (argv.find((a) => a.startsWith('--actor=')) || '').slice('--actor='.length);
  const actor = actorArg || defaultActor;
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
  if (!fixedTo && to !== 'accepted' && to !== 'changes') {
    fail("invalid --to — expected 'accepted' or 'changes'");
  }

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
  // acceptance later if the head advances past it. One extra json field on the existing call — no extra gh hop.
  let currentLabels;
  let headSha = '';
  try {
    const parsed = JSON.parse(execFileSync('gh', [
      'pr', 'view', pr, '--repo', repo, '--json', 'labels,headRefOid',
    ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
    currentLabels = Array.isArray(parsed.labels) ? parsed.labels : [];
    headSha = typeof parsed.headRefOid === 'string' ? parsed.headRefOid : '';
  } catch (e) {
    fail(ghErr(e, 'gh pr view failed'), 1);
  }

  // we:scripts/review-set-label.mjs#runReviewLabelCli — the PURE decision. A refusal (INVARIANT 2, or nothing to
  // re-arm) changes NOTHING and exits non-zero.
  const decision = decideSetLabel({ to, currentLabels });
  if (!decision.allowed) {
    process.stdout.write(`${JSON.stringify(refusalResult({ pr: Number(pr), decision }))}\n`);
    process.exit(1);
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
    writeFileSync(tmp, buildComment({ to, actor, decision, headSha }), 'utf8');
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
 * refuse to honour the acceptance if the head advanced past the reviewed tree. The marker goes FIRST: the
 * drain's `parseReviewedSha` takes the LAST marker in a body, and a caller-supplied body could legitimately
 * quote an older marker while discussing a prior round (as #983's re-accept comment did). Leading position
 * means the marker this CLI stamps is the one that loses to nothing but itself. The marker is omitted on
 * `changes`, and when the head SHA is unavailable (`buildReviewedShaMarker` → '') the gate fails open rather
 * than reading a garbage marker.
 * @param {{to:string, actor:string, headSha?:string, body?:string}} o
 * @returns {string}
 */
export function buildVerdictComment({ to, actor, headSha = '', body = '' } = {}) {
  const marker = to === 'accepted' ? buildReviewedShaMarker(headSha) : '';
  const text = typeof body === 'string' ? body.trim() : '';
  return [
    ...(marker ? [marker] : []),
    to === 'accepted' ? '✅ review — accepted' : '🔁 review — changes requested',
    '',
    `Recorded by ${actor} via the Plateau Loop review console.`,
    ...(text ? ['', text] : []),
  ].join('\n');
}

// we:scripts/review-set-label.mjs — allow importing the pure decider + shared harness without running the CLI
// (the test file and rearm-review.mjs import this module). The standard main check used in review-detail.mjs.
const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (IS_CLI) {
  // #2882 — the OPTIONAL `--body-file=<path>` carries the caller's write-up (see `buildVerdictComment`). Read
  // it up front so an unreadable path fails BEFORE any gh mutation, matching the harness's fail-closed posture.
  const bodyFileArg = (process.argv.slice(2).find((a) => a.startsWith('--body-file=')) || '').slice('--body-file='.length);
  let verdictBody = '';
  if (bodyFileArg) {
    try { verdictBody = readFileSync(bodyFileArg, 'utf8'); }
    catch (e) { fail(`--body-file=${bodyFileArg} is unreadable (${String((e && e.message) || e).split('\n')[0]})`); }
  }
  runReviewLabelCli({
    defaultActor: 'loop-console operator',
    usage: 'usage: review-set-label.mjs <pr> --repo=<owner/name> --to=accepted|changes [--actor=<name>] [--body-file=<path>]  (pr must be a positive integer)',
    buildComment: ({ to, actor, headSha }) => buildVerdictComment({ to, actor, headSha, body: verdictBody }),
    successResult: ({ pr, to, labels }) => ({ ok: true, pr, to, labels }),
    refusalResult: ({ decision }) => ({ error: decision.reason }),
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
