/**
 * @file scripts/backlog/guarded-write.mjs
 * @description THE ONE CARD-MUTATION WRITER — extracted out of `we:scripts/backlog.mjs` (#3034, under epic
 * #3029) so a declared operation (`we:scripts/operations/claim.mjs`'s `write` effect, via
 * `we:scripts/operations/claim-io.mjs`) can call the SAME guard chain the CLI always has, instead of
 * re-deriving it. This is a pure extraction — the two exports here are the SAME functions that used to live
 * inline in `backlog.mjs` (lines 105-163 as of #3034), moved verbatim apart from one change: `die()` (which
 * called `process.exit(1)`) is now `throw new Error(...)`, because a shared library cannot exit its caller's
 * process. Every existing `backlog.mjs` call site is unaffected — it wraps the call and hands the thrown
 * message to its own `die()`, so today's exact exit-1 text and code are unchanged (see `backlog.mjs`'s local
 * `writeBacklogMd`/`writeBacklogMdUnguarded` shims).
 *
 * WHY IT MOVED: `we:scripts/operations/claim-io.mjs`'s sink needs to write through this SAME chain — the lane
 * guard (#2302/#104/#2219/#2339), the #3015 secret scrub and the #883 locus-prefix scan — not a second copy.
 * Before this extraction the functions were module-local (not exported) in `backlog.mjs`, so calling them from
 * a new file was not possible without first pulling them out here.
 *
 * The two golden-corpus fixtures that pin the lane-isolation refusal TEXT exactly still apply — they exercise
 * `backlog.mjs`, which now calls THROUGH this module rather than carrying its own copy:
 *   `we:scripts/golden-corpus/hook-guard-bash/backlog-mutation-primary-cwd.json`
 *   `we:scripts/golden-corpus/hook-guard-bash/backlog-mutation-primary-cwd-override.json`
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { laneGuardDecision, resolveReal } from '../guard-lane.mjs';
import { scrubPublish } from '../lib/secret-scrub.mjs';
import { scanRepoLocusPrefixes } from '../check-standards-rules.mjs';

/** The repo root, resolved by SCRIPT LOCATION — this file sits one level deeper than `backlog.mjs`, so it
 *  climbs two directories rather than one. Callers may override via `{ root }` (tests, and any out-of-tree
 *  caller), the same escape hatch `run-store.mjs`'s `RUNS_ROOT` uses. */
const HERE = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_ROOT = join(HERE, '..', '..');

/**
 * The card writer WITH the primary-checkout lane guard. #1574 gap (1) motivates running it here rather than
 * only in the PreToolUse `--pre` hook: the CLI write path (`scaffold`/`claim`/`resolve`/…) writes straight to
 * `fs`, never through the `Edit`/`Write` tools, so the hook never sees it. Enforce the lane-isolation rule
 * (#2302/#104/#2219/#2339) at the SOURCE — a workflow/subagent/cron/headless caller that shells this CLI (or,
 * as of #3034, a declared operation's sink that calls THIS function) bypasses the PreToolUse(Bash) hook, which
 * fires only for Bash-*tool* calls in a session that loads `.claude/settings.json`.
 *
 * THROWS rather than exiting — the caller (a CLI verb, or an operation's effect sink) decides how to surface
 * the refusal. `laneGuardDecision`'s own message text is unchanged, so a caller that reproduces it verbatim in
 * its own `die()` matches today's output exactly.
 *
 * @param {string} abs - absolute path of the file about to be written.
 * @param {string} rel - the repo-relative path (for the message + the locus-prefix scan's `file` key).
 * @param {string} content - the full file text to write.
 * @param {{root?: string}} [opts]
 */
export function writeBacklogMd(abs, rel, content, { root = DEFAULT_ROOT } = {}) {
  if (laneGuardDecision(resolveReal(abs), root)) {
    throw new Error(
      `backlog item-mutation BLOCKED — "${rel}" resolves under the shared PRIMARY checkout. Every card ` +
      `mutation (cost/claim/resolve/release/scaffold/settle/retype/yield/prepare-stamp) must run in a LANE ` +
      `clone, never the primary tree — running it here stamps the item on primary and bypasses lane ` +
      `isolation (#2302/#104/#2219/#2339). Enforced at the source so non-Bash-tool channels ` +
      `(workflow/subagent/cron/headless) are covered too, not just the PreToolUse(Bash) hook. cd into a ` +
      `lane clone (~/workspace/.lanes/<repo>/lane-N) and run it there. There is no override.`,
    );
  }
  writeBacklogMdUnguarded(abs, rel, content, { root });
}

/**
 * The card writer WITHOUT the primary-checkout lane guard — the sanctioned drain-side on-land splice path
 * (mirrors why `numberPendingHashes` uses its own writer). The lane guard exists to keep INTERACTIVE / session
 * card mutations out of the primary tree (#2302/#104); the mechanized LANDER is the deliberate carve-out — it
 * runs ON primary, post-land, syncs to origin/main, splices a deterministic frontmatter-only change, and
 * publishes via the same gated transport pr-land uses. So `resolve-parent` (#2752) writes through here, exactly
 * as JIT-numbering does. Still runs the locus-prefix content scan — that is content-hygiene (#883), orthogonal
 * to lane isolation, and a frontmatter-only splice never trips it, so it is a cheap belt-and-braces check, never
 * a blocker on the resolve path.
 *
 * THROWS rather than exiting — same contract as {@link writeBacklogMd}.
 *
 * @param {string} abs @param {string} rel @param {string} content @param {{root?: string}} [opts]
 */
export function writeBacklogMdUnguarded(abs, rel, content, { root = DEFAULT_ROOT } = {}) {
  assertPublishableContent(rel, content);
  writeFileSync(abs, content);
}

/**
 * THE CONTENT GATES EVERY COMMITTED FILE THIS REPO WRITES FROM CODE MUST PASS — the #3015 secret scrub and the
 * #883 locus-prefix scan. THROWS on either; returns nothing.
 *
 * EXTRACTED FROM {@link writeBacklogMdUnguarded} (#3150), unchanged, so a SECOND code-written committed file
 * can pass the same two gates instead of carrying a near-copy of them. The first such caller is
 * `we:scripts/operations/explore-io.mjs`'s `publish-research` terminal effect, which writes a
 * `/research/` topic pair from juror-authored prose — text that is, if anything, more likely to carry a bare
 * code path than a hand-written card is.
 *
 * WHY BOTH GATES ARE ABOUT THE SAME MECHANISM GAP. A CLI (or an operation's effect sink) writes straight to
 * `fs`, never through the `Edit`/`Write` tools, so the PreToolUse hooks never see it — the gap #1574
 * documented. Enforcing at the SOURCE is what covers the workflow / subagent / cron / headless callers too.
 *
 * The `rel` path is used only in the messages and as the scan's `file` key; nothing is read from disk.
 *
 * @param {string} rel - the repo-relative path, for the message and the scan key.
 * @param {string} content - the full file text about to be written.
 */
export function assertPublishableContent(rel, content) {
  // #3015 — the PUBLISH-SEAM secret gate, and the load-bearing one. A backlog card is committed and pushed;
  // this writer is the ONE AUTHORING funnel every CLI card-mutation goes through (scaffold/resolve/settle/
  // retype/yield/prepare-stamp/claim), and a CLI writes straight to `fs`, so the PreToolUse(Edit|Write) hooks
  // never see it — the same mechanism gap #1574 documented for locus prefixes, one line above. Refuse BEFORE
  // `writeFileSync`, mirroring the reject-before-persist shape the learnings append seam used to have.
  const leaks = scrubPublish(content);
  if (leaks.length) {
    throw new Error(
      `secret-scrub: refusing to write ${rel} — the content carries ${leaks.join('; ')} (#3015). A backlog ` +
      `card is COMMITTED and PUSHED, so a credential in it is a published credential. Remove the value (and ` +
      `rotate it if it was ever real); describe it in words instead of pasting it.`,
    );
  }
  const findings = scanRepoLocusPrefixes([{ file: rel, content }]);
  if (findings.length) {
    const { count, sample } = findings[0];
    throw new Error(`locus-prefix: ${count} bare code-path ref(s) in ${rel} lack a <repo>: prefix (#883; e.g. "${sample}" → "we:${sample}"). Prefix them now — don't leave it for the gate.`);
  }
}
