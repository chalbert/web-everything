/**
 * review-set-label.mjs — swap a PARKED PR's review label, INVARIANT-2 guarded (#2470, increment 2 of 2).
 *
 * The WRITE half of the Plateau Loop review console. A PURE `decideSetLabel` decides the label swap for a
 * reviewer verdict (`accepted` / `changes`), and a thin `gh`-shelling CLI applies it and posts a durable
 * verdict comment. Single-sourced in WE (Native-First / zero standard-impl here — this is a definition + write
 * tool, not product code) so the plateau console shells it rather than re-implementing how a verdict lands.
 *
 * INVARIANT 2 (the whole point): a `review:human` PR is NEVER cleared to `review:accepted` by anything but a
 * human's /review ceremony. `decideSetLabel` REFUSES `to==='accepted'` when the PR carries `review:human`
 * (`gate-self` is human-ceremony-only). The refusal lives in the PURE core so it is unbypassable — the CLI
 * cannot route around it. Do NOT weaken it.
 *
 * Split mirrors `we:scripts/review-detail.mjs`: a PURE decider that takes the already-observed labels and
 * returns the swap, plus a thin impure CLI that does the `gh` calls and prints. REUSES
 * `we:scripts/lib/review-escalation.mjs` (`REVIEW_LABELS`, `hasReviewLabel`) — it never re-hardcodes the
 * label strings.
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REVIEW_LABELS, hasReviewLabel } from './lib/review-escalation.mjs';

/**
 * we:scripts/review-set-label.mjs#decideSetLabel — the PURE verdict-label decision. Given the target verdict
 * `to` and the PR's OBSERVED labels, return the label swap. INVARIANT 2 is enforced HERE (unbypassable): an
 * `accepted` verdict on a `review:human` PR is REFUSED — only a human's /review ceremony may clear the human
 * gate. A `changes` verdict is always allowed (a bounce lands nothing) and NEVER removes `review:human`.
 * @param {{to:('accepted'|'changes'), currentLabels?:Array}} o - `currentLabels` is the observed label array
 *   (string or `{name}` shape, per `hasReviewLabel`).
 * @returns {{allowed:boolean, addLabel:string, removeLabels:string[], reason:string}}
 */
export function decideSetLabel({ to, currentLabels = [] } = {}) {
  // we:scripts/review-set-label.mjs#decideSetLabel — only the two reviewer verdicts are valid targets.
  if (to !== 'accepted' && to !== 'changes') {
    throw new Error(`decideSetLabel: unknown verdict '${to}' — expected 'accepted' or 'changes'`);
  }

  const isHuman = hasReviewLabel(currentLabels, REVIEW_LABELS.human);

  // we:scripts/review-set-label.mjs#decideSetLabel — INVARIANT 2: never clear review:human to accepted here.
  if (to === 'accepted' && isHuman) {
    return {
      allowed: false,
      addLabel: '',
      removeLabels: [],
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
      reason: 'accepted — reviewer accepted; drain may merge',
    };
  }

  // we:scripts/review-set-label.mjs#decideSetLabel — changes: a bounce is always allowed (regardless of
  // human/pending). It adds review:changes and drops review:pending, but NEVER removes review:human — a bounce
  // lands nothing, so the human gate stays until a human clears it.
  return {
    allowed: true,
    addLabel: REVIEW_LABELS.changes,
    removeLabels: [REVIEW_LABELS.pending],
    reason: 'changes — author lane fixes hot-context and re-pushes',
  };
}

// we:scripts/review-set-label.mjs — allow importing the pure decider without running the CLI (the test file
// imports this module). The standard main check used in `we:scripts/review-detail.mjs`.
const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (IS_CLI) runCli();

function runCli() {
  const args = process.argv.slice(2);
  const repo = (args.find((a) => a.startsWith('--repo=')) || '').slice('--repo='.length);
  const to = (args.find((a) => a.startsWith('--to=')) || '').slice('--to='.length);
  const actorArg = (args.find((a) => a.startsWith('--actor=')) || '').slice('--actor='.length);
  const actor = actorArg || 'loop-console operator';
  const pr = args.find((a) => /^\d+$/.test(a));

  // we:scripts/review-set-label.mjs#runCli — validate every input BEFORE any `gh` call (fail closed).
  if (!pr || !/^\d+$/.test(pr) || Number(pr) <= 0) {
    fail('usage: review-set-label.mjs <pr> --repo=<owner/name> --to=accepted|changes [--actor=<name>]  (pr must be a positive integer)');
  }
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    fail('invalid --repo — expected <owner/name>');
  }
  if (to !== 'accepted' && to !== 'changes') {
    fail("invalid --to — expected 'accepted' or 'changes'");
  }

  // we:scripts/review-set-label.mjs#runCli — observe the PR's current labels (the I/O boundary).
  let currentLabels;
  try {
    const out = execFileSync('gh', [
      'pr', 'view', pr, '--repo', repo, '--json', 'labels',
    ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const parsed = JSON.parse(out);
    currentLabels = Array.isArray(parsed.labels) ? parsed.labels : [];
  } catch (e) {
    fail(ghErr(e, 'gh pr view failed'), 1);
  }

  // we:scripts/review-set-label.mjs#runCli — the PURE decision. A refusal (INVARIANT 2) exits non-zero.
  const decision = decideSetLabel({ to, currentLabels });
  if (!decision.allowed) {
    process.stdout.write(`${JSON.stringify({ error: decision.reason })}\n`);
    process.exit(1);
  }

  // we:scripts/review-set-label.mjs#runCli — apply the swap: add the verdict label, remove the stale ones
  // (argv array, no shell).
  const editArgs = ['pr', 'edit', pr, '--repo', repo, '--add-label', decision.addLabel];
  for (const rm of decision.removeLabels) { editArgs.push('--remove-label', rm); }
  try {
    execFileSync('gh', editArgs, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  } catch (e) {
    fail(ghErr(e, 'gh pr edit failed'), 1);
  }

  // we:scripts/review-set-label.mjs#runCli — post a DURABLE verdict comment. Write the body to a temp file to
  // dodge shell-quoting pitfalls (emoji/newlines), then `--body-file`.
  const header = to === 'accepted' ? '✅ review — accepted' : '🔁 review — changes requested';
  const body = [
    header,
    '',
    `Recorded by ${actor} via the Plateau Loop review console.`,
  ].join('\n');
  const tmp = join(tmpdir(), `review-set-label-${pr}-${Date.now()}.md`);
  try {
    writeFileSync(tmp, body, 'utf8');
    execFileSync('gh', ['pr', 'comment', pr, '--repo', repo, '--body-file', tmp], {
      encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
    });
  } catch (e) {
    fail(ghErr(e, 'gh pr comment failed'), 1);
  } finally {
    try { unlinkSync(tmp); } catch { /* best-effort cleanup */ }
  }

  // we:scripts/review-set-label.mjs#runCli — re-read the labels so the printed result reflects the true
  // post-swap state (tolerant: fall back to a locally-derived set if the re-read fails).
  let newLabels;
  try {
    const out = execFileSync('gh', ['pr', 'view', pr, '--repo', repo, '--json', 'labels'], {
      encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    });
    newLabels = (JSON.parse(out).labels || []).map((l) => (typeof l === 'string' ? l : l && l.name)).filter(Boolean);
  } catch {
    const names = (Array.isArray(currentLabels) ? currentLabels : [])
      .map((l) => (typeof l === 'string' ? l : l && l.name)).filter(Boolean)
      .filter((n) => !decision.removeLabels.includes(n));
    newLabels = [...new Set([...names, decision.addLabel])];
  }

  process.stdout.write(`${JSON.stringify({ ok: true, pr: Number(pr), to, labels: newLabels })}\n`);
  process.exit(0);
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
