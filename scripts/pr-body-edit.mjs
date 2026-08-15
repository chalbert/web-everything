#!/usr/bin/env node
/**
 * @file scripts/pr-body-edit.mjs
 * @description Replace a PR body while CARRYING THE `authored-by-actor` STAMP ACROSS — and, with `--repair`,
 *   RESTORE a stamp a body has already lost, from ROUTES no shell guard can reach (the web UI included).
 *
 * WHY (the base `--body-file` mode): `pr-land` writes the stamp at open and `review-independence.mjs` reads it
 * to refuse an author clearing its own PR. A raw `gh pr edit --body` replaces the whole body, dropping the
 * stamp, and the guard then reads `unknown-author` — which the invoked CLI deliberately permits. Permitting it
 * is correct for a PR opened before the stamp existed and wrong for one whose stamp was stripped, and after the
 * fact nothing can tell those apart. Keeping the stamp is what preserves the distinction.
 *
 * `guard-bash.mjs` denies the raw command and points here.
 *
 * WHY `--repair` (#3067): the carry-forward above only helps a body edited THROUGH this tool. A body edited in
 * the GitHub web UI — the one route no shell guard can intercept — loses its stamp with nothing here ever
 * observing the edit. But GitHub keeps its OWN record of it: the issue/PR timeline API's `edited` events carry
 * `changes.body.from`, the body as it stood immediately before each edit, REGARDLESS of what wrote the edit
 * (`gh`, the API, or the web UI — GitHub does not distinguish). `--repair` walks that timeline looking for the
 * stamp the live body no longer has. Recoverable → carried across, same as the base mode. Not recoverable (no
 * stamp anywhere in the history GitHub kept, or conflicting ids across it) → the PR is marked with
 * `STAMP_LOST_MARKER` instead of silently staying `unknown-author`, so a reader — and, once wired,
 * `review-independence.mjs`'s decider — sees "stripped and unrecoverable", not "predates the stamp regime".
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import {
  readAuthorActorStamps, buildAuthorActorMarker, hasStampLostMarker, buildStampLostMarker,
} from './lib/review-independence.mjs';
// #3061 — `process.exit()` discards a buffered `process.stdout.write`. This script exits on the value of
// `main()`, which is the shape that truncates most reliably.
import { writeLineSync } from './lib/write-all-sync.mjs';

/**
 * The body to write: `next`, plus the stamps `current` carried that `next` lacks.
 *
 * Carries EVERY distinct stamp, not just one. `parseAuthorActorId` resolves a two-stamp body to '' on purpose
 * (agreement-or-nothing), so dropping one here would silently convert an ambiguous body into a confident
 * single-author one — turning a refusal into a permit. Pure.
 *
 * @param {string} current - the body now on the PR.
 * @param {string} next - the replacement body.
 * @returns {{body: string, carried: string[]}}
 */
export function withCarriedStamps(current, next) {
  const have = new Set(readAuthorActorStamps(next));
  const carried = readAuthorActorStamps(current).filter((id) => !have.has(id));
  if (!carried.length) return { body: next, carried: [] };
  const markers = carried.map(buildAuthorActorMarker).filter(Boolean);
  return { body: `${next.replace(/\s*$/, '')}\n\n${markers.join('\n')}\n`, carried };
}

/**
 * #3067's RECOVERY — find the author stamp GitHub's own edit history still remembers, when the LIVE body has
 * none. `fromBodies` is every prior body state the caller read off the PR's timeline (`changes.body.from` of
 * each `edited` event, oldest or newest order does not matter — every one is scanned). Pure.
 *
 * AGREEMENT-OR-NOTHING, same discipline as `parseAuthorActorId` and for the same reason: if the history shows
 * two DIFFERENT ids across its edits (a re-authored PR, or a forge attempt) there is no honest basis to pick
 * one, so this answers '' rather than guess — the caller then has no choice but to mark the PR stamp-lost
 * rather than silently attribute it to whichever id happened to survive.
 *
 * @param {string[]} fromBodies - prior body snapshots, in any order.
 * @returns {string} the single id every stamped snapshot agrees on, or '' when none/ambiguous.
 */
export function recoverAuthorIdFromHistory(fromBodies) {
  const ids = new Set();
  for (const body of Array.isArray(fromBodies) ? fromBodies : []) {
    for (const id of readAuthorActorStamps(body)) ids.add(id);
  }
  return ids.size === 1 ? [...ids][0] : '';
}

/** Write `body` back to the PR — same stdin-backed, sanctioned-override edit both modes below use. Shared so
 *  neither mode can drift on how the write actually happens.
 *
 *  `execFile` defaults to the real `execFileSync` and is only ever overridden by a test — real callers never
 *  pass it, so this default IS production behavior, not a seam that could silently diverge from it. */
function writeBody(pr, repo, body, execFile = execFileSync) {
  execFile('gh', ['pr', 'edit', pr, '--body-file', '-', ...(repo ? ['--repo', repo] : [])],
    { input: body, encoding: 'utf8', env: { ...process.env, PR_BODY_STAMP_OK: '1' } });
}

/**
 * #3067 — `--repair`: no `--body-file` is given; the LIVE body is read, and if it already carries no stamp, its
 * GitHub timeline (`issues/<n>/timeline`, which records `edited` events with `changes.body.from` — a PR is an
 * issue under the hood, and GitHub does not care whether the edit came from `gh`, the REST/GraphQL API, or the
 * web UI) is searched for one. Recovered → carried onto the live body, same shape as the base mode. Not
 * recovered → the PR is marked `STAMP_LOST_MARKER` (idempotent — a PR already marked is left alone) so a reader
 * sees "stripped and unrecoverable" rather than silently re-reading as `unknown-author`.
 *
 * The timeline FETCH failing (network blip, rate limit, transient auth error, 5xx) is deliberately NOT treated
 * as "timeline searched, nothing found": `stampLostMarked` is a durable, sticky mark — this function's own first
 * check short-circuits on it, so a false mark from a transient failure would never get retried, and a human
 * would have to notice and manually strip it. So a thrown/failed fetch exits non-zero with a distinct
 * "could not investigate" outcome and writes NOTHING; only a fetch that actually SUCCEEDED (even to an
 * honestly empty `[]`) may reach the stamp-lost write below.
 *
 * `execFile` (default: the real `execFileSync`) is the injectable seam a test overrides to stub the timeline
 * fetch and the body write without touching the real `gh` binary — the same shape `computeNetDiffChangedFiles`'s
 * `exec` parameter uses elsewhere in scripts/, not a bespoke pattern for this file.
 */
export function repair(gh, pr, repo, execFile = execFileSync) {
  const current = JSON.parse(gh(['pr', 'view', pr, '--json', 'body'])).body || '';
  if (readAuthorActorStamps(current).length) {
    writeLineSync(1, `pr-body-edit: #${pr} already stamped — nothing to repair`);
    return 0;
  }
  if (hasStampLostMarker(current)) {
    writeLineSync(1, `pr-body-edit: #${pr} already marked stamp-lost — nothing to repair`);
    return 0;
  }
  // The timeline endpoint is queried by a fully-qualified `owner/repo` path, never via the `gh()` wrapper's
  // `--repo` flag (that flag is for `gh pr`/`gh issue` shorthand; `gh api` takes the slug in the path itself).
  const slug = repo || JSON.parse(gh(['repo', 'view', '--json', 'nameWithOwner'])).nameWithOwner;
  let events;
  try {
    // `per_page=100` covers every realistic PR's edit count in one page — a best-effort recovery step, not a
    // security boundary: missing an edit only means falling through to the stamp-lost mark below, never a
    // false positive recovery. But the CALL ITSELF failing (thrown here, e.g. a non-zero `gh` exit or bad JSON)
    // is a DIFFERENT outcome from "the call succeeded and returned an empty timeline" — see the function doc.
    events = JSON.parse(execFile('gh', ['api', `repos/${slug}/issues/${pr}/timeline?per_page=100`],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
  } catch (err) {
    writeLineSync(2, `pr-body-edit: #${pr} could not investigate — the timeline fetch failed `
      + `(${err && err.message ? err.message : err}); re-run --repair once the failure clears. `
      + 'NOT marking stamp-lost (#3067 r2).');
    return 1;
  }
  const fromBodies = (Array.isArray(events) ? events : [])
    .filter((e) => e && e.event === 'edited' && e.changes && typeof e.changes.body?.from === 'string')
    .map((e) => e.changes.body.from);
  const recovered = recoverAuthorIdFromHistory(fromBodies);
  if (recovered) {
    const { body } = withCarriedStamps(buildAuthorActorMarker(recovered), current);
    writeBody(pr, repo, body, execFile);
    writeLineSync(1, `pr-body-edit: #${pr} repaired — restored the stamp for ${recovered}, recovered from `
      + `${fromBodies.length} prior body snapshot(s) in the PR's timeline`);
    return 0;
  }
  writeBody(pr, repo, `${current.replace(/\s*$/, '')}\n\n${buildStampLostMarker()}\n`, execFile);
  writeLineSync(1, `pr-body-edit: #${pr} marked stamp-lost — no authored-by-actor stamp recoverable from `
    + `${fromBodies.length} prior body snapshot(s); the clear must now refuse rather than tolerate this as `
    + 'unknown-author (#3067)');
  return 0;
}

function main(argv) {
  const arg = (n) => (argv.find((a) => a.startsWith(`--${n}=`)) || '').split('=').slice(1).join('=');
  const pr = arg('pr');
  const file = arg('body-file');
  const repo = arg('repo');
  const gh = (args) => execFileSync('gh', repo ? [...args, '--repo', repo] : args, { encoding: 'utf8' });
  if (argv.includes('--repair')) {
    if (!pr) {
      writeLineSync(2, 'usage: pr-body-edit.mjs --pr=<n> --repair [--repo=<owner/name>]');
      return 2;
    }
    if (file) {
      writeLineSync(2, 'pr-body-edit: --repair and --body-file are mutually exclusive');
      return 2;
    }
    return repair(gh, pr, repo);
  }
  if (!pr || !file) {
    writeLineSync(2, 'usage: pr-body-edit.mjs --pr=<n> --body-file=<path> [--repo=<owner/name>]\n'
      + '   or: pr-body-edit.mjs --pr=<n> --repair [--repo=<owner/name>]');
    return 2;
  }
  const current = JSON.parse(gh(['pr', 'view', pr, '--json', 'body'])).body || '';
  const { body, carried } = withCarriedStamps(current, readFileSync(file, 'utf8'));
  // Hand the body via stdin-backed file rather than argv: a long body overflows the arg limit.
  writeBody(pr, repo, body);
  writeLineSync(1, carried.length
    ? `pr-body-edit: #${pr} updated; carried ${carried.length} author stamp(s) across`
    : `pr-body-edit: #${pr} updated; no stamp to carry (body had none)`);
  return 0;
}

// `process.exitCode =`, not `process.exit()` — #3061's `exit-wraps-call` shape discards the callee's flush.
if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = main(process.argv.slice(2));
