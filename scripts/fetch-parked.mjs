#!/usr/bin/env node
/**
 * fetch-parked.mjs — dump a stable per-PR review bundle reviewers currently hand-assemble from scattered `gh`
 * calls (#2434, one of three drain fetch/state helpers under `scripts/`).
 *
 * WHY: when the drain parks a PR for review, a reviewer re-derives the same shape by hand — `gh pr view` for the
 * body/files/state/labels, `gh pr checks` (or the rollup) for green/red, `gh pr diff` for the change — across
 * one or several PR numbers. This is the ONE read-only tool that emits that bundle as a stable JSON array, so
 * the console / reviewer reads one shape, never re-invents the plumbing.
 *
 * Split mirrors the house idiom (`scripts/review-detail.mjs`, `scripts/push-if-green.mjs`): a PURE
 * `assembleParked({view, diff})` distills an already-parsed `gh pr view … --json` object plus the raw diff into
 * the contract; a thin impure CLI does the two `gh` calls per PR and prints. Green/red is single-sourced through
 * `classifyChecks` from `./pr-land.mjs` (the SAME truth pr-land waits for) — the rollup is first normalized to
 * the `gh pr checks` bucket shape classifyChecks reads (`rollupToCheckRows`). Review class reuses
 * `REVIEW_LABELS`/`hasReviewLabel` from `./lib/review-escalation.mjs`.
 *
 * Usage:
 *   node scripts/fetch-parked.mjs 472 471            # JSON array, one entry per PR (default — this is a data tool)
 *   node scripts/fetch-parked.mjs 12 --repo=~/workspace/frontierui   # run gh in another repo's checkout (couples span repos)
 *   node scripts/fetch-parked.mjs 472 --json         # explicit; identical to the default
 *
 * Flags:
 *   <num…>          one or more PR numbers (positional)
 *   --repo=<path>   filesystem checkout to run gh in (default: cwd) — PRs may live in WE/frontierui/plateau-app
 *   --json          emit the JSON array (default; the flag is accepted for symmetry with the other helpers)
 *
 * Tolerant of a missing PR: emits an `{number, error}` entry for it and continues the batch (never crashes).
 * Exit 0 always when at least one number was given; 2 on a usage error (no numbers).
 */
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { classifyChecks } from './pr-land.mjs';
import { REVIEW_LABELS, hasReviewLabel } from './lib/review-escalation.mjs';

/** Map a raw `gh` labels array (objects `{name}` or strings) to a plain name array. Pure, tolerant of absent. */
export function labelNames(labels) {
  return (Array.isArray(labels) ? labels : [])
    .map((l) => (typeof l === 'string' ? l : l && l.name))
    .filter(Boolean);
}

/**
 * Normalize a `gh pr view --json statusCheckRollup` array into the `{name, bucket}` row shape `classifyChecks`
 * reads. Pure. WHY: `classifyChecks` was built for `gh pr checks --json …bucket` output (rows carry a `bucket`
 * ∈ pass|fail|pending|skipping|cancel); a rollup row is instead a GraphQL `CheckRun` (`status`/`conclusion`, no
 * `bucket`/`state`) or `StatusContext` (`state`), so feeding the raw rollup would misread every check as passed.
 * This maps each rollup row to gh's own bucket vocabulary so `classifyChecks` stays the single green/red truth.
 * Tolerant of an absent/odd rollup (→ []).
 * @param {Array<object>|null|undefined} rollup
 * @returns {Array<{name:string, bucket:string}>}
 */
export function rollupToCheckRows(rollup) {
  const rows = Array.isArray(rollup) ? rollup : [];
  return rows.map((c) => {
    const name = String((c && (c.name || c.context)) || '');
    let bucket;
    if (c && c.status != null && String(c.status).toUpperCase() !== 'COMPLETED') {
      // A CheckRun still in flight (QUEUED / IN_PROGRESS / WAITING / PENDING / REQUESTED).
      bucket = 'pending';
    } else {
      const verdict = String((c && (c.conclusion || c.state)) || '').toUpperCase();
      switch (verdict) {
        case 'SUCCESS':
        case 'EXPECTED':
          bucket = 'pass'; break;
        case 'SKIPPED':
        case 'NEUTRAL':
          bucket = 'skipping'; break;
        case 'CANCELLED':
        case 'STALE':
          bucket = 'cancel'; break;
        case 'FAILURE':
        case 'ERROR':
        case 'TIMED_OUT':
        case 'ACTION_REQUIRED':
        case 'STARTUP_FAILURE':
          bucket = 'fail'; break;
        case 'PENDING':
        case '':
          bucket = 'pending'; break;
        default:
          bucket = 'fail'; // an unknown terminal conclusion is treated as red, never silently green
      }
    }
    return { name, bucket };
  });
}

/** The review class a PR's labels put it in — reuses the ratified `REVIEW_LABELS` (never re-hardcodes the
 *  strings). Pure. `human` (a human must clear it) wins over `pending` (an independent review is owed). */
export function reviewClassFromLabels(labels) {
  if (hasReviewLabel(labels, REVIEW_LABELS.human)) return 'human';
  if (hasReviewLabel(labels, REVIEW_LABELS.pending)) return 'pending';
  return 'none';
}

/**
 * The PURE per-PR bundle assembler (#2434). Takes an already-parsed `gh pr view … --json` object and the raw
 * `gh pr diff` text, returns the stable contract reviewers read. Never throws on a missing field — an absent
 * rollup → `checks.status:'passed'` (classifyChecks' no-checks default), absent labels → `[]`, etc.
 * @param {{view: object, diff?: string}} o
 * @returns {{number:number, title:string, body:string, files:Array, state:string,
 *   checks:{status:string, reason:string}, diff:string, labels:string[], reviewClass:string,
 *   headRefName:string, mergeable:string}}
 */
export function assembleParked({ view, diff } = {}) {
  const v = view || {};
  const labels = labelNames(v.labels);
  return {
    number: Number(v.number) || 0,
    title: String(v.title || ''),
    body: typeof v.body === 'string' ? v.body : '',
    files: Array.isArray(v.files) ? v.files : [],
    state: String(v.state || ''),
    checks: classifyChecks(rollupToCheckRows(v.statusCheckRollup)),
    diff: typeof diff === 'string' ? diff : '',
    labels,
    reviewClass: reviewClassFromLabels(labels),
    headRefName: String(v.headRefName || ''),
    mergeable: String(v.mergeable || ''),
  };
}

// Allow importing the pure assembler without running the CLI (the test file + pr-state.mjs import this module).
const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (IS_CLI) runCli();

function runCli() {
  const args = process.argv.slice(2);
  const expandHome = (p) => (p && p.startsWith('~') ? join(homedir(), p.slice(1)) : p);
  const repoFlag = (args.find((a) => a.startsWith('--repo=')) || '').slice('--repo='.length);
  const cwd = repoFlag ? resolve(expandHome(repoFlag)) : process.cwd();
  const nums = args.filter((a) => /^\d+$/.test(a));

  if (nums.length === 0) {
    process.stdout.write(`${JSON.stringify({ error: 'usage: fetch-parked <num…> [--repo=<path>] [--json]' })}\n`);
    process.exit(2);
  }

  const gh = (ghArgs) => execFileSync('gh', ghArgs, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

  const out = nums.map((num) => {
    try {
      const view = JSON.parse(gh([
        'pr', 'view', num, '--json',
        'number,title,body,files,state,statusCheckRollup,labels,headRefName,mergeable',
      ]));
      let diff = '';
      try { diff = gh(['pr', 'diff', num]); } catch { diff = ''; } // a diff hiccup must not drop the whole entry
      return assembleParked({ view, diff });
    } catch (e) {
      const msg = String((e && (e.stderr || e.message)) || e).split('\n').filter(Boolean).pop() || 'gh pr view failed';
      return { number: Number(num) || 0, error: msg };
    }
  });

  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
  process.exit(0);
}
