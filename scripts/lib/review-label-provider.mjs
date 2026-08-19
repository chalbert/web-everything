/**
 * @file scripts/lib/review-label-provider.mjs
 * @description THE PROVIDER PORT for the review-label arc (#x8xf5rl) — the four operations
 *   `we:scripts/review-set-label.mjs` needs from a forge, behind one injectable seam.
 *
 * WHY THIS EXISTS, AND IT IS NOT "we might add GitLab". `review-set-label.mjs` reached GitHub through five
 * hardcoded `execFileSync('gh', …)` calls, and its 1787-line test file covers only PURE functions
 * (`decideSetLabel`, `presentRemoveLabels`, `buildVerdictComment`) because there was nothing to inject through.
 * So the WRITE ARC had no test at all — including the branch that file's own #2964 block calls "the safety
 * property": comment-first UNLESS `review:accepted` is already live, because an orphan LABEL makes
 * `acceptanceCoversHead` fail OPEN and the drain then merges with the #2409 staleness gate disarmed. That was
 * the most consequential untested line in the review path, and a seam is what makes it assertable.
 *
 * THE SHAPE IS FITTED TO THIS CALLER, NOT DECLARED FORGE-AGNOSTIC. One implementation never validates an
 * abstraction. If a second forge ever arrives this port is a far better starting point than five scattered
 * subprocess calls — and it should be expected to CHANGE shape then, not treated as already correct. Nothing
 * here claims otherwise.
 *
 * WHAT DELIBERATELY DID NOT MOVE BEHIND THE PORT: independence (#2844), the `reviewed-sha` / `reviewed-diff` /
 * `reviewed-contribution` markers, `decideSetLabel`, the #2964 ordering, and the verdict-ledger append. They are
 * DECISIONS, and they stay above the seam — which is the whole point. The port carries forge mechanics only.
 *
 * SYNCHRONOUS BY CONTRACT. Every operation here PERFORMS the work and reports its real outcome. A deferred
 * transport (stage a request, let CI run the adapter later) must NOT implement this port: it could only ever
 * answer "requested", and both available lies are known failures — reporting success on a write that never
 * landed wedges the run, reporting failure on one that did double-posts a durable comment. Deferral wraps a
 * provider call; it does not pretend to be one.
 *
 * IMPURE by construction in `createGhProvider`; the module itself is pure.
 */

import { execFileSync } from 'node:child_process';
import { unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** The `--json` fields the label arc reads about a PR. Named once so a second adapter supplies the same shape
 *  rather than guessing at it, and so a stub in a test cannot drift from what the real one returns. */
export const PR_STATE_FIELDS = Object.freeze(['labels', 'headRefOid', 'headRefName', 'state', 'body']);

/**
 * The argv a `gh` adapter runs for each operation. PURE, and exported SEPARATELY from the adapter so a test can
 * assert the command is byte-identical to what this file executed before the port existed — a refactor of a
 * merge-safety path must be provably argv-preserving, not merely "looks right".
 */
export const GH_ARGV = Object.freeze({
  readPrState: (repo, pr) => ['pr', 'view', String(pr), '--repo', repo, '--json', PR_STATE_FIELDS.join(',')],
  readLabels: (repo, pr) => ['pr', 'view', String(pr), '--repo', repo, '--json', 'labels'],
  // The removals are INTERSECTED with the PR's live labels by `presentRemoveLabels` before they reach here —
  // `gh pr edit --remove-label` errors on a label the PR does not carry, so passing an absent one is a failure,
  // not a no-op. The port does not re-derive that; it is a decision and it stays above the seam.
  setLabels: (repo, pr, { add, remove = [] }) => {
    const argv = ['pr', 'edit', String(pr), '--repo', repo, '--add-label', add];
    for (const rm of remove) { argv.push('--remove-label', rm); }
    return argv;
  },
  // `--body-file`, never `--body`: the verdict body carries newlines and emoji, and shell-quoting them is the
  // kind of thing that works until one comment does not.
  postComment: (repo, pr, bodyFile) => ['pr', 'comment', String(pr), '--repo', repo, '--body-file', bodyFile],
  currentRepo: () => ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'],
});

/**
 * The `gh` provider — the default, and byte-identical to what `review-set-label.mjs` executed inline before.
 *
 * `exec` is injectable so the ADAPTER itself is testable without `gh` on PATH; a test asserts the argv it builds.
 * That is a different seam from the port: this one proves the adapter is faithful, the port proves the caller's
 * ordering is right.
 *
 * @param {{exec?: Function, writeFile?: Function, removeFile?: Function, tmpDir?: string}} [o]
 */
export function createGhProvider({
  exec = (args, opts) => execFileSync('gh', args, { encoding: 'utf8', ...opts }),
  writeFile = writeFileSync,
  removeFile = unlinkSync,
  tmpDir = tmpdir(),
} = {}) {
  return {
    name: 'gh',

    readPrState(repo, pr) {
      return JSON.parse(exec(GH_ARGV.readPrState(repo, pr), { maxBuffer: 64 * 1024 * 1024 }));
    },

    readLabels(repo, pr) {
      return JSON.parse(exec(GH_ARGV.readLabels(repo, pr), { maxBuffer: 64 * 1024 * 1024 })).labels || [];
    },

    setLabels(repo, pr, spec) {
      exec(GH_ARGV.setLabels(repo, pr, spec), { maxBuffer: 16 * 1024 * 1024 });
    },

    // The temp file is written and removed HERE rather than by the caller: it is an artefact of this adapter's
    // `--body-file` mechanic, and a second adapter posting over an API would have no file at all. `finally` so a
    // failed post still cleans up — the body can be large and it is not the caller's litter to sweep.
    postComment(repo, pr, body) {
      const path = join(tmpDir, `review-label-${pr}-${process.pid}.md`);
      try {
        writeFile(path, body, 'utf8');
        exec(GH_ARGV.postComment(repo, pr, path), { maxBuffer: 16 * 1024 * 1024 });
      } finally {
        try { removeFile(path); } catch { /* best-effort cleanup */ }
      }
    },

    /** NOT part of the port proper — it answers "which repo am I in", not "what about this PR". Kept on the
     *  adapter because it is the same `gh` arc, and it fires only when `--repo` was omitted. */
    currentRepo() {
      return exec(GH_ARGV.currentRepo(), { maxBuffer: 4 * 1024 * 1024 }).trim();
    },
  };
}

/**
 * Decide the ORDER the two writes must land in. PURE, and extracted for one reason: this was the branch with no
 * test.
 *
 * NOT ALREADY ACCEPTED (the ordinary first accept, and every `changes` / `rearm` / `clear-human` bounce) →
 * COMMENT FIRST. An orphan comment is INERT — `parseReviewedSha` is only ever reached behind a live
 * `review:accepted` — whereas an orphan LABEL is not: `review:accepted` with no marker makes
 * `acceptanceCoversHead` fail OPEN, and the drain then merges with the #2409 staleness gate disarmed.
 *
 * ALREADY ACCEPTED (re-accept after a fix) → SWAP FIRST. Comment-first would post a marker naming the LIVE head
 * while the acceptance is already live, so a run whose swap then FAILED would have freshened the coverage of an
 * acceptance it never applied.
 *
 * Keyed on the LABEL, not on `to`: `buildComment` is caller-supplied, so this cannot know whether a given
 * caller's body stamps a marker, and assuming it might is the conservative direction.
 *
 * @param {{acceptanceAlreadyLive: boolean}} o
 * @returns {['comment','swap']|['swap','comment']}
 */
export function writeOrder({ acceptanceAlreadyLive } = {}) {
  return acceptanceAlreadyLive ? ['swap', 'comment'] : ['comment', 'swap'];
}
