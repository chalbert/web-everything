/**
 * @file scripts/operations/clear-stuck-session-io.mjs
 * @description THE IO SHELL of the `clear-stuck-session` declaration (#3383) — the reader that OBSERVES a
 *   session's own job directory, `claude agents --json --all`, `ps aux` and this repo's operation run-store,
 *   and the one sink that ACTS: moving the job directory aside. Kept out of `./clear-stuck-session.mjs` for
 *   the same reason `restart-runner-io.mjs` is kept out of `restart-runner.mjs` — that file's import graph is
 *   asserted free of `node:` specifiers, and every verb here (`fs`, a subprocess, the run-store) belongs on
 *   this side of the split.
 *
 * WHERE A SESSION'S JOB DIRECTORY LIVES. `<config-dir>/jobs/<shortId>/`, where `<config-dir>` is
 * `$CLAUDE_CONFIG_DIR` when set, else `~/.claude` — the directory `~/.claude/jobs/<id>/state.json` (id being
 * the SAME short id `claude agents --json` reports on the `id` field, and the directory name matches it byte
 * for byte — measured against the real jobs directory on 2026-09-13, 534 entries, every one an 8-hex prefix of
 * its own `sessionId`).
 *
 * WHY THE LIVENESS PROBE IS WIDER THAN `restart-runner-io.mjs`'s `defaultIsPidAlive`. That probe needs a pid,
 * and the known-stuck listing rows carry none at all — measured: every `state:"blocked"` row in the current
 * listing (13 of them, 2026-09-13) has only `{id, cwd, kind, startedAt, sessionId, name, state}`, no `pid`.
 * So `resolvePidAlive` here checks BOTH signals available: the listing row's own `pid` (when present, the
 * ordinary `kill(pid, 0)` probe), and — always — a `ps aux` scan for the session's full UUID, because a real
 * live Claude Code session is a `--resume=<uuid>` subprocess (measured against this very process's own `ps
 * aux` line). Neither found ⇒ `pidAlive: false`, which is what lets {@link
 * ../conveyor/reconcile-core.mjs#assessLiveness} report "nothing live" for a row whose `pid` field never
 * existed in the first place.
 *
 * PR RESOLUTION REUSES `reconcile-core.mjs#bindAgents`, NOT A SECOND LOOKUP. `--pr=<n>` needs to know which of
 * the sessions bound to that PR (by lane `HEAD`/`headRefOid` or by the `review-<pr>`/`fix-<pr>` name slugs) is
 * the stuck one; `bindAgents` is the exact function `reconcile-core.mjs`'s own reconcile pass and
 * `dispatch-abort.mjs`'s neighbourhood already use for "which live session is working this PR" — reused here
 * rather than re-derived, per this repo's own #3283 lesson about a second, looser copy of that grammar.
 *
 * "NO RUN-STORE RECORD" READS EVERY RUN IN `we:scripts/operations/run-store.mjs`'S FILE STORE (today's total
 * is small — a gitignored session-local sidecar, `.operations/runs/*.json`) and looks for an `in-flight`
 * effect whose `handle` this session's short id or full session id matches — the same short-id-is-a-prefix
 * relationship `dispatch-lane-io.mjs#isHandleListed` already established for the `claude agents` listing,
 * applied here against a run record's own `effect.handle` instead of a listing row's `sessionId`.
 *
 * IMPURE by construction: subprocess, fs, the run-store.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

import { defaultListAgents, normalizeHandle } from './dispatch-lane-io.mjs';
import { bindAgents } from '../conveyor/reconcile-core.mjs';
import { createFileRunStore } from './run-store.mjs';
import { QUARANTINE_MOVE_EFFECT } from './clear-stuck-session.mjs';

/** `$CLAUDE_CONFIG_DIR` when set, else `~/.claude` — the same default the `claude` CLI itself resolves to. */
export function configDir(env = process.env) {
  const override = env.CLAUDE_CONFIG_DIR;
  return override && String(override).trim() ? resolve(String(override).trim()) : join(homedir(), '.claude');
}

/** `<config-dir>/jobs`. */
export function jobsDir(cfgDir = configDir()) {
  return join(cfgDir, 'jobs');
}

/** `<config-dir>/jobs/.cleared` — the quarantine location. Never `jobs/<id>` itself, so a listing that scans
 *  `jobs/*` for a live entry never trips over its own quarantine pile. */
export function quarantineDir(cfgDir = configDir()) {
  return join(jobsDir(cfgDir), '.cleared');
}

/**
 * A short session id out of whatever shape the caller passed — a bare 6-40 char hex/word id, or a full
 * `xxxxxxxx-xxxx-...` UUID (its first hyphen-delimited segment). PURE. `''`/nullish → `null`.
 * @param {string|null|undefined} x
 * @returns {string|null}
 */
export function shortIdOf(x) {
  const s = String(x ?? '').trim().toLowerCase();
  if (!s) return null;
  const seg = s.split('-')[0];
  return /^[0-9a-f]{4,40}$/.test(seg) ? seg : (seg || null);
}

/** Read `<jobDir>/state.json`, narrowed to the three fields this operation cares about. `null` on any
 *  failure — a corrupt or absent state file is evidence, not a throw, since this is a diagnostic read over
 *  another process's own bookkeeping. */
export function readJobState(jobDir, { readFile = readFileSync } = {}) {
  try {
    const parsed = JSON.parse(String(readFile(join(jobDir, 'state.json'), 'utf8')));
    return { state: parsed?.state ?? null, detail: parsed?.detail ?? null, needs: parsed?.needs ?? null };
  } catch {
    return null;
  }
}

/**
 * Does a `ps aux`-style listing carry any process referencing this session at all? A real live Claude Code
 * background session is a `--resume=<full-uuid>` (or `--session-id=<uuid>`) subprocess — matched by the FULL
 * id, never the short one, since an 8-hex short id is exactly the kind of substring that could coincidentally
 * appear elsewhere (a commit sha, a temp path).
 * @param {string|null} fullSessionId
 * @param {{exec?: Function}} [o]
 * @returns {boolean}
 */
export function scanPsForSession(fullSessionId, { exec = execFileSync } = {}) {
  if (!fullSessionId) return false;
  try {
    const out = String(exec('ps', ['aux'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 10_000 }));
    return out.toLowerCase().includes(String(fullSessionId).toLowerCase());
  } catch {
    // A `ps` that cannot run answers nothing — false is the SAFE direction here only because it is always
    // paired with `assessLiveness`'s own `pidAlive !== false` ⇒ `liveness-unknown` refusal one level up: an
    // unreadable probe must never silently read as "confirmed dead" on its own. See `resolvePidAlive`.
    return null;
  }
}

/**
 * Resolve `pidAlive` for one listing row the SAME two ways real liveness can be known here: the row's own
 * `pid` field when present (rare for the known-stuck shape, but honoured when it exists — a live pid must
 * never be second-guessed by a wider, noisier scan), else a `ps aux` scan for the full session id.
 * @returns {boolean|null} `true`/`false` when established, `null` when neither probe could say.
 */
export function resolvePidAlive(entry, { fullSessionId, isPidAlive, exec } = {}) {
  const pid = Number(entry?.pid);
  if (Number.isInteger(pid) && pid > 0) return isPidAlive(pid);
  return scanPsForSession(fullSessionId, { exec });
}

/**
 * Find the `claude agents --json --all` row for a short id, if listed. Matches by `id` first (exact — that
 * field IS the short id), falling back to a `sessionId` prefix match for a caller that only had the full UUID.
 */
export function findListingEntry(shortId, agents) {
  const list = Array.isArray(agents) ? agents : [];
  const norm = normalizeHandle(shortId);
  if (!norm) return null;
  return list.find((a) => normalizeHandle(a?.id) === norm) ?? list.find((a) => normalizeHandle(a?.sessionId).startsWith(norm)) ?? null;
}

/**
 * Resolve a `--pr=<n>` input to whichever session `reconcile-core.mjs#bindAgents` binds to that PR — the SAME
 * lookup `reconcile-core.mjs`'s own reconcile pass and `dispatch-abort.mjs`'s neighbourhood already use.
 * Returns the bound listing row's `id` (its short id), or `null` when nothing binds.
 * @param {{fetchPr: (pr:number) => object|null, agents: object[]}} o
 */
export function resolveSessionForPr(pr, { fetchPr, agents }) {
  const prFacts = fetchPr(pr);
  if (!prFacts) return null;
  const bound = bindAgents(prFacts, agents);
  return bound.length ? String(bound[0].agent?.id ?? '') || null : null;
}

/** `gh pr view <n> --json number,headRefOid,headRefName` → `{number, headRefOid, headRefName}`, or `null`. */
export function defaultFetchPr(pr, { exec = execFileSync } = {}) {
  try {
    const out = String(exec('gh', ['pr', 'view', String(pr), '--json', 'number,headRefOid,headRefName'], {
      encoding: 'utf8', timeout: 30_000,
    }));
    const parsed = JSON.parse(out);
    return { number: parsed.number, headRefOid: parsed.headRefOid, headRefName: parsed.headRefName };
  } catch {
    return null;
  }
}

/**
 * Does any run record in THIS repo's operation-engine store still hold an `in-flight` effect bound to this
 * session? Scans every run (today's store is small) rather than indexing by handle — see the file header.
 * @returns {{bound: boolean, runs: Array<{runId: string, key: string}>}}
 */
export function scanRunStoreForSession({ shortId, fullSessionId, store = createFileRunStore() } = {}) {
  const targets = [normalizeHandle(shortId), normalizeHandle(fullSessionId)].filter(Boolean);
  if (!targets.length) return { bound: false, runs: [] };
  const runs = [];
  let ids = [];
  try { ids = store.list(); } catch { return { bound: false, runs: [] }; }
  for (const id of ids) {
    let run;
    try { run = store.read(id); } catch { continue; }
    for (const e of run?.effects || []) {
      if (e?.status !== 'in-flight') continue;
      const h = normalizeHandle(e?.handle);
      if (!h) continue;
      // Prefix match either direction — a run's handle is conventionally the SHORT id (dispatch-lane-io.mjs's
      // own header), but this is defensive against a caller that recorded the full one.
      if (targets.some((t) => h.startsWith(t) || t.startsWith(h))) runs.push({ runId: id, key: String(e.key ?? '') });
    }
  }
  return { bound: runs.length > 0, runs };
}

/**
 * THE READER. Builds one `readStuckFacts({session, pr})` call — everything {@link
 * ../clear-stuck-session.mjs#shapeStuckRead} needs, observed and none of it judged.
 *
 * @param {object} [io] - every dependency is injectable; the CLI block binds the real ones.
 * @returns {(o: {session: string, pr: number}) => object}
 */
export function createClearStuckSessionReader({
  cfgDir = configDir(),
  listAgents = () => defaultListAgents({ all: true }),
  fetchPr = defaultFetchPr,
  isPidAlive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e?.code === 'EPERM'; } },
  exec = execFileSync,
  readFile = readFileSync,
  exists = existsSync,
  store = createFileRunStore(),
} = {}) {
  return ({ session = '', pr = 0 } = {}) => {
    const requestedSession = String(session || '').trim() || null;
    const requestedPr = Number.isInteger(pr) && pr > 0 ? pr : null;

    let agents = [];
    try { agents = listAgents(); } catch { agents = []; }

    let shortId = null;
    let resolvedVia = 'none';
    if (requestedSession) {
      shortId = shortIdOf(requestedSession);
      resolvedVia = 'session';
    } else if (requestedPr) {
      shortId = resolveSessionForPr(requestedPr, { fetchPr, agents });
      resolvedVia = 'pr';
    }

    const listingEntry = shortId ? findListingEntry(shortId, agents) : null;
    const fullSessionId = listingEntry?.sessionId ? String(listingEntry.sessionId) : (requestedSession && requestedSession.includes('-') ? requestedSession : null);

    const jobDirPath = shortId ? join(jobsDir(cfgDir), shortId) : null;
    const jobDirExists = !!(jobDirPath && exists(jobDirPath));
    const stateJson = jobDirExists ? readJobState(jobDirPath, { readFile }) : null;

    const pidAlive = listingEntry ? resolvePidAlive(listingEntry, { fullSessionId, isPidAlive, exec }) : null;
    const runStore = shortId ? scanRunStoreForSession({ shortId, fullSessionId, store }) : { bound: false, runs: [] };

    return {
      resolvedVia, requestedSession, requestedPr, shortId, fullSessionId,
      jobDirPath, jobDirExists, stateJson, listingEntry, pidAlive,
      runStoreBound: runStore.bound, boundRuns: runStore.runs,
    };
  };
}

// ── the one sink ───────────────────────────────────────────────────────────────────────────────────────────

/**
 * MOVE the job directory aside — never delete — then verify the daemon actually drops the session from its
 * own listing. `<config-dir>/jobs/.cleared/<shortId>-<timestamp>/`.
 *
 * IDEMPOTENT ON A MISSING SOURCE. If `jobDirPath` no longer exists when this runs (another operator's manual
 * `claude stop`/cleanup won the race, or a retried effect after an earlier attempt already moved it), this
 * looks for an already-quarantined entry with the same `shortId-` prefix and reports that instead of throwing
 * — a partial-failure replay must not turn "already cleared" into a hard error.
 */
export function moveJobDirAside({ shortId, jobDirPath }, {
  cfgDir = configDir(),
  now = () => Date.now(),
  ensureDir = (d) => mkdirSync(d, { recursive: true }),
  exists = existsSync,
  rename = renameSync,
  listAgents = () => defaultListAgents({ all: true }),
  readdir = (d) => { try { return readdirSync(d); } catch { return []; } },
} = {}) {
  const qDir = quarantineDir(cfgDir);
  if (!exists(jobDirPath)) {
    // Already gone — report what quarantine already holds, if anything, rather than failing a replay.
    let existing = null;
    try {
      const entries = readdir(qDir);
      existing = entries.find((e) => e.startsWith(`${shortId}-`)) ?? null;
    } catch { /* quarantine dir may not exist yet; nothing to find */ }
    return {
      moved: false, alreadyGone: true,
      from: jobDirPath, to: existing ? join(qDir, existing) : null,
      verifiedCleared: true,
    };
  }

  ensureDir(qDir);
  const dest = join(qDir, `${shortId}-${now()}`);
  rename(jobDirPath, dest);

  // VERIFY the daemon actually drops it — re-list and check the id is gone, rather than trusting the move
  // alone. A listing this cannot read is reported, not swallowed — an operator needs to know verification did
  // not run, distinctly from "verified and it is still listed".
  let stillListed = null;
  try {
    const after = Array.isArray(listAgents()) ? listAgents() : [];
    stillListed = !!findListingEntry(shortId, after);
  } catch {
    stillListed = null;
  }

  return { moved: true, alreadyGone: false, from: jobDirPath, to: dest, stillListed, verifiedCleared: stillListed === false };
}

/** The sink table. One effect type, one sink — everything else in `io` is forwarded, so one stub set drives
 *  the whole operation in a test, exactly like `restart-runner-io.mjs#createRestartRunnerSinks`. */
export function createClearStuckSessionSinks({ cfgDir = configDir(), ...io } = {}) {
  return {
    [QUARANTINE_MOVE_EFFECT]: async ({ shortId, jobDirPath } = {}) => moveJobDirAside({ shortId, jobDirPath }, { cfgDir, ...io }),
  };
}
