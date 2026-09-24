/**
 * advisory-fix-mark.mjs — post the durable ADVISORY-FIX comment on a `review:human` conveyor PR whose fixer
 * addressed an admitted `advisory:changes` finding (#xkmu3gv). The advisory-half sibling of
 * `we:scripts/conveyor/ci-heal-mark.mjs`, with the SAME deliberate shape: a durable marker comment, NO label
 * swap of any kind.
 *
 * WHY NO LABEL SWAP. The advisory finding lives entirely OUTSIDE the human review ceremony —
 * `we:scripts/operations/review-pr.mjs`'s `advise` step never calls `decideSetLabel`, and there is no
 * `review:changes` on this population to "re-arm" in the sense `we:scripts/conveyor/rearm-review.mjs` means
 * it (this population is `needs-human` + `advisory:changes`, never `bounced`). So the strongest thing a fixer
 * that repairs the finding can do — exactly the same non-negotiable `rearm-review.mjs`'s own header states for
 * the ordinary case — is post evidence that it acted. This file NEVER touches `review:human`, NEVER adds
 * `review:accepted`, and NEVER touches any `advisory:*` label itself: only the NEXT `advise` run (a fresh
 * `review` dispatch, already owed by `we:scripts/conveyor/reconcile-core.mjs`'s `needs-human` phase once this
 * marker outnumbers the advisory-note count) may change those, by judging the repaired head fresh.
 *
 * WHY A DURABLE COMMENT (mirrors #2643/#2666). `reconcile-core.mjs` bounds this population's auto-fix at its
 * OWN, smaller cap (`ADVISORY_FIX_ROUND_CAP`, #xkmu3gv — see that constant's own docblock) so a genuinely
 * unfixable advisory finding cannot flap forever; that cap must survive a conveyor RESTART, which wipes any
 * in-session tally. Each completed advisory-fix round posts exactly ONE comment whose leading line is
 * {@link ADVISORY_FIX_COMMENT_MARKER}, and the count IS PR state, read back off the PR's own thread — no
 * parallel state store (#2612 invariant).
 *
 * Scripted per [we:docs/agent/platform-decisions.md#deterministic-core-thin-judgment] (#2607): "was this
 * advisory finding already fixed" is a pure, script-decidable count over the PR's comments — it lives here as
 * a pure function the reconcile pass shells, never a rule the fix-agent brief re-derives in prose.
 */
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { resolveChildTimeoutMs } from '../lib/bounded-child.mjs';

/**
 * we:scripts/conveyor/advisory-fix-mark.mjs#ADVISORY_FIX_COMMENT_MARKER — the stable FIRST LINE of the durable
 * advisory-fix comment. Single-sourced and used two ways: the CLI POSTS a comment starting with it on every
 * completed advisory-fix round, and {@link countAdvisoryFixComments} MATCHES it to recover the attempt count.
 * Distinct from every other marker in this repo (`REARM_COMMENT_MARKER`, `CI_HEAL_COMMENT_MARKER`,
 * `STAND_DOWN_MARKER`, `CONFLICT_FIX_COMMENT_MARKER`, `ADVISORY_NOTE_MARKER`) so no two durable floors can ever
 * cross-count. Treat this line as fixed — changing it orphans the count on every open advisory-fixed PR's
 * existing history.
 */
export const ADVISORY_FIX_COMMENT_MARKER = '🔧 conveyor fix — advisory finding addressed (#xkmu3gv)';

/**
 * we:scripts/conveyor/advisory-fix-mark.mjs#countAdvisoryFixComments — the DURABLE, restart-surviving
 * advisory-fix attempt count for a PR (#xkmu3gv). Pure — the caller passes the PR's `comments` exactly as
 * `gh pr view <pr> --json comments` returns them (`[{ body }]`); a bare-string array is tolerated too. A
 * comment is counted only when the marker is its LEADING line (`trimStart().startsWith`, the same narrowing
 * every sibling counter in this repo uses), so a human quoting the comment in a reply never inflates the count.
 * @param {Array<{body?:string}|string>|null|undefined} comments
 * @returns {number} the number of conveyor advisory-fix comments on the PR (0 for a non-array / empty input)
 */
export function countAdvisoryFixComments(comments) {
  if (!Array.isArray(comments)) return 0;
  let n = 0;
  for (const c of comments) {
    const body = typeof c === 'string' ? c : c?.body;
    if (typeof body === 'string' && body.trimStart().startsWith(ADVISORY_FIX_COMMENT_MARKER)) n += 1;
  }
  return n;
}

/**
 * we:scripts/conveyor/advisory-fix-mark.mjs#buildAdvisoryFixComment — the durable comment body a completed
 * advisory-fix round posts. Its FIRST line MUST be {@link ADVISORY_FIX_COMMENT_MARKER} (single-sourced) so
 * posting and counting can never drift. Pure.
 * @param {{ actor?:string }} o
 * @returns {string}
 */
export function buildAdvisoryFixComment({ actor = 'conveyor fix agent' } = {}) {
  return [
    ADVISORY_FIX_COMMENT_MARKER,
    '',
    `${actor} addressed the admitted advisory finding above and re-pushed HEAD.`,
    'This did NOT touch `review:human`, `review:pending`, `review:changes`, or any `advisory:*` label, and did ' +
      'NOT record a verdict. A fresh independent review is owed next (the reconcile pass dispatches it once ' +
      'this comment outnumbers the prior advisory note) — it re-runs the advisory pass on this new head and ' +
      'posts the next real verdict; only that step, or the operator\'s own `/review`, may change any label.',
  ].join('\n');
}

// ── IO SHELL (runs only as a CLI — the pure exports above stay side-effect-free on import) ────────────────────────
const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (IS_CLI) {
  const argv = process.argv.slice(2);
  const flags = {};
  const positionals = [];
  for (const a of argv) {
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq === -1) flags[a.slice(2)] = true;
      else flags[a.slice(2, eq)] = a.slice(eq + 1);
    } else positionals.push(a);
  }
  const fail = (m) => {
    process.stderr.write(`✗ ${m}\n`);
    process.exit(1);
  };
  const pr = Number(positionals[0]);
  if (!Number.isInteger(pr) || pr <= 0) {
    fail('usage: advisory-fix-mark.mjs <pr> [--repo=<owner/name>] [--actor=<name>]  (pr must be a positive integer)');
  }
  const body = buildAdvisoryFixComment({
    actor: typeof flags.actor === 'string' ? flags.actor : undefined,
  });
  const args = ['pr', 'comment', String(pr), '--body', body];
  if (typeof flags.repo === 'string') args.push(`--repo=${flags.repo}`); // the fix agent runs in its WE lane clone; a missing --repo derives from cwd.
  try {
    execFileSync('gh', args, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', timeout: resolveChildTimeoutMs(), killSignal: 'SIGKILL' });
  } catch (e) {
    fail(`could not post advisory-fix comment on PR #${pr}: ${String(e.message || e).split('\n')[0]}`);
  }
  process.stdout.write(JSON.stringify({ ok: true, pr, commented: true }) + '\n');
}
