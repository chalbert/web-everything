#!/usr/bin/env node
/**
 * @file scripts/conveyor/tick-core.mjs
 * @description The MECHANIZED CONVEYOR TICK CORE (WE #2699, epic #2677(a)). ONE pure function
 *   ({@link planTick}) that turns a tick's read-only inputs — the {@link ../readiness/conveyor-state.mjs
 *   conveyor-state} read, the {@link ../readiness/dispatch-plan.mjs dispatch plan}, the free-lane ids, and the
 *   conveyor's in-session guard/watcher bookkeeping — into the tick's MECHANICAL decisions (which agents to
 *   spawn, which watchers to arm, which guards to retire, whether to idle-stop, and the status line) PLUS the
 *   next bookkeeping state. It mechanizes the deterministic per-tick orchestration the /conveyor SKILL
 *   (we:skills-src/conveyor/SKILL.md §2–3) previously re-derived in prose: chain state-read → dispatch-plan,
 *   filter launches through the in-flight / prepare / fix guards, arm watchers, retire guards on
 *   claim / return / TTL / PR-terminal / re-dispatch-gate, and idle-stop. The SKILL now only EXECUTES the
 *   returned decisions (spawn the agents, arm the watchers, post the line) and carries `nextState` into the next
 *   tick — it never re-derives a guard rule in prose.
 *
 *   Scripted per [we:docs/agent/platform-decisions.md#deterministic-core-thin-judgment] (#2607): every
 *   script-decidable rule of the tick — the three guards and their retirement, watcher arming, idle-stop — is a
 *   deterministic, tested core; the JUDGMENT the SKILL keeps (the readiness discussion, supervising a build,
 *   reviewing an escalation, ratifying a decision) stays out of here. Same inputs → same plan, always.
 *
 * PURE-CORE / IO-SHELL SPLIT (the hard design constraint, mirrored from dispatch-plan.mjs + conveyor-state.mjs):
 *   • The PURE core ({@link planTick} and every helper above the shell banner) has NO fs / git / `Date` /
 *     child_process / gh — the state read, the plan, the free lanes, the bookkeeping, and the clock (`now`) are
 *     all passed IN. It is unit-tested directly (scripts/conveyor/__tests__/tick-core.test.mjs) with plain
 *     objects, no git/network. The one import — `normNum` from {@link ./queue-store.mjs} — is the SAME id
 *     normalizer the state read and dispatcher key on, so this core can never disagree with them on item identity.
 *   • The IO SHELL (the `main()` CLI, gated on the main-module check) gathers the read-only inputs by shelling
 *     the existing readiness scripts — `conveyor-state.mjs --json`, `dispatch-plan.mjs --json`, and
 *     `lane-pool.mjs list --acquirable --json` for the free lanes — reads the conveyor's bookkeeping from STDIN
 *     (it is SESSION-EPHEMERAL process state, never a committed repo store — memory rule 105 / SKILL §5), calls
 *     the pure core, and emits `{ decisions, nextState }`. The SKILL pipes its current bookkeeping in and carries
 *     the emitted `nextState` to the next tick IN-SESSION — no parallel on-disk state store is ever created.
 *
 * THE THREE GUARDS — mechanized here EXACTLY as the SKILL documents them (their semantics are UNCHANGED; this
 * only moves the derivation from prose to a tested core):
 *
 *   1. IN-FLIGHT DISPATCH GUARD (build). One `{ num, lane, spawnedTick }` entry per spawned delivery agent.
 *      {@link filterLaunches} drops a `plan.launch` entry whose `num` OR whose assigned `lane` matches a LIVE
 *      guard entry — the contended resource is the LANE, not just the item, so BOTH must exclude (else tick N
 *      launches {num,lane}, the agent is slow to acquire, and tick N+1 re-assigns that lane to a different
 *      top-of-queue num while agent A is still starting — two agents on one lane). {@link retireBuildGuards}
 *      retires an entry three ways: CLAIMED (its lane shows leased in `state.lanes` OR the item left
 *      `state.queue`), AGENT-RETURNED (an injected `signals.returnedBuildNums` — the Agent completed/errored),
 *      or TTL (still pending after `buildTtlTicks`, default 3 — the required backstop for an agent that died
 *      after spawn but before claiming; surfaced as a note the first time).
 *
 *   2. PREPARE GUARD (scope + decision) — DIFFERENT bookkeeping, do NOT copy the build guard's retirement. One
 *      `{ num, kind, lane, spawnedTick, sawPr }` entry per prepare-scope / prepare-decision agent, keyed by
 *      `num` (the contended resource is the item's SCOPE/FORK authorship, not the incidental lane). A prepare
 *      NEVER claims and leaves the queue only at MERGE (several ticks), and its Agent RETURNS at PR-open, well
 *      before merge — so the build guard's "retire on Agent-return" rule would be a double-dispatch bug here.
 *      {@link retirePrepareGuards} therefore retires ONLY on: SCOPE-COMMITTED (the item left the pending set —
 *      `state.unshaped` for a scope prepare, or the un-prepared `state.decisions` rows for a decision prepare),
 *      PR-TERMINAL (a prepare PR was seen open and has now left the open set), or TTL-TO-FIRST-PR
 *      (`prepareTtlTicks`, default 5 — fires ONLY while NO open PR for the num has ever appeared, to catch an
 *      agent that died pre-PR; once an open prepare PR exists the TTL is VOID). NEVER on mere Agent-return.
 *      The re-dispatch gate ({@link planPrepareSpawns}) is the UNION: skip spawning a prepare for `num` when
 *      EITHER a live prepare-guard entry exists for it OR `state.prs` has an OPEN PR for that `num` (which,
 *      while the item is still unscoped/un-prepared, can only be its prepare — the backstop if the guard is lost).
 *
 *   3. FIX GUARD (§3c) — TWO separate pieces of state. An in-flight ENTRY `{ pr, num, lane, spawnedTick }` keyed
 *      by PR number ("a fix agent for this PR is live now"), and a per-PR attempt counter `fixAttempts[pr]`
 *      ("how many auto-fixes this PR has cost in total") that SURVIVES entry retirement and clears ONLY when the
 *      PR is terminal. Keeping the counter off the entry is the whole point: a bounce → fix → re-arm → bounce
 *      AGAIN is a NEW `review:changes` with no live entry, so a counter on the entry would reset each cycle and
 *      the cap would never bind. {@link planFixSpawns} skips a PR with a live entry (in-flight test), stops at
 *      the retry cap (`fixRetryCap`, default 3 — surfaced for `/review`), else spawns + bumps the counter.
 *      {@link retireFixGuards} retires the ENTRY when the PR no longer carries `review:changes` (re-armed /
 *      terminal) or on TTL (`fixTtlTicks`, default 5) — NOT the counter, which {@link clearTerminalFixAttempts}
 *      drops only when the PR leaves the open set. Because `fixAttempts` is in-session process state, it does NOT
 *      survive a conveyor restart; the cap therefore also reads a DURABLE floor `prRearmCounts[pr]` derived from
 *      the PR's own re-arm comments (`countRearmComments` — one comment per completed auto-fix, #2643), and binds
 *      on `max(in-session, durable)`. The durable floor is the restart-surviving source of truth (no parallel
 *      state store, #2612 — the count IS PR state); the in-session tally is the overlay that additionally counts
 *      a fix agent that died before re-arming (which leaves no comment for the floor to see).
 *
 *   3b. CI-HEAL GUARD (§3c-ci, #2666) — the SIBLING of the fix guard, SAME entry+counter+cap+TTL shape, but its
 *      trigger is a CI REGRESSION not a `review:changes` label: a conveyor PR that was GREEN AT OPEN
 *      (`ready-to-merge` / a review park) but has since gone RED on a required check ({@link isRedCi}) or BEHIND +
 *      parked ({@link isBehind} — the not-landable BEHIND case #2183 leaves unhealed). The delivery agent has long
 *      exited and the drain skips a red-CI PR, so nothing heals it. {@link planCiHealSpawns} dispatches a CI-heal
 *      agent that rebases + repairs ONLY the CI half and NEVER touches the review label. Its cap binds on
 *      `max(in-session ciHealAttempts, durable prCiHealCounts)` — the durable floor from the PR's own CI-heal
 *      comments (`countCiHealComments`, #2666 mirrors #2643), so a restart never resets a burned PR.
 *      {@link retireCiHealGuards} retires the ENTRY on CI recovery / PR-terminal (`resolved`) or TTL; the counter
 *      clears ONLY on PR-terminal ({@link clearTerminalCiHealAttempts}). `review:changes` PRs are EXCLUDED — the
 *      fix loop (guard 3) already rebases them.
 *
 * WATCHER ARMING (§4): {@link armWatchers} arms one watcher per OPEN PR whose `num` this conveyor DISPATCHED
 *   this session (`launchedNums` — builds AND prepares) that is not already watched, and prunes the watched set
 *   to the currently-open conveyor PRs (a merged/closed PR's watcher already exited). Scoping to conveyor-launched
 *   nums keeps an unrelated PR's stray `review:*` label from waking the loop. Each armed entry carries the
 *   `releaseSession` slug ({@link releaseSessionForNum}) the watcher passes as `--release-session`, so on MERGE
 *   pr-watch auto-releases that item's lane lease(s) across pools — the ghost-lease reclamation #2667 built and
 *   #2700 wires in (the periodic lease-reaper, SKILL §4c, is the catch-all backstop for what auto-release misses).
 *
 * HEALTH / STALL BACKSTOP (§2): `state.health` is now LIVE — #2616 populates the lane→num map on
 *   `acquire --item`, so `conveyor-state`'s stall scan flags a genuinely silent lane rather than always reading
 *   `ok`. {@link planTick} CONSUMES that verdict as a real backstop: `buildStatusLine` shows the `⚠ lane-N` warn
 *   and each stalled lane becomes an actionable `lane-stalled` note, so the per-tick lease-reaper reclaims the
 *   stalled lease and the operator sees it. It never auto-re-dispatches a guard on a stall (the 3-min threshold is
 *   far below a guard's spawn-to-death TTL — the guard TTLs remain the re-dispatch backstop, un-regressed).
 *
 * IDLE-STOP (§6): {@link assessIdleStop} stops ONLY when the queue is empty (no cleared `buildQueued` rows, no
 *   in-flight lanes, no open conveyor PRs) AND there has been no operator feedback for `idleWindowMs` (default
 *   15 min). It reads the operator-feedback clock (`now`, `lastOperatorTurn`) as injected inputs and deliberately
 *   IGNORES `state.idle.lastQueueAdd` (that field is the drain's queue, not the conveyor queue — SKILL §6).
 */

import { normNum } from './queue-store.mjs';

// ── PURE CORE (no fs / git / Date / child_process / gh — every input is passed IN) ───────────────────────────

/** Default TTL (in ticks) for the BUILD guard's died-before-claim backstop (SKILL §2 rule 3). */
export const DEFAULT_BUILD_TTL_TICKS = 3;
/** Default TTL (in ticks) for the PREPARE guard's died-before-first-PR backstop (SKILL §2 prepare guard). */
export const DEFAULT_PREPARE_TTL_TICKS = 5;
/** Default TTL (in ticks) for the FIX guard's died-before-rearm backstop (SKILL §3c). */
export const DEFAULT_FIX_TTL_TICKS = 5;
/** Default per-PR auto-fix attempt cap before a bounce is surfaced for `/review` (SKILL §3c). */
export const DEFAULT_FIX_RETRY_CAP = 3;
/** Default TTL (in ticks) for the CI-HEAL guard's died-before-repush backstop (SKILL §3c-ci, #2666). */
export const DEFAULT_CI_HEAL_TTL_TICKS = 5;
/** Default per-PR CI-heal attempt cap before a red/BEHIND PR is surfaced for `/review` (SKILL §3c-ci, #2666). */
export const DEFAULT_CI_HEAL_RETRY_CAP = 3;
/** Default idle-stop window: queue-empty + no operator feedback for this long → stop (SKILL §6). */
export const DEFAULT_IDLE_WINDOW_MS = 15 * 60 * 1000;
/** The review label that routes a bounced PR to a fix agent (vs. a human-owned review park). */
export const REVIEW_CHANGES_LABEL = 'review:changes';

/** The labels that mark a conveyor PR as HAVING BEEN GREEN / CLEARED at open — `ready-to-merge` (pr-land applied
 *  it only once `test` went green) or a human review park. A PR that carries one of these was healthy at open, so
 *  a later red check / BEHIND is a REGRESSION to heal (#2666); a PR carrying NONE of them was never green (a
 *  born-red build the delivery agent already escalated gate-red) and must NOT trip the CI-heal loop. */
export const GREEN_AT_OPEN_LABELS = Object.freeze(['ready-to-merge', 'review:human', 'review:pending']);
/** The human-owned review-park labels. A PR carrying one is NOT landable, so #2183's BEHIND-rebuild never fires
 *  for it — the parked-and-BEHIND case this CI-heal loop covers (#2666). CI is repaired; the park label is NOT. */
export const REVIEW_PARK_LABELS = Object.freeze(['review:human', 'review:pending']);

/** True when a `state.prs` row is OPEN. `state.prs` is built from `gh pr list --state open`, so every row is
 *  open by construction; this tolerates a missing/blank `state` (→ open) and only rejects an explicit terminal
 *  state, so a caller that hands in a wider list never mis-reads a closed PR as open. */
function isOpenPr(p) {
  const s = String(p?.state || '').toUpperCase();
  return s === '' || s === 'OPEN';
}

/** The OPEN `state.prs` row for item `num` (normalized), or null. While an item is still unscoped / un-prepared
 *  it has NO build PR, so its only open PR can be its in-flight prepare — the union re-dispatch gate's backstop. */
function openPrForNum(prs, num) {
  const key = normNum(num);
  return (Array.isArray(prs) ? prs : []).find((p) => p && isOpenPr(p) && normNum(p.num) === key) || null;
}

/** True when a `state.prs` row carries the `review:changes` label (a human bounce → route to a fix agent). */
function hasReviewChanges(prRow) {
  return Array.isArray(prRow?.labels) && prRow.labels.includes(REVIEW_CHANGES_LABEL);
}

/** Lowercased label-name set for a `state.prs` row (labels are plain strings out of `shapePrs`; tolerate `{name}`). */
function labelSet(labels) {
  return new Set(
    (Array.isArray(labels) ? labels : [])
      .map((l) => (typeof l === 'string' ? l : l?.name))
      .filter(Boolean)
      .map((n) => String(n).toLowerCase()),
  );
}

/** True when the PR's required-check rollup is DEFINITIVELY red (`ci === 'fail'` — `ciRollup` in conveyor-state.mjs
 *  distills the whole rollup to `pass|fail|pending|none`; only `fail` is a settled red check the drain would skip). */
function isRedCi(prRow) {
  return String(prRow?.ci || '').toLowerCase() === 'fail';
}

/** True when the PR is BEHIND its base (`main` advanced under it). Read from `mergeStateStatus` — the gh field name
 *  — so once conveyor-state.mjs shapes it onto the PR row this branch goes live; until then it is dormant (the field
 *  is absent → always false), and the red-CI branch alone drives the loop. See the follow-up that populates it. */
function isBehind(prRow) {
  return String(prRow?.mergeStateStatus ?? prRow?.behind ?? '').toUpperCase() === 'BEHIND';
}

/** True when the PR carries a marker that it was GREEN / CLEARED at open (see {@link GREEN_AT_OPEN_LABELS}). */
function wasGreenAtOpen(labels) {
  const ls = labelSet(labels);
  return GREEN_AT_OPEN_LABELS.some((l) => ls.has(l));
}

/** True when the PR is human-review-PARKED (`review:human` / `review:pending`) — not landable, so #2183's rebuild
 *  never fires and its BEHIND stays unhealed (the case this loop covers, #2666). */
function isReviewParked(labels) {
  const ls = labelSet(labels);
  return REVIEW_PARK_LABELS.some((l) => ls.has(l));
}

/**
 * True when a `state.prs` row is a CI-HEAL TARGET (#2666) — a conveyor PR that was GREEN AT OPEN but has since
 * regressed on the CI axis, and is NOT already owned by the `review:changes` fix loop. Two disjoint triggers:
 *   • RED CI — a definitively-failed required check (`ci === 'fail'`) on a was-green PR. The drain skips a red check
 *     regardless of landability, so nothing heals it; this is the dominant, observed case (a BEHIND branch whose
 *     `test` job broke against the new main surfaces here as `ci: 'fail'`).
 *   • BEHIND + PARKED — the base advanced (`mergeStateStatus === 'BEHIND'`) AND the PR is human-review-parked, so it
 *     is NOT landable and #2183's BEHIND-rebuild never fires. (A LANDABLE BEHIND PR is #2183's job — deliberately
 *     excluded here so the two loops never fight over the same rebuild.)
 * A `review:changes` PR is EXCLUDED — the review-changes fix loop (§3c) already reconstitutes + rebases it.
 */
function isCiHealTarget(prRow) {
  if (!prRow || !isOpenPr(prRow)) return false;
  const labels = prRow.labels;
  if (hasReviewChanges(prRow)) return false; // owned by the review:changes fix loop (§3c) — it already rebases
  if (isRedCi(prRow) && wasGreenAtOpen(labels)) return true; // red required check on a PR that was green at open
  if (isBehind(prRow) && isReviewParked(labels)) return true; // not-landable BEHIND — the case #2183 leaves unhealed
  return false;
}

/** The set of item nums (normalized) that are cleared-for-build (`buildQueued`) in the tick's `state.queue`. */
function clearedQueueNums(queue) {
  return new Set((Array.isArray(queue) ? queue : []).filter((r) => r?.buildQueued).map((r) => normNum(r.num)));
}

/**
 * RETIRE the in-flight BUILD guard entries (SKILL §2 — three ways). Given the live build guards and the tick's
 * read, split them into the entries that stay LIVE and the entries that RETIRE (each with its reason). Pure.
 *
 *   • CLAIMED  — the agent got going: its `lane` shows leased in `state.lanes`, OR its `num` has left the cleared
 *                build queue (a claimed item leaves `build-queue`'s ready set). The normal path.
 *   • RETURNED — the delivery `Agent` completed/errored: its `num` is in the injected `signals.returnedBuildNums`.
 *   • TTL      — still pending after `ttlTicks` without ever claiming (the required backstop for an agent that
 *                died after spawn but before claim). Surfaced (`note:true`) so the skill can warn once.
 *
 * @param {Array<{num:*, lane:*, spawnedTick:number}>} buildGuards
 * @param {{ lanes?:object[], queue?:object[], tick:number, ttlTicks?:number, returnedBuildNums?:Array<*> }} ctx
 * @returns {{ live:Array<object>, retired:Array<{num:*, lane:*, reason:string, note?:boolean}> }}
 */
export function retireBuildGuards(buildGuards, { lanes = [], queue = [], tick = 0, ttlTicks = DEFAULT_BUILD_TTL_TICKS, returnedBuildNums = [] } = {}) {
  const leasedLanes = new Set((Array.isArray(lanes) ? lanes : []).map((l) => String(l?.lane)));
  const clearedNums = clearedQueueNums(queue);
  const returned = new Set((Array.isArray(returnedBuildNums) ? returnedBuildNums : []).map(normNum));
  const live = [];
  const retired = [];
  for (const g of Array.isArray(buildGuards) ? buildGuards : []) {
    if (!g || g.num == null) continue;
    const key = normNum(g.num);
    const claimed = leasedLanes.has(String(g.lane)) || !clearedNums.has(key);
    if (claimed) { retired.push({ num: g.num, lane: g.lane, reason: 'claimed' }); continue; }
    if (returned.has(key)) { retired.push({ num: g.num, lane: g.lane, reason: 'returned' }); continue; }
    if (tick - (g.spawnedTick ?? tick) >= ttlTicks) {
      retired.push({ num: g.num, lane: g.lane, reason: 'ttl', note: true });
      continue;
    }
    live.push(g);
  }
  return { live, retired };
}

/**
 * FILTER `plan.launch` through the live in-flight dispatch guard (SKILL §2). Drop a launch entry whose `num` OR
 * whose assigned `lane` matches a live guard entry — BOTH are excluded because the contended resource is the
 * lane, not only the item. Pure.
 * @param {Array<{num:*, lane:*}>} launches  `plan.launch` from the dispatch plan
 * @param {Array<{num:*, lane:*}>} liveBuildGuards  the guards that survived retirement THIS tick
 * @returns {{ spawn:Array<{num:*, lane:*}>, suppressed:Array<{num:*, lane:*, by:string}> }}
 */
export function filterLaunches(launches, liveBuildGuards) {
  const guardNums = new Set((Array.isArray(liveBuildGuards) ? liveBuildGuards : []).map((g) => normNum(g.num)));
  const guardLanes = new Set((Array.isArray(liveBuildGuards) ? liveBuildGuards : []).map((g) => String(g.lane)));
  const spawn = [];
  const suppressed = [];
  for (const l of Array.isArray(launches) ? launches : []) {
    if (!l || l.num == null) continue;
    if (guardNums.has(normNum(l.num))) { suppressed.push({ num: l.num, lane: l.lane, by: 'num' }); continue; }
    if (guardLanes.has(String(l.lane))) { suppressed.push({ num: l.num, lane: l.lane, by: 'lane' }); continue; }
    spawn.push({ num: l.num, lane: l.lane });
  }
  return { spawn, suppressed };
}

/**
 * RETIRE the PREPARE guard entries (SKILL §2 prepare guard + §3e) — its OWN rules, never the build guard's.
 * Keyed by `num`; retires ONLY on scope-committed / PR-terminal / TTL-to-first-PR, NEVER on Agent-return.
 *
 *   • SCOPE-COMMITTED — the item left the pending set: `state.unshaped` for a `kind:'prepare'` (scope) guard, or
 *                       the un-prepared `state.decisions` rows for a `kind:'prepare-decision'` guard. Success.
 *   • PR-TERMINAL     — a prepare PR for the num was seen OPEN (`sawPr`) and has now left the open set.
 *   • TTL-TO-FIRST-PR — fires ONLY while NO open PR for the num has EVER appeared (`!sawPr`) and the entry is
 *                       older than `ttlTicks` — catches an agent that died before opening its PR. Once an open
 *                       prepare PR exists the TTL is void; retirement is then PR-terminal. Surfaced (`note:true`).
 *
 * A live entry's `sawPr` is STICKY: once an open PR is observed for the num it stays true, so a later `gh` read
 * that momentarily drops the (still-open) PR retires the guard as PR-TERMINAL rather than firing a false TTL.
 * (It cannot fully prevent a duplicate prepare on such a flaky read — the union re-dispatch gate reads the SAME
 * `state.prs`, so an absent PR opens the gate too — but that is a pre-existing property of one PR read serving
 * both the guard and the gate, and `gh pr list --state open` rarely drops a genuinely-open PR.)
 *
 * @param {Array<{num:*, kind?:string, lane:*, spawnedTick:number, sawPr?:boolean}>} prepareGuards
 * @param {{ unshaped?:object[], decisions?:object[], prs?:object[], tick:number, ttlTicks?:number }} ctx
 * @returns {{ live:Array<object>, retired:Array<{num:*, kind:string, reason:string, note?:boolean}> }}
 */
export function retirePrepareGuards(prepareGuards, { unshaped = [], decisions = [], prs = [], tick = 0, ttlTicks = DEFAULT_PREPARE_TTL_TICKS } = {}) {
  const unshapedNums = new Set((Array.isArray(unshaped) ? unshaped : []).map((u) => normNum(u.num)));
  const unpreparedNums = new Set(
    (Array.isArray(decisions) ? decisions : []).filter((d) => d?.prepared !== true).map((d) => normNum(d.num)),
  );
  const live = [];
  const retired = [];
  for (const g of Array.isArray(prepareGuards) ? prepareGuards : []) {
    if (!g || g.num == null) continue;
    const key = normNum(g.num);
    const kind = g.kind || 'prepare';
    const pendingNums = kind === 'prepare-decision' ? unpreparedNums : unshapedNums;
    const openPr = !!openPrForNum(prs, g.num);
    const sawPr = g.sawPr === true || openPr;
    if (!pendingNums.has(key)) { retired.push({ num: g.num, kind, reason: 'scope-committed' }); continue; }
    if (sawPr && !openPr) { retired.push({ num: g.num, kind, reason: 'pr-terminal' }); continue; }
    if (!sawPr && tick - (g.spawnedTick ?? tick) >= ttlTicks) {
      retired.push({ num: g.num, kind, reason: 'ttl', note: true });
      continue;
    }
    live.push(sawPr === g.sawPr ? g : { ...g, sawPr }); // persist the sticky sawPr flip
  }
  return { live, retired };
}

/**
 * PLAN the prepare-scope + prepare-decision spawns (SKILL §3b / §3e). For every unscoped held item
 * (`state.unshaped`) and every UNPREPARED decision (`state.decisions[].prepared === false`), spawn ONE prepare
 * agent UNLESS the UNION re-dispatch gate suppresses it: skip when EITHER a live prepare-guard entry exists for
 * the num OR `state.prs` has an OPEN PR for the num. A spawn consumes one `availableLanes` id (the free lanes
 * MINUS this tick's build launches MINUS every live guard's lane, computed by the caller); with no lane left the
 * item HOLDS (a note, no spawn — atomic `acquire` would fail one race anyway). Pure — mutates nothing; returns
 * the spawns, the new guard entries, the lanes it consumed, and any hold notes.
 *
 * @param {{ unshaped?:object[], decisions?:object[], prs?:object[], livePrepareGuards?:object[], availableLanes?:Array<*>, tick:number }} ctx
 * @returns {{ scopeSpawns:Array<{num:*, lane:*}>, decisionSpawns:Array<{num:*, lane:*}>, newGuards:Array<object>, consumedLanes:Array<*>, notes:Array<{kind:string, num:*, text:string}> }}
 */
export function planPrepareSpawns({ unshaped = [], decisions = [], prs = [], livePrepareGuards = [], availableLanes = [], tick = 0 } = {}) {
  const guardNums = new Set((Array.isArray(livePrepareGuards) ? livePrepareGuards : []).map((g) => normNum(g.num)));
  const lanes = [...(Array.isArray(availableLanes) ? availableLanes : [])];
  const scopeSpawns = [];
  const decisionSpawns = [];
  const newGuards = [];
  const consumedLanes = [];
  const notes = [];

  const plan = (num, kind, sink) => {
    const key = normNum(num);
    if (guardNums.has(key)) return; // live prepare-guard entry → already in flight
    if (openPrForNum(prs, num)) return; // open PR for an unscoped/un-prepared item → its in-flight prepare
    if (lanes.length === 0) { notes.push({ kind: 'prepare-no-lane', num, text: `no free lane to auto-prepare #${num}` }); return; }
    const lane = lanes.shift();
    consumedLanes.push(lane);
    guardNums.add(key); // a decision and a scope item never share a num, but stay safe against a duplicate row
    sink.push({ num, lane });
    newGuards.push({ num, kind, lane, spawnedTick: tick, sawPr: false });
  };

  for (const u of Array.isArray(unshaped) ? unshaped : []) if (u?.num != null) plan(u.num, 'prepare', scopeSpawns);
  for (const d of Array.isArray(decisions) ? decisions : []) {
    if (d?.num != null && d.prepared !== true) plan(d.num, 'prepare-decision', decisionSpawns);
  }
  return { scopeSpawns, decisionSpawns, newGuards, consumedLanes, notes };
}

/**
 * PLAN the fix-agent spawns for `review:changes` bounces (SKILL §3c). For every OPEN `state.prs` row that this
 * conveyor launched (`num` ∈ `launchedNums`) and carries `review:changes`: skip if a live fix-guard ENTRY
 * already exists for the PR (the in-flight test); else if the PR has reached the retry cap surface it for
 * `/review` (no spawn); else spawn a fix agent on a free lane, record a new entry, and BUMP the attempt counter.
 *
 * The cap is checked against `max(in-session fixAttempts[pr], durable prRearmCounts[pr])` (#2643). The in-session
 * `fixAttempts` map does NOT survive a conveyor restart, so on a fresh conveyor it starts empty and the cap would
 * never bind — the very unbounded fix↔bounce loop the cap exists to prevent. `prRearmCounts` is the DURABLE floor
 * derived from the PR's own re-arm comments (`countRearmComments`, one per completed auto-fix): it restores the
 * count after a restart, and the in-session map stays as the within-session overlay that also counts a fix agent
 * that DIED before re-arming (which posts no comment, so the durable floor can't see it — that TTL-backstop case
 * still terminates at the human via the in-session tally). Because the bump seeds off the max, the in-session map
 * is re-primed from the durable floor on the first post-restart spawn. Pure — returns the spawns, new entries, the
 * bumped counter map, consumed lanes, and the surface notes; mutates no input.
 *
 * @param {{ prs?:object[], launchedNums?:Array<*>, liveFixGuards?:object[], fixAttempts?:object, prRearmCounts?:object, retryCap?:number, availableLanes?:Array<*>, tick:number }} ctx
 * @returns {{ spawns:Array<{pr:number, num:*, lane:*}>, newGuards:Array<object>, fixAttempts:object, consumedLanes:Array<*>, notes:Array<object> }}
 */
export function planFixSpawns({ prs = [], launchedNums = [], liveFixGuards = [], fixAttempts = {}, prRearmCounts = {}, retryCap = DEFAULT_FIX_RETRY_CAP, availableLanes = [], tick = 0 } = {}) {
  const launched = new Set((Array.isArray(launchedNums) ? launchedNums : []).map(normNum));
  const guardedPrs = new Set((Array.isArray(liveFixGuards) ? liveFixGuards : []).map((g) => Number(g.pr)));
  const nextAttempts = { ...(fixAttempts && typeof fixAttempts === 'object' ? fixAttempts : {}) };
  const durable = prRearmCounts && typeof prRearmCounts === 'object' ? prRearmCounts : {};
  const lanes = [...(Array.isArray(availableLanes) ? availableLanes : [])];
  const spawns = [];
  const newGuards = [];
  const consumedLanes = [];
  const notes = [];

  for (const p of Array.isArray(prs) ? prs : []) {
    if (!p || !isOpenPr(p) || !hasReviewChanges(p)) continue;
    if (!launched.has(normNum(p.num))) continue; // only PRs THIS conveyor launched
    const pr = Number(p.prNumber);
    if (!pr) continue;
    if (guardedPrs.has(pr)) continue; // a fix agent for this PR is already live
    // The DURABLE re-arm-comment count is the restart-surviving floor; the in-session tally the within-session
    // overlay (it alone catches a fix that died before posting a re-arm comment). The cap binds on whichever is
    // higher, so a restart can never reset a PR that already burned its attempts (#2643).
    const attempts = Math.max(Number(nextAttempts[pr]) || 0, Number(durable[pr]) || 0);
    if (attempts >= retryCap) {
      notes.push({ kind: 'fix-exhausted', num: p.num, pr, attempts, text: `PR #${pr} (#${p.num}) bounced ${attempts}× — auto-fix exhausted, run /review ${pr}` });
      continue;
    }
    if (lanes.length === 0) { notes.push({ kind: 'fix-no-lane', num: p.num, pr, text: `no free lane to fix PR #${pr}` }); continue; }
    const lane = lanes.shift();
    consumedLanes.push(lane);
    guardedPrs.add(pr);
    nextAttempts[pr] = attempts + 1;
    spawns.push({ pr, num: p.num, lane });
    newGuards.push({ pr, num: p.num, lane, spawnedTick: tick });
  }
  return { spawns, newGuards, fixAttempts: nextAttempts, consumedLanes, notes };
}

/**
 * RETIRE the in-flight fix-guard ENTRIES (SKILL §3c — the ENTRY only, never the attempt counter). An entry
 * retires when its PR no longer carries `review:changes` (re-armed to `review:pending`, or merged/closed —
 * reason `resolved`) or on TTL (`ttlTicks`, the fix agent died before re-pushing/re-arming — reason `ttl`,
 * still gated by the retry cap on the next spawn, so a repeatedly-dying fix still terminates at the human). Pure.
 * @param {Array<{pr:number, num:*, spawnedTick:number}>} fixGuards
 * @param {{ prs?:object[], tick:number, ttlTicks?:number }} ctx
 * @returns {{ live:Array<object>, retired:Array<{pr:number, num:*, reason:string, note?:boolean}> }}
 */
export function retireFixGuards(fixGuards, { prs = [], tick = 0, ttlTicks = DEFAULT_FIX_TTL_TICKS } = {}) {
  const byPr = new Map();
  for (const p of Array.isArray(prs) ? prs : []) if (p?.prNumber != null) byPr.set(Number(p.prNumber), p);
  const live = [];
  const retired = [];
  for (const g of Array.isArray(fixGuards) ? fixGuards : []) {
    if (!g || g.pr == null) continue;
    const prRow = byPr.get(Number(g.pr));
    const stillChanges = prRow && isOpenPr(prRow) && hasReviewChanges(prRow);
    if (!stillChanges) { retired.push({ pr: Number(g.pr), num: g.num, reason: 'resolved' }); continue; }
    if (tick - (g.spawnedTick ?? tick) >= ttlTicks) {
      retired.push({ pr: Number(g.pr), num: g.num, reason: 'ttl', note: true });
      continue;
    }
    live.push(g);
  }
  return { live, retired };
}

/**
 * CLEAR the per-PR fix-attempt counter for PRs that have reached a TERMINAL state (SKILL §3c — the counter
 * clears ONLY on merge/close, NEVER on entry retirement). A PR is terminal when it has left the OPEN
 * `state.prs` set. Returns a NEW map with only the still-open PRs' counters. Pure.
 * @param {object} fixAttempts  `{ [pr]: count }`
 * @param {object[]} prs  the tick's `state.prs` (open PRs)
 * @returns {object} the pruned counter map
 */
export function clearTerminalFixAttempts(fixAttempts, prs) {
  const openPrs = new Set((Array.isArray(prs) ? prs : []).filter(isOpenPr).map((p) => Number(p.prNumber)));
  const next = {};
  for (const [pr, count] of Object.entries(fixAttempts && typeof fixAttempts === 'object' ? fixAttempts : {})) {
    if (openPrs.has(Number(pr))) next[pr] = count;
  }
  return next;
}

/**
 * PLAN the CI-HEAL fix-agent spawns for conveyor PRs gone RED / BEHIND after a green open (SKILL §3c-ci, #2666).
 * This is the SIBLING of {@link planFixSpawns}: same in-flight-entry + attempt-counter + retry-cap shape, but the
 * trigger is a CI regression ({@link isCiHealTarget}) in place of a `review:changes` label, and the spawned agent
 * repairs ONLY the CI half — it NEVER touches `review:human` / `review:pending` (the human gate stays). For every
 * OPEN conveyor-launched PR (`num` ∈ `launchedNums`) that is a CI-heal target: skip if a live CI-heal entry already
 * exists for the PR (in-flight test); else if it has reached the retry cap surface it for `/review` (no spawn); else
 * spawn a CI-heal agent on a free lane, record an entry, and BUMP the attempt counter.
 *
 * The cap binds on `max(in-session ciHealAttempts[pr], durable prCiHealCounts[pr])` — the SAME restart-surviving
 * design as the fix loop (#2643): the in-session map is wiped by a conveyor restart, so a DURABLE floor derived from
 * the PR's own CI-heal comments (`countCiHealComments`, one per completed heal) restores the count and the cap can
 * never reset a PR that already burned its attempts. Pure — returns the spawns, new entries, the bumped counter map,
 * consumed lanes, and surface notes; mutates no input.
 *
 * @param {{ prs?:object[], launchedNums?:Array<*>, liveCiHealGuards?:object[], ciHealAttempts?:object, prCiHealCounts?:object, retryCap?:number, availableLanes?:Array<*>, tick:number }} ctx
 * @returns {{ spawns:Array<{pr:number, num:*, lane:*, reason:string}>, newGuards:Array<object>, ciHealAttempts:object, consumedLanes:Array<*>, notes:Array<object> }}
 */
export function planCiHealSpawns({ prs = [], launchedNums = [], liveCiHealGuards = [], ciHealAttempts = {}, prCiHealCounts = {}, retryCap = DEFAULT_CI_HEAL_RETRY_CAP, availableLanes = [], tick = 0 } = {}) {
  const launched = new Set((Array.isArray(launchedNums) ? launchedNums : []).map(normNum));
  const guardedPrs = new Set((Array.isArray(liveCiHealGuards) ? liveCiHealGuards : []).map((g) => Number(g.pr)));
  const nextAttempts = { ...(ciHealAttempts && typeof ciHealAttempts === 'object' ? ciHealAttempts : {}) };
  const durable = prCiHealCounts && typeof prCiHealCounts === 'object' ? prCiHealCounts : {};
  const lanes = [...(Array.isArray(availableLanes) ? availableLanes : [])];
  const spawns = [];
  const newGuards = [];
  const consumedLanes = [];
  const notes = [];

  for (const p of Array.isArray(prs) ? prs : []) {
    if (!isCiHealTarget(p)) continue;
    if (!launched.has(normNum(p.num))) continue; // only PRs THIS conveyor launched
    const pr = Number(p.prNumber);
    if (!pr) continue;
    if (guardedPrs.has(pr)) continue; // a CI-heal agent for this PR is already live
    // DURABLE re-heal-comment count is the restart-surviving floor; the in-session tally the within-session overlay
    // (it alone catches a heal that died before posting its comment). The cap binds on whichever is higher (#2643).
    const attempts = Math.max(Number(nextAttempts[pr]) || 0, Number(durable[pr]) || 0);
    if (attempts >= retryCap) {
      notes.push({ kind: 'ci-heal-exhausted', num: p.num, pr, attempts, text: `PR #${pr} (#${p.num}) went red/BEHIND ${attempts}× — auto CI-heal exhausted, run /review ${pr}` });
      continue;
    }
    if (lanes.length === 0) { notes.push({ kind: 'ci-heal-no-lane', num: p.num, pr, text: `no free lane to CI-heal PR #${pr}` }); continue; }
    const lane = lanes.shift();
    consumedLanes.push(lane);
    guardedPrs.add(pr);
    nextAttempts[pr] = attempts + 1;
    const reason = isRedCi(p) ? 'red-ci' : 'behind';
    spawns.push({ pr, num: p.num, lane, reason });
    newGuards.push({ pr, num: p.num, lane, spawnedTick: tick });
  }
  return { spawns, newGuards, ciHealAttempts: nextAttempts, consumedLanes, notes };
}

/**
 * RETIRE the in-flight CI-HEAL guard ENTRIES (SKILL §3c-ci — the ENTRY only, never the attempt counter). Mirrors
 * {@link retireFixGuards}: an entry retires when its PR is no longer a CI-heal target ({@link isCiHealTarget} false —
 * CI recovered to non-red / no-longer-BEHIND, or the PR went terminal — reason `resolved`) or on TTL (`ttlTicks`,
 * the heal agent died before re-pushing — reason `ttl`, still gated by the retry cap on the next spawn so a
 * repeatedly-dying heal still terminates at the human). The per-PR attempt counter is NOT cleared here (it clears
 * only on PR-terminal, via {@link clearTerminalCiHealAttempts}). Pure.
 * @param {Array<{pr:number, num:*, spawnedTick:number}>} ciHealGuards
 * @param {{ prs?:object[], tick:number, ttlTicks?:number }} ctx
 * @returns {{ live:Array<object>, retired:Array<{pr:number, num:*, reason:string, note?:boolean}> }}
 */
export function retireCiHealGuards(ciHealGuards, { prs = [], tick = 0, ttlTicks = DEFAULT_CI_HEAL_TTL_TICKS } = {}) {
  const byPr = new Map();
  for (const p of Array.isArray(prs) ? prs : []) if (p?.prNumber != null) byPr.set(Number(p.prNumber), p);
  const live = [];
  const retired = [];
  for (const g of Array.isArray(ciHealGuards) ? ciHealGuards : []) {
    if (!g || g.pr == null) continue;
    const prRow = byPr.get(Number(g.pr));
    const stillTarget = prRow && isCiHealTarget(prRow);
    if (!stillTarget) { retired.push({ pr: Number(g.pr), num: g.num, reason: 'resolved' }); continue; }
    if (tick - (g.spawnedTick ?? tick) >= ttlTicks) {
      retired.push({ pr: Number(g.pr), num: g.num, reason: 'ttl', note: true });
      continue;
    }
    live.push(g);
  }
  return { live, retired };
}

/**
 * CLEAR the per-PR CI-heal attempt counter for PRs that have reached a TERMINAL state (mirrors
 * {@link clearTerminalFixAttempts} — the counter clears ONLY on merge/close, NEVER on entry retirement). Pure.
 * @param {object} ciHealAttempts  `{ [pr]: count }`
 * @param {object[]} prs  the tick's `state.prs` (open PRs)
 * @returns {object} the pruned counter map
 */
export function clearTerminalCiHealAttempts(ciHealAttempts, prs) {
  const openPrs = new Set((Array.isArray(prs) ? prs : []).filter(isOpenPr).map((p) => Number(p.prNumber)));
  const next = {};
  for (const [pr, count] of Object.entries(ciHealAttempts && typeof ciHealAttempts === 'object' ? ciHealAttempts : {})) {
    if (openPrs.has(Number(pr))) next[pr] = count;
  }
  return next;
}

/**
 * The lane-lease session slug that OWNS item `num`'s open PR — the `--release-session` a merge watcher passes to
 * `pr-watch.mjs` so that, the instant the PR MERGES, pr-watch auto-releases that session's lease(s) in EVERY pool
 * it acquired (`lane-pool release --all-pools --session=<slug>`, which also resets the freed clone to origin/main)
 * — the ghost-lease reclamation #2667 delivered but #2700 wires into the tick. Pure — derived from the num and
 * whether a LIVE prepare guard still holds it:
 *   • a `prepare-decision` guard → `prepare-decision-<num>` (the decision-prepare agent's session, SKILL §3e);
 *   • a `prepare` (scope) guard  → `prepare-<num>` (the scope-prepare agent's session, SKILL §3b);
 *   • otherwise                  → `conveyor-<num>` (the build/delivery agent's session, SKILL §3).
 * A prepare guard stays LIVE from spawn until its scope PR merges, so an OPEN prepare PR always still carries its
 * guard — the kind lookup is reliable for exactly the window a watcher is armed. A fix lease (`fix-<num>`) and any
 * lease this single slug misses (e.g. a build lease still held under a since-merged sibling) ride the periodic
 * lease-reaper backstop (`lease-reaper.mjs`, run each tick, SKILL §4c) — auto-release is the fast path, the reaper
 * the catch-all, exactly as #2667 designed them.
 * @param {*} num  the item number the PR belongs to (raw — a hashed `xNNNNNN` id keeps its form in the slug).
 * @param {Map<string,string>} prepareKindByNum  normNum → prepare-guard `kind` for the live prepare guards.
 * @returns {string}
 */
export function releaseSessionForNum(num, prepareKindByNum) {
  const kind = prepareKindByNum instanceof Map ? prepareKindByNum.get(normNum(num)) : undefined;
  if (kind === 'prepare-decision') return `prepare-decision-${num}`;
  if (kind === 'prepare') return `prepare-${num}`;
  return `conveyor-${num}`;
}

/**
 * ARM a merge watcher per newly-opened conveyor-launched PR (SKILL §4) and prune the watched set. A watcher is
 * armed for an OPEN `state.prs` row whose `num` this conveyor DISPATCHED this session (`launchedNums` — builds
 * AND prepares) that is not already in `watched`. Each armed entry carries the `releaseSession` slug pr-watch
 * passes as `--release-session` (#2700 — merge-time ghost-lease auto-release; see {@link releaseSessionForNum}).
 * The next watched set is exactly the currently-open conveyor-launched PRs (a merged/closed PR's watcher has
 * already exited, so it drops out). Pure.
 * @param {object[]} prs  the tick's `state.prs`
 * @param {Array<*>} launchedNums  the item nums this conveyor dispatched this session
 * @param {Array<number>} watched  the PR numbers with a live watcher
 * @param {Array<{num:*, kind?:string}>} livePrepareGuards  live prepare guards — supply each armed PR's owning session kind
 * @returns {{ arm:Array<{pr:number, releaseSession:string}>, nextWatched:Array<number> }}
 */
export function armWatchers(prs, launchedNums, watched, livePrepareGuards = []) {
  const launched = new Set((Array.isArray(launchedNums) ? launchedNums : []).map(normNum));
  const already = new Set((Array.isArray(watched) ? watched : []).map(Number));
  const prepareKindByNum = new Map(
    (Array.isArray(livePrepareGuards) ? livePrepareGuards : [])
      .filter((g) => g && g.num != null)
      .map((g) => [normNum(g.num), g.kind || 'prepare']),
  );
  const openConveyorPrs = (Array.isArray(prs) ? prs : [])
    .filter((p) => p && isOpenPr(p) && launched.has(normNum(p.num)) && Number(p.prNumber));
  const seen = new Set();
  const nextWatched = [];
  const arm = [];
  for (const p of openConveyorPrs) {
    const pr = Number(p.prNumber);
    if (seen.has(pr)) continue; // a num with two open PRs → watch each once
    seen.add(pr);
    nextWatched.push(pr);
    if (!already.has(pr)) arm.push({ pr, releaseSession: releaseSessionForNum(p.num, prepareKindByNum) });
  }
  return { arm, nextWatched };
}

/**
 * ASSESS idle-stop (SKILL §6). Stop ONLY when BOTH hold: the queue is EMPTY (no cleared `buildQueued` rows in
 * `state.queue`, no in-flight lanes in `state.lanes`, and no OPEN conveyor-launched PR) AND there has been no
 * operator feedback for `idleWindowMs` (measured `now - lastOperatorTurn`). Deliberately ignores
 * `state.idle.lastQueueAdd` (the drain's queue, not the conveyor queue). When `lastOperatorTurn`/`now` are absent
 * the feedback clock cannot be evaluated → never stops (conservative — a fresh session never idle-stops blind).
 * Pure — the clock is injected.
 * @param {{ queue?:object[], lanes?:object[], prs?:object[], launchedNums?:Array<*>, now?:number|null, lastOperatorTurn?:number|null, idleWindowMs?:number }} ctx
 * @returns {{ stop:boolean, queueEmpty:boolean, idleElapsedMs:(number|null) }}
 */
export function assessIdleStop({ queue = [], lanes = [], prs = [], launchedNums = [], now = null, lastOperatorTurn = null, idleWindowMs = DEFAULT_IDLE_WINDOW_MS } = {}) {
  const launched = new Set((Array.isArray(launchedNums) ? launchedNums : []).map(normNum));
  const clearedCount = (Array.isArray(queue) ? queue : []).filter((r) => r?.buildQueued).length;
  const laneCount = (Array.isArray(lanes) ? lanes : []).length;
  const openConveyorPrCount = (Array.isArray(prs) ? prs : []).filter((p) => p && isOpenPr(p) && launched.has(normNum(p.num))).length;
  const queueEmpty = clearedCount === 0 && laneCount === 0 && openConveyorPrCount === 0;
  const idleElapsedMs = now != null && lastOperatorTurn != null ? Number(now) - Number(lastOperatorTurn) : null;
  const noFeedback = idleElapsedMs != null && idleElapsedMs >= idleWindowMs;
  return { stop: queueEmpty && noFeedback, queueEmpty, idleElapsedMs };
}

/**
 * ROUTE a `pr-watch.mjs` process exit to its mechanical action (SKILL §3 — the watcher already CLASSIFIED the
 * PR; this maps its exit code + the PR's current labels to the branch, so the skill does not re-derive the
 * verdict). Exit codes: 0 merged · 1 error · 2 parked · 3 timeout · 4 closed. A parked PR (2) splits on its
 * label: `review:changes` → dispatch a fix agent; any other review label → surface for `/review`. Pure.
 * @param {number} code  the watcher's process exit code
 * @param {Array<string>} labels  the PR's current labels (from a fresh `state.prs` row / `gh pr view`)
 * @returns {{ action:'merged-freed'|'dispatch-fix'|'surface-review'|'anomaly-closed'|'rearm-timeout'|'error' }}
 */
export function routeWatcherExit(code, labels = []) {
  const ls = Array.isArray(labels) ? labels : [];
  switch (Number(code)) {
    case 0: return { action: 'merged-freed' };
    case 2: return { action: ls.includes(REVIEW_CHANGES_LABEL) ? 'dispatch-fix' : 'surface-review' };
    case 3: return { action: 'rearm-timeout' };
    case 4: return { action: 'anomaly-closed' };
    default: return { action: 'error' }; // 1, or any unknown code
  }
}

/**
 * Build the terse one-line tick status (SKILL §5). Counts are derived from the tick's read + the LIVE
 * bookkeeping so the line is deterministic:
 *   • building — distinct nums that are an in-flight build guard OR an active (non-prepare) leased lane. The
 *     guard half covers only the brief spawn→claim window (the build guard retires at claim), so the leased-lane
 *     half carries the count through the actual build — which needs `state.lanes[].num` populated from the
 *     lane-ports registry (#2616 populates it on `acquire --item`). Where that map is empty the count reflects
 *     only the spawn→claim window (a known undercount, not a miscount — no tick decision reads this line).
 *   • preparing — distinct live prepare-guard nums (scope + decision).
 *   • fixing — live fix-guard entries.
 *   • healing — live CI-heal-guard entries (conveyor PRs gone red/BEHIND after open, #2666).
 *   • queued — cleared `buildQueued` rows NOT already in flight (building/preparing).
 *   • parked — distinct conveyor-launched OPEN PRs carrying any `review:*` label.
 *   • health — `state.health.verdict`; a `warn` appends the flagged lanes.
 *   • infra — `state.infraBlocked` count (only when non-empty).
 * @returns {string}
 */
export function buildStatusLine({ queue = [], lanes = [], prs = [], health = {}, infraBlocked = [], liveBuildGuards = [], livePrepareGuards = [], liveFixGuards = [], liveCiHealGuards = [], launchedNums = [] } = {}) {
  const prepareNums = new Set((Array.isArray(livePrepareGuards) ? livePrepareGuards : []).map((g) => normNum(g.num)));
  const buildGuardNums = new Set((Array.isArray(liveBuildGuards) ? liveBuildGuards : []).map((g) => normNum(g.num)));
  // Active build lanes = leased lanes whose item is NOT a live prepare (a prepare also leases a lane).
  const buildLaneNums = new Set(
    (Array.isArray(lanes) ? lanes : [])
      .map((l) => (l?.num != null ? normNum(l.num) : null))
      .filter((n) => n && !prepareNums.has(n)),
  );
  const building = new Set([...buildGuardNums, ...buildLaneNums]);
  const inFlight = new Set([...building, ...prepareNums]);
  const queued = (Array.isArray(queue) ? queue : []).filter((r) => r?.buildQueued && !inFlight.has(normNum(r.num))).length;
  const launched = new Set((Array.isArray(launchedNums) ? launchedNums : []).map(normNum));
  const parked = new Set(
    (Array.isArray(prs) ? prs : [])
      .filter((p) => p && isOpenPr(p) && launched.has(normNum(p.num)) && (p.labels || []).some((x) => String(x).startsWith('review:')))
      .map((p) => normNum(p.num)),
  );
  const fixing = (Array.isArray(liveFixGuards) ? liveFixGuards : []).length;
  const healing = (Array.isArray(liveCiHealGuards) ? liveCiHealGuards : []).length;
  const verdict = health?.verdict === 'warn' ? 'warn' : 'ok';
  let line = `conveyor · ${building.size} building · ${prepareNums.size} preparing · ${fixing} fixing · ${healing} healing · ${queued} queued · ${parked.size} parked · health ${verdict}`;
  const infra = (Array.isArray(infraBlocked) ? infraBlocked : []).length;
  if (infra) line += ` · ${infra} infra-blocked`;
  if (verdict === 'warn') {
    const stalledLanes = (Array.isArray(health?.stalled) ? health.stalled : []).map((s) => `lane-${s.lane}`).join(' ');
    line += stalledLanes ? ` ⚠ ${stalledLanes}` : ' ⚠';
  }
  return line;
}

/**
 * The top-level PURE composer: a tick's read-only inputs + the conveyor's prior bookkeeping → the tick's
 * mechanical DECISIONS + the NEXT bookkeeping. Same inputs → same output, always. The order is the tick's order:
 * RETIRE stale guards first (so a launch is filtered against only still-live guards), FILTER the launches, then
 * plan the prepare + fix spawns against the free lanes the builds did not take, arm watchers, and assess
 * idle-stop. Every new spawn extends the LIVE guard set and `launchedNums`, so `nextState` is ready to feed the
 * next tick verbatim.
 *
 * @param {{
 *   state: object,                       // the conveyor-state.mjs read: { queue, unshaped, needsSlice, decisions, lanes, prs, health, infraBlocked, ... }
 *   plan?: { launch?:object[], held?:object[] },  // the dispatch-plan.mjs read
 *   freeLanes?: Array<*>,                // free lane ids (lane-pool list --acquirable) — for prepare/fix assignment
 *   bookkeeping?: {                      // the conveyor's prior in-session process state (SKILL §5)
 *     tick?:number, buildGuards?:object[], prepareGuards?:object[], fixGuards?:object[],
 *     fixAttempts?:object, watched?:Array<number>, launchedNums?:Array<*>,
 *   },
 *   signals?: { returnedBuildNums?:Array<*> },  // async events the shell folds in (Agent returns)
 *   prRearmCounts?: object,              // DURABLE per-PR re-arm-comment counts { [pr]: n } — the restart-surviving retry-cap floor (#2643); the IO shell derives it via `countRearmComments`
 *   config?: { buildTtlTicks?:number, prepareTtlTicks?:number, fixTtlTicks?:number, fixRetryCap?:number, idleWindowMs?:number },
 *   now?: number|null, lastOperatorTurn?: number|null,
 * }} input
 * @returns {{ decisions:object, nextState:object }}
 */
export function planTick({ state = {}, plan = {}, freeLanes = [], bookkeeping = {}, signals = {}, prRearmCounts = {}, prCiHealCounts = {}, config = {}, now = null, lastOperatorTurn = null } = {}) {
  const cfg = {
    buildTtlTicks: config.buildTtlTicks ?? DEFAULT_BUILD_TTL_TICKS,
    prepareTtlTicks: config.prepareTtlTicks ?? DEFAULT_PREPARE_TTL_TICKS,
    fixTtlTicks: config.fixTtlTicks ?? DEFAULT_FIX_TTL_TICKS,
    fixRetryCap: config.fixRetryCap ?? DEFAULT_FIX_RETRY_CAP,
    ciHealTtlTicks: config.ciHealTtlTicks ?? DEFAULT_CI_HEAL_TTL_TICKS,
    ciHealRetryCap: config.ciHealRetryCap ?? DEFAULT_CI_HEAL_RETRY_CAP,
    idleWindowMs: config.idleWindowMs ?? DEFAULT_IDLE_WINDOW_MS,
  };
  const tick = Number(bookkeeping.tick) || 0;
  const { queue = [], unshaped = [], needsSlice = [], decisions = [], lanes = [], prs = [], health = {}, infraBlocked = [] } = state;

  // 1. RETIRE stale guards FIRST — a launch is then filtered against only still-live guards.
  const build = retireBuildGuards(bookkeeping.buildGuards, {
    lanes, queue, tick, ttlTicks: cfg.buildTtlTicks, returnedBuildNums: signals.returnedBuildNums,
  });
  const prepare = retirePrepareGuards(bookkeeping.prepareGuards, {
    unshaped, decisions, prs, tick, ttlTicks: cfg.prepareTtlTicks,
  });
  const fix = retireFixGuards(bookkeeping.fixGuards, { prs, tick, ttlTicks: cfg.fixTtlTicks });
  const fixAttempts = clearTerminalFixAttempts(bookkeeping.fixAttempts, prs);
  const ciHeal = retireCiHealGuards(bookkeeping.ciHealGuards, { prs, tick, ttlTicks: cfg.ciHealTtlTicks });
  const ciHealAttempts = clearTerminalCiHealAttempts(bookkeeping.ciHealAttempts, prs);

  // 2. FILTER plan.launch through the live build guard (num OR lane), then record a guard per new build.
  const launched = filterLaunches(plan.launch, build.live);
  const newBuildGuards = launched.spawn.map((l) => ({ num: l.num, lane: l.lane, spawnedTick: tick }));
  const liveBuildGuards = [...build.live, ...newBuildGuards];

  // 3. The free lanes a prepare/fix may take = free lanes MINUS this tick's build launches MINUS every live
  //    guard's lane (build + prepare + fix) — mirror the build guard's lane exclusion so nothing races a lane.
  const takenLanes = new Set([
    ...launched.spawn.map((l) => String(l.lane)),
    ...liveBuildGuards.map((g) => String(g.lane)),
    ...prepare.live.map((g) => String(g.lane)),
    ...fix.live.map((g) => String(g.lane)),
    ...ciHeal.live.map((g) => String(g.lane)),
  ]);
  let availableLanes = (Array.isArray(freeLanes) ? freeLanes : []).filter((l) => !takenLanes.has(String(l)));

  // 4. PREPARE spawns (scope + decision) — union re-dispatch gate, lane exclusion; consume lanes.
  const prep = planPrepareSpawns({ unshaped, decisions, prs, livePrepareGuards: prepare.live, availableLanes, tick });
  const consumed = new Set(prep.consumedLanes.map(String));
  availableLanes = availableLanes.filter((l) => !consumed.has(String(l)));
  const livePrepareGuards = [...prepare.live, ...prep.newGuards];

  // 5. `launchedNums` grows with every dispatch (build + prepare) — the set watcher-arming scopes to.
  const launchedNums = Array.from(new Set([
    ...(Array.isArray(bookkeeping.launchedNums) ? bookkeeping.launchedNums.map(normNum) : []),
    ...launched.spawn.map((l) => normNum(l.num)),
    ...prep.scopeSpawns.map((s) => normNum(s.num)),
    ...prep.decisionSpawns.map((s) => normNum(s.num)),
  ]));

  // 6. FIX spawns — conveyor-launched `review:changes` PRs, gated by in-flight test + retry cap; consume lanes.
  const fixPlan = planFixSpawns({ prs, launchedNums, liveFixGuards: fix.live, fixAttempts, prRearmCounts, retryCap: cfg.fixRetryCap, availableLanes, tick });
  const liveFixGuards = [...fix.live, ...fixPlan.newGuards];
  const fixConsumed = new Set(fixPlan.consumedLanes.map(String));
  availableLanes = availableLanes.filter((l) => !fixConsumed.has(String(l)));

  // 6b. CI-HEAL spawns — conveyor-launched PRs gone RED / BEHIND after a green open (#2666). The SIBLING of the
  //     fix loop: same entry + counter + cap shape, CI-regression trigger, and the heal repairs ONLY CI — never the
  //     review label. Uses the lanes the builds/prepares/fixes did not take, gated by in-flight test + retry cap.
  const ciHealPlan = planCiHealSpawns({ prs, launchedNums, liveCiHealGuards: ciHeal.live, ciHealAttempts, prCiHealCounts, retryCap: cfg.ciHealRetryCap, availableLanes, tick });
  const liveCiHealGuards = [...ciHeal.live, ...ciHealPlan.newGuards];

  // 7. WATCHERS — one per open conveyor-launched PR; prune to currently-open conveyor PRs. Each armed entry
  //    carries the `releaseSession` slug pr-watch passes as `--release-session` (#2700 merge-time auto-release),
  //    derived from the live prepare guards (a prepare PR's session differs from a build PR's).
  const watch = armWatchers(prs, launchedNums, bookkeeping.watched, livePrepareGuards);

  // 8. IDLE-STOP — queue-empty AND no operator feedback for the window.
  const idle = assessIdleStop({ queue, lanes, prs, launchedNums, now, lastOperatorTurn, idleWindowMs: cfg.idleWindowMs });

  // 9. Surface notes — the deterministic, no-agent surfaces (§3d epics, §3e prepared decisions) + guard TTL
  //    re-dispatch warnings, gathered so the skill posts them without re-deriving.
  const notes = [];
  for (const r of build.retired) if (r.note) notes.push({ kind: 'build-ttl', num: r.num, text: `⚠ #${r.num} never claimed after ${cfg.buildTtlTicks} ticks — re-dispatching` });
  for (const r of prepare.retired) if (r.note) notes.push({ kind: 'prepare-ttl', num: r.num, text: `⚠ prepare #${r.num} produced no PR in ${cfg.prepareTtlTicks} ticks — re-dispatching` });
  for (const r of fix.retired) if (r.note) notes.push({ kind: 'fix-ttl', num: r.num, text: `⚠ fix for PR carrying #${r.num} stalled ${cfg.fixTtlTicks} ticks — re-dispatch allowed` });
  for (const r of ciHeal.retired) if (r.note) notes.push({ kind: 'ci-heal-ttl', num: r.num, text: `⚠ CI-heal for PR carrying #${r.num} stalled ${cfg.ciHealTtlTicks} ticks — re-dispatch allowed` });
  if (prep.scopeSpawns.length) notes.push({ kind: 'auto-preparing-scope', nums: prep.scopeSpawns.map((s) => s.num), text: `⚠ ${prep.scopeSpawns.length} auto-preparing scope: ${prep.scopeSpawns.map((s) => `#${s.num}`).join(' ')}` });
  notes.push(...prep.notes.map((n) => ({ kind: n.kind, num: n.num, text: n.text })));
  notes.push(...fixPlan.notes.map((n) => ({ kind: n.kind, num: n.num, pr: n.pr, text: n.text })));
  notes.push(...ciHealPlan.notes.map((n) => ({ kind: n.kind, num: n.num, pr: n.pr, text: n.text })));
  for (const e of Array.isArray(needsSlice) ? needsSlice : []) notes.push({ kind: 'needs-slice', num: e.num, epicState: e.epicState, text: `⚠ epic #${e.num} needs slicing (/slice ${e.num})` });
  for (const d of Array.isArray(decisions) ? decisions : []) if (d?.prepared === true) notes.push({ kind: 'decision-ready', num: d.num, text: `⚖ decision #${d.num} ready to ratify (/next decision)` });
  // HEALTH — the stall scan is LIVE now (#2616 populates the lane→num map on `acquire --item`), so `state.health`
  // flags a genuinely stalled lane instead of always reading `ok`. Surface each stalled lane as an actionable note
  // (the status line already shows the aggregate `⚠ lane-N` warn): the per-tick lease-reaper (SKILL §4c) reclaims
  // the stalled lane's lease on its TTL-stale axis, so the health verdict is now a real backstop, not the inert
  // signal the SKILL used to forbid relying on. This SURFACES + RECLAIMS; it never auto-re-dispatches a guard —
  // the stall threshold (3 min) is far shorter than a guard's spawn-to-death TTL, so acting on it as a re-dispatch
  // trigger would false-positive on a legitimately-quiet live agent (the guard TTLs stay the re-dispatch backstop).
  for (const s of Array.isArray(health?.stalled) ? health.stalled : []) {
    notes.push({ kind: 'lane-stalled', num: s.num, lane: s.lane, idleS: s.idleS, text: `⚠ lane-${s.lane} (#${s.num}) stalled ${s.idleS}s — the lease-reaper reclaims its lease once it passes the reaper TTL; investigate if it recurs` });
  }
  // DEGRADED-INFRA — the clustered outage signal #2661 collapsed onto `state.health.degradedInfra`: ONE entry per
  // shared external cause ({ cause, count, members }), so several lanes down on the SAME outage read as ONE event,
  // not N alarms. Surface ONE note PER CLUSTER (cause + affected-lane count) — distinct from the per-lane
  // `lane-stalled` note above: an infra-blocked lane is NOT a stall (its work is pushed + auto-retrying, #2659),
  // and the whole point of the cluster is that the operator sees the outage once, not once per waiting lane. This
  // is the tick-note half of the same signal the status board already renders as its #2660 OUTAGE banner. Purely
  // ADDITIVE — degradedInfra does not flip `verdict`, so this never changes idle-stop or the health warn.
  for (const c of Array.isArray(health?.degradedInfra) ? health.degradedInfra : []) {
    if (!c || !c.cause) continue;
    // #2661 guarantees a numeric `count`; fall back to the members length (then 0) so a malformed cluster never
    // renders "undefined lanes" — defensive only, the input contract makes the fallback unreachable today.
    const count = Number.isFinite(c.count) ? c.count : (Array.isArray(c.members) ? c.members.length : 0);
    notes.push({ kind: 'degraded-infra', cause: c.cause, count, text: `⚠ outside dependency degraded — ${count} lane${count === 1 ? '' : 's'} waiting on ${c.cause} (auto-retrying)` });
  }

  const statusLine = buildStatusLine({
    queue, lanes, prs, health, infraBlocked, liveBuildGuards, livePrepareGuards, liveFixGuards, liveCiHealGuards, launchedNums,
  });

  return {
    decisions: {
      spawnBuilds: launched.spawn,
      suppressedBuilds: launched.suppressed,
      spawnPrepareScope: prep.scopeSpawns,
      spawnPrepareDecision: prep.decisionSpawns,
      spawnFixes: fixPlan.spawns,
      spawnCiHeals: ciHealPlan.spawns,
      armWatchers: watch.arm,
      retireGuards: { build: build.retired, prepare: prepare.retired, fix: fix.retired, ciHeal: ciHeal.retired },
      idleStop: idle.stop,
      idle,
      statusLine,
      notes,
    },
    nextState: {
      tick: tick + 1,
      buildGuards: liveBuildGuards,
      prepareGuards: livePrepareGuards,
      fixGuards: liveFixGuards,
      fixAttempts: fixPlan.fixAttempts,
      ciHealGuards: liveCiHealGuards,
      ciHealAttempts: ciHealPlan.ciHealAttempts,
      watched: watch.nextWatched,
      launchedNums,
    },
  };
}

// ── IO SHELL (runs only as a CLI — owns all child_process; keeps the pure core import-clean) ──────────────────

/** Read all of STDIN as a string (the SESSION-EPHEMERAL bookkeeping is piped in — never a committed repo store). */
async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

async function main(argv) {
  const { execFileSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');

  const HERE = dirname(fileURLToPath(import.meta.url));
  const STATE_CLI = join(HERE, '..', 'readiness', 'conveyor-state.mjs');
  const PLAN_CLI = join(HERE, '..', 'readiness', 'dispatch-plan.mjs');
  const LANE_POOL_CLI = join(HERE, '..', 'lane-pool.mjs');

  const flags = {};
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq === -1) flags[a.slice(2)] = true;
    else flags[a.slice(2, eq)] = a.slice(eq + 1);
  }
  const fail = (m) => { process.stderr.write(`✗ ${m}\n`); process.exit(1); };

  const runJson = (cmd, args, what) => {
    let out;
    try {
      out = execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
    } catch (e) {
      fail(`${what} failed: ${String(e.message || e).split('\n')[0]}`);
    }
    try { return JSON.parse(out); }
    catch (e) { fail(`could not parse ${what} JSON: ${String(e.message || e).split('\n')[0]}`); }
  };

  // The SESSION-EPHEMERAL bookkeeping is piped in on STDIN (SKILL §5: no on-disk parallel state store). A first
  // tick with no prior bookkeeping pipes nothing / `{}` — every field then defaults to empty in the pure core.
  let bookkeeping = {};
  let signals = {};
  let config = {};
  let lastOperatorTurn = null;
  if (!process.stdin.isTTY) {
    const raw = (await readStdin()).trim();
    if (raw) {
      let parsed;
      try { parsed = JSON.parse(raw); }
      catch (e) { fail(`could not parse STDIN bookkeeping JSON: ${String(e.message || e).split('\n')[0]}`); }
      bookkeeping = parsed.bookkeeping || parsed || {};
      signals = parsed.signals || {};
      config = parsed.config || {};
      lastOperatorTurn = parsed.lastOperatorTurn ?? null;
    }
  }

  const stateArgs = ['--json'];
  const planArgs = ['--json'];
  if (typeof flags.repo === 'string') { stateArgs.push(`--repo=${flags.repo}`); }
  const state = runJson('node', [STATE_CLI, ...stateArgs], 'conveyor-state');
  const plan = runJson('node', [PLAN_CLI, ...planArgs], 'dispatch-plan');

  // Free lane ids — the same acquirable picker dispatch-plan's shell uses (ascending, deterministic assignment).
  const paths = runJson('node', [LANE_POOL_CLI, 'list', '--acquirable', '--json'], 'lane-pool list');
  const freeLanes = (Array.isArray(paths) ? paths : [])
    .map((p) => { const m = /lane-(\d+)\/?$/.exec(String(p)); return m ? Number(m[1]) : null; })
    .filter((n) => n != null)
    .sort((a, b) => a - b);

  // DURABLE retry-cap floor (#2643): for each OPEN `review:changes` PR, read its re-arm comments off the PR and
  // count them (`countRearmComments`). This is the restart-surviving source of truth for "how many times this PR
  // was auto-fixed" — the in-session `fixAttempts` map is gone after a restart, so without this the cap could
  // never bind on a fresh conveyor. Only `review:changes` PRs are read (rare), so it adds no per-tick gh cost in
  // the common case; a comment read that fails is best-effort (floor 0 — the in-session tally still guards).
  const { countRearmComments } = await import('./rearm-review.mjs');
  const { countCiHealComments } = await import('./ci-heal-mark.mjs');
  const prRearmCounts = {};
  const prCiHealCounts = {};
  // ONE `gh pr view … --json comments` per PR that is EITHER a `review:changes` bounce (fix-loop floor, #2643) OR a
  // CI-heal target (CI-heal floor, #2666). Both durable floors read the SAME comment thread, so a single read serves
  // both counters — a red/BEHIND PR that is also `review:changes` is owned by the fix loop, but reading its comments
  // once and counting both markers costs nothing extra. Both are RARE (a red / bounced PR), so this adds no per-tick
  // gh cost in the common all-green case.
  for (const p of Array.isArray(state?.prs) ? state.prs : []) {
    const labels = Array.isArray(p?.labels) ? p.labels : [];
    const wantsRearm = p?.prNumber && labels.includes('review:changes');
    const wantsCiHeal = p?.prNumber && isCiHealTarget(p);
    if (!wantsRearm && !wantsCiHeal) continue;
    // Best-effort, NON-fatal (unlike `runJson`, which exits the tick on error): a single PR's comment read must
    // never kill the whole tick — on failure the floor stays unset (0) and the in-session tally still binds.
    // Thread `--repo` exactly as the state read does (line above): without it, `gh pr view` resolves the repo from
    // cwd, so in explicit-`--repo` mode every read would 404 → floor 0 → the durable cap silently drops (the very
    // restart bug this fixes, re-exposed for that invocation).
    const prViewArgs = ['pr', 'view', String(p.prNumber), '--json', 'comments'];
    if (typeof flags.repo === 'string') { prViewArgs.push(`--repo=${flags.repo}`); }
    try {
      const raw = execFileSync('gh', prViewArgs,
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024 });
      const comments = JSON.parse(raw)?.comments;
      if (wantsRearm) prRearmCounts[p.prNumber] = countRearmComments(comments);
      if (wantsCiHeal) prCiHealCounts[p.prNumber] = countCiHealComments(comments);
    } catch { /* leave the floor unset — the in-session tally still guards the cap */ }
  }

  const out = planTick({ state, plan, freeLanes, bookkeeping, signals, prRearmCounts, prCiHealCounts, config, now: Date.now(), lastOperatorTurn });
  writeAllSync(1, JSON.stringify(out, null, 2) + '\n');
  process.exit(0);
}

// Run the IO shell only when invoked directly — never on import (keeps the pure core side-effect-free).
import { pathToFileURL } from 'node:url';
import { writeAllSync } from '../lib/write-all-sync.mjs';
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main(process.argv.slice(2));
}
