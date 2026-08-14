#!/usr/bin/env node
/**
 * @file scripts/conveyor/lease-reaper.mjs
 * @description The CONVEYOR LEASE REAPER (WE #2667, epic #2612). Walks every lane pool and RECLAIMS an orphan
 *   lease — one whose owning agent is gone — so a stranded lane returns to the pool automatically instead of
 *   being hand-released by the main session. This is the RECLAMATION half that #2623 was missing.
 *
 * WHY (the toil this removes): when a conveyor delivery agent dies mid-build (an API death), or its PR merges
 * without the main session hand-releasing the lease, the `.lane-lease` marker sits on disk holding its lane —
 * in EVERY pool the item acquired (a cross-locus couple leaves one in the WE pool AND one in the plateau-app
 * pool). #2623 taught the scope-lease COLLECTOR to COUNT such empty/stale leases correctly (so the dispatch
 * plan's free-lane math is right), but it never REMOVED them — a counted-as-stale lease still occupies its lane
 * until a human clears it. This reaper is the reclamation: it removes the marker, freeing the lane for dispatch.
 * Observed real ghosts: 13 lanes across 3 pools released by hand — exactly what this automates.
 *
 * EXTENDS #2623 (counting → reclaiming), and is the periodic BACKSTOP to the merge-time auto-release
 * (`pr-watch.mjs --release-session`, #2667): auto-release clears a couple's leases the instant its PR merges;
 * the reaper catches everything auto-release missed — a dead agent that never opened a PR (rides the TTL-stale
 * axis), or a merge whose main session was down when it landed (rides the PR-merged axis).
 *
 * PURE-CORE / IO-SHELL SPLIT (mirrors pr-watch.mjs / scope-lease-collect.mjs):
 *   • The PURE core ({@link classifyReap}, {@link reapPlan}, {@link itemNumFromSession}, {@link laneRefItemNum})
 *     has NO fs / git / gh / clock — every signal is passed IN. It is unit-tested directly against fixtures.
 *   • The IO SHELL (the `main()` CLI, gated on the main-module check) owns POOL_ROOT enumeration, marker reads,
 *     an optional single `gh pr list`, and the actual reclamation — which it delegates to
 *     `lane-pool.mjs release --pool=<name> --lane=<n> --force` so the reserved-lane protection lives in ONE
 *     place (this reaper never rm's a marker directly, so it can never nuke a permanent memory lane).
 *
 * THE REAP AXES (a lease is reaped when it is NOT reserved AND any one holds):
 *   • pr-merged / pr-closed — the lease's item PR reached a terminal state (matched by head ref `lane/<num>-*`);
 *     the work is done/abandoned, so the lane is free even before TTL. Because a cross-locus couple's WE PR is
 *     WE-last, a merged WE PR (num N) means the whole couple is done — so matching by `num` reclaims the
 *     plateau-app-pool half too. (Best-effort: the gh axis degrades to OFF if gh is unavailable — TTL still bites.)
 *   • ttl-stale — the lease outlived its TTL (`isLeaseStale`; AGE-based — there is no heartbeat, so a >TTL live
 *     build is reapable, exactly as `acquire` already treats a >TTL lease as reclaimable); the owner is presumed
 *     gone. This is the zero-IO backstop that reclaims a dead agent's lane with no PR and no network.
 *   • pid-dead — the owning agent's process is gone. DORMANT under today's schema (see {@link pidAliveForLease}):
 *     the lease's recorded `pid` is the short-lived `lane-pool acquire` CLI, NOT the delivery agent (an LLM has
 *     no unix pid), so a literal check would reap LIVE leases — the axis returns `null` (unknown) and never
 *     fires alone. The pure branch is kept so a future durable `agentPid` field lights it up unchanged.
 * RESERVED (permanent memory, #2350) leases are NEVER reaped, on every axis.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { homedir, hostname } from 'node:os';
import { isLeaseStale, isReservedLease, LEASE_FILENAME, DEFAULT_LEASE_TTL_MINUTES } from '../lib/lane-lease.mjs';

// ── PURE CORE (no fs / git / gh / clock — every signal is injected) ───────────────────────────────────────────

/**
 * The item number a lane's owning session encodes. Conveyor sessions are `conveyor-<num>` / `fix-<num>` /
 * `prepare-<num>` / `prepare-decision-<num>` (and a retry suffix like `conveyor-2500b`), so the trailing digit
 * run is the item. Returns the number as a string, or null when the session names no item (a non-conveyor lease).
 * @param {string|null|undefined} session
 * @returns {string|null}
 */
export function itemNumFromSession(session) {
  const m = String(session ?? '').match(/(\d+)[a-z]?$/i);
  return m ? m[1] : null;
}

/**
 * The item id a `lane/<num>-<slug>` head ref encodes (mirrors `itemNumFromSession`'s couple key), or null.
 * A conveyor PR is opened by `pr-land --ref=lane/<num>-<slug>`, so its head ref carries the item id.
 *
 * THE GRAMMAR IS `pr-land`'S, NOT A SECOND ONE (#x9ylkp7, task 4). `we:scripts/pr-land.mjs` parses its own
 * `--ref` with `^lane\/(x[a-z0-9]{5,7}|\d+)` — a backlog item is identified EITHER by its number OR by its
 * `bornAs` hash (`x9ylkp7`), and the delivery-agent brief's `{{ITEM_NUM}}` is documented to be "the backlog
 * item number (or `xNNNNNN` hash)". This matcher accepted only the digit half, so every hash-identified item's
 * PR read as "no item at all". Widening it HERE rather than in a second copy is the whole point: the lease
 * reaper and the dispatch observer (`we:scripts/operations/dispatch-lane-io.mjs`) both key PRs to items through
 * this one function, so they can never disagree about which ref belongs to which item.
 *
 * WHAT THE WIDENING DOES **NOT** CHANGE, checked rather than assumed: {@link prStatesFromList} now mints
 * hash-keyed entries too, but {@link itemNumFromSession} — the only thing that ever LOOKS a key up in the
 * reaper — matches `(\d+)[a-z]?$` and so can only ever produce a digit key. A hash key is therefore
 * unreachable on the reap path, and the new keys collide with no existing one. The reaper's behaviour is
 * byte-identical; the observer is what the new keys are for. (`lease-reaper.test.mjs` pins exactly this.)
 *
 * A hash is lower-cased on the way out, matching `we:scripts/conveyor/queue-store.mjs`'s `normNum`; the digit
 * branch is unaffected by that (`'3095'.toLowerCase()` is `'3095'`).
 *
 * @param {string|null|undefined} headRef
 * @returns {string|null}
 */
export function laneRefItemNum(headRef) {
  const m = String(headRef ?? '').match(/^lane\/(x[a-z0-9]{5,7}|\d+)[a-z]?-/i);
  return m ? m[1].toLowerCase() : null;
}

/**
 * The DETERMINISTIC reap verdict for ONE lease — pure, same signals → same verdict. A lease is reaped when it
 * is not reserved AND any axis fires; the reason names the axis (PR-terminal wins, then TTL, then pid).
 *
 * @param {object|null} lease  the parsed `.lane-lease` marker.
 * @param {{nowMs:number, ttlMs?:number, prState?:('merged'|'closed'|'open'|null), pidAlive?:(boolean|null)}} sig
 *   `prState` = the terminal state of the lease's item PR (null = unknown, don't reap on this axis);
 *   `pidAlive` = whether the owning agent process is alive (null = unknown/untrustworthy → axis dormant).
 * @returns {{reap:boolean, reason:('pr-merged'|'pr-closed'|'ttl-stale'|'pid-dead'|'reserved'|null)}}
 */
export function classifyReap(lease, { nowMs, ttlMs = DEFAULT_LEASE_TTL_MINUTES * 60_000, prState = null, pidAlive = null } = {}) {
  if (!lease || typeof lease !== 'object') return { reap: false, reason: null };
  // #2350 — a RESERVED (permanent) lane is the durable memory slot; it is off-limits to reclamation on EVERY
  // axis. Short-circuit BEFORE any other test so no signal can ever collect it.
  if (isReservedLease(lease)) return { reap: false, reason: 'reserved' };
  // PR-terminal wins: the work is done (merged) or abandoned (closed), so the lane is free even pre-TTL.
  if (prState === 'merged') return { reap: true, reason: 'pr-merged' };
  if (prState === 'closed') return { reap: true, reason: 'pr-closed' };
  // TTL-stale: the owner outlived its heartbeat — the zero-IO dead-agent backstop.
  if (isLeaseStale(lease, nowMs, ttlMs)) return { reap: true, reason: 'ttl-stale' };
  // pid-dead: only fires when the shell supplies a TRUSTWORTHY liveness (dormant today — see pidAliveForLease).
  if (pidAlive === false) return { reap: true, reason: 'pid-dead' };
  return { reap: false, reason: null };
}

/**
 * Reduce a parsed `gh pr list` array → a Map of item-num → PR state, keyed by matching each PR's head ref
 * `lane/<num>-*`. PURE (no gh) so the risky reduction is unit-tested directly. SAFETY: **open WINS** — if a
 * number has ANY open PR, the number reads `'open'` (never reaped on the PR axis), because both this and
 * `itemNumFromSession` collapse a retry suffix (`lane/2500b-*` → `2500`), so a still-live retry PR must never
 * be overwritten by an OLDER terminal PR of the same base number — that would `release --force` a LIVE lane
 * (the #2267 data-loss hazard). Among terminal-only numbers, `merged` wins over `closed` (the work landed).
 * Priority: open > merged > closed.
 * @param {Array<{headRefName?:string, state?:string, mergedAt?:string|null}>} prs
 * @returns {Map<string,'open'|'merged'|'closed'>}
 */
export function prStatesFromList(prs) {
  const RANK = { open: 3, merged: 2, closed: 1 };
  const byNum = new Map();
  for (const pr of Array.isArray(prs) ? prs : []) {
    const num = laneRefItemNum(pr?.headRefName);
    if (!num) continue;
    const s = String(pr.state || '').toUpperCase();
    const state = pr.mergedAt || s === 'MERGED' ? 'merged' : s === 'CLOSED' ? 'closed' : 'open';
    const prev = byNum.get(num);
    if (!prev || RANK[state] > RANK[prev]) byNum.set(num, state); // open wins; then merged over closed
  }
  return byNum;
}

/**
 * Build the reap plan over a flat list of `{ pool, lane, dir, lease }` candidates. Pure — the shell resolves
 * each lease's per-lease signals (via the injected `signalsFor`) and this maps {@link classifyReap} over them.
 * @param {Array<{pool:string, lane:number, dir:string, lease:object|null}>} candidates
 * @param {{nowMs:number, ttlMs?:number, signalsFor?:((c:object)=>{prState?:any, pidAlive?:any})|null}} opts
 * @returns {{reap:Array, keep:Array}} `reap` = candidates to collect (each + `reason`); `keep` = the rest.
 */
export function reapPlan(candidates, { nowMs, ttlMs = DEFAULT_LEASE_TTL_MINUTES * 60_000, signalsFor = null } = {}) {
  const reap = [];
  const keep = [];
  for (const c of Array.isArray(candidates) ? candidates : []) {
    if (!c || !c.lease) continue; // no lease → nothing to reap
    const extra = typeof signalsFor === 'function' ? signalsFor(c) || {} : {};
    const verdict = classifyReap(c.lease, { nowMs, ttlMs, prState: extra.prState ?? null, pidAlive: extra.pidAlive ?? null });
    if (verdict.reap) reap.push({ ...c, reason: verdict.reason });
    else keep.push({ ...c, reason: verdict.reason });
  }
  return { reap, keep };
}

// ── IO SHELL (runs only as a CLI — owns POOL_ROOT walk / marker reads / gh / the release delegation) ──────────

const HERE = dirname(fileURLToPath(import.meta.url));
const LANE_POOL_CLI = join(HERE, '..', 'lane-pool.mjs');
const expandHome = (p) => (p && p.startsWith('~') ? join(homedir(), p.slice(1)) : p);
const POOL_ROOT = expandHome(process.env.LANE_POOL_ROOT) || join(homedir(), 'workspace', '.lanes');

const log = (m) => process.stderr.write(m + '\n');

/** Read + parse a lane's `.lane-lease` marker → the lease object, or null (missing / corrupt reads as none). */
function readLease(dir) {
  const file = join(dir, '.git', LEASE_FILENAME);
  if (!existsSync(file)) return null;
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Lane indices under a pool dir (`lane-N` children), sorted — mirrors lane-pool's own `laneIndicesIn`. */
function laneIndicesIn(poolDir) {
  if (!existsSync(poolDir)) return [];
  return readdirSync(poolDir)
    .filter((d) => /^lane-\d+$/.test(d))
    .map((d) => Number(d.slice(5)))
    .sort((a, b) => a - b);
}

/** Pool names under POOL_ROOT that hold lanes (skip scratch clones / render siblings) — one or the selected. */
function poolsToScan(flags) {
  if (typeof flags.pool === 'string' && flags.pool) return [flags.pool];
  if (!existsSync(POOL_ROOT)) return [];
  return readdirSync(POOL_ROOT)
    .filter((name) => laneIndicesIn(join(POOL_ROOT, name)).length > 0)
    .sort();
}

/**
 * Whether the owning agent's process is alive. DORMANT under today's schema: the lease's `pid` is the
 * short-lived `lane-pool acquire` CLI (it exits right after stamping the marker — see lane-lease.mjs's "pid is
 * informational only"), NOT the delivery agent (an LLM has no unix pid). A literal check on it is meaningless —
 * it is ~always dead, and reaping on it would collect LIVE leases (the #2267 data-loss hazard). So this returns
 * `null` (unknown) for the current schema, and dead-agent reclamation rides the TTL-stale backstop instead. A
 * future lease that records a trustworthy long-lived `agentPid` (same host) plugs in here and the pure
 * classifier's `pid-dead` branch lights up unchanged.
 */
export function pidAliveForLease(lease) {
  const agentPid = lease && Number.isInteger(lease.agentPid) ? lease.agentPid : null;
  if (agentPid == null) return null; // no durable agent pid → axis dormant
  if (lease.host && lease.host !== hostname()) return null; // can't check a pid on another host
  try {
    process.kill(agentPid, 0);
    return true;
  } catch (e) {
    return e && e.code === 'ESRCH' ? false : null; // ESRCH = gone; EPERM/other = can't tell → unknown
  }
}

/**
 * ONE `gh pr list` → a Map of item-num → terminal PR state (`merged` / `closed` / `open`), keyed by matching
 * each PR's head ref `lane/<num>-*`. Terminal states win over `open` so a couple's merged WE PR reads `merged`.
 * Best-effort: any gh failure disables the axis (returns null → every lease's prState is unknown → TTL still
 * bites). Scoped to the current repo (`--pr-repo=<owner/name>` overrides); a couple's WE PR num reclaims the
 * impl-pool half too, since both halves share the item number.
 */
function fetchPrStates(flags) {
  if (flags['no-check-prs']) return null;
  const args = ['pr', 'list', '--state', 'all', '--limit', String(Number(flags['pr-limit']) || 400), '--json', 'number,state,mergedAt,headRefName'];
  if (typeof flags['pr-repo'] === 'string') args.push('--repo', flags['pr-repo']);
  let prs;
  try {
    prs = JSON.parse(execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  } catch (e) {
    log(`  ⚠ gh pr list failed — PR-terminal reap axis OFF this run (TTL-stale still applies): ${String(e?.message || e).split('\n')[0]}`);
    return null;
  }
  return prStatesFromList(prs); // pure "open wins" reduction — see prStatesFromList
}

/** Delegate the actual reclamation to lane-pool's release (reserved-lane protection lives there). */
function releaseLane(pool, lane) {
  execFileSync('node', [LANE_POOL_CLI, 'release', `--pool=${pool}`, `--lane=${lane}`, '--force'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
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

function main(argv) {
  const flags = parseFlags(argv);
  const dryRun = !!flags['dry-run'];
  const ttlMinutes =
    flags['ttl-minutes'] !== undefined && Number.isFinite(Number(flags['ttl-minutes']))
      ? Number(flags['ttl-minutes'])
      : DEFAULT_LEASE_TTL_MINUTES;
  const ttlMs = ttlMinutes * 60_000;
  const nowMs = Date.now();

  const prStates = fetchPrStates(flags); // null when the axis is off

  // Collect every held lease across the scanned pools into flat candidates.
  const candidates = [];
  for (const pool of poolsToScan(flags)) {
    const poolDir = join(POOL_ROOT, pool);
    for (const lane of laneIndicesIn(poolDir)) {
      const dir = join(poolDir, `lane-${lane}`);
      const lease = readLease(dir);
      if (lease) candidates.push({ pool, lane, dir, lease });
    }
  }

  const signalsFor = (c) => {
    const num = itemNumFromSession(c.lease?.session);
    const prState = prStates && num ? prStates.get(num) ?? null : null;
    return { prState, pidAlive: pidAliveForLease(c.lease) };
  };
  const { reap, keep } = reapPlan(candidates, { nowMs, ttlMs, signalsFor });

  // Reclaim (unless dry-run). A single failed release is logged and skipped — the reaper is best-effort and one
  // stuck lane must not abort the whole sweep — but a failure count surfaces via a non-zero exit (below) so a
  // cron/loop wrapper can tell a clean sweep from a partial one.
  let reaped = 0;
  let failures = 0;
  const done = [];
  for (const c of reap) {
    if (dryRun) {
      log(`  would reap ${c.pool}/lane-${c.lane} (${c.reason}; session ${c.lease?.session ?? 'unknown'})`);
      continue;
    }
    try {
      releaseLane(c.pool, c.lane);
      log(`  reaped ${c.pool}/lane-${c.lane} (${c.reason}; was session ${c.lease?.session ?? 'unknown'})`);
      done.push({ pool: c.pool, lane: c.lane, reason: c.reason, session: c.lease?.session ?? null });
      reaped++;
    } catch (e) {
      log(`  ⚠ ${c.pool}/lane-${c.lane}: release failed (${String(e?.message || e).split('\n')[0]}) — left in place`);
      failures++;
    }
  }

  if (flags.json) {
    process.stdout.write(
      JSON.stringify(
        {
          scanned: candidates.length,
          reaped: dryRun ? 0 : reaped,
          failures: dryRun ? 0 : failures,
          wouldReap: dryRun ? reap.map((c) => ({ pool: c.pool, lane: c.lane, reason: c.reason, session: c.lease?.session ?? null })) : undefined,
          collected: dryRun ? undefined : done,
          kept: keep.length,
          prAxis: prStates ? 'on' : 'off',
        },
        null,
        2,
      ) + '\n',
    );
  } else {
    log(
      `lease-reaper: ${candidates.length} held lease(s) · ` +
        `${dryRun ? `${reap.length} would reap` : `${reaped} reaped${failures ? `, ${failures} failed` : ''}`} · ${keep.length} kept · PR-axis ${prStates ? 'on' : 'off'}`,
    );
  }
  // Non-zero exit only when a release we attempted actually FAILED (a gh-axis-off run is a clean degrade, not a
  // failure) — so a cron/loop wrapper can distinguish a clean sweep from a partial one.
  process.exit(failures > 0 ? 1 : 0);
}

// Run the IO shell only when invoked directly — never on import (keeps the pure core side-effect-free).
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main(process.argv.slice(2));
}
