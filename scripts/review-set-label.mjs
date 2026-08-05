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
 * #2895 — INVARIANT 2 says who may NOT clear a gate-self PR; the `clear-human` target says how the one who MAY
 * actually does it. Before this, #2882 closed the raw label edit without opening a replacement, so the single
 * act the `review:human` tier exists to enable had no sanctioned way to perform it and the operator was pushed
 * to an unrecorded `gh` call — losing the `reviewed-sha` stamp and the attributed comment. `clear-human` is the
 * ONLY target that removes `review:human`, it is reachable only from this file's CLI (the `humanCeremony` hook),
 * and it demands a confirmation typed at a real terminal. `accepted` stays unconditionally refused on a
 * `review:human` PR — see `decideSetLabel` for why this is a target rather than a flag, and
 * `decideHumanCeremony` for what the terminal barrier does and does not defend against.
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
  // we:scripts/review-set-label.mjs#decideSetLabel — only the four verdict targets are valid.
  if (to !== 'accepted' && to !== 'changes' && to !== 'rearm' && to !== 'clear-human') {
    throw new Error(
      `decideSetLabel: unknown verdict '${to}' — expected 'accepted', 'changes', 'rearm', or 'clear-human'`,
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
  // The human-ceremony gate itself is NOT here: it is inherently impure (a real terminal), so it lives in
  // `runReviewLabelCli` behind `decideHumanCeremony`. This core decides only WHAT the swap is; `fixedTo` keeps
  // the agent callers (the conveyor fix agent pins `rearm`) from ever naming this target — pinned by a test.
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
      reason: 'gate-self CLEARED by a human — review:human dropped, review:accepted added; drain may merge',
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
 * we:scripts/review-set-label.mjs#decideHumanCeremony — the PURE half of the #2895 human-ceremony gate: given
 * whether stdin is a real terminal and what was typed at the prompt, may this `clear-human` proceed? Pure, so
 * the barrier is unit-testable without a pty.
 *
 * WHAT THIS DEFENDS AGAINST, stated honestly. In a solo constellation the agent runs on the operator's machine,
 * with the operator's PAT, with read access to the whole filesystem — so a secret file, an env var, or a GitHub
 * identity check are ALL forgeable by an agent, and login identity is already useless as an independence signal
 * (#2439: every commit is the same account). The one thing an agent structurally cannot do is TYPE AT A LIVE
 * TERMINAL: its shell runs with no tty attached, and a pipe does not satisfy `isTTY`. That is the whole barrier.
 * It is NOT cryptographic and does not pretend to be — an adversary holding the machine wins regardless. The
 * threat model is "an eager agent must not clear its own homework", and for that this holds.
 *
 * INTERIM BY DESIGN: the durable home for this signal is a UI with its own auth, where "the human did it" is a
 * property of the session rather than of the input device. Until that exists, the terminal is the only place
 * where "the operator did it" and "an agent did it" differ, so this is a way-station, not the destination.
 *
 * The typed token is the PR NUMBER, not `y`. Clearing a gate-self PR is the highest-consequence act in the
 * review system, so a fat-finger on a confirm prompt must not be able to perform it — the operator has to name
 * the PR they mean. Comparison is exact after trimming surrounding whitespace.
 * @param {{isTTY?:boolean, typed?:string, pr:(string|number)}} o
 * @returns {{allowed:boolean, reason:string}}
 */
export function decideHumanCeremony({ isTTY = false, typed = '', pr } = {}) {
  if (!isTTY) {
    return {
      allowed: false,
      reason:
        'clear-human needs a real terminal — stdin is not a tty, so this is not an interactive human ceremony. ' +
        'Run it yourself in a terminal (an agent shell has no tty; a pipe does not count).',
    };
  }
  const want = String(pr).trim();
  const got = String(typed == null ? '' : typed).trim();
  if (got !== want) {
    return {
      allowed: false,
      reason: `confirmation did not match — expected the PR number "${want}", got "${got}"; nothing was changed`,
    };
  }
  return { allowed: true, reason: `confirmed by a human at a terminal for PR #${want}` };
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
  humanCeremony = null,
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
  // #2895 — `clear-human` is reachable ONLY when the caller opts in via `humanCeremony`. The conveyor fix agent
  // and every other agent caller pin `fixedTo` (or simply do not pass the hook), so they cannot name this target
  // even by constructing the argv themselves — pinned by a test. This is the caller-side half of the gate; the
  // interactive half is `decideHumanCeremony` below.
  const targets = humanCeremony ? "'accepted', 'changes', or 'clear-human'" : "'accepted' or 'changes'";
  const targetOk = to === 'accepted' || to === 'changes' || (to === 'clear-human' && !!humanCeremony);
  if (!fixedTo && !targetOk) {
    fail(`invalid --to — expected ${targets}`);
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

  // we:scripts/review-set-label.mjs#runReviewLabelCli — the #2895 HUMAN CEREMONY, run AFTER the pure decision
  // (so the operator is shown the real swap, not a guess) and BEFORE any gh mutation (so a refused or
  // mistyped ceremony changes nothing). Only `clear-human` reaches it; every other target is untouched.
  if (to === 'clear-human') {
    const verdict = humanCeremony({ pr, repo, decision, headSha, currentLabels });
    if (!verdict.allowed) {
      process.stdout.write(`${JSON.stringify(refusalResult({ pr: Number(pr), decision: {
        ...decision, allowed: false, reason: verdict.reason,
      } }))}\n`);
      process.exit(1);
    }
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
 * @param {{to:string, actor:string, headSha?:string, body?:string}} o
 * @returns {string}
 */
export function buildVerdictComment({ to, actor, headSha = '', body = '' } = {}) {
  // #2895 — `clear-human` stamps the marker for the same reason `accepted` does: it IS an acceptance (it adds
  // review:accepted), so the drain must be able to refuse it later if the head advances past the cleared tree.
  const marker = to === 'accepted' || to === 'clear-human' ? buildReviewedShaMarker(headSha) : '';
  const text = stripReviewedShaMarkers(typeof body === 'string' ? body : '');
  const heading = to === 'clear-human'
    ? '✅ review — gate-self CLEARED by a human'
    : to === 'accepted' ? '✅ review — accepted' : '🔁 review — changes requested';
  // The attribution line is the point of the whole item: a raw `gh` call recorded none of this. On the
  // gate-self path it says explicitly that a human performed the terminal ceremony, so the record distinguishes
  // "a human cleared it" from "a reviewer accepted it" without the reader having to infer it from the label set.
  const attribution = to === 'clear-human'
    ? `Cleared by ${actor} — confirmed at a terminal via \`review-set-label.mjs --to=clear-human\` (#2895). `
      + 'A gate-self edit is human-ceremony-only; no agent can reach this path.'
    : `Recorded by ${actor} via the Plateau Loop review console.`;
  return [
    heading,
    '',
    attribution,
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
/** GitHub's hard cap on an issue/PR comment body. Checked BEFORE the label swap — see the CLI block below. */
export const GH_COMMENT_MAX = 65536;

export function stripReviewedShaMarkers(body) {
  return String(body || '')
    .replace(/<!--\s*reviewed-sha:\s*([0-9a-fA-F]{7,40})\s*-->/g, '`reviewed-sha: $1` (quoted, not this verdict\'s)')
    .trim();
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
  // Single-sourced so the size PROJECTION below and the `defaultActor` the render actually uses can never drift.
  const DEFAULT_ACTOR = 'loop-console operator';
  // The bare `--body-file <path>` form is REJECTED, not silently ignored: ignoring it posts a verdict with the
  // findings missing and still exits 0. Every other flag in the harness is `=`-form; say so rather than no-op.
  const bareIdx = argvRest.indexOf('--body-file');
  if (bareIdx !== -1) fail('use --body-file=<path> (the =-form) — the space-separated form is not accepted');
  const bodyFileArg = (argvRest.find((a) => a.startsWith('--body-file=')) || '').slice('--body-file='.length);
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
    // GitHub rejects a comment body over 65536 chars. Catching it here means the label is never applied against
    // a comment that cannot post; catching it later would leave exactly the accepted-without-a-marker state above.
    // Project with the ACTUAL `--actor`, not an assumed 64-char stand-in. `--actor` is unbounded caller input and
    // is rendered verbatim into the attribution line, so a stand-in makes this an ESTIMATE rather than the upper
    // bound the guard needs — and it errs in the one direction that matters. Measured on this file before the fix:
    // a 400-char actor renders 336 chars LONGER than the projection, so a body sized to pass here posts over the
    // cap, `gh pr edit` having already applied the label. That is precisely the accepted-without-a-marker state
    // the comment above says this check exists to prevent. Mirror `runReviewLabelCli`'s own parse so the projection
    // and the render cannot disagree about who the actor is (`defaultActor` below is the same fallback).
    const projectedActor = (argvRest.find((a) => a.startsWith('--actor=')) || '').slice('--actor='.length) || DEFAULT_ACTOR;
    const projected = buildVerdictComment({ to: 'accepted', actor: projectedActor, headSha: 'f'.repeat(40), body: verdictBody }).length;
    if (projected > GH_COMMENT_MAX) {
      fail(`--body-file=${bodyFileArg} renders a ${projected}-char comment, over GitHub's ${GH_COMMENT_MAX} limit — trim it (the label is not applied)`);
    }
  }
  runReviewLabelCli({
    defaultActor: 'loop-console operator',
    usage: 'usage: review-set-label.mjs <pr> --repo=<owner/name> --to=accepted|changes|clear-human [--actor=<name>] [--body-file=<path>]  (pr must be a positive integer; clear-human needs a real terminal)',
    buildComment: ({ to, actor, headSha }) => buildVerdictComment({ to, actor, headSha, body: verdictBody }),
    successResult: ({ pr, to, labels }) => ({ ok: true, pr, to, labels }),
    refusalResult: ({ decision }) => ({ error: decision.reason }),
    // #2895 — ONLY this CLI passes the hook, so only this CLI can name `--to=clear-human`. The conveyor fix
    // agent (`rearm-review.mjs`) pins `fixedTo: 'rearm'` and passes no hook, so the gate-self clearance is
    // unreachable from an agent caller even if it built the argv by hand.
    humanCeremony: promptHumanCeremony,
  });
}

/**
 * we:scripts/review-set-label.mjs#promptHumanCeremony — the IMPURE half of the #2895 gate: show the operator the
 * swap that is about to happen, read one line from the terminal, and hand both facts to the pure
 * `decideHumanCeremony`. Prints to stderr so stdout stays the machine-readable JSON result the callers parse.
 *
 * Reading is a blocking `readFileSync(0)` on the tty rather than `readline`, so the whole CLI stays synchronous
 * (every other step here is `execFileSync`); an async prompt would force the harness to become async for this one
 * branch. On a non-tty this never reads at all — `decideHumanCeremony` refuses first, so an agent invocation
 * cannot hang waiting on input that will never come.
 */
function promptHumanCeremony({ pr, repo, decision, headSha, currentLabels }) {
  const isTTY = !!process.stdin.isTTY;
  if (!isTTY) return decideHumanCeremony({ isTTY, typed: '', pr });

  const names = (Array.isArray(currentLabels) ? currentLabels : [])
    .map((l) => (typeof l === 'string' ? l : l && l.name)).filter(Boolean);
  const removals = presentRemoveLabels(decision.removeLabels, currentLabels);
  process.stderr.write(
    `\nGATE-SELF CLEARANCE — this is the one act no agent may perform.\n\n`
    + `  PR       #${pr}  (${repo})\n`
    + `  head     ${headSha || '(unknown)'}\n`
    + `  labels   ${names.join(', ') || '(none)'}\n`
    + `  add      ${decision.addLabel}\n`
    + `  remove   ${removals.join(', ') || '(none)'}\n\n`
    + `Confirm you reviewed this tree yourself. Type the PR number (${pr}) to clear it, anything else to abort: `,
  );
  let typed = '';
  try { typed = readFileSync(0, 'utf8'); } catch { typed = ''; }
  process.stderr.write('\n');
  return decideHumanCeremony({ isTTY, typed: String(typed).split('\n')[0], pr });
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
