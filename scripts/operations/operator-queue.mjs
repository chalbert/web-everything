/**
 * @file Read-only operator queue: the SOLE authority on which human-gated PRs are worth the operator's time.
 *
 * THE OPERATOR'S RULE (2026-09-19): "I won't look at a human PR until it carries `advisory:accepted` and has no
 * request-changes or review-pending." A PR is in NEEDS YOU only when ALL of these hold:
 *   - it carries `review:human` AND `advisory:accepted`, and carries NEITHER `review:pending` NOR `review:changes`
 *     (a HARD gate on the labels — `review:pending` is by definition not ready);
 *   - the advisory COMMENT, parsed independently (`we:scripts/lib/advisory-labels.mjs#parseAdvisories`), agrees:
 *     its newest advisory covers the live head and accepts. The comment is the source of truth; the label is a
 *     derived view of it. Any disagreement between the two is reported in NOT READY as the reason, never resolved
 *     silently in either direction;
 *   - CI is green, the PR is not conflicting, and GitHub reports it MERGEABLE.
 *
 * THREE BUCKETS, not two. `mergeable: UNKNOWN` is GitHub's transient "still computing" state, and reporting it in
 * NOT READY ("agent work is owed") made a healthy PR flap between ready and not-ready from run to run. So an
 * UNKNOWN PR is re-polled a few times with backoff (GitHub computes on request); one that is STILL unknown lands in
 * PENDING — "transient, re-run", where no agent work is owed. A PR with a real failure stays in NOT READY and does
 * not list the transient state among its reasons.
 */
import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import {
  ADVISORY_LABELS, ADVISORY_OUTCOMES, advisoryCoversHead, latestAdvisory,
} from '../lib/advisory-labels.mjs';

import { CONSTELLATION_REPOS, repoKeyForSlug } from '../lib/constellation-repos.mjs';
import { readUnsupported } from '../conveyor/unsupported-repo.mjs';
const hasLabel = (pr, name) => (pr.labels ?? []).some((label) => label.name === name);

/** How many times an UNKNOWN mergeability is re-polled, and the first backoff (doubling each attempt). */
export const MERGEABLE_POLL_ATTEMPTS = 4;
export const MERGEABLE_POLL_DELAY_MS = 1000;

/**
 * Evaluate one PR against every readiness gate. Pure.
 * @returns {{ready: boolean, reasons: string[], transient: boolean}} `transient` is true when the ONLY thing
 *   between this PR and `ready` is GitHub's still-computing mergeability — `ready` is then false and `reasons` empty.
 */
export function evaluatePr(pr) {
  const reasons = [];
  if (!hasLabel(pr, 'review:human')) reasons.push('no review:human label');

  const advisory = latestAdvisory(pr.comments);
  const head = (pr.headRefOid ?? '').toLowerCase();
  const covers = advisory ? advisoryCoversHead(advisory, head) : false;
  if (!advisory) {
    reasons.push('no advisory verdict');
  } else if (!covers) {
    reasons.push(`advisory is on ${advisory.head.toLowerCase().slice(0, 9)}, head is ${head.slice(0, 9)}`);
  }
  if (advisory?.outcome === ADVISORY_OUTCOMES.CHANGES || hasLabel(pr, 'review:changes')) {
    reasons.push('changes requested');
  }
  if (hasLabel(pr, 'review:pending')) reasons.push('review:pending label (advisory not accepted yet)');

  // THE LABEL GATE, and its cross-check against the parsed comment. `parsed` is what the comment says about the
  // CURRENT head: a stale or missing advisory says nothing, so any advisory label riding on it is a disagreement.
  const accepted = hasLabel(pr, ADVISORY_LABELS.ACCEPTED);
  const changes = hasLabel(pr, ADVISORY_LABELS.CHANGES);
  const parsed = advisory && covers ? advisory.outcome : null;
  const parsedText = parsed
    ? `advisory comment says ${parsed} on this head`
    : (advisory ? 'advisory comment is not on this head' : 'no advisory comment');
  if (accepted && changes) {
    reasons.push(`label/comment disagreement: ${ADVISORY_LABELS.ACCEPTED} and ${ADVISORY_LABELS.CHANGES} are both set`);
  } else if (accepted && parsed !== ADVISORY_OUTCOMES.ACCEPT) {
    reasons.push(`label/comment disagreement: ${ADVISORY_LABELS.ACCEPTED} is set but ${parsedText}`);
  } else if (changes && parsed !== ADVISORY_OUTCOMES.CHANGES) {
    reasons.push(`label/comment disagreement: ${ADVISORY_LABELS.CHANGES} is set but ${parsedText}`);
  } else if (!accepted && parsed === ADVISORY_OUTCOMES.ACCEPT) {
    reasons.push(`label/comment disagreement: ${parsedText} but ${ADVISORY_LABELS.ACCEPTED} is absent`);
  }

  const checks = (pr.statusCheckRollup ?? []).filter((check) => check.name !== 'review-gate');
  const pending = checks.filter((check) => check.status !== 'COMPLETED');
  const failing = checks.filter((check) => check.status === 'COMPLETED'
    && !['SUCCESS', 'SKIPPED', 'NEUTRAL'].includes(check.conclusion));
  const names = (entries) => entries.map((check) => check.name || check.context || 'unnamed check').join(', ');
  if (failing.length) reasons.push(`CI failing: ${names(failing)}`);
  if (pending.length) reasons.push(`CI pending: ${names(pending)}`);
  if (hasLabel(pr, 'ci:failed')) reasons.push('ci:failed label');

  if (pr.mergeable === 'CONFLICTING' || hasLabel(pr, 'merge-status:conflicting')) {
    reasons.push('conflicts with base');
  }
  const mergeabilityUnknown = pr.mergeable !== 'MERGEABLE' && pr.mergeable !== 'CONFLICTING';
  const transient = mergeabilityUnknown && reasons.length === 0;
  return { ready: reasons.length === 0 && !mergeabilityUnknown, reasons, transient };
}

/** Blocking sleep — `main` is synchronous, and this only runs on the rare UNKNOWN-mergeability path. */
const blockingSleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/**
 * Re-poll one PR's mergeability until GitHub reports a definite answer or the attempts run out. GitHub computes
 * `mergeable` on request, so the answer usually arrives on the first or second poll. A failed poll counts as
 * "still unknown" — it must never turn a transient state into a hard failure.
 * @returns {string} the last `mergeable` value seen (`UNKNOWN` if it never settled).
 */
export function pollMergeable({
  repo, number, exec = execFileSync, sleep = blockingSleep,
  attempts = MERGEABLE_POLL_ATTEMPTS, delayMs = MERGEABLE_POLL_DELAY_MS,
}) {
  let mergeable = 'UNKNOWN';
  for (let attempt = 0; attempt < attempts && mergeable === 'UNKNOWN'; attempt += 1) {
    sleep(delayMs * 2 ** attempt);
    try {
      const out = exec('gh', ['pr', 'view', String(number), '--repo', repo, '--json', 'mergeable'], {
        encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      });
      mergeable = JSON.parse(out).mergeable || 'UNKNOWN';
    } catch { /* transient — keep the last known value and try again */ }
  }
  return mergeable;
}

export function main(args = process.argv.slice(2), { sleep, pollAttempts, pollDelayMs, unsupportedPath } = {}) {
  const requested = args.filter((arg) => arg.startsWith('--repo=')).map((arg) => arg.slice(7));
  const unsupported = readUnsupported({ path: unsupportedPath }).filter(
    (row) => !requested.length || requested.some((repo) => repoKeyForSlug(repo) === row.repo),
  );
  const report = { ready: [], pending: [], notReady: [], errors: [], unsupported };
  for (const repo of requested.length ? requested : Object.values(CONSTELLATION_REPOS).map(({ slug }) => slug)) {
    try {
      const prs = JSON.parse(execFileSync('gh', [
        'pr', 'list', '--repo', repo, '--state', 'open', '--limit', '200', '--json',
        'number,title,labels,headRefOid,mergeable,statusCheckRollup,comments',
      ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
      for (const listed of prs.filter((candidate) => hasLabel(candidate, 'review:human'))) {
        let pr = listed;
        let result = evaluatePr(pr);
        // Only a PR that would otherwise be ready is worth re-polling — one with a real failure is not-ready
        // whatever GitHub says about mergeability.
        if (result.transient) {
          pr = { ...pr, mergeable: pollMergeable({
            repo, number: pr.number, sleep, attempts: pollAttempts, delayMs: pollDelayMs,
          }) };
          result = evaluatePr(pr);
        }
        const row = { repo, number: pr.number, title: pr.title };
        if (result.ready) report.ready.push(row);
        else if (result.transient) report.pending.push(row);
        else report.notReady.push({ ...row, reasons: result.reasons });
      }
    } catch (error) {
      const detail = String(error.stderr || error.message).trim().replace(/\s+/g, ' ');
      report.errors.push(`${repo}: ${detail}`);
    }
  }
  if (args.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    for (const error of report.errors) console.error(`ERROR ${error}`);
    console.log('NEEDS YOU (review:human + advisory:accepted, all gates pass):');
    console.log(report.ready.map((pr) => `${pr.repo}#${pr.number}  ${pr.title}`).join('\n') || '(none)');
    console.log('PENDING — transient, re-run (GitHub is still computing mergeability; no agent work owed):');
    console.log(report.pending.map((pr) => `${pr.repo}#${pr.number}  ${pr.title}`).join('\n') || '(none)');
    console.log('UNSUPPORTED REPO — owed work the conveyor cannot dispatch for this repo:');
    console.log(report.unsupported.map((row) => `${row.repo}#${row.prNumber}  ${row.action}  ${row.why}`).join('\n') || '(none)');
    console.log('NOT READY — agent work (review:human but gates fail):');
    console.log(report.notReady.map((pr) => `${pr.repo}#${pr.number}  ${pr.reasons.join('; ')}`).join('\n') || '(none)');
  }
}

/** True when this module is the CLI entry, even if argv[1] was typed via a symlink or a doubled slash (`$TMPDIR//x`). */
export function isCliEntry(argv1 = process.argv[1], moduleUrl = import.meta.url) {
  if (!argv1) return false;
  let resolved = argv1;
  try { resolved = realpathSync(argv1); } catch { /* not on disk — compare the raw spelling */ }
  return moduleUrl === pathToFileURL(resolved).href;
}

if (isCliEntry()) main();
