#!/usr/bin/env node
/**
 * @file scripts/conveyor/backfill-changed-files.mjs
 * @description ONE-TIME, IDEMPOTENT backfill (#4034 follow-up, backlog card 4034b): fills `changedFiles` — the
 *   PR's changed files, NET versus its base — on every EXISTING scorecard row that names a real `pr` but has
 *   no `changedFiles` yet. DRY-RUN BY DEFAULT: prints the plan and touches nothing. `--apply` writes, and only
 *   after backing up the store file first. NEVER changes any field but `changedFiles` on any row it touches,
 *   and NEVER touches a row that already carries one — so a second `--apply` run finds nothing left to do.
 *
 * WHY THIS EXISTS. `we:scripts/lib/critical-work.mjs` (#4034, PR #2752) treats a `reworked`/`rejected` row with
 * no declared file scope as CRITICAL by default — fail closed, its own `unknown-scope` reason. Every scorecard
 * row written before this backfill predates that rule and stamps no scope at all, so every one of them reads
 * as critical regardless of what it actually touched, including two 2026-09-15 rows that are the ONLY thing
 * currently blocking astra's `bugfix` triple (see the card). This command closes that gap retroactively, for
 * every row whose `pr` field names a real, queryable pull request.
 *
 * READ-ONLY GITHUB CALL ONLY: `gh api --method GET repos/<repo>/pulls/<n>/files` (paginated), via
 * `we:scripts/conveyor/parked-pr-conflict-watch.mjs#defaultListPrFiles` — reused, never re-implemented (that
 * function's own docs record the hard-won `--method GET` gotcha; duplicating the argv risks losing it). Nothing
 * here ever calls a mutating `gh` verb, and `--apply` never edits the PR itself — only this repo's local store.
 *
 * WHAT IT CANNOT FIX. A row with `pr: null` carries no PR to query at all — the PR reference itself was never
 * recorded on the row, only reconstructed prose. This command reports those explicitly as `no-pr-on-row` rather
 * than silently omitting them from the plan. They stay critical (fail-closed, `unknown-scope`) until someone
 * supplies scope another way — `we:scripts/lib/critical-work.mjs#isCriticalMiss`'s own `evidence` parameter
 * already accepts that at the io edge; this command is only the PR-lookup path.
 *
 * IDEMPOTENCY AND SAFETY. The plan is built from ONE read of the store. `--apply` re-reads the store UNDER the
 * SAME file lock `appendScorecard` uses (`infra-blocked.mjs#withInfraLock`) and patches each planned row ONLY
 * if it is still byte-identical (via `JSON.stringify`) to the copy the plan was built from — an append-only
 * store never reorders or edits existing rows, so this should always hold, but a mismatch (e.g. this command
 * run twice concurrently) is reported and skipped rather than silently overwritten. Every OTHER field on every
 * row is passed through unchanged; only `changedFiles` is ever set.
 *
 * Usage:
 *   node scripts/conveyor/backfill-changed-files.mjs                  # DRY RUN (default) — prints the plan, writes nothing
 *   node scripts/conveyor/backfill-changed-files.mjs --json           # same, machine-readable
 *   node scripts/conveyor/backfill-changed-files.mjs --repo=o/n       # default: this checkout's own repo (gh `currentRepo`)
 *   node scripts/conveyor/backfill-changed-files.mjs --apply          # back up the store, then write
 *   node scripts/conveyor/backfill-changed-files.mjs --apply --repo=o/n
 */
import { copyFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { readStore, writeStore, resolveScorecardStorePath } from './run-scorecard-store.mjs';
import { withInfraLock } from './infra-blocked.mjs';
import { defaultListPrFiles } from './parked-pr-conflict-watch.mjs';
import { createGhProvider } from '../lib/review-label-provider.mjs';

/** A backfillable row: a real positive-integer `pr`, and no `changedFiles` array yet (idempotent skip). PURE. */
export function needsBackfill(record) {
  return Boolean(record) && typeof record === 'object'
    && Number.isInteger(record.pr) && record.pr > 0
    && !Array.isArray(record.changedFiles);
}

/**
 * Build the backfill PLAN from a store snapshot — PURE, no IO. Groups candidate rows by `(repo, pr)` so a PR
 * with several rows (a `session-delegation` row plus N `review-seat` rows) is looked up once, and threads
 * through whatever files-by-PR map the caller already fetched (or is about to).
 * @param {{records: object[]}} store
 * @param {string} defaultRepo - used for a row (e.g. `session-delegation`) that carries no `repo` of its own
 * @returns {{targets: Array<{repo:string, pr:number}>, rows: Array<{index:number, repo:string, pr:number, dispatchKind:string, before:string}>, noPr: Array<{index:number, dispatchKind:string, outcome:string|null, taskDescription:string|null}>}}
 */
export function planBackfill(store, defaultRepo) {
  const records = Array.isArray(store?.records) ? store.records : [];
  const rows = [];
  const noPr = [];
  const targetKeys = new Set();
  const targets = [];
  records.forEach((record, index) => {
    if (Number.isInteger(record?.pr) && record.pr > 0) {
      if (!needsBackfill(record)) return; // already filled — idempotent skip
      const repo = typeof record.repo === 'string' && record.repo ? record.repo : defaultRepo;
      const key = `${repo}#${record.pr}`;
      if (!targetKeys.has(key)) { targetKeys.add(key); targets.push({ repo, pr: record.pr }); }
      rows.push({ index, repo, pr: record.pr, dispatchKind: record.dispatchKind ?? null, before: JSON.stringify(record) });
    } else if ((record?.outcome === 'reworked' || record?.outcome === 'rejected') && !Array.isArray(record?.changedFiles)) {
      // Informational only — never a write target: nothing here can look this row's PR up.
      noPr.push({
        index, dispatchKind: record?.dispatchKind ?? null, outcome: record?.outcome ?? null,
        provider: record?.provider ?? null, model: record?.model ?? null, taskType: record?.taskType ?? null,
        taskDescription: record?.taskDescription ?? null, scoredAt: record?.scoredAt ?? null,
      });
    }
  });
  return { targets, rows, noPr };
}

/**
 * Resolve each planned target's file list. Never throws — a failed lookup is recorded as a reason string, and
 * that PR's rows are simply left unfilled (`changedFiles` stays absent) rather than aborting the whole run.
 * @param {Array<{repo:string, pr:number}>} targets
 * @param {{listFiles?: Function}} [io]
 * @returns {Map<string, {files: string[]|null, reason: string|null}>}
 */
export function resolveFileLists(targets, { listFiles = ({ repo, pr }) => defaultListPrFiles({ number: pr, repo }) } = {}) {
  const out = new Map();
  for (const t of targets) {
    const key = `${t.repo}#${t.pr}`;
    try {
      const files = listFiles(t);
      out.set(key, { files: Array.isArray(files) && files.length ? files : null, reason: Array.isArray(files) && files.length ? null : 'gh returned no files (closed/deleted PR, or an empty diff)' });
    } catch (e) {
      out.set(key, { files: null, reason: `gh api failed — ${String(e?.message ?? e).split('\n')[0]}` });
    }
  }
  return out;
}

/** One printable plan row. PURE. */
function renderRow(r, fileLists) {
  const entry = fileLists.get(`${r.repo}#${r.pr}`);
  return {
    index: r.index, repo: r.repo, pr: r.pr, dispatchKind: r.dispatchKind,
    changedFiles: entry?.files ?? null,
    fileCount: entry?.files ? entry.files.length : 0,
    reason: entry?.files ? null : (entry?.reason ?? 'unresolved'),
  };
}

/**
 * Apply the plan: re-read the store under the store's own append lock, patch each row that is STILL
 * byte-identical to its planned `before` snapshot, write ONLY `changedFiles` onto it, back up the file first.
 * Never throws — a lock/write failure is returned as `{applied:false, reason}`.
 */
export function applyBackfill({ rows, fileLists, path = resolveScorecardStorePath(), backup = defaultBackup } = {}) {
  return withInfraLock(path, () => {
    const fresh = readStore({ path });
    let patched = 0;
    let skippedStale = 0;
    const skippedNoFiles = [];
    for (const r of rows) {
      const entry = fileLists.get(`${r.repo}#${r.pr}`);
      if (!entry?.files) { skippedNoFiles.push({ index: r.index, pr: r.pr, reason: entry?.reason ?? 'unresolved' }); continue; }
      const current = fresh.records[r.index];
      if (!current || JSON.stringify(current) !== r.before) { skippedStale += 1; continue; }
      fresh.records[r.index] = { ...current, changedFiles: entry.files };
      patched += 1;
    }
    if (patched > 0) {
      backup(path);
      writeStore(fresh, { path });
    }
    return { applied: true, patched, skippedStale, skippedNoFiles };
  });
}

function defaultBackup(path) {
  if (!existsSync(path)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${path}.pre-backfill-4034b-${stamp}.bak.json`;
  copyFileSync(path, backupPath);
  return backupPath;
}

// ── CLI ─────────────────────────────────────────────────────────────────────────────────────────────────────────

function parseFlags(argv) {
  const flags = {};
  for (const a of argv) {
    if (a === '--apply') flags.apply = true;
    else if (a === '--json') flags.json = true;
    else if (a === '--help') flags.help = true;
    else if (a.startsWith('--repo=')) flags.repo = a.slice('--repo='.length);
  }
  return flags;
}

const USAGE = `Usage: node scripts/conveyor/backfill-changed-files.mjs [--repo=owner/name] [--apply] [--json]

Fills \`changedFiles\` (the PR's changed files, net versus its base) on every scorecard row that names a real
\`pr\` but has none yet — a one-time, idempotent maintenance pass for #4034's fail-closed "unknown scope" rule.
Dry-run by default: prints the plan, writes nothing. --apply backs up the store then writes. Never touches a
row that already has \`changedFiles\`, and never changes any field but that one.`;

export async function main(argv = process.argv.slice(2), env = process.env) {
  const flags = parseFlags(argv);
  if (flags.help) { console.log(USAGE); return 0; }
  const repo = flags.repo || createGhProvider().currentRepo();
  const store = readStore();
  const { targets, rows, noPr } = planBackfill(store, repo);
  const fileLists = resolveFileLists(targets);
  const plan = rows.map((r) => renderRow(r, fileLists));
  const fillable = plan.filter((p) => p.changedFiles);
  const unfillable = plan.filter((p) => !p.changedFiles);

  let applyResult = null;
  if (flags.apply) {
    applyResult = applyBackfill({ rows, fileLists });
  }

  if (flags.json) {
    console.log(JSON.stringify({ repo, plan, noPr, applied: applyResult }, null, 2));
    return 0;
  }

  console.log(`backfill-changed-files: store has ${store.records.length} row(s); repo=${repo}`);
  console.log(`  ${rows.length} row(s) across ${targets.length} PR(s) name a pr and lack changedFiles`);
  console.log(`  ${fillable.length} row(s) fillable now, ${unfillable.length} not (see reasons below)`);
  console.log(`  ${noPr.length} miss row(s) (reworked/rejected) carry NO pr at all — cannot be backfilled by PR lookup`);
  console.log('');
  for (const p of plan) {
    console.log(`  [${p.index}] PR #${p.pr} (${p.repo}) ${p.dispatchKind ?? '?'} — `
      + (p.changedFiles ? `${p.fileCount} file(s): ${p.changedFiles.slice(0, 6).join(', ')}${p.fileCount > 6 ? ', …' : ''}` : `UNFILLED — ${p.reason}`));
  }
  if (noPr.length) {
    console.log('\n  miss rows with no pr on record (unrecoverable by this command):');
    for (const n of noPr) {
      console.log(`    [${n.index}] ${n.provider ?? '?'}/${n.model ?? '?'} ${n.taskType ?? '?'} ${n.outcome} — ${n.taskDescription ?? '(no description)'} (${n.scoredAt ?? '?'})`);
    }
  }
  if (flags.apply) {
    console.log(`\napply: patched ${applyResult.patched} row(s)${applyResult.skippedStale ? `, skipped ${applyResult.skippedStale} stale row(s)` : ''}.`);
  } else {
    console.log(`\nDRY RUN — nothing written. Re-run with --apply to write (backs up the store first):`);
    console.log(`  node scripts/conveyor/backfill-changed-files.mjs --repo=${repo} --apply`);
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => { process.exitCode = code; }).catch((e) => {
    console.error(`backfill-changed-files: ${e?.message ?? e}`);
    process.exitCode = 1;
  });
}
