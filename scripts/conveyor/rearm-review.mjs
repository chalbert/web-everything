/**
 * rearm-review.mjs — re-arm a repaired conveyor fix PR for re-review after a `review:changes` bounce (#2630).
 *
 * THE ONE LABEL SWAP THE FIX AGENT IS ALLOWED TO MAKE. When a conveyor-launched PR is bounced `review:changes`
 * (a human ran `/review` and requested changes), the conveyor auto-spawns a FIX AGENT into that PR's lane (see
 * `we:skills-src/conveyor/fix-agent-brief.md`). The fix agent repairs the reviewer's finding, gets the gate
 * green, re-pushes HEAD to the `lane/*` ref — then hands the PR BACK for re-review by calling this script. It
 * swaps `review:changes → review:pending` so the drain's AI-review convergence pass (or a human) re-verdicts.
 *
 * THE INVARIANT THIS ENFORCES (the whole point — #2630): the fix agent NEVER self-clears the human review gate.
 * `decideRearm` NEVER emits `review:accepted` and NEVER removes `review:human`. A repaired bounce goes back to
 * `review:pending` (an independent re-review is owed); if the PR also carried `review:human` (a gate-self edit),
 * that label STAYS — only a human's `/review` ceremony may clear it. So the strongest thing an auto-fix can do
 * is re-arm the review, never pass it. The refusal lives in the PURE core so the CLI cannot route around it.
 *
 * Split mirrors `we:scripts/review-set-label.mjs`: a PURE decider that takes the already-observed labels and
 * returns the swap, plus a thin impure CLI that does the `gh` calls and prints. REUSES
 * `we:scripts/lib/review-escalation.mjs` (`REVIEW_LABELS`, `hasReviewLabel`) — it never re-hardcodes the label
 * strings. Scripted per [we:docs/agent/platform-decisions.md#deterministic-core-thin-judgment] (#2607): the
 * label swap is script-decidable (observed labels → one deterministic swap), so it is a tested pure function,
 * never a rule the fix-agent brief re-derives in prose.
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REVIEW_LABELS, hasReviewLabel } from '../lib/review-escalation.mjs';

/**
 * we:scripts/conveyor/rearm-review.mjs#decideRearm — the PURE re-arm decision. Given the PR's OBSERVED labels,
 * return the label swap that hands a repaired `review:changes` bounce back for re-review.
 *
 * Rules (all enforced HERE, unbypassable):
 *   • ONLY a PR that currently carries `review:changes` can be re-armed. Anything else → `allowed:false` (a
 *     no-op: there is no bounce to hand back). This makes the script idempotent — a second call after the swap
 *     already happened refuses cleanly rather than double-applying.
 *   • The swap is ALWAYS `review:changes → review:pending`: drop the bounce, add "an independent review is
 *     owed". NEVER `review:accepted` — an auto-fix may never clear the review.
 *   • `review:human` is NEVER removed. If the bounce also carried the human gate (a gate-self edit), it stays;
 *     the re-armed PR is `review:human` + `review:pending`, still human-ceremony-only.
 *
 * @param {{currentLabels?:Array}} o - `currentLabels` is the observed label array (string or `{name}` shape,
 *   per `hasReviewLabel`).
 * @returns {{allowed:boolean, addLabel:string, removeLabels:string[], keepsHuman:boolean, reason:string}}
 */
export function decideRearm({ currentLabels = [] } = {}) {
  const hasChanges = hasReviewLabel(currentLabels, REVIEW_LABELS.changes);
  const hasHuman = hasReviewLabel(currentLabels, REVIEW_LABELS.human);

  // we:scripts/conveyor/rearm-review.mjs#decideRearm — only a live `review:changes` bounce is re-armable.
  // No bounce → refuse (idempotent no-op). This is what makes a second call after the swap safe.
  if (!hasChanges) {
    return {
      allowed: false,
      addLabel: '',
      removeLabels: [],
      keepsHuman: hasHuman,
      reason: 'no review:changes label — nothing to re-arm (the PR is not a bounce awaiting repair)',
    };
  }

  // we:scripts/conveyor/rearm-review.mjs#decideRearm — the re-arm: drop the bounce, add "review owed". NEVER
  // add review:accepted and NEVER remove review:human — the fix agent cannot clear the human gate (#2630).
  return {
    allowed: true,
    addLabel: REVIEW_LABELS.pending,
    removeLabels: [REVIEW_LABELS.changes],
    keepsHuman: hasHuman,
    reason: hasHuman
      ? 're-armed — review:changes→review:pending; review:human KEPT (gate-self stays human-ceremony-only)'
      : 're-armed — review:changes→review:pending; drain AI-review (or a human) re-verdicts',
  };
}

/**
 * we:scripts/conveyor/rearm-review.mjs#presentRemoveLabels — narrow a decision's `removeLabels` to only those
 * the PR ACTUALLY carries, so `gh pr edit --remove-label` is never handed an absent label (which errors). Pure.
 * Mirrors the same helper in `we:scripts/review-set-label.mjs`.
 * @param {string[]} removeLabels - the decision's requested removals
 * @param {Array} currentLabels - the PR's OBSERVED labels (string or `{name}` shape, per `hasReviewLabel`)
 * @returns {string[]}
 */
export function presentRemoveLabels(removeLabels, currentLabels) {
  return (Array.isArray(removeLabels) ? removeLabels : []).filter((l) => hasReviewLabel(currentLabels, l));
}

// we:scripts/conveyor/rearm-review.mjs — allow importing the pure decider without running the CLI (the test
// file imports this module). The standard main check used across the conveyor scripts.
const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (IS_CLI) runCli();

function runCli() {
  const args = process.argv.slice(2);
  let repo = (args.find((a) => a.startsWith('--repo=')) || '').slice('--repo='.length);
  const actorArg = (args.find((a) => a.startsWith('--actor=')) || '').slice('--actor='.length);
  const actor = actorArg || 'conveyor fix agent';
  const pr = args.find((a) => /^\d+$/.test(a));

  // we:scripts/conveyor/rearm-review.mjs#runCli — validate every input BEFORE any `gh` mutation (fail closed).
  if (!pr || !/^\d+$/.test(pr) || Number(pr) <= 0) {
    fail('usage: rearm-review.mjs <pr> [--repo=<owner/name>] [--actor=<name>]  (pr must be a positive integer)');
  }

  // we:scripts/conveyor/rearm-review.mjs#runCli — --repo is optional: default to the cwd repo (the fix agent
  // runs inside its WE lane clone, so the current repo IS the PR's repo). Derived once, up front.
  if (!repo) {
    try {
      const out = execFileSync('gh', ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'], {
        encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
      });
      repo = out.trim();
    } catch (e) {
      fail(ghErr(e, 'gh repo view failed (pass --repo=<owner/name> explicitly)'), 1);
    }
  }
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    fail('invalid --repo — expected <owner/name>');
  }

  // we:scripts/conveyor/rearm-review.mjs#runCli — observe the PR's current labels (the I/O boundary).
  let currentLabels;
  try {
    const out = execFileSync('gh', ['pr', 'view', pr, '--repo', repo, '--json', 'labels'], {
      encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    });
    const parsed = JSON.parse(out);
    currentLabels = Array.isArray(parsed.labels) ? parsed.labels : [];
  } catch (e) {
    fail(ghErr(e, 'gh pr view failed'), 1);
  }

  // we:scripts/conveyor/rearm-review.mjs#runCli — the PURE decision. A refusal (no bounce to re-arm) exits
  // non-zero and changes NOTHING — the caller treats it as "already re-armed / not a bounce".
  const decision = decideRearm({ currentLabels });
  if (!decision.allowed) {
    process.stdout.write(`${JSON.stringify({ ok: false, pr: Number(pr), reason: decision.reason })}\n`);
    process.exit(1);
  }

  // we:scripts/conveyor/rearm-review.mjs#runCli — apply the swap: add review:pending, remove review:changes
  // (argv array, no shell). Intersect the decision's removals with the labels the PR ACTUALLY carries so
  // `gh pr edit --remove-label` is never handed an absent label (which errors).
  const removals = presentRemoveLabels(decision.removeLabels, currentLabels);
  const editArgs = ['pr', 'edit', pr, '--repo', repo, '--add-label', decision.addLabel];
  for (const rm of removals) { editArgs.push('--remove-label', rm); }
  try {
    execFileSync('gh', editArgs, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  } catch (e) {
    fail(ghErr(e, 'gh pr edit failed'), 1);
  }

  // we:scripts/conveyor/rearm-review.mjs#runCli — post a DURABLE re-arm comment so the PR carries a readable
  // record that the bounce was repaired and re-armed (not just a silent label flip). Write to a temp file to
  // dodge shell-quoting pitfalls (emoji/newlines), then `--body-file`.
  const body = [
    '🔧 conveyor fix — re-armed for re-review',
    '',
    `The \`review:changes\` bounce was repaired and re-pushed by ${actor}; the PR is re-armed \`review:pending\`` +
      ` (an independent re-review is owed).${decision.keepsHuman ? ' `review:human` is kept — a gate-self edit stays human-ceremony-only.' : ''}`,
    '',
    'The fix agent did NOT clear the review — a human `/review` (or the drain AI-review convergence pass) re-verdicts.',
  ].join('\n');
  const tmp = join(tmpdir(), `rearm-review-${pr}-${Date.now()}.md`);
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

  // we:scripts/conveyor/rearm-review.mjs#runCli — re-read the labels so the printed result reflects the true
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
      .filter((n) => !removals.includes(n));
    newLabels = [...new Set([...names, decision.addLabel])];
  }

  process.stdout.write(`${JSON.stringify({ ok: true, pr: Number(pr), rearmed: true, labels: newLabels })}\n`);
  process.exit(0);
}

/** we:scripts/conveyor/rearm-review.mjs#fail — print a machine-readable error and exit non-zero. */
function fail(message, code = 2) {
  process.stdout.write(`${JSON.stringify({ error: message })}\n`);
  process.exit(code);
}

/** we:scripts/conveyor/rearm-review.mjs#ghErr — the last non-empty line of a `gh` failure (stderr wins). */
function ghErr(e, fallback) {
  return String((e && (e.stderr || e.message)) || e).split('\n').filter(Boolean).pop() || fallback;
}
