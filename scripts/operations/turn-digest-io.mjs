/**
 * @file scripts/operations/turn-digest-io.mjs
 * @description THE IO SHELL of {@link ./turn-digest.mjs} — the reader its `read` step is injected with, and the
 *   post-run `finish` hook that writes the snapshot. `turn-digest.mjs` reaches none of this.
 *
 * EVERYTHING HERE READS, except two files under the operations state root (never the repo, never committed):
 *   · `<state>/latest.json`            — the last digest, written atomically by {@link createTurnDigestFinish}. The
 *                                        delivery hook (#3726) reads only this file.
 *   · `<state>/cursors/<consumer>.json` — one consumer's "landed since" cursor, written only on `--advance`.
 * `<state>` is `$TURN_DIGEST_DIR` when set, else `<coordination-root>/turn-digest` (the root `run-store.mjs` uses, with
 * its own `WE_COORDINATION_ROOT` override), so a test or a second operator never shares a host's real files.
 *
 * ── WHICH READS COMPOSE HERE, AND WHAT EACH COSTS WHEN IT IS MISSING ──────────────────────────────────────────
 *
 * Every section is read behind its own port, and a port that throws or finds nothing yields
 * `{ available: false, reason }` — never an empty list (see the header of `turn-digest.mjs`).
 *
 *   | section            | real read                                                       | when it cannot run          |
 *   |--------------------|-----------------------------------------------------------------|-----------------------------|
 *   | `landed`           | `git log --first-parent --merges <cursor>..origin/main`         | not a checkout / bad cursor |
 *   | `needsOperator`    | `readNeedsYou` → the `operator-queue.mjs` found on ANY checkout | script on no checkout       |
 *   | `owed`             | `runReconcilePass({repo})` per repo                             | that repo's `gh` read fails |
 *   | `staleLabels`      | `gh pr list --state open` per repo                              | that repo's `gh` read fails |
 *   | `live.sessions`    | `defaultListAgents` (`claude agents --json`)                    | the listing throws          |
 *   | `live.inFlight`    | the run store's in-flight `conveyor.dispatch-delivery-agent`    | store unreadable            |
 *   | `live.lanes`       | `lane-pool list --json [--acquirable --no-reap]` per pool       | no pool for that repo       |
 *   | `runner`           | the runner lease + the dispatch-pause marker                    | lease unreadable            |
 *
 * `--no-reap` on the lane read is load-bearing: `lane-pool list --acquirable` runs the ghost-lease REAPER first
 * (#3449), which deletes lease files. A digest that reaped leases would not be read-only.
 *
 * `operator-queue.mjs` is found on whichever checkout has it (the same search `tracker-refresh` uses), because the
 * prototype branch does not carry the script itself. Where no checkout has it, `needsOperator` is unavailable.
 *
 * IMPURE by construction: `fs`, `git`, `gh`, child `node`.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONSTELLATION_REPOS } from '../lib/constellation-repos.mjs';
import { readNeedsYou } from '../lib/prototype-tracker-compact-io.mjs';
import { isParkedConflictTarget } from '../conveyor/parked-pr-conflict-watch.mjs';
import { runReconcilePass } from '../conveyor/reconcile-pass.mjs';
import { readPauseState, resolvePausedKinds } from '../readiness/dispatch-pause.mjs';
import { isLeaseExpired, readLockEntry } from '../readiness/file-locks.mjs';
import { RUNNER_LEASE_MINUTES, RUNNER_LEASE_PATH, RUNNER_LOCK_ROOT } from '../../skills-src/conveyor/runner-lock.mjs';
import { DISPATCH_EFFECT } from './dispatch-lane.mjs';
import { defaultIsPidAlive } from './restart-runner-io.mjs';
import { defaultListAgents } from './dispatch-lane-io.mjs';
import { resolveCoordinationRoot } from './coordination-root.mjs';
import { createFileRunStore } from './run-store.mjs';
import { DIGEST_VERSION, formatDigest, isValidConsumerId, resolveCursor } from './turn-digest.mjs';

/** The checkout this operation lives in (script location, never the cwd). */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Env override for the state directory. */
export const TURN_DIGEST_DIR_ENV = 'TURN_DIGEST_DIR';

/** The ref `landed` is read from. */
export const LANDED_REF = 'origin/main';

/** How many first-parent merge commits one `git log` may return; the pure layer trims to the caller's `limit`. */
export const LOG_WINDOW = 400;

/** Cards whose resolution makes `live` trustworthy. Their status is read off `origin/main`. */
export const LIVE_PREREQUISITES = Object.freeze(['3725', '3721']);

const GH_TIMEOUT_MS = 60 * 1000;
const PR_LIMIT = 200;

const firstLine = (e) => String(e?.message ?? e ?? '').split('\n').find((l) => l.trim())?.trim() ?? 'unreadable';

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
// The state directory: paths, the atomic writer, the cursor and the snapshot.

/** `<state>` — where the snapshot and the cursors live. */
export function resolveDigestDir({ env = process.env, home = homedir() } = {}) {
  const override = env[TURN_DIGEST_DIR_ENV];
  return override && override.trim() ? resolve(override.trim()) : join(resolveCoordinationRoot({ env, home }), 'turn-digest');
}

export const snapshotPath = (dir = resolveDigestDir()) => join(dir, 'latest.json');

/** One consumer's cursor file. Refuses an id that is not filename-safe. */
export function cursorPath(consumer, dir = resolveDigestDir()) {
  if (!isValidConsumerId(consumer)) throw new TypeError(`turn-digest: invalid consumer id ${JSON.stringify(consumer)} (letters, digits, . _ - ; at most 80)`);
  return join(dir, 'cursors', `${consumer}.json`);
}

/** Write a file ATOMICALLY (temp + rename), so a reader mid-write never sees partial JSON. */
export function writeAtomic(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, text);
  renameSync(tmp, path);
}

/** A consumer's stored cursor sha, or `null` when there is none. A torn or unreadable file reads as none. */
export function readStoredCursor(consumer, dir = resolveDigestDir()) {
  if (!consumer) return null;
  try {
    const parsed = JSON.parse(readFileSync(cursorPath(consumer, dir), 'utf8'));
    return typeof parsed?.sha === 'string' && parsed.sha.trim() ? parsed.sha.trim() : null;
  } catch { return null; }
}

/** Store a consumer's cursor. */
export function writeStoredCursor(consumer, sha, { dir = resolveDigestDir(), now = () => new Date() } = {}) {
  writeAtomic(cursorPath(consumer, dir), `${JSON.stringify({ consumer, sha, at: now().toISOString() }, null, 2)}\n`);
}

/** Write the snapshot. */
export function writeSnapshot(digest, dir = resolveDigestDir()) {
  writeAtomic(snapshotPath(dir), `${JSON.stringify(digest, null, 2)}\n`);
  return snapshotPath(dir);
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
// The landed-since read: pure git.

/** Default git runner: stdout, throws on a non-zero exit. */
export function defaultGit(args, { cwd } = {}) {
  return String(execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024, timeout: 60_000 }));
}

/**
 * THE LANDED READ. `{available:true, tip, cursor, limit, log}` or `{available:false, reason}`. The `log` is raw
 * `git log` text; the pure layer parses and reduces it to merged PR numbers.
 *
 * A CURSOR THAT IS NOT AN ANCESTOR OF THE TIP IS REFUSED, never quietly widened: after a history rewrite,
 * `cursor..tip` would list commits the consumer already saw (or none it has not), and either reads as a
 * confident answer. The consumer must reset its cursor deliberately.
 */
export function readLanded({ root = REPO_ROOT, ref = LANDED_REF, since = '', stored = null, limit, fetch = false, git = defaultGit } = {}) {
  const fetched = fetch ? tryFetch({ root, ref, git }) : null;
  let tip;
  try { tip = git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], { cwd: root }).trim(); } catch { tip = ''; }
  if (!tip) return { available: false, reason: `\`${ref}\` does not resolve in ${root} — fetch it first (\`git fetch origin main\`)` };

  const { cursor, source } = resolveCursor({ since, stored });
  let cursorSha = null;
  if (cursor) {
    try { cursorSha = git(['rev-parse', '--verify', '--quiet', `${cursor}^{commit}`], { cwd: root }).trim(); } catch { cursorSha = ''; }
    if (!cursorSha) return { available: false, reason: `cursor ${cursor} (from ${source}) is not a commit in this checkout` };
    try { git(['merge-base', '--is-ancestor', cursorSha, tip], { cwd: root }); } catch {
      return { available: false, reason: `cursor ${cursorSha.slice(0, 9)} (from ${source}) is not an ancestor of ${ref} — history was rewritten; reset the cursor` };
    }
  }
  let log;
  try {
    log = git(['log', '--first-parent', '--merges', `--max-count=${LOG_WINDOW}`, '--format=%H%x1f%cI%x1f%s', cursorSha ? `${cursorSha}..${tip}` : tip], { cwd: root });
  } catch (e) { return { available: false, reason: `git log failed: ${firstLine(e)}` }; }
  return { available: true, tip, cursor: { value: cursorSha, source: cursorSha ? source : 'none' }, limit, log, fetch: fetched };
}

/** A best-effort `git fetch` of the ref's branch. `{ok, error?}`; a failed fetch is reported, never fatal. */
function tryFetch({ root, ref, git }) {
  const [remote, ...rest] = ref.split('/');
  const branch = rest.join('/');
  if (!remote || !branch) return { ok: false, error: `cannot fetch ${ref}: not <remote>/<branch>` };
  try { git(['fetch', '--quiet', remote, `+refs/heads/${branch}:refs/remotes/${remote}/${branch}`], { cwd: root }); return { ok: true }; } catch (e) { return { ok: false, error: firstLine(e) }; }
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
// The GitHub reads.

/** Default `gh` runner. */
export function defaultGh(args) {
  return String(execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024, timeout: GH_TIMEOUT_MS }));
}

/** The argv for one repo's open-PR listing. Pinned by a test: `--state open` and `mergeable` are load-bearing. */
export function openPrsArgv(repo) {
  return ['pr', 'list', '--repo', repo, '--state', 'open', '--limit', String(PR_LIMIT), '--json', 'number,headRefName,labels,mergeable,mergeStateStatus'];
}

/** One repo's open PRs, each stamped with whether the conflict watch tracks it. Throws when the listing fails. */
export function listOpenPrs(repo, { gh = defaultGh } = {}) {
  const parsed = JSON.parse(gh(openPrsArgv(repo)) || '[]');
  return (Array.isArray(parsed) ? parsed : []).map((pr) => ({ ...pr, parked: isParkedConflictTarget({ mergeable: 'CONFLICTING', labels: pr.labels }) }));
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
// The live reads.

/** The sessions `claude agents --json` reports, reduced to what the digest carries. */
export function readSessions({ listAgents = defaultListAgents } = {}) {
  const raw = listAgents();
  if (!Array.isArray(raw)) throw new Error('the session listing was not an array');
  return raw.map((r) => ({ id: String(r.sessionId ?? r.id ?? ''), name: String(r.name ?? ''), status: String(r.status ?? r.state ?? ''), cwd: String(r.cwd ?? '') }));
}

/** EVERY in-flight dispatch effect across the run store (not one item's). Unreadable records are counted, not skipped. */
export function readInFlight({ store = createFileRunStore() } = {}) {
  const rows = [];
  let unreadable = 0;
  for (const id of store.list()) {
    let run;
    try { run = store.read(id); } catch { unreadable += 1; continue; }
    if (!run) continue;
    for (const e of Array.isArray(run.effects) ? run.effects : []) {
      if (e?.status !== 'in-flight' || e.type !== DISPATCH_EFFECT) continue;
      rows.push({ runId: String(run.id), item: String(e.payload?.num ?? ''), handle: e.handle ?? null, startedAt: e.startedAt ?? null, lastSeenLiveAt: e.lastSeenLiveAt ?? null });
    }
  }
  return { rows, unreadable };
}

/** Expand `$HOME` in a constellation checkout path; `''` means THIS checkout. */
const checkoutFor = (meta, home) => (meta.path ? meta.path.replace('$HOME', home) : REPO_ROOT);

/**
 * Lane counts per repo through `lane-pool list --json`, once plain and once `--acquirable --no-reap`. The reaper is
 * skipped on purpose (see the header). A repo with no checkout on this host is a per-repo `error`, not zero lanes.
 */
export function readLanes({ repos, run = (args, opts) => String(execFileSync('node', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000, ...opts })), exists = existsSync, home = homedir() } = {}) {
  const byRepo = [];
  for (const meta of repos) {
    const path = checkoutFor(meta, home);
    if (!exists(path)) { byRepo.push({ repo: meta.slug, total: null, acquirable: null, error: `no checkout at ${path}` }); continue; }
    try {
      const pool = join(REPO_ROOT, 'scripts', 'lane-pool.mjs');
      const total = JSON.parse(run([pool, 'list', '--json', `--repo=${path}`], { cwd: path }) || '[]');
      const free = JSON.parse(run([pool, 'list', '--json', '--acquirable', '--no-reap', `--repo=${path}`], { cwd: path }) || '[]');
      byRepo.push({ repo: meta.slug, total: total.length, acquirable: free.length });
    } catch (e) { byRepo.push({ repo: meta.slug, total: null, acquirable: null, error: firstLine(e) }); }
  }
  const ok = byRepo.filter((r) => !r.error);
  if (!ok.length) return { available: false, reason: byRepo.map((r) => `${r.repo}: ${r.error}`).join('; ') || 'no repos' };
  return { available: true, total: ok.reduce((n, r) => n + r.total, 0), acquirable: ok.reduce((n, r) => n + r.acquirable, 0), byRepo };
}

/** The runner's lease and the dispatch-pause marker. Both fail open on a missing file (no lease = down). */
export function readRunner({ readLease = () => readLockEntry(RUNNER_LOCK_ROOT, RUNNER_LEASE_PATH), isPidAlive = defaultIsPidAlive, readPause = () => readPauseState(), now = () => Date.now() } = {}) {
  const entry = readLease();
  const pid = Number.isFinite(Number(entry?.pid)) ? Number(entry.pid) : null;
  const pause = readPause();
  return {
    available: true,
    lease: entry
      ? { present: true, pid, heartbeatAt: entry.heartbeatAt ?? null, expired: isLeaseExpired(entry, now(), RUNNER_LEASE_MINUTES), pidAlive: pid === null ? null : isPidAlive(pid) }
      : { present: false, pid: null, heartbeatAt: null, expired: false, pidAlive: null },
    paused: pause.paused === true,
    pausedKinds: pause.paused === true ? resolvePausedKinds(pause) : null,
  };
}

/** The status of each prerequisite card, read off `ref` (a pure git read). An unreadable card is `unknown`, never `resolved`. */
export function readPrerequisites({ root = REPO_ROOT, ref = LANDED_REF, git = defaultGit, cards = LIVE_PREREQUISITES } = {}) {
  let names = [];
  try { names = git(['ls-tree', '--name-only', ref, 'backlog/'], { cwd: root }).split('\n'); } catch (e) {
    return cards.map((card) => ({ card, status: 'unknown', reason: `cannot list backlog on ${ref}: ${firstLine(e)}` }));
  }
  return cards.map((card) => {
    const file = names.find((n) => n.startsWith(`backlog/${card}-`));
    if (!file) return { card, status: 'unknown', reason: `no backlog card ${card} on ${ref}` };
    try {
      const head = git(['show', `${ref}:${file}`], { cwd: root }).split('\n').slice(0, 30).join('\n');
      const m = /^status:\s*"?([A-Za-z-]+)"?\s*$/m.exec(head);
      return m ? { card, status: m[1] } : { card, status: 'unknown', reason: 'card has no status field' };
    } catch (e) { return { card, status: 'unknown', reason: firstLine(e) }; }
  });
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
// The reader.

/** `--repos=a,b` (or empty: the whole constellation) to `[{key, slug, path}]`. An unknown slug is kept as a bare repo. */
export function resolveRepos(spec) {
  const all = Object.entries(CONSTELLATION_REPOS).map(([key, m]) => ({ key, ...m, slug: ghSlug(m.slug) }));
  const wanted = String(spec ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!wanted.length) return all;
  return wanted.map((w) => all.find((r) => r.slug === ghSlug(w) || r.key === w) ?? { key: w, slug: ghSlug(w), path: '', dirs: [] });
}

/**
 * A `gh --repo` value needs `OWNER/REPO`. This branch's copy of `CONSTELLATION_REPOS` carries bare `frontierui` and
 * `plateau-app`, which `gh` refuses with `expected the "[HOST/]OWNER/REPO" format`; they live under `chalbert/`. Found
 * by the first live probe of this digest. `origin/main`'s table already says `chalbert/frontierui` and
 * `chalbert/plateau-app`, so this is a no-op once the branch catches up; until then it keeps the digest working on both.
 */
export const ghSlug = (slug) => (String(slug).includes('/') ? String(slug) : `chalbert/${slug}`);

const guard = (fn) => { try { return fn(); } catch (e) { return { available: false, reason: firstLine(e) }; } };

/**
 * THE READER the declaration is injected with. Every port is injectable, so each section's unavailable path is
 * reachable in a test with no git, no `gh`, no `claude` and no lease.
 */
export function createTurnDigestReader(ports = {}) {
  const {
    root = REPO_ROOT,
    git = defaultGit,
    gh = defaultGh,
    dir = undefined,
    now = () => new Date(),
    readNeeds = () => readNeedsYou(),
    reconcile = (repo, agents) => runReconcilePass({ repo, readAgents: () => agents }),
    listAgents = defaultListAgents,
    readInFlightRows = () => readInFlight(),
    readLaneCounts = (repos) => readLanes({ repos }),
    readRunnerState = () => readRunner(),
    readPrereqs = () => readPrerequisites({ root, git }),
  } = ports;

  return ({ since = '', consumer = '', repos = '', limit, advance = false, fetch = false } = {}) => {
    const consumerId = String(consumer ?? '').trim();
    if (consumerId && !isValidConsumerId(consumerId)) throw new TypeError(`turn-digest: invalid --consumer ${JSON.stringify(consumerId)} (letters, digits, . _ - ; at most 80)`);
    const repoList = resolveRepos(repos);
    const stateDir = dir ?? resolveDigestDir();

    const landed = guard(() => readLanded({ root, since, stored: consumerId ? readStoredCursor(consumerId, stateDir) : null, limit: Number.isInteger(limit) ? limit : undefined, fetch, git }));

    const needsRaw = guard(() => {
      const r = readNeeds();
      return r?.error ? { available: false, reason: r.error } : { available: true, lines: r?.lines ?? [] };
    });

    // ONE session listing serves reconcile (for every repo) and `live.sessions`; a failing listing is both
    // `live.sessions` unavailable and a reason every repo's reconcile read is unavailable.
    let agents = null;
    let sessionsRaw;
    try { agents = listAgents(); sessionsRaw = { available: true, rows: readSessionsFrom(agents) }; } catch (e) { sessionsRaw = { available: false, reason: firstLine(e) }; }

    const byRepoPrs = [];
    const byRepoOwed = [];
    for (const r of repoList) {
      try { byRepoPrs.push({ repo: r.slug, prs: listOpenPrs(r.slug, { gh }) }); } catch (e) { byRepoPrs.push({ repo: r.slug, error: firstLine(e) }); }
      if (agents === null) { byRepoOwed.push({ repo: r.slug, error: `the session listing failed, so the reconcile plan cannot bind sessions to PRs (${sessionsRaw.reason})` }); continue; }
      try {
        const plan = reconcile(r.slug, agents);
        byRepoOwed.push({ repo: r.slug, dispatch: plan.dispatch, refusals: plan.refusals, notes: plan.notes });
      } catch (e) { byRepoOwed.push({ repo: r.slug, error: firstLine(e) }); }
    }

    const inFlight = guard(() => { const r = readInFlightRows(); return { available: true, ...r }; });
    const lanes = guard(() => readLaneCounts(repoList));
    const runner = guard(() => readRunnerState());
    const prerequisites = (() => { try { return readPrereqs(); } catch (e) { return LIVE_PREREQUISITES.map((card) => ({ card, status: 'unknown', reason: firstLine(e) })); } })();

    return {
      now: now().toISOString(),
      repos: repoList.map((r) => r.slug),
      consumer: consumerId || null,
      advance: advance === true,
      landed,
      needs: needsRaw,
      owed: { available: true, byRepo: byRepoOwed },
      prs: { available: true, byRepo: byRepoPrs },
      live: { sessions: sessionsRaw, inFlight, lanes, prerequisites },
      runner,
    };
  };
}

function readSessionsFrom(agents) {
  return readSessions({ listAgents: () => agents });
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
// The finish hook: the snapshot and the cursor.

/**
 * THE COMMAND LINE'S `finish` HOOK (`run.mjs` calls it with the settled run). Writes the snapshot, and — only when the
 * digest carries `cursor.advanceTo` — the consumer's cursor. It is NOT an engine effect and never appears in the run.
 *
 * Plain mode prints the readable digest and the snapshot path. `--json` leaves the adapter's JSON untouched (so stdout
 * stays pure JSON); a failed write then surfaces on the exit code and on stderr through `warn`.
 * @param {{dir?: string, write?: Function, advance?: Function, warn?: Function}} [ports]
 */
export function createTurnDigestFinish({ dir = undefined, write = writeSnapshot, advance = writeStoredCursor, warn = (m) => process.stderr.write(`${m}\n`) } = {}) {
  return ({ run, code, lines, json = false } = {}) => {
    const digest = run?.verdict;
    if (!digest || digest.version !== DIGEST_VERSION) return { code, lines };
    const target = dir ?? resolveDigestDir();
    const notes = [];
    let failed = false;
    try {
      const path = write(digest, target);
      notes.push(`snapshot: ${path}`);
    } catch (e) { failed = true; notes.push(`turn-digest: FAILED to write the snapshot — ${firstLine(e)}`); }
    if (digest.cursor?.advanceTo) {
      try {
        advance(digest.cursor.consumer, digest.cursor.advanceTo, { dir: target });
        notes.push(`cursor: ${digest.cursor.consumer} advanced to ${String(digest.cursor.advanceTo).slice(0, 9)}`);
      } catch (e) { failed = true; notes.push(`turn-digest: FAILED to advance the cursor — ${firstLine(e)}`); }
    } else if (digest.cursor?.advanceRequested) {
      notes.push('cursor: NOT advanced — `--advance` needs a `--consumer` id and a readable main tip');
    }
    const nextCode = failed ? 1 : code;
    if (json) { for (const n of notes) if (/FAILED|NOT advanced/.test(n)) warn(n); return { code: nextCode, lines }; }
    return { code: nextCode, lines: [...formatDigest(digest), ...notes] };
  };
}
