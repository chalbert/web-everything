#!/usr/bin/env node
/**
 * @file scripts/pr-body-edit.mjs
 * @description Replace a PR body while CARRYING THE `authored-by-actor` STAMP ACROSS.
 *
 * WHY: `pr-land` writes the stamp at open and `review-independence.mjs` reads it to refuse an author clearing
 * its own PR. A raw `gh pr edit --body` replaces the whole body, dropping the stamp, and the guard then reads
 * `unknown-author` — which the invoked CLI deliberately permits. Permitting it is correct for a PR opened
 * before the stamp existed and wrong for one whose stamp was stripped, and after the fact nothing can tell
 * those apart. Keeping the stamp is what preserves the distinction.
 *
 * `guard-bash.mjs` denies the raw command and points here.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { readAuthorActorStamps, buildAuthorActorMarker } from './lib/review-independence.mjs';
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

function main(argv) {
  const arg = (n) => (argv.find((a) => a.startsWith(`--${n}=`)) || '').split('=').slice(1).join('=');
  const pr = arg('pr');
  const file = arg('body-file');
  const repo = arg('repo');
  if (!pr || !file) {
    writeLineSync(2, 'usage: pr-body-edit.mjs --pr=<n> --body-file=<path> [--repo=<owner/name>]');
    return 2;
  }
  const gh = (args) => execFileSync('gh', repo ? [...args, '--repo', repo] : args, { encoding: 'utf8' });
  const current = JSON.parse(gh(['pr', 'view', pr, '--json', 'body'])).body || '';
  const { body, carried } = withCarriedStamps(current, readFileSync(file, 'utf8'));
  // Hand the body via stdin-backed file rather than argv: a long body overflows the arg limit.
  execFileSync('gh', ['pr', 'edit', pr, '--body-file', '-', ...(repo ? ['--repo', repo] : [])],
    { input: body, encoding: 'utf8', env: { ...process.env, PR_BODY_STAMP_OK: '1' } });
  writeLineSync(1, carried.length
    ? `pr-body-edit: #${pr} updated; carried ${carried.length} author stamp(s) across`
    : `pr-body-edit: #${pr} updated; no stamp to carry (body had none)`);
  return 0;
}

// `process.exitCode =`, not `process.exit()` — #3061's `exit-wraps-call` shape discards the callee's flush.
if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = main(process.argv.slice(2));
