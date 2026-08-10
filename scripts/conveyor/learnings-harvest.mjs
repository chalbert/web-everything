#!/usr/bin/env node
/**
 * learnings-harvest.mjs — the deterministic core of the PERIODIC learnings harvest (#x2j0l3t, under
 * conveyor #2612; successor to the close-session sweep of #2614).
 *
 * THE RULE IT IMPLEMENTS: **collection is not adjudication.** A session — main loop or subagent — only ever
 * APPENDS what it observed (learnings-drop.mjs). It never decides what that observation is worth. Worth is
 * decided later, ONCE, over the whole cross-session pool. This file is the "later": read every pool file,
 * re-scrub, cluster across sessions, rank by recurrence, and hand a short candidate list to the `/harvest`
 * skill's judgment half (red-team → route to backlog/memory → lane → PR).
 *
 * WHY NOT AT CLOSE (what close-session-sweep.mjs did, single-session):
 *   1. A subagent cannot run a session close, so its entries only counted if some OTHER session closed.
 *   2. A session that ends without a close lost everything it noticed.
 *   3. Dedup-from-a-sample-of-one: the red-team's own filters ask recurrence questions ("a fresh angle on a
 *      covered cluster?", "narrow/rare → leave on-disk") that ONE session structurally cannot answer. A pool
 *      answers them with a count — `count` (entries) and `sessions` (distinct sessions) are that evidence.
 *
 * THE POOL. `$LEARNINGS_POOL || ~/.claude/conveyor/learnings` — `*.jsonl`, one file per session (so
 * concurrent agents never contend on one file), all read together. The directory is MACHINE-fixed, NOT
 * repo-anchored: every clone on the machine (primary checkout, every lane clone) emits into and harvests
 * from the same pool. UNTRACKED and machine-local by design: an in-the-moment append cannot
 * afford a lane→PR, and the durable ARTIFACTS are what the harvest lands. When the multi-tenant transport of
 * #2610 exists it ships pool entries to the central inbox; the emit seam does not change. Entries are NOT
 * consumed by a close — only `--archive` (after a harvest actually acted) moves them to `harvested/<stamp>/`.
 *
 * DESIGN: pure core (no I/O) + thin CLI, per we:docs/agent/platform-decisions.md
 * #deterministic-core-thin-judgment. The scrub is NOT re-implemented here — it shells the same
 * `validateEntry` the append seam used (defence in depth), and the same `dedup` clustering.
 *
 * Usage:
 *   node scripts/conveyor/learnings-harvest.mjs [--dir=<pool>] [--threshold=0.6] [--min-sessions=1] [--json]
 *   node scripts/conveyor/learnings-harvest.mjs --status [--json]     # depth/age only — what a close reports
 *   node scripts/conveyor/learnings-harvest.mjs --archive --stamp=<iso> --files=<a.jsonl,b.jsonl>
 *   node scripts/conveyor/learnings-harvest.mjs --archive --stamp=<iso> --before=<iso>
 *
 * `--archive` consumes, AFTER acting, and requires an explicit bound (`--files=` — the `files[]` the harvest
 * itself read — or a `--before=` mtime cutoff) so it cannot swallow entries appended mid-harvest.
 */
import { existsSync, readdirSync, readFileSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { basename, dirname, isAbsolute, join } from 'node:path';
import { validateEntry, poolDir as machinePoolDir } from './learnings-drop.mjs';
import { dedup, DEFAULT_THRESHOLD } from './learnings-dedup.mjs';
import { writeLineSync } from '../lib/write-all-sync.mjs';

export const ARCHIVE_DIR = 'harvested';

// ── path resolution ─────────────────────────────────────────────────────────────────────────────
function repoRoot() {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return process.cwd();
  }
}

/**
 * resolvePoolDir({ dir, env, home }) → absolute path of the POOL DIRECTORY.
 * Precedence: explicit --dir → the MACHINE-fixed pool (`poolDir` in learnings-drop.mjs, i.e.
 * `$LEARNINGS_POOL || ~/.claude/conveyor/learnings`). Pure given its inputs.
 * Deliberately the DIRECTORY, not one file: the drop seam is per-session, the harvest seam is per-pool.
 *
 * IT SHELLS THE EMIT SEAM'S RESOLVER ON PURPOSE (review fix, PR #1068 blocker 1). Both ends used to derive
 * the pool from the CWD's git root independently, so an agent emitting inside a lane clone and a harvest
 * run from the primary checkout read two different pools and neither errored. One resolver, one pool.
 */
export function resolvePoolDir({ dir, env = process.env, root, home } = {}) {
  if (dir) return isAbsolute(dir) ? dir : join(root || repoRoot(), dir);
  return machinePoolDir({ env, home });
}

/**
 * poolFiles(dir) → sorted absolute paths of the pool's `*.jsonl` files. The `harvested/` sub-directory is
 * NOT walked (already consumed), and a missing pool dir is the common, correct empty case — never an error.
 */
export function poolFiles(dir) {
  if (!dir || !existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith('.jsonl'))
    .map((d) => join(dir, d.name))
    .sort();
}

// ── pure core ───────────────────────────────────────────────────────────────────────────────────
/**
 * readPool(files, { read }) → { entries, stats }. Reads each pool file LINE-TOLERANTLY: one malformed line
 * (a half-written append, a crashed agent) must never cost the rest of the pool, so it is counted in
 * `stats.malformed` and skipped rather than thrown. Each surviving entry is re-validated through the SAME
 * scrub the append used, and tagged with its `session` (the file's basename). `ts` arrives NORMALIZED out
 * of `validateEntry` (strict ISO or null) — this reader deliberately performs NO `raw.*` read, so no field
 * can route around the privacy boundary on its way to `stats.oldest`. `read` is injectable for tests.
 */
export function readPool(files, { read = (p) => readFileSync(p, 'utf8') } = {}) {
  const entries = [];
  let received = 0;
  let malformed = 0;
  let rejected = 0;
  for (const file of files) {
    const session = basename(file).replace(/\.jsonl$/, '');
    let text;
    try { text = read(file); } catch { malformed++; continue; }
    for (const line of String(text).split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      received++;
      let raw;
      try { raw = JSON.parse(t); } catch { malformed++; continue; }
      const { ok, clean } = validateEntry(raw);
      if (!ok) { rejected++; continue; }
      entries.push({ ...clean, session });
    }
  }
  return { entries, stats: { files: files.length, received, valid: entries.length, malformed, rejected } };
}

/**
 * ageStats(entries, { now }) → { oldest, newest, ageDays } over the entries' `ts` stamps.
 * `ageDays` is how long the OLDEST unharvested observation has been waiting — the number that tells an
 * operator whether the harvest cadence is keeping up. Null-safe: entries with no `ts` are ignored.
 */
export function ageStats(entries, { now } = {}) {
  const stamps = entries.map((e) => e.ts).filter(Boolean).sort();
  if (!stamps.length) return { oldest: null, newest: null, ageDays: null };
  const oldest = stamps[0];
  const newest = stamps[stamps.length - 1];
  const nowMs = now != null ? new Date(now).getTime() : Date.now();
  const oldMs = new Date(oldest).getTime();
  const ageDays = Number.isFinite(oldMs) ? Math.max(0, Math.round((nowMs - oldMs) / 86400000)) : null;
  return { oldest, newest, ageDays };
}

/**
 * harvest(entries, { threshold, minSessions, now }) → { candidates, stats }. PURE.
 *
 * Clusters across the WHOLE pool, then ranks by `sessions` (distinct sessions that hit it) before `count`
 * (raw entries) — a friction three different sessions independently hit outranks one session that dropped
 * three restatements of it. `minSessions` is the recurrence floor: raise it to harvest only what has
 * demonstrably recurred, leaving one-offs in the pool for the next run (they are NOT discarded).
 */
export function harvest(entries, { threshold = DEFAULT_THRESHOLD, minSessions = 1, now } = {}) {
  const { clusters, stats } = dedup(entries, { threshold });
  const ranked = clusters
    .map((c) => ({ ...c, sessions: c.sessions?.length ?? 0 }))
    .sort((a, b) => (b.sessions - a.sessions) || (b.count - a.count));
  const candidates = ranked.filter((c) => c.sessions >= minSessions);
  return {
    candidates,
    stats: {
      ...stats,
      ...ageStats(entries, { now }),
      ranked: ranked.length,
      belowFloor: ranked.length - candidates.length,
      minSessions,
    },
  };
}

/**
 * harvestPool({ dir, threshold, minSessions, now }) → { candidates, stats, dir, files }.
 * The I/O wrapper: resolve → read → harvest. An absent/empty pool returns empty candidates and exit-0 — the
 * common, correct outcome (nothing observed since the last harvest is not a failure).
 */
export function harvestPool({ dir, threshold, minSessions, now, env, root } = {}) {
  const poolDir = resolvePoolDir({ dir, env, root });
  const files = poolFiles(poolDir);
  const { entries, stats: readStats } = readPool(files);
  const { candidates, stats } = harvest(entries, { threshold, minSessions, now });
  return { candidates, stats: { ...readStats, ...stats }, dir: poolDir, files };
}

/**
 * poolStatus({ dir }) → { entries, sessions, ageDays, dir } — the CHEAP depth/age read a session close
 * reports. Reporting the pool's depth is DATA, not judgment: it tells the operator the harvest is due
 * without the close deciding anything about what is in there.
 */
export function poolStatus({ dir, now, env, root } = {}) {
  const poolDir = resolvePoolDir({ dir, env, root });
  const files = poolFiles(poolDir);
  const { entries } = readPool(files);
  const { ageDays, oldest } = ageStats(entries, { now });
  return { entries: entries.length, sessions: files.length, ageDays, oldest, dir: poolDir };
}

/**
 * archivePool({ dir, stamp, files, before }) → { moved, to, missing }. Moves the BOUNDED set of pool files
 * into `harvested/<stamp>/`, so a re-run never re-processes what was already acted on. Called ONLY after the
 * harvest actually routed its survivors — archiving is the acknowledgement, never a side effect of reading.
 *
 * THE BOUND IS MANDATORY (review fix, PR #1068 blocker 5a). This used to call `poolFiles()` fresh at archive
 * time, i.e. archive whatever is in the pool NOW rather than what the harvest actually READ. The harvest's
 * red-team → route → lane → PR window is minutes long, and the red-team subagents themselves emit into the
 * pool during it, so a bare re-enumeration moved unadjudicated entries into `harvested/` where no future
 * harvest can ever see them. Callers must pass either the exact `files[]` `harvestPool` returned or a
 * `before` mtime cutoff; a request for a file that has since vanished is reported in `missing`, not fatal.
 *
 * A MISSING POOL DIR IS AN ERROR HERE (review fix, PR #1068 blocker 5b), unlike in `poolFiles`. For a READER
 * "no pool dir" is the correct empty case; for a MUTATOR it means the caller resolved the wrong pool, and
 * printing "nothing to archive" + exit 0 would leave the real pool undrained — the next harvest then
 * re-routes duplicate items and memory entries.
 */
export function archivePool({ dir, stamp, files: requested, before, env, root, home } = {}) {
  const poolDir = resolvePoolDir({ dir, env, root, home });
  if (!existsSync(poolDir)) {
    const err = new Error(`pool directory does not exist (${poolDir}) — refusing to archive, the real pool would be left undrained`);
    err.code = 'ENOPOOL';
    throw err;
  }
  const missing = [];
  let files;
  if (Array.isArray(requested)) {
    for (const f of requested) {
      const abs = isAbsolute(f) ? f : join(poolDir, f);
      if (dirname(abs) === poolDir && abs.endsWith('.jsonl') && existsSync(abs)) continue;
      missing.push(abs);
    }
    files = requested
      .map((f) => (isAbsolute(f) ? f : join(poolDir, f)))
      .filter((f) => !missing.includes(f));
  } else if (before != null) {
    const cutoff = new Date(before).getTime();
    if (!Number.isFinite(cutoff)) throw new Error(`--before must be a parseable timestamp (got ${JSON.stringify(before)})`);
    files = poolFiles(poolDir).filter((f) => statSync(f).mtimeMs <= cutoff);
  } else {
    throw new Error(
      '--archive needs an explicit bound: pass --files=<the files[] the harvest read> or --before=<iso>. ' +
      'A bare re-enumeration would consume entries appended AFTER the harvest read them (including the ' +
      "red-team subagents' own drops), and archived entries are unrecoverable by any future harvest.",
    );
  }
  if (!files.length) return { moved: [], to: null, missing };
  const label = String(stamp || 'harvest').replace(/[^A-Za-z0-9._-]/g, '-');
  const to = join(poolDir, ARCHIVE_DIR, label);
  mkdirSync(to, { recursive: true });
  const moved = [];
  for (const f of files) {
    // Collision-safe: a second archive under the same stamp suffixes rather than clobbering a prior file.
    let dest = join(to, basename(f));
    let n = 1;
    while (existsSync(dest)) dest = join(to, `${basename(f, '.jsonl')}.${n++}.jsonl`);
    renameSync(f, dest);
    moved.push(dest);
  }
  return { moved, to, missing };
}

// ── thin CLI ──────────────────────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const flags = {};
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq === -1) flags[a.slice(2)] = true;
    else flags[a.slice(2, eq)] = a.slice(eq + 1);
  }
  return flags;
}

function main(argv) {
  const f = parseArgs(argv);
  const dir = f.dir;

  if (f.archive) {
    // `--files=` is the primary form: the exact `files[]` the harvest read (step 1's --json). `--before=`
    // is the mtime-cutoff alternative. One of the two is required — see archivePool.
    const files = typeof f.files === 'string'
      ? f.files.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;
    let result;
    try {
      result = archivePool({ dir, stamp: f.stamp, files, before: f.before });
    } catch (e) {
      console.error(`learnings-harvest: ${e.message}`);
      process.exit(2);
    }
    if (f.json) writeLineSync(1, JSON.stringify(result, null, 2));
    else {
      console.log(result.moved.length ? `archived ${result.moved.length} pool file(s) → ${result.to}` : 'nothing to archive.');
      if (result.missing.length) console.log(`  (${result.missing.length} requested file(s) no longer in the pool — skipped)`);
    }
    process.exit(0);
  }

  if (f.status) {
    const s = poolStatus({ dir });
    if (f.json) writeLineSync(1, JSON.stringify(s, null, 2));
    else if (!s.entries) console.log('learnings pool: empty.');
    else console.log(`learnings pool: ${s.entries} entr${s.entries === 1 ? 'y' : 'ies'} across ${s.sessions} session file(s)${s.ageDays != null ? `, oldest ${s.ageDays}d` : ''}.`);
    process.exit(0);
  }

  const threshold = f.threshold != null ? Number(f.threshold) : DEFAULT_THRESHOLD;
  const minSessions = f['min-sessions'] != null ? Number(f['min-sessions']) : 1;
  let result;
  try {
    result = harvestPool({ dir, threshold, minSessions });
  } catch (e) {
    console.error(`learnings-harvest: cannot harvest (${e.message})`);
    process.exit(2);
  }
  if (f.json) {
    writeLineSync(1, JSON.stringify(result, null, 2));
  } else if (!result.stats.received) {
    console.log(`learnings pool empty (${result.dir}) — nothing to harvest.`);
  } else {
    const s = result.stats;
    console.log(`harvested ${result.dir}: ${s.received} entries / ${s.files} session file(s) (${s.rejected} rejected, ${s.malformed} malformed) → ${result.candidates.length} candidate(s)${s.belowFloor ? `, ${s.belowFloor} below the ×${s.minSessions}-session floor` : ''}${s.ageDays != null ? `; oldest ${s.ageDays}d` : ''}.`);
    for (const c of result.candidates) {
      console.log(`  [${c.kind}] ${c.sessions} session(s) / ×${c.count}  ${c.area}\n     ${c.summary}\n     → ${c.suggestion}`);
    }
  }
  process.exit(0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2));
}
