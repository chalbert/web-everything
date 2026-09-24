/**
 * ci-heal-mark.mjs — post the durable CI-HEAL comment on a conveyor PR that a CI-heal agent has rebased + repaired
 * (#2666). This is the CI-half sibling of `rearm-review.mjs`, with ONE deliberate difference: it posts a durable
 * marker comment but makes NO LABEL SWAP. A CI-heal repairs only the CI axis — it must NEVER touch `review:human` /
 * `review:pending` / `review:changes` (the human review gate stays exactly as it was). So unlike the re-arm swap,
 * the strongest thing a CI-heal records on the PR is a comment.
 *
 * WHY A DURABLE COMMENT (the whole point — mirrors #2643). The conveyor bounds auto CI-heal at N attempts per PR so
 * a genuinely-broken diff can't flap forever. That cap must survive a conveyor RESTART, which wipes the in-session
 * `ciHealAttempts` map. So each completed heal posts exactly ONE comment whose leading line is
 * {@link CI_HEAL_COMMENT_MARKER}, and the tick core recovers the attempt count by counting those comments
 * ({@link countCiHealComments}) — the count IS PR state, read back off the PR's own thread, with NO parallel state
 * store (#2612). Build and count share ONE marker (single-sourced here) so they can never drift; treat the marker
 * line as fixed — changing it orphans the count on every open CI-heal PR's history (a burned PR would read as zero
 * attempts again, re-exposing the exact restart reset this design prevents).
 *
 * Scripted per [we:docs/agent/platform-decisions.md#deterministic-core-thin-judgment] (#2607): the "how many heals
 * has this PR cost" question is a pure, script-decidable count over the PR's comments — it lives here as a pure
 * function the tick core shells, never a rule the conveyor SKILL re-derives in prose.
 */
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

/**
 * we:scripts/conveyor/ci-heal-mark.mjs#CI_HEAL_COMMENT_MARKER — the stable FIRST LINE of the durable CI-heal comment.
 * Single-sourced and used two ways: the CLI POSTS a comment starting with it on every completed heal, and
 * {@link countCiHealComments} MATCHES it to recover the attempt count from the PR (#2666). Distinct from the fix
 * loop's re-arm marker so the two durable floors never cross-count.
 */
export const CI_HEAL_COMMENT_MARKER = '🩹 conveyor CI-heal — rebased & re-pushed';

/**
 * we:scripts/conveyor/ci-heal-mark.mjs#countCiHealComments — the DURABLE, restart-surviving CI-heal attempt count for
 * a PR (#2666). Every completed CI-heal posts exactly ONE comment whose leading line is {@link CI_HEAL_COMMENT_MARKER},
 * so counting those comments recovers "how many times this PR was auto-CI-healed" from the PR ITSELF — the retry cap
 * then binds even after a conveyor restart wipes the in-session `ciHealAttempts` map (the exact unbounded heal↔red
 * loop the cap exists to prevent). Pure — the caller passes the PR's `comments` exactly as `gh pr view <pr> --json
 * comments` returns them (`[{ body }]`); a bare-string array is tolerated too. A comment is counted only when the
 * marker is its leading line (`trimStart().startsWith`), so a human QUOTING the comment in a reply never inflates it.
 * @param {Array<{body?:string}|string>|null|undefined} comments
 * @returns {number} the number of conveyor CI-heal comments on the PR (0 for a non-array / empty input)
 */
export function countCiHealComments(comments) {
  if (!Array.isArray(comments)) return 0;
  let n = 0;
  for (const c of comments) {
    const body = typeof c === 'string' ? c : c?.body;
    if (typeof body === 'string' && body.trimStart().startsWith(CI_HEAL_COMMENT_MARKER)) n += 1;
  }
  return n;
}

/**
 * we:scripts/conveyor/ci-heal-mark.mjs#buildCiHealComment — the durable comment body a completed heal posts. Its
 * FIRST line MUST be {@link CI_HEAL_COMMENT_MARKER} (single-sourced) so posting and counting can never drift. Pure.
 *
 * `executedVendor` (#3850 Fork 2, we:backlog/3850-…md) — the REAL vendor that ran this heal, in
 * `DELIVERY_VENDOR_PROVIDERS`'s own vocabulary (`we:scripts/lib/dispatch-contracts.mjs`). Defaults to
 * `'claude'` (native, unmarked — every pre-#3850 comment reads this way, which is the correct, non-disruptive
 * default for history that predates this field). A non-Claude vendor gets its OWN line, machine-readable by
 * {@link parseCiHealExecutedVendor} below, because a `ci-heal` can NEVER write a review label itself (this
 * file's own hardest rule) — the durable comment is the only place this fact can be recorded for a later
 * reader to bind a land-seam hold on.
 * @param {{ actor?:string, reason?:string, executedVendor?:string }} o
 * @returns {string}
 */
export function buildCiHealComment({ actor = 'conveyor CI-heal agent', reason = '', executedVendor = 'claude' } = {}) {
  const why = reason === 'behind' ? 'the branch had fallen BEHIND `main`'
    : reason === 'red-ci' ? 'a required check had gone red after open'
    : 'a required check regressed after open';
  const lines = [
    CI_HEAL_COMMENT_MARKER,
    '',
    `${why}; ${actor} rebased onto current \`main\`, repaired the failing check, and re-pushed HEAD.`,
    'Only the CI axis was repaired — the review gate (`review:human` / `review:pending`) was NOT touched. A human ' +
      '`/review` (or the drain AI-review) still verdicts as before; the drain lands it once green and reviewed.',
  ];
  if (executedVendor && executedVendor !== 'claude') {
    lines.push(
      '',
      `${EXECUTED_VENDOR_MARKER_PREFIX}${executedVendor}`,
      '(#3850 Fork 2 — a delegated run; the land seam owes this PR an independent review before it merges, ' +
        'even though this CI-heal changed no review label.)',
    );
  }
  return lines.join('\n');
}

/**
 * we:scripts/conveyor/ci-heal-mark.mjs#EXECUTED_VENDOR_MARKER_PREFIX — the stable line prefix
 * {@link buildCiHealComment} stamps the executed vendor behind, and {@link parseCiHealExecutedVendor} matches
 * to read it back. Single-sourced so the two can never drift, exactly like {@link CI_HEAL_COMMENT_MARKER}.
 */
export const EXECUTED_VENDOR_MARKER_PREFIX = 'Executed by: ';

/**
 * we:scripts/conveyor/ci-heal-mark.mjs#parseCiHealExecutedVendor — #3850 Fork 2's READ HALF: given a PR's
 * comments (`gh pr view <pr> --json comments`'s own shape, or a bare-string array — same tolerance as
 * {@link countCiHealComments}), recover the executed vendor of the MOST RECENT completed CI-heal. Pure.
 *
 * Reads the LAST matching comment (a PR can be healed more than once; only the latest push's vendor matters
 * for a land-time decision — an earlier heal's vendor says nothing about the CURRENT head). A comment with no
 * {@link EXECUTED_VENDOR_MARKER_PREFIX} line (every heal before #3850, or a Claude-executed one — see
 * {@link buildCiHealComment}, which omits the line entirely for `'claude'`) reads as `'claude'`: the safe,
 * non-disruptive default for history this field predates.
 *
 * NOT YET CALLED FROM THE DRAIN'S OWN MERGE DECISION — see `ci-heal-dispatch-wrapper.mjs#ciHealMark`'s own
 * docblock for why the real wiring (into `merge-ai-prs.mjs` / `decideReviewGate`) is a deliberately deferred
 * fast-follow, not silently skipped.
 * @param {Array<{body?:string}|string>|null|undefined} comments
 * @returns {string} the executed vendor of the most recent CI-heal comment, or `'claude'` if none is found.
 */
export function parseCiHealExecutedVendor(comments) {
  if (!Array.isArray(comments)) return 'claude';
  let vendor = 'claude';
  for (const c of comments) {
    const body = typeof c === 'string' ? c : c?.body;
    if (typeof body !== 'string' || !body.trimStart().startsWith(CI_HEAL_COMMENT_MARKER)) continue;
    const line = body.split('\n').find((l) => l.startsWith(EXECUTED_VENDOR_MARKER_PREFIX));
    vendor = line ? line.slice(EXECUTED_VENDOR_MARKER_PREFIX.length).trim() || 'claude' : 'claude';
  }
  return vendor;
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
    fail('usage: ci-heal-mark.mjs <pr> [--repo=<owner/name>] [--reason=<red-ci|behind>] [--actor=<name>] [--vendor=<vendor>]  (pr must be a positive integer)');
  }
  const body = buildCiHealComment({
    actor: typeof flags.actor === 'string' ? flags.actor : undefined,
    reason: typeof flags.reason === 'string' ? flags.reason : undefined,
    executedVendor: typeof flags.vendor === 'string' ? flags.vendor : undefined,
  });
  const args = ['pr', 'comment', String(pr), '--body', body];
  if (typeof flags.repo === 'string') args.push(`--repo=${flags.repo}`); // the heal agent runs in its WE lane clone; a missing --repo derives from cwd.
  try {
    execFileSync('gh', args, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  } catch (e) {
    fail(`could not post CI-heal comment on PR #${pr}: ${String(e.message || e).split('\n')[0]}`);
  }
  process.stdout.write(JSON.stringify({ ok: true, pr, commented: true }) + '\n');
}
