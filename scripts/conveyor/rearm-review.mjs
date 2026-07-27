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
 * The `rearm` decision NEVER emits `review:accepted` and NEVER removes `review:human`. A repaired bounce goes
 * back to `review:pending` (an independent re-review is owed); if the PR also carried `review:human` (a gate-self
 * edit), that label STAYS — only a human's `/review` ceremony may clear it. So the strongest thing an auto-fix
 * can do is re-arm the review, never pass it.
 *
 * #2644 — this file is now a THIN SHIM over `we:scripts/review-set-label.mjs`. It USED to clone that file
 * byte-for-byte (`presentRemoveLabels` / `ghErr` copied verbatim, the whole gh view→decide→edit→comment→re-read
 * CLI harness duplicated); the jury (PR #702, simplicity lens) flagged the duplicated label-swap I/O boundary as
 * drift-prone. The re-arm swap is now the third target of the shared PURE `decideSetLabel` (`to: 'rearm'`), and
 * the CLI is the shared `runReviewLabelCli`. Only the three real deltas live here: the comment body, the default
 * `--actor`, and the optional-`--repo` fallback. The refusal STILL lives in the pure core, so the CLI cannot
 * route around it. Scripted per [we:docs/agent/platform-decisions.md#deterministic-core-thin-judgment] (#2607).
 */
import { resolve } from 'node:path';
import { decideSetLabel, runReviewLabelCli, presentRemoveLabels } from '../review-set-label.mjs';

// we:scripts/conveyor/rearm-review.mjs — re-export the shared narrowing helper on this module's surface so the
// fix-agent brief's entrypoint and the pinned tests keep importing it from here (it is single-sourced next door).
export { presentRemoveLabels };

/**
 * we:scripts/conveyor/rearm-review.mjs#decideRearm — the PURE re-arm decision. Now a THIN alias over the shared
 * `decideSetLabel({ to: 'rearm' })` (#2644): given the PR's OBSERVED labels, return the label swap that hands a
 * repaired `review:changes` bounce back for re-review. Kept as a named export so callers/tests read the intent
 * (`decideRearm`) rather than the generic verdict target. Every rule below is enforced in the shared pure core
 * (unbypassable):
 *   • ONLY a PR that currently carries `review:changes` can be re-armed. Anything else → `allowed:false` (an
 *     idempotent no-op: a second call after the swap refuses cleanly rather than double-applying).
 *   • The swap is ALWAYS `review:changes → review:pending`: drop the bounce, add "an independent review is
 *     owed". NEVER `review:accepted` — an auto-fix may never clear the review.
 *   • `review:human` is NEVER removed. If the bounce also carried the human gate (a gate-self edit), it stays;
 *     the re-armed PR is `review:human` + `review:pending`, still human-ceremony-only.
 * @param {{currentLabels?:Array}} o - `currentLabels` is the observed label array (string or `{name}` shape).
 * @returns {{allowed:boolean, addLabel:string, removeLabels:string[], keepsHuman:boolean, reason:string}}
 */
export function decideRearm({ currentLabels = [] } = {}) {
  return decideSetLabel({ to: 'rearm', currentLabels });
}

// we:scripts/conveyor/rearm-review.mjs — allow importing the pure decider without running the CLI (the test file
// imports this module). The standard main check used across the conveyor scripts.
const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (IS_CLI) {
  // we:scripts/conveyor/rearm-review.mjs — the fix-agent re-arm CLI: the shared harness with the three deltas
  // this caller supplies (the comment body, the default --actor, the optional --repo fallback). The re-arm
  // swap + its refusal are the shared pure `decideSetLabel({ to: 'rearm' })` — this file adds no invariant.
  runReviewLabelCli({
    fixedTo: 'rearm',
    defaultActor: 'conveyor fix agent',
    repoOptional: true, // the fix agent runs inside its WE lane clone, so a missing --repo derives from cwd.
    usage: 'usage: rearm-review.mjs <pr> [--repo=<owner/name>] [--actor=<name>]  (pr must be a positive integer)',
    // The DURABLE re-arm comment — a readable record that the bounce was repaired and re-armed (not a silent flip).
    buildComment: ({ actor, decision }) => [
      '🔧 conveyor fix — re-armed for re-review',
      '',
      `The \`review:changes\` bounce was repaired and re-pushed by ${actor}; the PR is re-armed \`review:pending\`` +
        ` (an independent re-review is owed).${decision.keepsHuman ? ' `review:human` is kept — a gate-self edit stays human-ceremony-only.' : ''}`,
      '',
      'The fix agent did NOT clear the review — a human `/review` (or the drain AI-review convergence pass) re-verdicts.',
    ].join('\n'),
    successResult: ({ pr, labels }) => ({ ok: true, pr, rearmed: true, labels }),
    refusalResult: ({ pr, decision }) => ({ ok: false, pr, reason: decision.reason }),
  });
}
