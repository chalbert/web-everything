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
// #2901 — the NET two-tree diff basis. merge-ai-prs.mjs guards its CLI behind `if (IS_CLI)`, so importing
// this one function does not run the lander; the /review skill mandates the same import for the same reason.
import { computeNetDiffText } from './merge-ai-prs.mjs';
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

/**
 * Filter normalized check rows to just the REQUIRED set (#2482). Pure. WHY: the `checks=` token must answer the
 * question a reviewer actually has — "would pr-land merge this?" — and pr-land gates on `gh pr checks --required`
 * (required checks only), NOT the full rollup. `requiredNames` is the required-check name list (from
 * `gh pr checks --required --json name`); when it is a NON-array (the required set couldn't be determined — a
 * transient gh error), we CANNOT honestly narrow, so we keep every row (the historical all-checks behaviour —
 * conservative, over-reports red, never under-reports). An EMPTY array means "this PR has zero required checks" →
 * filters to `[]` → `classifyChecks`' no-checks `passed` default.
 * @param {Array<{name:string, bucket:string}>} rows - `rollupToCheckRows` output
 * @param {string[]|null|undefined} requiredNames
 * @returns {Array<{name:string, bucket:string}>}
 */
export function filterToRequired(rows, requiredNames) {
  const list = Array.isArray(rows) ? rows : [];
  if (!Array.isArray(requiredNames)) return list; // unknown required set → keep all checks (unchanged behaviour)
  const req = new Set(requiredNames.map(String));
  return list.filter((r) => req.has(String((r && r.name) || '')));
}

/**
 * Recover the check rows from a (possibly non-zero) `gh pr checks …` invocation (#2482). Pure. `gh pr checks`
 * exits NON-zero in two different situations that must be told apart:
 *   - checks still PENDING / a check FAILED — gh prints the JSON rows to stdout anyway → recover & classify them.
 *   - the PR has genuinely ZERO required checks — gh prints `no checks reported …` to stderr, no JSON → `[]`
 *     (which `classifyChecks` reads as the no-checks `passed` default, so a no-required-checks PR is green rather
 *     than a forever-pending wait — #2482 finding 3).
 * Anything else (a real gh / network error) is `unknown` — the caller keeps waiting / falls back to all-checks.
 * @param {{stdout?:string, stderr?:string, message?:string}} o
 * @returns {{rows:Array}|{unknown:true}}
 */
export function recoverCheckRows({ stdout, stderr, message } = {}) {
  const out = String(stdout || '').trim();
  if (out.startsWith('[')) {
    try { return { rows: JSON.parse(out) }; } catch { /* not valid JSON — fall through */ }
  }
  if (/no checks reported/i.test(`${stderr || ''}\n${message || ''}`)) return { rows: [] };
  return { unknown: true };
}

/**
 * Resolve a PR's REQUIRED-check name list via `gh pr checks --required --json name` (#2482). Impure only in the
 * injected `runGh` runner (so it is unit-testable with a stub); the interpretation is the pure `recoverCheckRows`.
 * Returns the name array (possibly `[]` for a no-required-checks PR), or `undefined` when the required set can't
 * be determined (a transient gh error) so the caller falls back to the historical all-checks display.
 * @param {(args:string[])=>string} runGh
 * @param {number|string} num
 * @returns {string[]|undefined}
 */
export function resolveRequiredNames(runGh, num) {
  const names = (rows) => (Array.isArray(rows) ? rows.map((r) => r && r.name).filter(Boolean) : undefined);
  try {
    return names(JSON.parse(runGh(['pr', 'checks', String(num), '--required', '--json', 'name'])));
  } catch (e) {
    const rec = recoverCheckRows({ stdout: e && e.stdout, stderr: e && e.stderr, message: e && e.message });
    return rec.rows ? names(rec.rows) : undefined;
  }
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
 * The `checks` token is over the REQUIRED set when `requiredNames` is supplied (so it matches what pr-land waits
 * for — #2482); with no `requiredNames` it degrades to the full rollup (the historical all-checks behaviour), and
 * `checksScope` records which (`'required'` vs `'all'`) so a consumer knows exactly what the token covers.
 * #2901 — `diffBasis` records WHICH diff the consumer is holding: `'net'` (the two-tree
 * `git diff <forkpoint> <head>`, what a reviewer must judge) or `'three-dot'` (`gh pr diff`, the degraded
 * fallback). A reviewer handed a three-dot diff sees files that sibling lanes already landed on `main` as though
 * this PR added them, and will faithfully report findings about code the PR does not contain — observed on
 * PR #1018, where a juror flagged an "unrelated #2457 re-scope" that is not in the diff at all. The basis must
 * therefore travel WITH the diff: a degraded basis that looks identical to a good one is how a confident,
 * well-argued, wrong finding reaches a PR author.
 * @param {{view: object, diff?: string, requiredNames?: string[]|null, diffBasis?: string}} o
 * @returns {{number:number, title:string, body:string, files:Array, state:string,
 *   checks:{status:string, reason:string}, checksScope:string, diff:string, diffBasis:string, labels:string[],
 *   reviewClass:string, headRefName:string, mergeable:string}}
 */
export function assembleParked({ view, diff, requiredNames, diffBasis } = {}) {
  const v = view || {};
  const labels = labelNames(v.labels);
  const checkRows = filterToRequired(rollupToCheckRows(v.statusCheckRollup), requiredNames);
  return {
    number: Number(v.number) || 0,
    title: String(v.title || ''),
    body: typeof v.body === 'string' ? v.body : '',
    files: Array.isArray(v.files) ? v.files : [],
    state: String(v.state || ''),
    checks: classifyChecks(checkRows),
    checksScope: Array.isArray(requiredNames) ? 'required' : 'all',
    diff: typeof diff === 'string' ? diff : '',
    // Default to the DEGRADED label, never the good one: an unstated basis must not read as a net diff.
    diffBasis: diffBasis === 'net' ? 'net' : 'three-dot',
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

  const gh = (ghArgs) => execFileSync('gh', ghArgs, {
    cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
  });

  const out = nums.map((num) => {
    try {
      const view = JSON.parse(gh([
        'pr', 'view', num, '--json',
        'number,title,body,files,state,statusCheckRollup,labels,headRefName,mergeable',
      ]));
      // #2901 — the NET two-tree diff vs CURRENT main, NOT `gh pr diff`'s three-dot merge-base diff. The
      // three-dot form lists a sibling-lane file that has since landed on main as if THIS PR added it, so a
      // reviewer grades work the PR never did. #2901 fixed this for the `/review` skill and did not touch this
      // module — which is what the converge loop reads — so the defect survived here and produced a phantom
      // finding on PR #1018 within hours. Same basis the drain's escalation SCORE uses (#2450/#2373/#2404), so
      // what a reviewer reads and what was scored cannot drift.
      let diff = '';
      let diffBasis = 'three-dot';
      const headRef = String(view.headRefName || '');
      let netFiles = null;
      if (headRef) {
        const exec = (c, a, o) => execFileSync(c, a, { cwd, maxBuffer: 64 * 1024 * 1024, ...o });
        // #1031 review, finding 4 — `scored` means only "a candidate ref RESOLVED", never "the ref is CURRENT".
        // resolveNetDiffBasis swallows its fetch error and falls through to whatever `origin/<headRef>` happens
        // to be cached, so a working gh API path plus a broken git transport would hand back a plausible OLDER
        // diff labelled `net`: the panel signs off commit A while the head is commit B, with no signal. Before
        // this block existed a diff-fetch failure produced `diff: ''`, which degrades the round to needs-human —
        // strictly safer. So prove the fetch here, and refuse the `net` label if it did not happen.
        let fetched = false;
        try { exec('git', ['fetch', '--quiet', 'origin', headRef], { stdio: ['ignore', 'pipe', 'pipe'] }); fetched = true; } catch { fetched = false; }
        const net = fetched ? computeNetDiffText({ exec, rev: headRef, fetchExtraRefs: [headRef] }) : null;
        if (net && net.scored && typeof net.text === 'string' && net.text) {
          diff = net.text; diffBasis = 'net';
          // The FILE LIST must come from the same basis as the diff — `gh pr view --json files` is three-dot too,
          // and the file list is what a juror CITES. On PR #1018 it carried 29 entries against 18 real ones and
          // the phantom finding named one of the surplus.
          //
          // #1031 review, finding 2 — do NOT source this from `computeNetDiffChangedFiles`. That returns
          // `parseNumstat` output, which is git's DISPLAY encoding: a rename renders as `a.txt => b.txt` and a
          // non-ASCII path is C-quoted (`"caf\303\251.txt"`). `gh` reports the plain new path, so the
          // intersection silently DROPS those entries — and a rename-only PR would produce a ZERO-file list
          // advertised as `net`, i.e. authoritative. That is worse than the inflated list this replaced: a
          // reviewer is told a real file is not in the PR and dismisses genuine findings on it.
          // `--name-only -z --no-renames` gives plain NUL-separated paths in every case.
          let changed = null;
          try {
            const raw = exec('git', ['diff', '--name-only', '-z', '--no-renames', '--end-of-options', `${net.base}..${net.rev}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
            changed = String(raw || '').split('\0').map((x) => x.trim()).filter(Boolean);
          } catch { changed = null; }
          // FAIL OPEN. If the intersection would lose entries the gh list has, the two sources disagree about
          // encoding or scope and we cannot say which is right — so keep the UNFILTERED list and drop back to the
          // `three-dot` label rather than present a short list as authoritative. A basis claim we cannot support
          // is the failure this whole field exists to prevent.
          if (changed && changed.length) {
            const candidate = new Set(changed.map(String));
            const ghPaths = (Array.isArray(view.files) ? view.files : []).map((x) => String(x && (x.path || x.filename)));
            const kept = ghPaths.filter((x) => candidate.has(x));
            if (kept.length >= candidate.size) netFiles = candidate;
            else diffBasis = 'three-dot';
          } else {
            diffBasis = 'three-dot';
          }
        }
      }
      // Fall back ONLY when the net basis could not be resolved (a foreign clone without the head ref, a failed
      // fetch, a diff failure). `diffBasis` then says so, so a consumer can tell a reviewer the list may be inflated.
      if (!diff) { try { diff = gh(['pr', 'diff', num]); } catch { diff = ''; } } // a diff hiccup must not drop the whole entry
      // Narrow the `checks=` token to the REQUIRED set so it matches what pr-land waits for (#2482); a gh hiccup
      // here yields `undefined` → assembleParked falls back to the all-checks display (never drops the entry).
      const requiredNames = resolveRequiredNames(gh, num);
      const scopedView = netFiles
        ? { ...view, files: (Array.isArray(view.files) ? view.files : []).filter((x) => netFiles.has(String(x && (x.path || x.filename)))) }
        : view;
      return assembleParked({ view: scopedView, diff, requiredNames, diffBasis });
    } catch (e) {
      const msg = String((e && (e.stderr || e.message)) || e).split('\n').filter(Boolean).pop() || 'gh pr view failed';
      return { number: Number(num) || 0, error: msg };
    }
  });

  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
  process.exit(0);
}
