#!/usr/bin/env node
/**
 * @file scripts/conveyor/health-watch.mjs
 * @description #4077 (health daemon slice 1, ruling #4065) — the IO SHELL of the health watch. Runs the probes,
 *   hands their raw readings to the pure core (we:scripts/conveyor/health-watch-core.mjs), and writes back the
 *   episode store, the per-episode reports and the last-tick-completed stamp. Resident via one
 *   `health-watch` entry in we:skills-src/conveyor/daemon-manifest.mjs (pass-daemon runs `tick` every 5 min).
 *
 * READ-ONLY toward the fleet: it reads daemon logs, lease files, self-sync alerts, the lane-pool health lines,
 * `gh pr list` and `claude agents --json`, and runs only declared read-only diagnoses. It never dispatches,
 * notifies, files or edits anything but its own state dir. Ships in SHADOW mode (4065): what it WOULD notify /
 * dispatch is written into each report under "Held back". The ONE exception, off by default (#4078): with config
 * `investigateDispatch: true` it dispatches a diagnose-only investigation agent per episode and stops it at its
 * wall clock — see we:scripts/conveyor/health-investigate-dispatch.mjs.
 *
 * State lives under the pinned daemon state root (#4052, `health-watch-section.mjs#healthDir`, the ONE shared
 *   resolver every reader goes through — see that file's own header): `.conveyor/health/`
 *   state.json          episodes, per-daemon memory, log cursors, gh cache (written only by the tick)
 *   silences.json       tracked-silences (written only by `silence`/`unsilence`; the tick only reads it)
 *   last-tick.json      the last-tick-completed stamp (separate from the pass-daemon lease heartbeat, which
 *                       keeps beating through a hung tick — pass-daemon.mjs:194)
 *   episodes/<id>.md    the durable per-episode report (+ .json)
 *
 * Every child call has a hard timeout; a whole-tick watchdog kills a hung tick and records it, so the next tick
 * raises the `health-tick-overrun` smell.
 *
 * Usage:
 *   node scripts/conveyor/health-watch.mjs tick    [--json] [--force-gh] [--no-gh] [--dry-run] [--state-root=DIR]
 *                                                  [--logs-dir=DIR] [--lock-root=DIR] [--self-sync-dir=DIR]
 *                                                  [--ps-fixture=FILE] [--machine-load-fixture=FILE]  # machine-overload's inputs, real by default
 *                                                  [--no-investigate]  # skip the #4078 investigation pass entirely
 *   node scripts/conveyor/health-watch.mjs section [--state-root=DIR]      # the HEALTH section (operator queue)
 *   node scripts/conveyor/health-watch.mjs silence --smell=ID [--subject=S] --card=NNN [--hours=72]
 *   node scripts/conveyor/health-watch.mjs unsilence --smell=ID [--subject=S]
 */
import { execFileSync, spawn } from 'node:child_process';
import {
  existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, renameSync, openSync, readSync, closeSync, unlinkSync,
} from 'node:fs';
import { homedir, loadavg, cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_HEALTH_CONFIG, emptyHealthState, runHealthTick, renderEpisodeReport, renderHealthSection, summarizeDiagnosisOutput, scrubText, scrubDeep, parsePsOutput, MINUTE,
} from './health-watch-core.mjs';
import { SMELLS } from './health-smells/index.mjs';
import { healthDir, healthSectionLines } from './health-watch-section.mjs';
import { runInvestigations } from './health-investigate-dispatch.mjs';

export { healthDir, healthSectionLines };
import { CONSTELLATION_REPOS } from '../lib/constellation-repos.mjs';
import { readGithubAppStatus } from '../lib/github-app-auth-env.mjs';
import { ghThrottleLockRoot, ghThrottleLogPath, budgetProbeArgs } from '../lib/gh-throttle.mjs';
import { persistSpendHours } from '../lib/gh-spend.mjs';
import { readSharedOpenPrs } from '../lib/pr-snapshot.mjs';
import { readClaudeAuthExpiredInfo } from './hung-session.mjs';
import { readBgIsolationStallInfo } from './bg-isolation-stall.mjs';
import { stuckOnPermissionPrompt } from './health-smells/dispatch-permission-stall.mjs';
import { notifyDesktopChecked } from './branch-sync.mjs';
import { DAEMON_MANIFEST } from '../../skills-src/conveyor/daemon-manifest.mjs';
import { RUNNER_LOCK_ROOT } from '../../skills-src/conveyor/runner-lock.mjs';
import { collectDaemonStatus } from '../operations/daemon-status-io.mjs';
import { assessDaemonStatus } from '../operations/daemon-status.mjs';
import { readBacklogCards } from '../backlog-stranded-sweep.mjs';
import { readPrEventsStatuses } from '../lib/pr-events.mjs';
import { readSeatCapUsage } from '../operations/review-extra-seats.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const BOOTSTRAP_TAIL_BYTES = 512 * 1024;
export const MAX_READ_BYTES = 2 * 1024 * 1024;
export const GH_CADENCE_MS = 15 * MINUTE;
export const CHILD_TIMEOUT_MS = 30_000;

// ── paths ────────────────────────────────────────────────────────────────────────────────────────────────────

export function defaultLogsDir(env = process.env) {
  return env.HEALTH_WATCH_LOGS_DIR || join(homedir(), 'workspace', 'wev-review-daemon', '.conveyor');
}
export function defaultSelfSyncDir(env = process.env) {
  return env.HEALTH_WATCH_SELF_SYNC_DIR || join(homedir(), '.claude', 'daemon-self-sync-state');
}

function readJson(path, fallback) { try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return fallback; } }
function writeJsonAtomic(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`);
  renameSync(tmp, path);
}

/** Read bytes [start, end) of a file as a Buffer (bounded). */
export function readRangeBuf(path, start, end) {
  const len = Math.max(0, end - start);
  const buf = Buffer.alloc(len);
  if (!len) return buf;
  const fd = openSync(path, 'r');
  try { readSync(fd, buf, 0, len, start); } finally { closeSync(fd); }
  return buf;
}

/** Read bytes [start, end) of a file (bounded). */
export function readRange(path, start, end) {
  const len = Math.max(0, end - start);
  if (!len) return '';
  const buf = Buffer.alloc(len);
  const fd = openSync(path, 'r');
  try { readSync(fd, buf, 0, len, start); } finally { closeSync(fd); }
  return buf.toString('utf8');
}

// ── probes ───────────────────────────────────────────────────────────────────────────────────────────────────

/** Incrementally read every `*.log` in the daemon logs dir from its cursor (bootstrap: the last 512 KB). */
export function probeDaemonLogs(logsDir, cursors = {}) {
  const out = [];
  const nextCursors = {};
  if (!existsSync(logsDir)) return { samples: out, cursors: nextCursors };
  for (const f of readdirSync(logsDir).filter((n) => n.endsWith('.log')).sort()) {
    const path = join(logsDir, f);
    const name = f.replace(/\.log$/, '');
    const st = statSync(path);
    const cur = cursors[name];
    const bootstrap = !cur || cur.ino !== st.ino || st.size < cur.size;
    let start = bootstrap ? Math.max(0, st.size - BOOTSTRAP_TAIL_BYTES) : cur.size;
    if (st.size - start > MAX_READ_BYTES) start = st.size - MAX_READ_BYTES;
    // Consume only through the LAST complete line: a line still being written (no trailing newline yet) is left
    // for the next sample, so a refusal split across two reads is parsed whole, never dropped.
    const buf = readRangeBuf(path, start, st.size);
    const lastNl = buf.lastIndexOf(0x0a);
    const consumed = lastNl === -1 ? 0 : lastNl + 1;
    let text = buf.subarray(0, consumed).toString('utf8');
    if (start > 0 && (bootstrap || start !== cur?.size)) text = text.slice(text.indexOf('\n') + 1); // drop a partial first line
    const passName = name;
    out.push({ name, mtimeMs: st.mtimeMs, sizeBytes: st.size, text, bootstrap, defaultIntervalMs: DAEMON_MANIFEST[passName]?.intervalMs });
    nextCursors[name] = { ino: st.ino, size: start + consumed };
  }
  return { samples: out, cursors: nextCursors };
}

function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e?.code === 'EPERM'; }
}

/** Every daemon lease under the runner lock root, mapped to its log name in the logs dir. */
export function probeLeases(lockRoot, logNames) {
  const out = [];
  if (!existsSync(lockRoot)) return out;
  for (const d of readdirSync(lockRoot)) {
    const lock = readJson(join(lockRoot, d, 'lock.json'), null);
    if (!lock?.owner) continue;
    const role = String(lock.owner).split(':').slice(2).join(':');
    const base = role.startsWith('pass-daemon:') ? role.slice('pass-daemon:'.length) : role;
    const log = [base, base.replace(/^reconcile-/, '')].find((n) => logNames.has(n)) ?? base;
    out.push({ log, role, pid: lock.pid, pidAlive: pidAlive(lock.pid), heartbeatAt: Date.parse(lock.heartbeatAt || '') || null });
  }
  // One lease per daemon: lease dirs are keyed per clone path, so an older clone's dead lease can linger beside
  // the live one (seen live: 3 dead review-daemon leases, days old). The freshest heartbeat is the daemon.
  const best = new Map();
  for (const l of out) {
    const cur = best.get(l.log);
    if (!cur || (l.heartbeatAt ?? 0) > (cur.heartbeatAt ?? 0)) best.set(l.log, l);
  }
  return [...best.values()];
}

/** A launchd label → the name its log/memory is keyed by here (`com.we.fix-dispatch-daemon` → `fix-dispatch-daemon`,
 *  `com.we.conveyor-pass-daemon.merge-orphan-sweep` → `merge-orphan-sweep`, `com.plateau.drain-daemon` →
 *  `plateau-drain-daemon`). */
export function daemonNameForLabel(label) {
  return String(label).replace(/^com\.we\.(conveyor-pass-daemon\.)?/, '').replace(/^com\.plateau\./, 'plateau-');
}

/**
 * The daemon inventory + liveness, from the declared `daemon-status` read (#4067) — launchd discovery, the
 * lease heartbeat, and each daemon's own last-tick record — instead of re-deriving it. Mapped to the `leases`
 * shape the smells read. `lastActivityAt` carries daemon-status's own timestamp for a daemon whose log this
 * watch does not read (the plateau drain daemon). Every launchctl/plutil child call gets a hard timeout.
 *
 * `intervalMs` — the SAME `DAEMON_MANIFEST[name]?.intervalMs` the `daemonLogs` probe already attaches to a
 * sample as `defaultIntervalMs` (see `probeDaemonLogs` above), looked up here too and carried on the lease.
 * Root cause (2026-09-27, live `daemon-silent` false-positive FLAPPING on `merge-orphan-sweep`, open 36h+):
 * that pass now runs from its OWN dedicated clone (`wev-merge-daemon`, #3383's daemon split — a daemon that
 * writes to `main` gets its own clone), so its log never appears under this watch's single `defaultLogsDir()`
 * (`wev-review-daemon/.conveyor`) and `daemon-silent.mjs`'s primary `daemons[lease.log]` memory is never built
 * for it. It falls back to a synthetic memory built ONLY from this lease — and that fallback used to hardcode
 * `intervalMs: 120_000` (2 minutes) regardless of the daemon's REAL configured cadence, so a perfectly healthy
 * daemon on a slower cadence (merge-orphan-sweep's is 15 minutes — `MERGE_ORPHAN_SWEEP_INTERVAL_MS` in
 * `daemon-manifest.mjs`) tripped the fallback's fixed 10-minute silence threshold on every ordinary tick gap,
 * flapping open/closed forever. Carrying the real interval here lets `daemon-silent.mjs`'s fallback scale its
 * threshold the same way the primary path already does — `null` for a daemon `DAEMON_MANIFEST` does not cover
 * (every resident daemon that is not a `pass-daemon.mjs` watcher), which the smell already treats as "use the
 * generic default".
 */
export function probeDaemonStatus({ collect = collectDaemonStatus, assess = assessDaemonStatus, timeoutMs = 15_000 } = {}) {
  const exec = (cmd, args, opts = {}) => execFileSync(cmd, args, { ...opts, timeout: timeoutMs });
  const read = assess(collect({ exec }));
  return read.daemons.filter((d) => d.readable !== false).map((d) => {
    const ms = (v) => (v == null ? null : typeof v === 'number' ? v : Date.parse(v) || null);
    const entry = d.lease?.entry ?? null;
    const activity = [ms(d.tick?.lastActivityAt), ms(d.tick?.at), ms(d.tick?.logMtimeMs)].filter(Number.isFinite);
    const log = daemonNameForLabel(d.name);
    return {
      log,
      role: d.kind ?? null,
      pid: entry?.pid ?? null,
      pidAlive: !!d.running,
      heartbeatAt: ms(entry?.heartbeatAt),
      lastActivityAt: activity.length ? Math.max(...activity) : null,
      daemonState: d.state,
      headline: d.headline,
      intervalMs: DAEMON_MANIFEST[log]?.intervalMs ?? null,
    };
  });
}

/**
 * Which of these backlog card ids are `status: active` — read from each card file's own frontmatter (the
 * backlog is the tracker). Missing/unreadable cards are simply not active.
 * @returns {Set<string>}
 */
export function readActiveCards(ids, backlogDir) {
  const out = new Set();
  if (!ids.length || !existsSync(backlogDir)) return out;
  const files = readdirSync(backlogDir);
  for (const id of new Set(ids.map(String))) {
    const f = files.find((n) => n.startsWith(`${id}-`) && n.endsWith('.md'));
    if (!f) continue;
    try {
      const head = readFileSync(join(backlogDir, f), 'utf8').slice(0, 2000);
      if (/^status:\s*active\s*$/m.test(head)) out.add(id);
    } catch { /* unreadable → not active */ }
  }
  return out;
}

/** Self-sync alerts + rebuild state per daemon clone key. */
export function probeSelfSync(dir) {
  if (!existsSync(dir)) return [];
  const keys = new Set(readdirSync(dir).map((f) => f.split('.')[0]).filter(Boolean));
  return [...keys].sort().map((cloneKey) => {
    const alertsPath = join(dir, `${cloneKey}.alerts.jsonl`);
    let alerts = [];
    if (existsSync(alertsPath)) {
      const st = statSync(alertsPath);
      const text = readRange(alertsPath, Math.max(0, st.size - 256 * 1024), st.size);
      alerts = text.split('\n').slice(-400).map((l) => { try { return JSON.parse(l); } catch { return null; } })
        .filter(Boolean).map((a) => ({ ...a, at: Date.parse(a.at || '') || null }));
    }
    const rb = readJson(join(dir, `${cloneKey}.rebuild.json`), null);
    const rebuild = rb ? {
      adopted: rb.adopted ? { ...rb.adopted, at: Date.parse(rb.adopted.at || '') || null } : null,
      rejected: rb.rejected ?? null,
      quarantine: rb.quarantine ?? null,
      inProgress: rb.inProgress ? { ...rb.inProgress, startedAt: Date.parse(rb.inProgress.startedAt || '') || null } : null,
      // x5wbsbc: a failed live smoke keeps the clone on its last-good build instead of blocking delivery —
      // `daemon-rebuild.mjs`'s `hold`/`smokeAndAdopt` write this; `since` parsed the same way `adopted.at`/
      // `inProgress.startedAt` are (`Date.parse`, `null` when invalid — an epoch-0 string included, same style).
      held: rb.held ? { ...rb.held, since: Date.parse(rb.held.since || '') || null } : null,
    } : null;
    return { cloneKey, alerts, rebuild };
  });
}

/**
 * #4200-ish (gh-shim-lane-path) — every generated `gh` shim under `~/.claude/github-app-token/` (the legacy
 * shared `gh-shim/gh` plus each per-checkout `gh-shim.d/<hash>/gh` — see `scripts/lib/gh-app-shim.mjs`), scanned
 * for a baked `GH_THROTTLE_CLI`/`REAL_GH` path pointing INTO a lane clone (`.lanes/`). The lane pool resets,
 * recycles and deletes lane clones the moment their own PR lands — a shim baked with a lane path breaks EVERY
 * gh call routed through it the instant that lane goes away, silently, with no warning until something tries
 * to call `gh` (live: a shim found hard-coding `.../.lanes/web-everything/lane-22/scripts/lib/gh-throttle.mjs`).
 * This smell exists to catch that BEFORE the lane resets, not after. READ-ONLY toward the token store: reads
 * only the generated shim SCRIPTS themselves (baked-in paths, never a secret) — never `web-everything.json`
 * (the token cache) alongside them.
 */
export function probeGhShimLanes({ home = homedir(), exists = existsSync, readdir = readdirSync, readFile = readFileSync } = {}) {
  const root = join(home, '.claude', 'github-app-token');
  const shimPaths = [];
  const legacy = join(root, 'gh-shim', 'gh');
  if (exists(legacy)) shimPaths.push(legacy);
  const dDir = join(root, 'gh-shim.d');
  if (exists(dDir)) {
    for (const entry of readdir(dDir)) {
      const p = join(dDir, entry, 'gh');
      if (exists(p)) shimPaths.push(p);
    }
  }
  const laneLike = (v) => typeof v === 'string' && /\/\.lanes\//.test(v);
  return shimPaths.map((p) => {
    let src = '';
    try { src = readFile(p, 'utf8'); } catch { /* unreadable — reports as no baked path found, never throws */ }
    const throttleCli = src.match(/const GH_THROTTLE_CLI = "([^"]*)"/)?.[1] ?? null;
    const realGh = src.match(/const REAL_GH = "([^"]*)"/)?.[1] ?? null;
    return { path: p, throttleCli, realGh, inLane: laneLike(throttleCli) || laneLike(realGh) };
  });
}

/** The last `{"checked":true,"health":{…}}` line each lane-pool-health-watch log printed. */
export function probeLanePools(logsDir) {
  const out = [];
  for (const key of Object.keys(CONSTELLATION_REPOS)) {
    const path = join(logsDir, `lane-pool-health-watch-${key}.log`);
    if (!existsSync(path)) continue;
    const st = statSync(path);
    const text = readRange(path, Math.max(0, st.size - 512 * 1024), st.size);
    const matches = [...text.matchAll(/\{"checked":true,"health":(\{[^}]*\})/g)];
    if (!matches.length) continue;
    try { out.push({ repo: key, health: JSON.parse(matches.at(-1)[1]), at: st.mtimeMs }); } catch { /* skip */ }
  }
  return out;
}

function run(cmd, args, { timeoutMs = CHILD_TIMEOUT_MS, cwd = REPO_ROOT } = {}) {
  return execFileSync(cmd, args, { cwd, encoding: 'utf8', timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
}

/** `machine-overload`'s own process snapshot: every live process, BSD/macOS `ps` column order
 *  `pid,ppid,pcpu,etime,command` (parsed by the pure {@link parsePsOutput}). `--ps-fixture=FILE` (tick()) reads
 *  this same column order from a file instead — the incident-reproduction path (no load generator is ever run
 *  to test this smell). */
export function probeProcesses({ exec = run } = {}) {
  return parsePsOutput(exec('ps', ['-Ao', 'pid,ppid,pcpu,etime,command'], { timeoutMs: 15_000 }));
}

/** `machine-overload`'s own load signal: `os.loadavg()` (1/5/15 min) + core count, so the smell can normalize
 *  loadavg to "per core". `--machine-load-fixture=FILE` (tick()) reads `{load1,load5,load15,cpuCount}` JSON
 *  instead — real `os.loadavg()` right now reads whatever this machine's normal load is, never the incident. */
export function probeMachineLoad({ getLoadAvg = loadavg, getCpuCount = () => cpus().length } = {}) {
  const [load1, load5, load15] = getLoadAvg();
  return { load1, load5, load15, cpuCount: Math.max(1, getCpuCount()) };
}

/** `gh-call-failures`' input: the TAIL (last `maxBytes`) of gh-throttle's sidecar `calls.jsonl`, parsed. The
 *  file grows unbounded (14MB live), so only the tail is read; a torn first line is skipped. `[]` if absent. */
export function probeGhCalls({ logPath = ghThrottleLogPath(ghThrottleLockRoot()), maxBytes = 2 * 1024 * 1024 } = {}) {
  if (!existsSync(logPath)) return [];
  const size = statSync(logPath).size;
  const len = Math.min(size, maxBytes);
  const buf = Buffer.alloc(len);
  const fd = openSync(logPath, 'r');
  try { readSync(fd, buf, 0, len, size - len); } finally { closeSync(fd); }
  const out = [];
  for (const line of buf.toString('utf8').split('\n')) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch { /* torn first line / partial write */ }
  }
  return out;
}

/** `gh-graphql-budget`'s input: the App installation's REAL GraphQL bucket (the in-band `rateLimit` field — never
 *  the REST `/rate_limit` endpoint, whose `graphql` entry disagreed with it live) plus the throttle's active
 *  shared budget-block records. 1 GraphQL point per tick. */
/** #4309 — the hourly GitHub-spend persistence step `tick` runs alongside {@link probeGhCalls}: rolls every fully
 *  closed hour of `calls.jsonl` into `spend-hourly.jsonl` (next to the log) through gh-spend.mjs's own cursor. */
export function persistGhSpend({ logPath = ghThrottleLogPath(ghThrottleLockRoot()), now = Date.now(), persist = persistSpendHours } = {}) {
  return persist({ logPath, now });
}

export function probeGraphqlBudget({ exec = run, lockRoot = ghThrottleLockRoot(), nowMs = Date.now() } = {}) {
  let sample = null;
  try {
    const raw = exec('gh', budgetProbeArgs('graphql'));
    const j = JSON.parse(String(raw || '{}'))?.data?.rateLimit;
    if (j && typeof j.remaining === 'number') sample = { remaining: j.remaining, limit: typeof j.limit === 'number' ? j.limit : null, resetAt: j.resetAt || null };
  } catch { sample = null; }
  const blocks = [];
  try {
    for (const f of readdirSync(lockRoot)) {
      if (!/^budget-block-.*\.json$/.test(f)) continue;
      try { const b = JSON.parse(readFileSync(join(lockRoot, f), 'utf8')); if (Number.isFinite(b?.untilMs) && b.untilMs > nowMs) blocks.push(b); } catch { /* torn */ }
    }
  } catch { /* no lock root yet */ }
  return { sample, blocks };
}

export function probePrs({ exec = run } = {}) {
  const out = [];
  for (const { slug } of Object.values(CONSTELLATION_REPOS)) {
    // #gh-graphql-budget — the host-shared open-PR snapshot when this is the real `run` (never a test's fake exec).
    // `isDraft` (draft-first PRs, operator-approved 2026-09-27) — already part of `SNAPSHOT_FIELDS`, added here
    // so the `draft-not-promoted` smell can read it; the shared-cache path costs nothing extra for it.
    const shared = exec === run ? readSharedOpenPrs({ repo: slug, fields: 'number,title,headRefName,labels,statusCheckRollup,updatedAt,isDraft' }) : null;
    const rows = shared || JSON.parse(exec('gh', ['pr', 'list', '--repo', slug, '--state', 'open', '--limit', '100', '--json', 'number,title,headRefName,labels,statusCheckRollup,updatedAt,isDraft']));
    for (const pr of rows) {
      out.push({
        repo: slug, number: pr.number, title: pr.title, headRefName: pr.headRefName, updatedAt: pr.updatedAt,
        isDraft: !!pr.isDraft,
        labels: (pr.labels || []).map((l) => ({ name: l.name })),
        // `status` (draft-first PRs, operator-approved 2026-09-27) — carried alongside `state`/`conclusion` so
        // `we:scripts/operations/pr-status.mjs#reduceCheckState` (the `draft-not-promoted` smell's own green
        // check) reads the SAME completion signal every other CI-truth consumer in this repo does off a raw
        // `gh pr view --json statusCheckRollup` CheckRun entry (`status`+`conclusion`) — omitting it here would
        // have every real GitHub-Actions check (CheckRun-shaped, no `.state` at all) read as perpetually
        // "running" through that function, since it never looks at `.state`.
        statusCheckRollup: (pr.statusCheckRollup || []).map((c) => ({ name: c.name || c.context, conclusion: c.conclusion, state: c.state, status: c.status, completedAt: c.completedAt })),
      });
    }
  }
  return out;
}

export function probeAgents({ exec = run } = {}) {
  const arr = JSON.parse(exec('claude', ['agents', '--json'], { cwd: homedir() }));
  // `cwd`/`sessionId` carried through (additive — no existing smell reads `probes.agents` at all yet) so the
  // claude-auth-expired sign below can resolve each background session's own transcript.
  // #xrv69j6 — `status`/`waitingFor` ALSO carried through (additive, same reasoning): a background session
  // blocked on Claude Code's own unanswerable permission prompt reports `state: "blocked"`,
  // `status: "waiting"`, `waitingFor: "permission prompt"` (measured live, `claude agents --json`, session
  // `fix-2735`) — the `dispatch-permission-stall` smell below is the first reader.
  return arr.map((a) => ({
    name: a.name, state: a.state, kind: a.kind, startedAt: a.startedAt, cwd: a.cwd, sessionId: a.sessionId,
    status: a.status ?? null, waitingFor: a.waitingFor ?? null,
  }));
}

/**
 * Live incident, night of 2026-09-25/26 ET — the operator's own Claude login expired and every daemon-
 * dispatched session hit an immediate CLI auth failure. Reads each BACKGROUND session's own transcript via the
 * shared detector ({@link readClaudeAuthExpiredInfo}, `we:scripts/conveyor/hung-session.mjs` — the SAME one
 * `session-reaper.mjs`'s reap axis and `reconcile-core.mjs`'s liveness mark both use, so this sign can never
 * disagree with either about what "auth-expired" means) and returns just the ones it flags, each carrying its
 * OWN `startedAt` (the "when" the `claude-auth-expired` smell's own 30-minute window measures from — these
 * sessions fail on their very first turn, so `startedAt` IS effectively "when the failure happened").
 * @param {Array<{name?:string, kind?:string, cwd?:string, sessionId?:string, startedAt?:string|number}>} agents
 * @param {{readInfo?:Function}} [io]
 * @returns {Array<{name:string, startedAt:number|null}>}
 */
export function probeAuthExpiredSessions(agents, { readInfo = readClaudeAuthExpiredInfo } = {}) {
  const out = [];
  for (const a of Array.isArray(agents) ? agents : []) {
    if (a?.kind !== 'background' || !a?.cwd || !a?.sessionId) continue;
    let info = null;
    try { info = readInfo(a); } catch { info = null; }
    if (info?.authExpired !== true) continue;
    const startedAt = typeof a.startedAt === 'number' ? a.startedAt : Date.parse(a.startedAt ?? '');
    out.push({ name: a.name ?? null, startedAt: Number.isFinite(startedAt) ? startedAt : null });
  }
  return out;
}

/**
 * #x9fbg1x, live incident `fix-2748`/`fix-2770` (2026-09-26) — reads each session `stuckOnPermissionPrompt`
 * (`we:scripts/conveyor/health-smells/dispatch-permission-stall.mjs`) already names as stuck on an unanswerable
 * permission prompt, and asks the SAME shared detector `reconcile-core.mjs#markBgIsolationStalls` uses
 * (`we:scripts/conveyor/bg-isolation-stall.mjs#readBgIsolationStallInfo`) whether its OWN transcript shows
 * Claude Code's own background-session worktree-isolation guard refusal ("Call EnterWorktree first…")
 * specifically, rather than some other permission gate (e.g. the lane-grant one `dispatch-permission-stall`
 * already covers generically). Returns only the ones it confirms — modeled directly on
 * {@link probeAuthExpiredSessions} just above, same shape, same "read a transcript only for a candidate the
 * cheap listing check already narrowed to" cost discipline.
 * @param {Array<{name?:string, kind?:string, state?:string, waitingFor?:string, cwd?:string, sessionId?:string, startedAt?:string|number}>} agents
 * @param {{readInfo?:Function}} [io]
 * @returns {Array<{name:string, sessionId:string|null, cwd:string|null, startedAt:number|null, evidence:string|null}>}
 */
export function probeBgIsolationStalls(agents, { readInfo = readBgIsolationStallInfo } = {}) {
  const out = [];
  for (const a of stuckOnPermissionPrompt(agents)) {
    let info = null;
    try { info = readInfo(a); } catch { info = null; }
    if (info?.stall !== true) continue;
    const startedAt = typeof a.startedAt === 'number' ? a.startedAt : Date.parse(a.startedAt ?? '');
    out.push({
      name: a.name ?? null, sessionId: a.sessionId ?? null, cwd: a.cwd ?? null,
      startedAt: Number.isFinite(startedAt) ? startedAt : null, evidence: info.evidence ?? null,
    });
  }
  return out;
}

/**
 * The `stale-claim` smell's class-A input: every `status: active`/`preparing` backlog claim's liveness, via the
 * declared `stale-state` read (#911) — shelled exactly like `lane-starvation`'s own `diagnose` already does, so
 * this probe and that diagnose never drift onto two different readers. Read-only; a hard timeout, like every
 * other child call in this file.
 * @returns {{observedAt:string, records:Array<object>, gaps:string[]}}
 */
export function probeStaleState({ exec = run, timeoutMs = 90_000 } = {}) {
  const out = exec(process.execPath, [join(REPO_ROOT, 'scripts/operations/run.mjs'), 'stale-state', '--json'], { timeoutMs });
  return JSON.parse(out).verdict;
}

/**
 * The `stale-claim` smell's class-B input: every backlog card (`{stem, body}`, reused from
 * `../backlog-stranded-sweep.mjs`'s own reader — never a second `backlog/` scan) plus the merged-PR list its
 * pure `sweepStrandings` matches against. ONE `gh pr list --state merged` read serves both the smell's `matched`
 * tier (via `sweepStrandings`) and its lower-confidence `mentioned` tier (a body scan over this same list) —
 * never a duplicate merged-PR fetch.
 * @returns {{cards:Array<{stem:string, body:string}>, prs:Array<object>}}
 */
export function probeMergedPrs({ exec = run, limit = 800, timeoutMs = 60_000 } = {}) {
  const prs = JSON.parse(exec('gh', ['pr', 'list', '--repo', CONSTELLATION_REPOS.we.slug, '--state', 'merged', '--limit', String(limit), '--json', 'number,title,headRefName,body'], { timeoutMs }));
  return { cards: readBacklogCards(REPO_ROOT), prs };
}

// ── the tick ─────────────────────────────────────────────────────────────────────────────────────────────────

function acquireTickLock(dir) {
  mkdirSync(dir, { recursive: true });
  const p = join(dir, 'tick.lock');
  try {
    if (existsSync(p) && Date.now() - statSync(p).mtimeMs > 10 * MINUTE) unlinkSync(p);
    writeFileSync(p, String(process.pid), { flag: 'wx' });
    return () => { try { unlinkSync(p); } catch { /* gone */ } };
  } catch { return null; }
}

/**
 * One tick: probe → pure core → diagnoses → write state, reports, stamp.
 * @returns {Promise<object>} a summary (also what `--json` prints)
 */
export async function tick(flags = {}) {
  const started = Date.now();
  const now = flags.now ? Date.parse(flags.now) : started;
  const dir = healthDir(flags['state-root']);
  const statePath = join(dir, 'state.json');
  const prev = { ...emptyHealthState(), ...readJson(statePath, {}) };
  const config = { ...DEFAULT_HEALTH_CONFIG, ...readJson(join(dir, 'config.json'), {}) };
  const logsDir = flags['logs-dir'] || defaultLogsDir();
  const probeErrors = {};
  const probes = {};
  // A probe's error text is scrubbed at capture: an auth failure can echo a token in its message.
  const attempt = (name, fn) => { try { return fn(); } catch (e) { probeErrors[name] = scrubText(String(e?.message || e).split('\n')[0]); return undefined; } };

  const logs = attempt('daemonLogs', () => probeDaemonLogs(logsDir, prev.cursors || {}));
  if (logs) probes.daemonLogs = logs.samples;
  // Daemon inventory: the declared daemon-status read (#4067) on a real host; the raw lease-dir scan only when a
  // test/fixture points --lock-root somewhere, or daemon-status itself fails (then that failure is a probe error).
  const leaseScan = () => probeLeases(flags['lock-root'] || RUNNER_LOCK_ROOT, new Set((logs?.samples || []).map((s) => s.name)));
  probes.leases = flags['lock-root'] ? attempt('leases', leaseScan)
    : (attempt('daemonStatus', () => probeDaemonStatus()) ?? attempt('leases', leaseScan));
  probes.selfSync = attempt('selfSync', () => probeSelfSync(flags['self-sync-dir'] || defaultSelfSyncDir()));
  probes.lanePools = attempt('lanePools', () => probeLanePools(logsDir));
  // #4200-ish — cheap, fs-only, every tick: catches a shim baked with a lane-clone path BEFORE that lane resets.
  probes.ghShimLanes = attempt('ghShimLanes', () => probeGhShimLanes());
  probes.appStatus = attempt('appStatus', () => readGithubAppStatus()) ?? null;
  // The declared heavy-command admission read (cap, held slots, waiters with requestedAt) — a fixture file in tests.
  probes.heavyQueue = attempt('heavyQueue', () => (flags['heavy-status-file']
    ? JSON.parse(readFileSync(flags['heavy-status-file'], 'utf8'))
    : JSON.parse(run(process.execPath, [join(REPO_ROOT, 'scripts/readiness/heavy-admission.mjs'), 'status', '--json'], { timeoutMs: 15_000 }))));
  // `machine-overload`'s own inputs — every tick, cheap, never gh-gated. `--ps-fixture`/`--machine-load-fixture`
  // are the incident-reproduction path: this repo never runs a load generator to test this smell (see that
  // smell's own header) — it feeds a real-shaped `ps` snapshot through the exact same tick instead.
  probes.processes = attempt('processes', () => (flags['ps-fixture']
    ? parsePsOutput(readFileSync(flags['ps-fixture'], 'utf8'))
    : probeProcesses()));
  probes.machineLoad = attempt('machineLoad', () => (flags['machine-load-fixture']
    ? JSON.parse(readFileSync(flags['machine-load-fixture'], 'utf8'))
    : probeMachineLoad()));
  // `gh-call-failures` — fs-only, every tick: the gh-throttle call log's tail (`--gh-calls-log=FILE` in tests).
  probes.ghCalls = attempt('ghCalls', () => probeGhCalls(flags['gh-calls-log'] ? { logPath: flags['gh-calls-log'] } : {}));
  // #4309 — alongside (never replacing) the 2 MB tail above: persist every fully closed hour of GitHub spend once,
  // through gh-spend.mjs's OWN byte cursor, so hours survive log rotation and the tail never loses a window.
  const ghSpend = attempt('ghSpend', () => persistGhSpend({ ...(flags['gh-calls-log'] ? { logPath: flags['gh-calls-log'] } : {}), now }));
  // `review-seat-cap-near-limit` (card xn2wf9t) — fs-only, every tick: each non-Claude review seat provider's
  // OWN daily cap usage, off the SAME scorecard store + reservation ledgers `runExtraSeats`/`runRedTeam` admit
  // against (`--scorecard-store-fixture=FILE` in tests, so this never touches a real store in the test suite).
  probes.reviewSeatCaps = attempt('reviewSeatCaps', () => readSeatCapUsage({
    storePath: flags['scorecard-store-fixture'] || undefined,
    now,
  }));
  // `gh-graphql-budget` — every tick (1 GraphQL point): the real bucket + the throttle's shared budget blocks.
  // `--graphql-budget-fixture=FILE` (a `{sample, blocks}` JSON) in tests; skipped under `--no-gh`.
  // `pr-events-stale` — fs-only, every tick: each event-driven waker's status file (`[]` while WE_PR_EVENTS is off).
  probes.prEventsStatus = attempt('prEventsStatus', () => readPrEventsStatuses(flags['pr-events-state-dir'] || undefined));
  if (flags['graphql-budget-fixture']) probes.graphqlBudget = attempt('graphqlBudget', () => JSON.parse(readFileSync(flags['graphql-budget-fixture'], 'utf8')));
  else if (!flags['no-gh']) probes.graphqlBudget = attempt('graphqlBudget', () => probeGraphqlBudget());

  const ghCache = prev.ghCache || {};
  const ghDue = !flags['no-gh'] && (flags['force-gh'] || !ghCache.at || now - ghCache.at >= GH_CADENCE_MS);
  if (ghDue) {
    const prs = attempt('prs', () => probePrs());
    const agents = attempt('agents', () => probeAgents());
    // Each probe is set independently of the other succeeding: red-pr-unattended still only evaluates once BOTH
    // are present (its own `probes: ['prs', 'agents']` declaration already gates that), but stale-claim needs
    // only `prs` and must not sit blocked on a failing `agents` read too. `ghCache.at` still needs both, so a
    // partial gh hiccup keeps `ghDue` true and retries sooner rather than waiting the full cadence.
    if (prs) probes.prs = prs;
    if (agents) probes.agents = agents;
    if (prs && agents) ghCache.at = now;
    // claude-auth-expired's own probe needs only `agents` (the exact same listing, same cadence) — independent
    // of whether `prs` also succeeded this tick, same reasoning as stale-claim's two probes just below.
    if (agents) probes.authExpired = attempt('authExpired', () => probeAuthExpiredSessions(agents));
    // #x9fbg1x — same cadence/gating reasoning as `authExpired` just above: needs only the same `agents`
    // listing, independent of whether `prs` also succeeded this tick.
    if (agents) probes.bgIsolationStalls = attempt('bgIsolationStalls', () => probeBgIsolationStalls(agents));
    // stale-claim's two probes ride the same 'gh' cadence (both are gh/git-heavy reads); independent of the
    // prs/agents pairing above — one failing never blocks the other.
    const staleState = attempt('staleState', () => probeStaleState());
    if (staleState) probes.staleState = staleState;
    const mergedPrs = attempt('mergedPrs', () => probeMergedPrs());
    if (mergedPrs) probes.mergedPrs = mergedPrs;
  }

  // A tick the watchdog killed last time is the overrun smell's input.
  const overrunPath = join(dir, 'overrun.json');
  const overrun = readJson(overrunPath, null);
  let lastTickForSmells = prev.lastTick;
  if (overrun) lastTickForSmells = { ...(prev.lastTick || {}), durationMs: overrun.killedAfterMs, killedByWatchdog: true };

  // Silences live in their OWN file, written only by `silence`/`unsilence` and only read here, so a silence
  // set while a tick runs can never be lost to the tick's state.json write (nor roll that write back). Which
  // expired silences were already announced is tick state (`notifiedSilences`).
  const notified = new Set(prev.notifiedSilences || []);
  const silenceSig = (x) => `${x.smell}|${x.subject ?? '*'}|${x.card ?? ''}|${x.expiresAt ?? ''}`;
  const silences = readJson(join(dir, 'silences.json'), []).map((x) => ({ ...x, expiredNotified: notified.has(silenceSig(x)) }));
  // A silence whose tracking card is still `active` never expires (4065 Fork 3): read those cards' status.
  const activeCards = readActiveCards(silences.map((x) => x.card).filter(Boolean), flags['backlog-dir'] || join(REPO_ROOT, 'backlog'));
  const result = runHealthTick({ ...prev, silences, lastTick: lastTickForSmells }, probes, SMELLS, now, { config, probeErrors, activeCards });
  // Scrubbed ONCE, right here: everything below — the printed section, the returned summary, every file — sees
  // only the redacted state.
  const state = scrubDeep(result.state);
  state.notifiedSilences = (result.state.silences || []).filter((x) => x.expiredNotified).map(silenceSig);
  delete state.silences;
  state.cursors = logs ? { ...(prev.cursors || {}), ...logs.cursors } : prev.cursors;
  state.ghCache = { at: ghCache.at ?? null };

  // Deterministic diagnoses (allowed in shadow mode) — hard timeout each.
  const diagnoses = [];
  for (const p of result.plan.filter((x) => x.kind === 'diagnose')) {
    const ep = state.episodes[p.key];
    if (!ep || flags['no-diagnose']) continue;
    const { command, args = [], timeoutMs = CHILD_TIMEOUT_MS } = p.diagnose;
    let d;
    try { d = { command: [command, ...args].join(' '), code: 0, output: run(command, args, { timeoutMs }) }; }
    catch (e) { d = { command: [command, ...args].join(' '), code: e?.status ?? null, timedOut: e?.code === 'ETIMEDOUT' || e?.signal === 'SIGTERM', output: `${e?.stdout || ''}${e?.stderr || ''}` || String(e?.message || e) }; }
    d.output = scrubText(summarizeDiagnosisOutput(d.output)); // scrubbed at capture: every persisted copy is redacted
    ep.diagnosis = d;
    diagnoses.push({ key: p.key, command: d.command, code: d.code });
  }

  // #4078 — the diagnose-only investigation agent: stop what is due, dispatch what the budget clears (nothing
  // unless config `investigateDispatch` is on), and put each episode's investigation status + findings on the
  // episode so the reports written below carry them. Its own failure is a probe error, never a failed tick.
  let investigations = null;
  if (!flags['no-investigate']) {
    try {
      investigations = await runInvestigations({ dir, state, smells: SMELLS, config, now, dryRun: !!flags['dry-run'] });
    } catch (e) { probeErrors.investigate = scrubText(String(e?.message || e).split('\n')[0]); }
  }

  // Real desktop notifications — THE MINIMAL NOTIFY PATH (#4077 slice 1 shipped with none: every `notify` plan
  // entry was only ever reported as "Held back" in a report, never actually sent, in ANY mode — see
  // `health-watch-core.mjs#planActions`'s own doc). Only entries `planActions` did NOT mark `suppressed` reach
  // here: every pre-existing smell stays exactly as silent as before in shadow mode (nothing here changes for
  // them), and the ONLY smells that can produce a non-suppressed entry while `mode: 'shadow'` are the ones
  // listed in `health-smells-notify-list.mjs`'s `NOTIFY_EVEN_IN_SHADOW` — the ONE declared place for this list
  // (deliberately not hand-enumerated here, since a stale copy here would read as authoritative; see that
  // file's own header for the operator decision behind its current contents). Best-effort:
  // `notifyDesktopChecked` already reports its own failure rather than throwing; a delivery failure here must
  // never fail the tick.
  const notifications = [];
  for (const p of result.plan.filter((x) => x.kind === 'notify' && !x.suppressed)) {
    const ep = state.episodes[p.key];
    // `--dry-run`/`--no-notify` both skip actually SENDING one (an OS-visible side effect, unlike the
    // read-only diagnoses above) — a dry-run reports what it would have sent via `result.plan` already.
    if (!ep || flags['no-notify'] || flags['dry-run']) continue;
    const title = `Health: ${ep.smell} — ${ep.subject}`;
    const body = scrubText(ep.recommendation || ep.summary || 'See the health report.');
    let sent;
    try { sent = notifyDesktopChecked({ title, body }); } catch (e) { sent = { ok: false, error: String(e?.message || e) }; }
    notifications.push({ key: p.key, ok: sent?.ok === true, error: sent?.ok === true ? null : scrubText(sent?.error ?? 'unknown') });
  }

  const completedAt = Date.now();
  const durationMs = completedAt - started;
  state.lastTick = { completedAt: flags.now ? now : completedAt, durationMs, mode: config.mode, probeErrors };

  const reportDir = join(dir, 'episodes');
  const smellsById = Object.fromEntries(SMELLS.map((s) => [s.id, s]));
  const written = [];
  if (!flags['dry-run']) {
    const toWrite = [...Object.values(state.episodes).filter((e) => e.status !== 'pending'),
      ...result.transitions.filter((t) => t.type === 'closed').map((t) => t.episode)];
    for (const ep of toWrite) {
      if (!ep?.id) continue;
      const md = renderEpisodeReport(ep, { now, smell: smellsById[ep.smell], diagnosis: ep.diagnosis, plan: result.plan, mode: config.mode });
      writeJsonAtomic(join(reportDir, `${ep.id}.md`), md);
      writeJsonAtomic(join(reportDir, `${ep.id}.json`), scrubDeep(ep));
      written.push(join(reportDir, `${ep.id}.md`));
    }
    writeJsonAtomic(statePath, state);
    writeJsonAtomic(join(dir, 'last-tick.json'), state.lastTick);
    if (overrun) { try { unlinkSync(overrunPath); } catch { /* gone */ } }
  }
  // The whole summary goes through the scrub too (the last choke point before stdout).
  return scrubDeep({
    now: new Date(now).toISOString(), durationMs, mode: config.mode, stateDir: dir, ghSampled: !!probes.prs,
    ghSpend: ghSpend ?? null, probeErrors, transitions: result.transitions.map((t) => ({ type: t.type, key: t.key })),
    plan: result.plan.map(({ diagnose, ...rest }) => rest), diagnoses, notifications, investigations, reports: written,
    section: renderHealthSection(state, { now, reportDir }),
    skipped: result.evaluations.filter((e) => !e.results).map((e) => ({ smell: e.smell.id, missing: e.skipped, error: e.error })),
  });
}

function parseFlags(argv) {
  const flags = {};
  const pos = [];
  for (const a of argv) {
    if (!a.startsWith('--')) { pos.push(a); continue; }
    const eq = a.indexOf('=');
    flags[eq === -1 ? a.slice(2) : a.slice(2, eq)] = eq === -1 ? true : a.slice(eq + 1);
  }
  return { flags, pos };
}

async function main(argv) {
  const { flags, pos } = parseFlags(argv);
  const cmd = pos[0] || 'tick';
  const dir = healthDir(flags['state-root']);
  if (cmd === 'section') { console.log(healthSectionLines({ stateRoot: flags['state-root'] }).join('\n')); return 0; }
  if (cmd === 'silence' || cmd === 'unsilence') {
    if (!flags.smell) { console.error('health-watch: --smell=<id> is required'); return 1; }
    // Only this command writes silences.json; the tick only reads it (see tick()).
    const silencesPath = join(dir, 'silences.json');
    const subject = typeof flags.subject === 'string' ? flags.subject : null;
    const silences = readJson(silencesPath, []).filter((x) => !(x.smell === flags.smell && (x.subject ?? null) === subject));
    if (cmd === 'silence') {
      if (!flags.card) { console.error('health-watch: a silence must name the tracking card (--card=NNN)'); return 1; }
      const hours = Number(flags.hours) || DEFAULT_HEALTH_CONFIG.silenceDefaultMs / 3_600_000;
      silences.push({ smell: flags.smell, subject, card: String(flags.card), expiresAt: Date.now() + hours * 3_600_000 });
    }
    writeJsonAtomic(silencesPath, silences);
    console.log(`health-watch: ${cmd}d ${flags.smell}${subject ? ` / ${subject}` : ''}`);
    return 0;
  }
  if (cmd !== 'tick') { console.error(`health-watch: unknown command "${cmd}" (tick | section | silence | unsilence)`); return 1; }

  // `--in-process` is the watchdog's worker child: its parent already holds the tick lock.
  const release = flags['dry-run'] || flags['in-process'] ? () => {} : acquireTickLock(dir);
  if (!release) { console.error('health-watch: another tick holds the tick lock — skipping.'); return 0; }
  const budget = (readJson(join(dir, 'config.json'), {}).tickBudgetMs) ?? DEFAULT_HEALTH_CONFIG.tickBudgetMs;
  if (flags['in-process']) {
    // The worker: runs the tick itself. Its probes block on synchronous child calls, so no timer in THIS
    // process could interrupt it — the watchdog lives in the parent (below).
    try {
      const summary = await tick(flags);
      if (flags.json) console.log(JSON.stringify(summary, null, 2));
      else {
        console.log(`health-watch: tick ${summary.now} in ${summary.durationMs}ms (${summary.mode}); transitions: ${summary.transitions.map((t) => `${t.type} ${t.key}`).join(', ') || 'none'}`);
        console.log(summary.section.join('\n'));
      }
      return 0;
    } finally { release(); }
  }
  try {
    return await runTickWithWatchdog(argv, { dir, killAfterMs: budget * 3 });
  } finally { release(); }
}

/**
 * The whole-tick watchdog. The tick runs in a CHILD process (`tick --in-process`) and this parent — whose event
 * loop never blocks — kills it with SIGKILL after `killAfterMs` and records `overrun.json`, which the next tick
 * turns into the `health-tick-overrun` smell. (An in-process setTimeout cannot do this: the tick's synchronous
 * execFileSync probes block the very event loop the timer needs.)
 * @returns {Promise<number>} the exit code: the child's own, or 3 when the watchdog killed it
 */
export function runTickWithWatchdog(argv, { dir, killAfterMs, script = fileURLToPath(import.meta.url) }) {
  return new Promise((resolveExit) => {
    const child = spawn(process.execPath, [script, ...argv, '--in-process'], { stdio: 'inherit' });
    let killed = false;
    const timer = setTimeout(() => {
      killed = true;
      try { writeJsonAtomic(join(dir, 'overrun.json'), { at: new Date().toISOString(), killedAfterMs: killAfterMs }); } catch { /* best effort */ }
      console.error(`health-watch: tick exceeded ${killAfterMs}ms — killed by the watchdog.`);
      child.kill('SIGKILL');
    }, killAfterMs);
    child.on('exit', (code) => { clearTimeout(timer); resolveExit(killed ? 3 : (code ?? 1)); });
    child.on('error', () => { clearTimeout(timer); resolveExit(1); });
  });
}

const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (IS_CLI) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (e) => { console.error(`health-watch: fatal: ${e?.stack || e}`); process.exitCode = 1; });
}
