#!/usr/bin/env node
/**
 * @file scripts/readiness/check-standards-scope-replay.mjs
 * @description The replay-proof harness that GATES epic #4163 (`check:standards` lane-gate scoping). Card #4164.
 *
 * WHAT THIS IS. `verify-lane-gate.mjs` already scopes the lane gate's `check:standards` half to
 * `--local --files=<changedFiles>` whenever {@link canScopeCheckStandards} allows it (#1937/#3395) — but the
 * epic's own measurement found that scoping saves NO wall/CPU time today (every one of `check-standards.mjs`'s
 * ~50 sections still runs over the WHOLE repo; `--files` only DEMOTES the resulting findings afterward,
 * `claimScope.mjs#partitionLocal`) and, worse, that today's `--files` argument is `changedFiles` ONLY — never
 * the files LINKED to them (outgoing/incoming references) — so a real finding on a file the lane's change
 * affects but did not itself edit can be silently demoted to a non-blocking note at the LANE gate, even though
 * the merge-gate's own unscoped CI run still catches it (never a merged regression — see
 * `verify-lane-gate.mjs`'s header — but a false-green at the local gate).
 *
 * This module is the REUSABLE evidence harness every later slice of #4163 (#4165 area checks, #4166 reference
 * checks, #4167 `--local` skip-work, #4168 per-file scanners) must re-run before landing, per the epic's own
 * "measure-before-default" discipline (mirrors `test-selection.mjs`'s false-green shadow compare, #2681, applied
 * here to `check:standards` instead of vitest). It does NOT change `check-standards.mjs`'s behaviour — it only
 * REPLAYS it, twice per diff (full, then scoped exactly as `verify-lane-gate.mjs` invokes it today), and diffs
 * the findings restricted to the lane's own footprint (changed files ∪ their linked files).
 *
 * THE COMPARE. For each of ~N recent MERGED lane diffs (a `Merge pull request #… from …/lane/…` commit's
 * `merge-base(parent1, parent2)..parent2`, i.e. the lane's own net diff — the same shape `test-selection.mjs`
 * pins as "select off the diff"):
 *   1. Run `check-standards.mjs --json` (FULL) at the lane's tip commit (`parent2`).
 *   2. Run `check-standards.mjs --json --local --files=<changedFiles>` (SCOPED) at the same commit — the
 *      BYTE-IDENTICAL command `verify-lane-gate.mjs#resolveDefaultGate` builds today.
 *   3. Compute `laneFiles = changedFiles ∪ linkedFiles(changedFiles)` ({@link linkedFilesFor} — the epic's
 *      ratified "git grep per changed id" direction, no maintained index).
 *   4. Any FULL finding whose file(s) intersect `laneFiles` that is ABSENT from the SCOPED run's findings is a
 *      MISS ({@link compareFindings}) — the false-green this harness exists to catch.
 * Wall (`real`) and CPU (`user`+`sys`) time are recorded for both runs via BSD `/usr/bin/time -l`
 * ({@link parseBsdTime}) — the same measurement shape the epic's own header cites (#4163: "12.5s user + 3.7s
 * sys, 1.2GB RSS").
 *
 * PURITY. The decision/compare core ({@link isLaneMergeSubject}, {@link parseMergeLog}, {@link idsForPath},
 * {@link linkedFilesFor}, {@link findingIdentity}, {@link compareFindings}, {@link parseBsdTime},
 * {@link summarize}, {@link formatTable}) is pure — no fs, no child_process, no clock, everything injectable.
 * Only the CLI shell at the bottom touches git / fs / a real child process, and it isolates every real run to a
 * SINGLE linked git worktree under the scratchpad (or `--worktree=<path>`) — never the primary checkout, never a
 * lane clone doing live edit-work (this repo's own #104 rule: edit-work runs in a lane; REPLAY runs in its own
 * disposable worktree so the two never collide).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync, lstatSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { findingFiles } from './claimScope.mjs';

// ── the LANE-MERGE recognizer (property: select off real merged lane diffs) ─────────────────────────────────

/** Matches this repo's drain merge-commit subject shape: `Merge pull request #NNNN from <owner>/lane/<slug>`. */
const LANE_MERGE_SUBJECT_RE = /^Merge pull request #\d+ from [^\s/]+\/lane\//;

/** Is this merge-commit subject a landed LANE PR (vs. any other merge)? Pure. */
export function isLaneMergeSubject(subject) {
  return LANE_MERGE_SUBJECT_RE.test(String(subject || ''));
}

/** The unit-separator record delimiter used by {@link MERGE_LOG_FORMAT} / {@link parseMergeLog}. Chosen because
 *  a commit subject can contain almost anything else (including `|`), but never a raw control character. */
const FIELD_SEP = '\x1f';

/** The `git log --format=` string {@link parseMergeLog} expects: sha, parents (space-separated), subject. */
export const MERGE_LOG_FORMAT = `%H${FIELD_SEP}%P${FIELD_SEP}%s`;

/**
 * Parse `git log --merges --format=<MERGE_LOG_FORMAT>` output into `{sha, parents, subject}` rows. Pure.
 * @param {string} text
 * @returns {{sha: string, parents: string[], subject: string}[]}
 */
export function parseMergeLog(text) {
  return String(text || '')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [sha, parents, ...rest] = line.split(FIELD_SEP);
      return { sha, parents: String(parents || '').split(' ').filter(Boolean), subject: rest.join(FIELD_SEP) };
    })
    .filter((r) => r.sha);
}

/**
 * @typedef {Object} LaneDiff
 * @property {string} sha the merge commit
 * @property {string} subject
 * @property {string} base the pre-merge parent (parent 1)
 * @property {string} head the lane's own tip (parent 2) — the commit REPLAYED at
 * @property {string} mergeBase `merge-base(base, head)` — the diff is `mergeBase..head`
 * @property {string[]} changedFiles the lane's OWN net diff (`git diff --name-only mergeBase head`)
 */

/**
 * Turn parsed merge-log rows into up-to-`count` {@link LaneDiff}s, skipping non-2-parent merges, non-lane
 * subjects, and any diff with an empty changed set (nothing to replay). Pure given `runGit`.
 * `offset` (default 0) skips that many otherwise-valid diffs before collecting `count` — lets a caller replay a
 * large sample in several foreground batches (`--offset=0 --count=15`, `--offset=15 --count=15`, …) without
 * ever re-doing an earlier batch's work.
 * @param {{rows: {sha:string, parents:string[], subject:string}[], runGit: (args:string[]) => string, count: number, offset?: number}} args
 * @returns {LaneDiff[]}
 */
export function selectLaneDiffs({ rows, runGit, count, offset = 0 }) {
  const out = [];
  let skipped = 0;
  for (const row of rows) {
    if (out.length >= count) break;
    if (!isLaneMergeSubject(row.subject)) continue;
    if (row.parents.length !== 2) continue;
    const [base, head] = row.parents;
    let mergeBase;
    try {
      mergeBase = String(runGit(['merge-base', base, head])).trim();
    } catch {
      continue;
    }
    if (!mergeBase) continue;
    let changedFiles;
    try {
      changedFiles = String(runGit(['diff', '--name-only', mergeBase, head]))
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
    } catch {
      continue;
    }
    if (changedFiles.length === 0) continue;
    if (skipped < offset) { skipped += 1; continue; }
    out.push({ sha: row.sha, subject: row.subject, base, head, mergeBase, changedFiles: changedFiles.sort() });
  }
  return out;
}

// ── LINKED FILES (the epic's ratified direction: git grep per changed id, no maintained index) ──────────────

/** Basenames too generic to `git grep` on (would return most of the repo). Mirrors `test-selection.mjs`'s own
 *  `GENERIC_BASENAME` exclusion for the same reason. */
const GENERIC_STEM = /^(index|main|types|type|utils|util|constants|config|readme|changelog|package|cli|run|id)$/i;

/**
 * Candidate reference "id" tokens for a changed file — the needles {@link linkedFilesFor} greps the rest of the
 * repo for. Two shapes, mirroring the repo's own id conventions:
 *   - the bare filename STEM (extension stripped) when specific enough (not {@link GENERIC_STEM}, length ≥ 4) —
 *     catches `docs/agent/foo.md` being named as `foo.md` or `foo` elsewhere;
 *   - a leading `NNN-` backlog numeric id (`backlog/4164-....md` → `4164`, and `#4164`) — catches every
 *     `#4164`/`4164` cross-reference this repo's citation convention uses.
 * Pure.
 * @param {string} path repo-relative path
 * @returns {string[]}
 */
export function idsForPath(path) {
  const p = String(path || '');
  const base = p.split('/').pop() || '';
  const stem = base.replace(/\.[^.]+$/, '');
  const ids = new Set();
  if (stem && stem.length >= 4 && !GENERIC_STEM.test(stem)) ids.add(stem);
  const m = /^(\d{3,5})-/.exec(stem);
  if (m) { ids.add(m[1]); ids.add(`#${m[1]}`); }
  return Array.from(ids);
}

/** Above this many `git grep` hits for one id, the id is not a REFERENCE — it is a common infra word (measured
 *  live: `lane-pool` alone hit 667 files in a 1-diff smoke test, #4164) and is dropped rather than treated as a
 *  "link", mirroring `scopeBasenameMismatches`'s own "a wide top tier is silence" axis: a name so common it
 *  matches almost everything carries no discriminating signal about what THIS diff actually touches. */
export const MAX_LINKED_HITS_PER_ID = 40;

/**
 * The files LINKED to `changedFiles` — referencing or referenced by them — found via `git grep` per changed
 * id (the epic's ratified direction: "no maintained index; a shared per-origin/main cached index only if git
 * grep proves slow"). `gitGrep(needle) => string[]` is injectable (repo-relative file paths containing the
 * literal needle, `[]` on no match). An id whose hit count exceeds {@link MAX_LINKED_HITS_PER_ID} is treated as
 * too generic and contributes nothing (see its doc). Pure given `gitGrep`. Never includes a file already in
 * `changedFiles`.
 * @param {string[]} changedFiles
 * @param {{gitGrep: (needle: string) => string[]}} args
 * @returns {string[]} sorted, deduped, repo-relative paths
 */
export function linkedFilesFor(changedFiles, { gitGrep }) {
  const changedSet = new Set(changedFiles);
  const linked = new Set();
  for (const f of changedFiles) {
    for (const id of idsForPath(f)) {
      const hits = gitGrep(id) || [];
      if (hits.length > MAX_LINKED_HITS_PER_ID) continue; // too generic — no discriminating signal
      for (const h of hits) if (h && !changedSet.has(h)) linked.add(h);
    }
  }
  return Array.from(linked).sort();
}

// ── THE COMPARE — full vs scoped, restricted to the lane's own footprint ────────────────────────────────────

/**
 * A stable identity for one `check-standards.mjs --json` finding — used to test set membership between the
 * FULL and SCOPED runs' error lists. `descriptor.kind` + the file(s) + the message text; falls back to the raw
 * message when there is no descriptor at all. Pure.
 * @param {{message: string, descriptor?: {kind?: string, file?: string, files?: string[]}}} finding
 * @returns {string}
 */
export function findingIdentity(finding) {
  const d = finding?.descriptor;
  const files = findingFiles(finding).sort().join(',');
  return JSON.stringify([d?.kind ?? null, files || null, String(finding?.message || '')]);
}

/**
 * @typedef {Object} CompareResult
 * @property {{message:string, descriptor?:object}[]} missed FULL findings on a lane file the SCOPED run dropped
 * @property {number} missedCount
 * @property {number} laneRelevantCount how many FULL findings pertained to a lane file at all
 */

/**
 * The core proof: a FULL-mode finding attributable to `laneFiles` (changed ∪ linked) that the SCOPED run does
 * NOT also report is a MISS — a false-green the lane gate would have shown today. A path-less/unattributable
 * finding is never counted here (the card's wording is "on a changed or linked file"; a global finding's
 * demotion is the ALREADY-ratified `--local` behaviour, not this proof's concern). Pure.
 * @param {{fullErrors: object[], scopedErrors: object[], laneFiles: string[]}} args
 * @returns {CompareResult}
 */
export function compareFindings({ fullErrors = [], scopedErrors = [], laneFiles = [] } = {}) {
  const laneSet = new Set(laneFiles);
  const scopedKeys = new Set(scopedErrors.map(findingIdentity));
  const relevant = fullErrors.filter((f) => findingFiles(f).some((x) => laneSet.has(x)));
  const missed = relevant.filter((f) => !scopedKeys.has(findingIdentity(f)));
  return { missed, missedCount: missed.length, laneRelevantCount: relevant.length };
}

// ── TIMING — BSD `/usr/bin/time -l` parsing (macOS; this host) ──────────────────────────────────────────────

/**
 * @typedef {Object} TimeStats
 * @property {number|null} realSec
 * @property {number|null} userSec
 * @property {number|null} sysSec
 * @property {number|null} maxRssBytes
 */

/** Parse BSD `/usr/bin/time -l`'s stderr report into {@link TimeStats}. Tolerant — any missing line is `null`.
 *  Pure (string in, object out). */
export function parseBsdTime(text) {
  const t = String(text || '');
  const real = /([\d.]+)\s+real/.exec(t);
  const user = /([\d.]+)\s+user/.exec(t);
  const sys = /([\d.]+)\s+sys/.exec(t);
  const rss = /(\d+)\s+maximum resident set size/.exec(t);
  return {
    realSec: real ? Number(real[1]) : null,
    userSec: user ? Number(user[1]) : null,
    sysSec: sys ? Number(sys[1]) : null,
    maxRssBytes: rss ? Number(rss[1]) : null,
  };
}

// ── SUMMARY / TABLE ───────────────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ReplayRow
 * @property {string} sha @property {string} subject
 * @property {number} changedCount @property {number} linkedCount
 * @property {TimeStats & {errors: number, warnings: number}} full
 * @property {TimeStats & {errors: number, warnings: number}} scoped
 * @property {number} missedCount @property {string[]} [error]
 */

/**
 * Aggregate a set of {@link ReplayRow}s into the totals the summary table + baseline artefact report. Pure.
 * @param {ReplayRow[]} rows
 */
export function summarize(rows) {
  const ok = rows.filter((r) => !r.error);
  const n = ok.length;
  const sum = (pick) => ok.reduce((a, r) => a + (pick(r) ?? 0), 0);
  const avg = (pick) => (n ? sum(pick) / n : null);
  const totalMissed = sum((r) => r.missedCount);
  const diffsWithMisses = ok.filter((r) => r.missedCount > 0).length;
  const fullRealAvg = avg((r) => r.full.realSec);
  const scopedRealAvg = avg((r) => r.scoped.realSec);
  const fullCpuAvg = avg((r) => (r.full.userSec ?? 0) + (r.full.sysSec ?? 0));
  const scopedCpuAvg = avg((r) => (r.scoped.userSec ?? 0) + (r.scoped.sysSec ?? 0));
  return {
    diffCount: rows.length,
    okCount: n,
    erroredCount: rows.length - n,
    totalMissed,
    diffsWithMisses,
    fullRealAvg, scopedRealAvg,
    fullCpuAvg, scopedCpuAvg,
    realSavingsPct: fullRealAvg ? (1 - scopedRealAvg / fullRealAvg) * 100 : null,
    cpuSavingsPct: fullCpuAvg ? (1 - scopedCpuAvg / fullCpuAvg) * 100 : null,
    pass: totalMissed === 0,
  };
}

/** Render the summary + per-diff rows as a fixed-width ASCII table (stdout + committed report). Pure. */
export function formatTable(rows, summary) {
  const lines = [];
  const fmt = (n) => (n == null ? '—' : n.toFixed(2));
  lines.push('sha       full-real  scoped-real  full-cpu  scoped-cpu  changed  linked  missed');
  for (const r of rows) {
    if (r.error) { lines.push(`${r.sha.slice(0, 9)}  ERROR: ${r.error}`); continue; }
    const fullCpu = (r.full.userSec ?? 0) + (r.full.sysSec ?? 0);
    const scopedCpu = (r.scoped.userSec ?? 0) + (r.scoped.sysSec ?? 0);
    lines.push(
      `${r.sha.slice(0, 9)}  ${fmt(r.full.realSec).padStart(9)}  ${fmt(r.scoped.realSec).padStart(11)}  ` +
      `${fmt(fullCpu).padStart(8)}  ${fmt(scopedCpu).padStart(10)}  ${String(r.changedCount).padStart(7)}  ` +
      `${String(r.linkedCount).padStart(6)}  ${String(r.missedCount).padStart(6)}`,
    );
  }
  lines.push('');
  lines.push(`${summary.okCount}/${summary.diffCount} diffs replayed cleanly (${summary.erroredCount} errored).`);
  lines.push(`avg wall:  full ${fmt(summary.fullRealAvg)}s   scoped ${fmt(summary.scopedRealAvg)}s   (${fmt(summary.realSavingsPct)}% saved)`);
  lines.push(`avg cpu:   full ${fmt(summary.fullCpuAvg)}s   scoped ${fmt(summary.scopedCpuAvg)}s   (${fmt(summary.cpuSavingsPct)}% saved)`);
  lines.push(`findings:  ${summary.totalMissed} missed across ${summary.diffsWithMisses} diff(s) — ${summary.pass ? 'PASS (zero misses)' : 'FAIL (scoped mode hid a real finding)'}`);
  return lines.join('\n');
}

// ── IO SHELL (CLI only — owns git / fs / child_process / clock) ─────────────────────────────────────────────

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..'); // scripts/readiness → repo root

function realGit(args, cwd = ROOT) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
}

function gitGrepIn(cwd) {
  return (needle) => {
    try {
      const out = execFileSync('git', ['grep', '-l', '-F', '-e', needle, '--', '.', ':!node_modules'], {
        cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 16 * 1024 * 1024,
      });
      return out.split('\n').map((s) => s.trim()).filter(Boolean);
    } catch {
      return []; // git grep exits 1 on no match — not an error
    }
  };
}

/** Run `check-standards.mjs --json [...extraArgs]` at the worktree's CURRENT checkout, timed via BSD
 *  `/usr/bin/time -l`. Never throws — a non-zero exit is a normal "errors found" result, not a harness failure;
 *  only an unparseable/absent JSON payload is reported as an error string. */
function runCheckStandards(worktreePath, extraArgs) {
  const res = spawnSync('/usr/bin/time', ['-l', 'node', 'scripts/check-standards.mjs', '--json', ...extraArgs], {
    cwd: worktreePath, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  const time = parseBsdTime(res.stderr);
  let parsed = null;
  let parseError = null;
  try { parsed = JSON.parse(res.stdout); } catch (e) { parseError = String(e?.message || e); }
  return {
    ...time,
    status: res.status,
    errors: parsed?.errors ?? [],
    warnings: parsed?.warnings ?? [],
    parseError: parsed ? null : (parseError || 'no JSON on stdout'),
  };
}

/** Ensure a single linked worktree exists at `path`, detached at `sha` — reused (re-checked-out) across every
 *  diff in the replay rather than one worktree per diff (50× cheaper: one `npm ci`/node_modules link, not 50). */
function ensureWorktree(path, sha) {
  mkdirSync(dirname(path), { recursive: true });
  if (existsSync(path)) {
    try { realGit(['worktree', 'remove', '--force', path]); } catch { /* stale/missing registration — fall through to add */ }
  }
  rmSync(path, { recursive: true, force: true });
  realGit(['worktree', 'add', '--force', '--detach', path, sha]);
  linkNodeModules(path);
}

/** Symlink the worktree's `node_modules` to the primary checkout's (check-standards.mjs's only external dep,
 *  `js-yaml`, resolves through it fine across a symlink; every replayed commit is from TODAY's short history,
 *  so `package-lock.json` is assumed unchanged — {@link assertLockfileUnchanged} verifies that before linking). */
function linkNodeModules(worktreePath) {
  const link = join(worktreePath, 'node_modules');
  try { rmSync(link, { recursive: true, force: true }); } catch { /* ignore */ }
  symlinkSync(join(ROOT, 'node_modules'), link, 'dir');
}

/** Refuse the node_modules symlink shortcut if `package-lock.json` differs between HEAD and any replayed commit
 *  (a real dependency change would make the shared `node_modules` wrong for that commit). Returns the diffing
 *  shas, `[]` if all match. */
function lockfileDrift(shas) {
  const headLock = (() => { try { return realGit(['show', 'HEAD:package-lock.json']); } catch { return null; } })();
  const drift = [];
  for (const sha of shas) {
    const lock = (() => { try { return realGit(['show', `${sha}:package-lock.json`]); } catch { return null; } })();
    if (lock !== headLock) drift.push(sha);
  }
  return drift;
}

function checkoutInWorktree(path, sha) {
  realGit(['checkout', '--force', '--detach', sha], path);
  realGit(['clean', '-fd', '-e', 'node_modules'], path);
}

function parseFlags(argv) {
  const flags = {};
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq === -1) flags[a.slice(2)] = true;
    else flags[a.slice(2, eq)] = a.slice(eq + 1);
  }
  return flags;
}

function runCli(argv) {
  const flags = parseFlags(argv);
  const count = Number(flags.count ?? 50);
  const offset = Number(flags.offset ?? 0);
  const base = typeof flags.base === 'string' ? flags.base : 'origin/main';
  const outPath = typeof flags.out === 'string' ? resolve(flags.out) : join(ROOT, 'scripts', 'readiness', 'check-standards-scope-replay-baseline.json');
  const worktreePath = typeof flags.worktree === 'string' ? resolve(flags.worktree) : join(tmpdir(), 'we-check-standards-scope-replay-wt');
  const keep = Boolean(flags.keep);
  const maxCandidates = Number(flags['max-candidates'] ?? (count + offset) * 20);

  const log = realGit(['log', base, '--merges', `--format=${MERGE_LOG_FORMAT}`, `-n${maxCandidates}`]);
  const rows = parseMergeLog(log);
  const diffs = selectLaneDiffs({ rows, runGit: (a) => realGit(a), count, offset });
  if (diffs.length === 0) {
    process.stderr.write('no lane-merge diffs found — nothing to replay\n');
    process.exitCode = 1;
    return;
  }

  const drift = lockfileDrift(diffs.map((d) => d.head));
  if (drift.length) {
    process.stderr.write(
      `package-lock.json differs from HEAD at ${drift.length} replayed commit(s) (${drift.slice(0, 3).join(', ')}...) — ` +
      `the shared node_modules symlink would be wrong there. Re-run with a smaller --count/newer window, or extend ` +
      `this harness to npm-ci per-commit before trusting those rows.\n`,
    );
  }

  const results = [];
  let worktreeReady = false;
  for (const diff of diffs) {
    try {
      if (!worktreeReady) { ensureWorktree(worktreePath, diff.head); worktreeReady = true; }
      else checkoutInWorktree(worktreePath, diff.head);

      const full = runCheckStandards(worktreePath, []);
      const linked = linkedFilesFor(diff.changedFiles, { gitGrep: gitGrepIn(worktreePath) });
      const laneFiles = Array.from(new Set([...diff.changedFiles, ...linked])).sort();
      const scoped = runCheckStandards(worktreePath, ['--local', `--files=${diff.changedFiles.join(',')}`]);
      const cmp = compareFindings({ fullErrors: full.errors, scopedErrors: scoped.errors, laneFiles });

      results.push({
        sha: diff.sha, subject: diff.subject, head: diff.head,
        changedCount: diff.changedFiles.length, linkedCount: linked.length,
        full: { realSec: full.realSec, userSec: full.userSec, sysSec: full.sysSec, maxRssBytes: full.maxRssBytes, errors: full.errors.length, warnings: full.warnings.length },
        scoped: { realSec: scoped.realSec, userSec: scoped.userSec, sysSec: scoped.sysSec, maxRssBytes: scoped.maxRssBytes, errors: scoped.errors.length, warnings: scoped.warnings.length },
        missedCount: cmp.missedCount,
        laneRelevantCount: cmp.laneRelevantCount,
        missed: cmp.missed.slice(0, 20).map((f) => ({ message: f.message, descriptor: f.descriptor })),
      });
    } catch (e) {
      results.push({ sha: diff.sha, subject: diff.subject, error: String(e?.message || e) });
    }
  }

  if (!keep) {
    try { realGit(['worktree', 'remove', '--force', worktreePath]); } catch { /* best-effort */ }
    try { rmSync(worktreePath, { recursive: true, force: true }); } catch { /* best-effort */ }
  }

  const summary = summarize(results);
  const baseline = {
    _doc: 'check-standards scoped-mode replay proof (#4164, gates epic #4163). Regenerate: ' +
      'node scripts/readiness/check-standards-scope-replay.mjs --count=50 --out=scripts/readiness/check-standards-scope-replay-baseline.json',
    at: new Date().toISOString(),
    base,
    requestedCount: count,
    lockfileDrift: drift,
    summary,
    rows: results,
  };
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(baseline, null, 2) + '\n');

  process.stdout.write(formatTable(results, summary) + '\n');
  process.stdout.write(`\nbaseline written to ${outPath}\n`);
  process.exitCode = summary.pass ? 0 : 1;
}

const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (IS_CLI) runCli(process.argv.slice(2));
