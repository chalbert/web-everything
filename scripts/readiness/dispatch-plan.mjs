#!/usr/bin/env node
/**
 * @file scripts/readiness/dispatch-plan.mjs
 * @description The DETERMINISTIC DISPATCHER core of the conveyor (WE #x53zzf9, epic #xkggoo0). Given the build
 *   queue, the active scope leases, and the free lane slots, it decides — as JSON — what LAUNCHES where and what
 *   HOLDS (and why). This is the keystone the future product conveyor inherits: plateau's server will shell it
 *   exactly like its `/api/scope-lease` endpoint shells {@link ./scope-lease-collect.mjs} today (one
 *   implementation, two shells), per the statute
 *   [we:docs/agent/platform-decisions.md#deterministic-core-thin-judgment].
 *
 * PURE-CORE / IO-SHELL SPLIT (the hard design constraint, mirrored from the sibling scope-lease modules):
 *   • The PURE core ({@link dispatchPlan}) has NO fs / git / clock / child_process — the queue, the leases, and
 *     the free-lane list are all passed IN. It is unit-tested directly (scripts/readiness/__tests__/
 *     dispatch-plan.test.mjs) with plain objects, no git/network. It NEVER re-implements scope-overlap
 *     detection: it composes {@link ./scope-lease.mjs scopesOverlap} — the same prefix-aware intersection the
 *     scope-lease board and collector use.
 *   • The IO SHELL (the `main()` CLI, gated on the main-module check) gathers the three inputs by shelling the
 *     existing readiness scripts — {@link ../backlog.mjs backlog.mjs build-queue --json} for the ranked build
 *     queue, {@link ./scope-lease-collect.mjs scope-lease-collect --json} for the live leases, and
 *     {@link ../lane-pool.mjs lane-pool list --acquirable --json} for the free lanes — then calls the pure
 *     core and emits its plan. REUSE, never reinvent: the ordering engine, the scope collector, and the pool
 *     picker are each single-sourced; this shell only glues them.
 *
 * THE DISPATCH RULES (§ conveyor dispatcher). Each queued item, in rank order (highest-priority first), resolves
 * to exactly ONE outcome:
 *   • openBlockers > 0                              → held "blocked"          (an unready item can't launch).
 *   • scope ABSENT or EMPTY (`[]`)                  → held "needs-probe"      (the script can't predict scope —
 *                                                     a probe agent writes the item's `scope:` frontmatter
 *                                                     later; the deterministic half only READS it). An EMPTY
 *                                                     scope is treated identically to absent: it is NOT a
 *                                                     meaningful "touches nothing" build (every built item
 *                                                     produces a lane diff), so [] is the un-safe declaration
 *                                                     and needs-probe is the safe default. This keeps the pure
 *                                                     core aligned with BOTH other halves — the loader
 *                                                     (normalizeScope collapses [] → undefined) and
 *                                                     check:standards (which ERRORS on an empty scope) — so no
 *                                                     shell can drift onto the launch-with-zero-protection path.
 *   • scope intersects an ACTIVE lease's scope      → held "overlaps lane-<n>" (a running lane owns those paths).
 *   • scope intersects a HIGHER-RANKED item WE JUST  → held "overlaps lane-<n>" (the rival pair: the higher-ranked
 *     LAUNCHED this same tick (a rival pair)           of two mutually-overlapping queued items launches; the
 *                                                       lower-ranked one holds on the lane it was assigned).
 *   • otherwise (disjoint) — assign the next free   → launch { num, lane }    (rank order fills free lanes until
 *     lane; once the free lanes run out              the slots run out).
 *                                                    → held "no free lane"     (disjoint but nowhere to run).
 * Precedence is exactly that order: a blocked item is blocked even with no scope; a scope-less item is
 * needs-probe even if a lane is free; a lease/rival overlap holds even when a free lane exists.
 */

import { scopesOverlap, normScope } from './scope-lease.mjs';

// ── PURE CORE (no fs / git / clock / child_process — every input is injected) ─────────────────────────────────

/** The held-reason vocabulary the plan emits (the exact `reason` set #x53zzf9 specifies). `cleared-but-not-ready`
 *  is SHELL-emitted (#2613 review, required 2b): a sidecar id with no ready build-queue row — surfaced as a held
 *  entry so a clear never silently vanishes. The pure {@link dispatchPlan} itself never emits it (those items are
 *  not in its `queue` input); the IO shell appends them via {@link clearedNotReady}. */
export const HELD_REASONS = Object.freeze([
  'blocked', 'needs-probe', 'no free lane', 'overlaps lane-<n>', 'cleared-but-not-ready',
]);

/** True when an item's `openBlockers` signals it is not ready to build. Tolerant of either the loader's array
 *  shape (`item.openBlockers` = the still-open blocker nums) or a bare count. */
function hasOpenBlockers(item) {
  const ob = item?.openBlockers;
  if (Array.isArray(ob)) return ob.length > 0;
  if (typeof ob === 'number') return ob > 0;
  return false;
}

/**
 * The DETERMINISTIC dispatch plan — the pure keystone. Same (queue, leases, freeLanes) → same plan, always.
 *
 * @param {{
 *   queue: Array<{num:(string|number), scope?:string[], openBlockers?:(string[]|number)}>,
 *   leases: Array<{lane:(string|number), scope:string[]}>,
 *   freeLanes: Array<string|number>,
 * }} input
 *   • `queue`     — the build queue ALREADY IN RANK ORDER (highest-priority first): the `buildQueued` items.
 *                   Each carries its predicted `scope` (repo-relative path prefixes, comparable to the leases'
 *                   scopes) and its `openBlockers`. The pure core does NOT re-order — the ordering engine
 *                   ({@link ../lib/build-queue.mjs orderQueueDetailed}) owns rank; this consumes that order.
 *   • `leases`    — the ACTIVE scope leases (running lanes): `{ lane, scope }`. `scope` is the lane's held
 *                   file-scope (predicted ∪ observed, from {@link ./scope-lease-collect.mjs}).
 *   • `freeLanes` — the free lane slots, as an array of lane IDS to assign (from `lane-pool list --acquirable`).
 *                   The "free lane-slot COUNT" the spec names is exactly `freeLanes.length`; the ids let a
 *                   launch carry the concrete `lane` it lands on. (Ids, not a bare count, because the plan's
 *                   `launch` must name a real lane — the same lane ids the "overlaps lane-<n>" holds reference.)
 * @returns {{ launch: Array<{num, lane}>, held: Array<{num, reason:string}> }}
 *   `launch` — the items to start now, each on the free lane it was assigned, in rank order.
 *   `held`   — every other queued item with its single reason ∈
 *              "blocked" | "needs-probe" | "overlaps lane-<n>" | "no free lane".
 */
export function dispatchPlan({ queue, leases, freeLanes } = {}) {
  const items = Array.isArray(queue) ? queue.filter((it) => it && typeof it === 'object') : [];
  const activeLeases = (Array.isArray(leases) ? leases : [])
    .filter((l) => l && typeof l === 'object')
    .map((l) => ({ lane: l.lane ?? null, scope: normScope(l.scope) }));
  const free = [...(Array.isArray(freeLanes) ? freeLanes : [])]; // consumed front-to-back, rank order

  const launch = [];
  const held = [];
  const launched = []; // { num, lane, scope } — items launched THIS tick, for the rival-pair check

  for (const item of items) {
    const num = item.num;

    // 1. Structurally not ready — an open prerequisite gates the build regardless of scope / slots.
    //    NOTE: via the production build-queue shell this branch is UNREACHABLE — `backlog.mjs build-queue`
    //    emits only READY items (isReady requires every blockedBy resolved), so their openBlockers is always
    //    []. It is kept as defense-in-depth for DIRECT core use (a future shell that feeds an unfiltered queue)
    //    and is pinned by the unit tests below.
    if (hasOpenBlockers(item)) {
      held.push({ num, reason: 'blocked' });
      continue;
    }
    // 2. No predicted scope — the script cannot decide overlap; a probe agent must write `scope:` first. An
    //    ABSENT, non-array, OR EMPTY scope all read as undeclared (see the file header): [] is not a
    //    meaningful "touches nothing" build, so it is treated identically to absent → needs-probe. Keying on
    //    the NORMALIZED scope's emptiness catches all four (undefined / non-array / [] / all-blank) in one.
    const scope = normScope(item.scope);
    if (scope.length === 0) {
      held.push({ num, reason: 'needs-probe' });
      continue;
    }

    // 3. Overlaps a RUNNING lane's held scope — that lane owns those paths; hold behind it.
    const leaseHit = activeLeases.find((l) => scopesOverlap(scope, l.scope));
    if (leaseHit) {
      held.push({ num, reason: `overlaps lane-${leaseHit.lane}` });
      continue;
    }
    // 4. Rival pair — overlaps a HIGHER-RANKED item already launched this tick. Rank order guarantees the
    //    higher-ranked rival was processed first and (if it launched) sits in `launched`, so the lower-ranked
    //    one holds on the lane its rival took. A higher rival that did NOT launch is absent here, so it never
    //    spuriously blocks a lower item — the hold is only against work that is actually starting.
    const rival = launched.find((r) => scopesOverlap(scope, r.scope));
    if (rival) {
      held.push({ num, reason: `overlaps lane-${rival.lane}` });
      continue;
    }
    // 5. Disjoint — launch it on the next free lane, or hold for want of one.
    if (free.length === 0) {
      held.push({ num, reason: 'no free lane' });
      continue;
    }
    const lane = free.shift();
    launch.push({ num, lane });
    launched.push({ num, lane, scope });
  }

  return { launch, held };
}

/**
 * Select the CLEARED build-queue rows, in the engine's rank order, by SESSION-LOCAL sidecar MEMBERSHIP (#2613).
 * The conveyor's cleared set is `.conveyor/queue.json` (session-local operator intent), NOT committed
 * `buildQueued` frontmatter — so a row is kept IFF its num is in `clearedKeys` (a set of NORMALIZED ids). The
 * ranked ORDER still comes from the build-queue engine (the rows are already ranked); only membership moved to
 * the sidecar. A committed `buildQueued:true` row that is NOT in the sidecar is dropped; a sidecar item that is
 * ranked is kept. `norm` is injected (queue-store's `normNum`) so this stays import-clean (no node built-ins in
 * the pure core) and directly unit-testable. Pure.
 * @param {Array<{num:*}>} rows  the ranked build-queue rows (`backlog.mjs build-queue --json` `.queue`)
 * @param {Set<string>|Iterable<string>} clearedKeys  the sidecar's ids, normalized via `norm`
 * @param {(n:*)=>string} norm  the id normalizer (queue-store `normNum`)
 * @returns {Array<{num:*}>} the cleared rows, rank order preserved
 */
export function selectClearedRows(rows, clearedKeys, norm) {
  const cleared = clearedKeys instanceof Set ? clearedKeys : new Set(clearedKeys);
  const key = typeof norm === 'function' ? norm : (x) => String(x);
  return (Array.isArray(rows) ? rows : []).filter((r) => r && cleared.has(key(r.num)));
}

/**
 * The CLEARED-BUT-NOT-READY set (#2613 review, required 2b): the sidecar entries whose id has NO ready
 * build-queue row. `build-queue --json .queue` is hard-filtered to READY items, so a cleared id that is
 * blocked / resolved / a typo / nonexistent lands in the sidecar but never in `rows` — without this it would
 * appear in NEITHER `launch` NOR `held`, a silent vanish (the exact "I cleared it, nothing happened" failure
 * #2613 kills). This returns each such id (in its stored spelling, for display) so the shell can surface it as
 * `held: {num, reason:'cleared-but-not-ready'}`. Pure — `norm` injected to stay import-clean.
 * @param {Array<{num:*}|string|number>} clearedEntries  the sidecar entries (`{num, addedAt}`) or bare ids
 * @param {Array<{num:*}>} readyRows  the ready build-queue rows
 * @param {(n:*)=>string} norm  the id normalizer (queue-store `normNum`)
 * @returns {Array<*>} the cleared ids with no ready row, original spelling preserved
 */
export function clearedNotReady(clearedEntries, readyRows, norm) {
  const key = typeof norm === 'function' ? norm : (x) => String(x);
  const ready = new Set((Array.isArray(readyRows) ? readyRows : []).map((r) => key(r?.num)));
  return (Array.isArray(clearedEntries) ? clearedEntries : [])
    .map((e) => (e && typeof e === 'object' ? e.num : e))
    .filter((n) => n != null && String(n) !== '' && !ready.has(key(n)));
}

// ── IO SHELL (runs only as a CLI — owns all child_process; keeps the pure core import-clean) ──────────────────

// Lazily required so importing the pure core pulls in NO node built-ins beyond scope-lease.mjs.
async function main(argv) {
  const { execFileSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');

  const HERE = dirname(fileURLToPath(import.meta.url));
  const BACKLOG_CLI = join(HERE, '..', 'backlog.mjs');
  const SCOPE_COLLECT_CLI = join(HERE, 'scope-lease-collect.mjs');
  const LANE_POOL_CLI = join(HERE, '..', 'lane-pool.mjs');

  const flags = {};
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq === -1) flags[a.slice(2)] = true;
    else flags[a.slice(2, eq)] = a.slice(eq + 1);
  }
  const log = (m) => process.stderr.write(m + '\n');
  const fail = (m) => { process.stderr.write(`✗ ${m}\n`); process.exit(1); };

  const runJson = (cmd, args, what) => {
    let out;
    try {
      out = execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      fail(`${what} failed: ${String(e.message || e).split('\n')[0]}`);
    }
    try { return JSON.parse(out); }
    catch (e) { fail(`could not parse ${what} JSON: ${String(e.message || e).split('\n')[0]}`); }
  };

  // Compare scopes on a repo-RELATIVE basis: strip a leading `<key>:` repo qualifier (a token with no slash
  // before the colon) from every entry so a lease's `we:scripts/x` / `web-everything.git:scripts/x` and an
  // item's plain `scripts/x` compare equal. Cross-repo same-path collisions are negligible for the WE
  // machinery paths this dispatcher orders; the pure core stays string-agnostic (this normalization is a
  // shell concern only).
  const toRepoRelative = (list) =>
    (Array.isArray(list) ? list : []).map((p) => String(p).replace(/^[^/:]+:/, ''));

  // 1. THE BUILD QUEUE — reuse the ranking engine wholesale (backlog.mjs build-queue --json) for the exact
  //    next-to-build ORDER + tier/score enrichment, but MEMBERSHIP of the cleared set now comes from the
  //    SESSION-LOCAL conveyor sidecar (`.conveyor/queue.json`, #2613), NOT committed `buildQueued` frontmatter.
  //    Clearing an item for build is session-local operator INTENT, so it rides a gitignored sidecar the lane
  //    guard does not police (the operator clears work from the MAIN session, which the frontmatter path
  //    blocks). An item is in the conveyor queue IFF its num is in the sidecar; committed `buildQueued` no
  //    longer arms a conveyor build. Enrich each with its predicted `scope` + `openBlockers` from the backlog
  //    loader (build-queue doesn't emit them). Dynamic-import keeps the pure core import-clean.
  const { readQueueFile, resolveQueuePath, normNum } = await import('../conveyor/queue-store.mjs');
  const sidecar = readQueueFile(resolveQueuePath()); // script-location + env override — matches conveyor-state
  const cleared = new Set(sidecar.map((e) => normNum(e.num)));
  const bq = runJson('node', [BACKLOG_CLI, 'build-queue', '--json'], 'backlog build-queue');
  const bqRows = Array.isArray(bq?.queue) ? bq.queue : [];
  const rows = selectClearedRows(bqRows, cleared, normNum);
  // Cleared-but-not-ready: sidecar ids with no ready build-queue row — surfaced as held entries below, never
  // silently dropped (#2613 review, required 2b).
  const notReady = clearedNotReady(sidecar, bqRows, normNum);
  let byNum = new Map();
  try {
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    const loadBacklog = require(join(HERE, '..', '..', 'src', '_data', 'backlog.js'));
    const items = typeof loadBacklog === 'function' ? loadBacklog() : [];
    byNum = new Map(items.map((it) => [String(it.num), it]));
  } catch (e) {
    log(`  ⚠ could not load backlog for scope/openBlockers enrichment (${String(e.message || e).split('\n')[0]}) — items read as needs-probe`);
  }
  const queue = rows.map((r) => {
    const it = byNum.get(String(r.num));
    return {
      num: r.num,
      scope: Array.isArray(it?.scope) ? toRepoRelative(it.scope) : undefined,
      openBlockers: Array.isArray(it?.openBlockers) ? it.openBlockers : [],
    };
  });

  // 2. THE ACTIVE LEASES — reuse the live scope-lease collector. Each lease's held scope = predicted ∪ observed.
  const picture = runJson('node', [SCOPE_COLLECT_CLI, '--json'], 'scope-lease-collect');
  const leases = (Array.isArray(picture?.leases) ? picture.leases : []).map((l) => ({
    lane: l.lane,
    scope: toRepoRelative([...(l.predicted || []), ...(l.observed || [])]),
  }));

  // 3. THE FREE LANES — reuse the pool's own acquirable picker. `list --acquirable --json` = the free lane
  //    dirs; the lane id is the trailing `lane-<n>`. Their COUNT is the free-slot count.
  const paths = runJson('node', [LANE_POOL_CLI, 'list', '--acquirable', '--json'], 'lane-pool list');
  const freeLanes = (Array.isArray(paths) ? paths : [])
    .map((p) => { const m = /lane-(\d+)\/?$/.exec(String(p)); return m ? Number(m[1]) : null; })
    .filter((n) => n != null)
    // Ascending lane order is a SHELL contract: the pure core assigns launches to freeLanes in the order
    // given, so sorting here makes the plan's lane assignment deterministic regardless of how `lane-pool
    // list --acquirable` happens to order its output (removes the dependency on the pool's listing stability).
    .sort((a, b) => a - b);

  const plan = dispatchPlan({ queue, leases, freeLanes });
  // Surface cleared-but-not-ready ids as held entries so a clear never silently vanishes (#2613 review, 2b).
  for (const num of notReady) plan.held.push({ num, reason: 'cleared-but-not-ready' });

  if (flags.json) {
    process.stdout.write(JSON.stringify(plan, null, 2) + '\n');
  } else {
    log(
      `dispatch plan: ${plan.launch.length} launch · ${plan.held.length} held ` +
        `(${queue.length} queued · ${leases.length} lease(s) · ${freeLanes.length} free lane(s))`,
    );
    for (const l of plan.launch) log(`  ▶ #${l.num} → lane-${l.lane}`);
    for (const h of plan.held) log(`  ⏸ #${h.num} — ${h.reason}`);
  }
  process.exit(0);
}

// Run the IO shell only when invoked directly — never on import (keeps the pure core side-effect-free).
import { pathToFileURL } from 'node:url';
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main(process.argv.slice(2));
}
