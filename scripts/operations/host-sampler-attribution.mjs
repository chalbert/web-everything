/**
 * @file scripts/operations/host-sampler-attribution.mjs
 * @description LANE + HEAVY-ADMISSION HOLDER ATTRIBUTION, WORKER LIFECYCLE and ADMISSION DETAIL for the host
 * sampler (epic #3383, capacity refinement 2026-09-21). The first 18.6 hours attributed CPU only for the top
 * processes and mostly to `unattributed`; the reservation question ("how much does a LANE need, how much does a
 * HEAVY command need, how much is the system's") needs EVERY process joined to its lane and to the heavy-admission
 * holder that spawned it.
 *
 * ATTRIBUTION NEVER GUESSES (same rule as `host-sampler-extras.mjs`). A process maps to a lane by, in order: its
 * cwd (a `lsof` reading), a lane path in its argv, the lane of its nearest ANCESTOR that has one, a live session's
 * cwd. It maps to a HOLDER only if its parent chain (itself included) reaches the pid of a held admission slot or
 * of a `heavy-admission.mjs run` wrapper. A heavy-class process with NO holder is reported apart as UNADMITTED
 * heavy work (the finding that `check:standards`, typed `vitest` and Playwright bypass the semaphore).
 *
 * PURE: every fact is injected. No fs, clock, env or process.
 */
import { COMMAND_CLASSES, HEAVY_CLASSES, WORKER_KINDS, classifyCommandClass, refineWithRoster, workerKind } from './host-sampler-classes.mjs';

export const MAX_HOPS = 40;

const inside = (p, root) => typeof p === 'string' && (p === root || p.startsWith(`${root}/`));
const mentions = (cmd, root) => cmd.includes(`${root}/`) || cmd.includes(`${root} `) || cmd.endsWith(root);
const r1 = (v) => Math.round(v * 10) / 10;
const baseName = (p) => String(p ?? '').replace(/^.*\//, '');
const emptyBucket = () => ({ cpuPct: 0, memBytes: 0, count: 0 });
const addTo = (b, row) => { b.cpuPct += row.pcpu || 0; b.memBytes += (row.rssKb || 0) * 1024; b.count += 1; };
const finish = (b) => ({ cpuPct: r1(b.cpuPct), memBytes: b.memBytes, count: b.count });

/** PURE. The roster's live sessions as `pid → {kind, name, sessionId, cwd}` (only rows that carry an integer pid). */
export function sessionPidMap(agents) {
  const m = new Map();
  for (const a of Array.isArray(agents) ? agents : []) if (Number.isInteger(a?.pid)) m.set(a.pid, { kind: workerKind(a), name: a.name ?? null, sessionId: a.sessionId ?? null, cwd: a.cwd ?? null });
  return m;
}

/**
 * PURE. The holders of the heavy-admission semaphore, with how long each has held and which processes it owns.
 * A held slot's `pid` is the holder; `heartbeatAt` is written ONCE at acquire (no heartbeat during the hold, by
 * design), so `now - heartbeatAt` IS the hold duration. A `heavy-admission.mjs run` wrapper that holds no slot is an
 * UNSLOTTED holder (its wait timed out and it failed open, or its slot was reclaimed).
 * @param {{admission:object|null, rows:object[], nowMs:number}} o
 */
export function holderTable({ admission, rows, nowMs }) {
  const byPid = new Map(rows.map((r) => [r.pid, r]));
  const holders = new Map();
  const waitingPids = new Set((admission?.waiting ?? []).map((w) => w.pid).filter(Number.isInteger));
  for (const h of admission?.held ?? []) {
    const hb = Date.parse(h.heartbeatAt);
    const row = Number.isInteger(h.pid) ? byPid.get(h.pid) : null;
    holders.set(Number.isInteger(h.pid) ? h.pid : `slot-${h.slot}`, {
      id: `slot-${h.slot}:${baseName(h.owner)}`, slot: h.slot, owner: h.owner ?? null, pid: Number.isInteger(h.pid) ? h.pid : null,
      heldForS: Number.isFinite(hb) ? Math.max(0, Math.round((nowMs - hb) / 1000)) : null, alive: row != null, elapsedS: row?.etimeS ?? null, unslotted: false,
    });
  }
  for (const r of rows) {
    if (holders.has(r.pid) || waitingPids.has(r.pid)) continue;
    if (/heavy-admission\.mjs\s+run\b/.test(r.command) && /^(node|nodejs)\b/.test(baseName(String(r.command).split(' ')[0]))) {
      holders.set(r.pid, { id: `unslotted:${r.pid}`, slot: null, owner: null, pid: r.pid, heldForS: null, alive: true, elapsedS: r.etimeS ?? null, unslotted: true });
    }
  }
  return holders;
}

/**
 * PURE. The lane resolver every attribution uses: `ownLane(row)` from the row's own evidence (cwd, argv, its session's
 * cwd), `laneOf(row)` additionally inheriting the nearest ancestor's lane.
 * @returns {{ownLane:(r:object)=>({lane:object,source:string}|null), laneOf:(r:object)=>({lane:object,source:string}|null)}}
 */
export function makeLaneResolver({ byPid, lanes = [], cwds = {}, sessionByPid = null }) {
  const laneOfPath = (p) => lanes.find((l) => inside(p, l.path)) || null;
  const own = new Map();
  const ownLane = (r) => {
    if (own.has(r.pid)) return own.get(r.pid);
    let v = null;
    const byCwd = laneOfPath(cwds[r.pid]);
    if (byCwd) v = { lane: byCwd, source: 'cwd' };
    else { const byArgv = lanes.find((l) => mentions(String(r.command), l.path)); if (byArgv) v = { lane: byArgv, source: 'argv' }; }
    if (!v && sessionByPid?.get(r.pid)?.cwd) { const bs = laneOfPath(sessionByPid.get(r.pid).cwd); if (bs) v = { lane: bs, source: 'session-cwd' }; }
    own.set(r.pid, v);
    return v;
  };
  const laneOf = (r) => {
    const seen = new Set();
    for (let cur = r, hop = 0; cur && !seen.has(cur.pid) && hop < MAX_HOPS; hop++) {
      seen.add(cur.pid);
      const o = ownLane(cur);
      if (o) return { lane: o.lane, source: cur === r ? o.source : 'ancestor' };
      cur = byPid.get(cur.ppid);
    }
    return null;
  };
  return { ownLane, laneOf };
}

/**
 * PURE. Join every process to its lane and holder and total per lane / per holder / unattributed.
 * @param {{rows:object[], lanes:Array<{pool:string,lane:string,path:string}>, cwds?:Record<number,string>,
 *   sessionByPid?:Map<number,object>|null, admission?:object|null, nowMs:number}} o
 */
export function attributeProcesses({ rows, lanes = [], cwds = {}, sessionByPid = null, admission = null, nowMs }) {
  const byPid = new Map(rows.map((r) => [r.pid, r]));
  const classOf = new Map(rows.map((r) => [r.pid, refineWithRoster(classifyCommandClass(r.command), r.pid, sessionByPid)]));
  const { ownLane } = makeLaneResolver({ byPid, lanes, cwds, sessionByPid });
  // A heavy command is ONE unit however many processes it spawns: a root has no heavy ancestor at ANY depth (an `npm`
  // or shell wrapper between two heavy processes must not split one command in two).
  const hasHeavyAncestor = (r) => {
    const seen = new Set([r.pid]);
    for (let cur = byPid.get(r.ppid), hop = 0; cur && !seen.has(cur.pid) && hop < MAX_HOPS; hop++) {
      if (HEAVY_CLASSES.includes(classOf.get(cur.pid))) return true;
      seen.add(cur.pid); cur = byPid.get(cur.ppid);
    }
    return false;
  };
  const holders = holderTable({ admission, rows, nowMs });
  // A heavy run counts as ADMITTED when a holder is above its root (an admission wrapper) or anywhere inside its tree
  // (`verify-lane.mjs` holds its own slot, and its parent shell is the root).
  const children = new Map();
  for (const r of rows) { if (!children.has(r.ppid)) children.set(r.ppid, []); children.get(r.ppid).push(r); }
  const topHeavy = (r) => {
    let top = r; const seen = new Set([r.pid]);
    for (let cur = byPid.get(r.ppid), hop = 0; cur && !seen.has(cur.pid) && hop < MAX_HOPS; hop++) { seen.add(cur.pid); if (HEAVY_CLASSES.includes(classOf.get(cur.pid))) top = cur; cur = byPid.get(cur.ppid); }
    return top;
  };
  const admittedMemo = new Map();
  const admittedRun = (top) => {
    if (admittedMemo.has(top.pid)) return admittedMemo.get(top.pid);
    let ok = false;
    const seen = new Set();
    for (let cur = top, hop = 0; cur && !seen.has(cur.pid) && hop < MAX_HOPS; hop++) { seen.add(cur.pid); if (holders.has(cur.pid)) { ok = true; break; } cur = byPid.get(cur.ppid); }
    for (let stack = [top]; !ok && stack.length;) { const r = stack.pop(); if (holders.has(r.pid)) ok = true; else for (const c of children.get(r.pid) ?? []) if (!seen.has(c.pid)) { seen.add(c.pid); stack.push(c); } }
    admittedMemo.set(top.pid, ok);
    return ok;
  };
  const laneStats = {}; const holderStats = new Map(); const laneSources = { cwd: 0, argv: 0, 'session-cwd': 0, ancestor: 0, none: 0 };
  const unlaned = emptyBucket(); const unheldHeavy = { ...emptyBucket(), byClass: {} }; const totals = emptyBucket();
  const heavyRoots = { count: 0, byClass: {} };
  for (const r of rows) {
    // walk self → parents once: nearest lane and nearest holder
    let lane = null; let laneSource = null; let holder = null;
    const seen = new Set();
    for (let cur = r, hop = 0; cur && !seen.has(cur.pid) && hop < MAX_HOPS; hop++) {
      seen.add(cur.pid);
      if (!lane) { const o = ownLane(cur); if (o) { lane = o.lane; laneSource = cur === r ? o.source : 'ancestor'; } }
      if (!holder && holders.has(cur.pid)) holder = holders.get(cur.pid);
      if (lane && holder) break;
      cur = byPid.get(cur.ppid);
    }
    const cls = classOf.get(r.pid);
    addTo(totals, r);
    if (lane) {
      const key = `${lane.pool}/${lane.lane}`;
      const s = (laneStats[key] ||= { ...emptyBucket(), byClass: {} });
      addTo(s, r); addTo((s.byClass[cls] ||= emptyBucket()), r);
      laneSources[laneSource] += 1;
    } else { addTo(unlaned, r); laneSources.none += 1; }
    const heavy = HEAVY_CLASSES.includes(cls);
    if (holder) {
      const s = holderStats.get(holder.id) ?? { holder, ...emptyBucket(), byClass: {} };
      addTo(s, r); addTo((s.byClass[cls] ||= emptyBucket()), r); holderStats.set(holder.id, s);
    } else if (heavy && !admittedRun(topHeavy(r))) { addTo(unheldHeavy, r); addTo((unheldHeavy.byClass[cls] ||= emptyBucket()), r); }
    if (heavy && !hasHeavyAncestor(r)) { heavyRoots.count += 1; heavyRoots.byClass[cls] = (heavyRoots.byClass[cls] || 0) + 1; }
  }
  const byClassOut = (m) => Object.fromEntries(Object.entries(m).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, finish(v)]));
  const perLane = {};
  for (const k of Object.keys(laneStats).sort()) perLane[k] = { ...finish(laneStats[k]), byClass: byClassOut(laneStats[k].byClass) };
  const holderOut = [...holderStats.values()].sort((a, b) => a.holder.id.localeCompare(b.holder.id)).map((s) => ({ ...s.holder, ...finish(s), byClass: byClassOut(s.byClass) }));
  // a held slot whose owner process has no rows (or whose subtree is empty) still needs a record
  for (const h of holders.values()) if (!holderStats.has(h.id)) holderOut.push({ ...h, cpuPct: 0, memBytes: 0, count: 0, byClass: {} });
  holderOut.sort((a, b) => a.id.localeCompare(b.id));
  return {
    perLane, unlaned: finish(unlaned), totals: finish(totals), holders: holderOut,
    unadmittedHeavy: { ...finish(unheldHeavy), byClass: byClassOut(unheldHeavy.byClass) },
    heavyRoots, laneSources,
    laneShare: totals.cpuPct > 0 ? Math.round(((totals.cpuPct - unlaned.cpuPct) / totals.cpuPct) * 1000) / 1000 : null,
  };
}

/**
 * PURE. The waiting and stale markers of the admission queue in detail: how long each live waiter has waited, and
 * which markers are STALE (dead pid or past the poll timeout): reported, never deleted.
 * @param {{admission:object|null, nowMs:number, pidLiveness?:(pid:number)=>('dead'|'alive'|'unknown')}} o
 */
export function admissionDetail({ admission, nowMs }) {
  const age = (m) => { const t = Date.parse(m?.requestedAt); return Number.isFinite(t) ? Math.max(0, Math.round((nowMs - t) / 1000)) : null; };
  const waiting = (admission?.waiting ?? []).map((w) => ({ owner: baseName(w.owner), pid: Number.isInteger(w.pid) ? w.pid : null, waitedS: age(w) }));
  const stale = (admission?.staleWaiting ?? []).map((w) => ({ owner: baseName(w.owner), pool: /\.lanes\/([^/]+)\//.exec(String(w.owner))?.[1] ?? null, pid: Number.isInteger(w.pid) ? w.pid : null, requestedAt: w.requestedAt ?? null, ageS: age(w) }));
  return { waiting, stale, oldestStaleAgeS: stale.reduce((m, s) => Math.max(m, s.ageS ?? 0), 0) };
}

// ── WORKER LIFECYCLE ────────────────────────────────────────────────────────────────────────────────────

/**
 * PURE. Live background/interactive sessions by kind and what each kind's process subtree costs. A roster row is
 * LIVE only when its pid is in THIS sample's `ps` (never trusted from the cached roster). The subtree cost is split
 * into the session's own NON-HEAVY processes and the HEAVY commands it spawned, so a worker's marginal cost is not
 * polluted by the `vitest` it ran.
 * @param {{agents:object[], rows:object[], sessionByPid?:Map<number,object>|null}} o
 */
export function summarizeWorkers({ agents, rows, sessionByPid = null }) {
  const byPid = new Map(rows.map((r) => [r.pid, r]));
  const children = new Map();
  for (const r of rows) { if (!children.has(r.ppid)) children.set(r.ppid, []); children.get(r.ppid).push(r); }
  const byKind = Object.fromEntries(WORKER_KINDS.map((k) => [k, { count: 0, cpuPct: 0, memBytes: 0, heavyCpuPct: 0, heavyMemBytes: 0 }]));
  const live = []; let noPid = 0;
  for (const a of Array.isArray(agents) ? agents : []) {
    if (!Number.isInteger(a?.pid)) { if (a?.state === 'working') noPid += 1; continue; }
    const root = byPid.get(a.pid);
    if (!root) continue;
    const kind = workerKind(a);
    const b = byKind[kind];
    b.count += 1;
    const seen = new Set(); const stack = [root];
    while (stack.length) {
      const r = stack.pop();
      if (seen.has(r.pid)) continue;
      seen.add(r.pid);
      const heavy = HEAVY_CLASSES.includes(refineWithRoster(classifyCommandClass(r.command), r.pid, sessionByPid));
      if (heavy) { b.heavyCpuPct += r.pcpu || 0; b.heavyMemBytes += (r.rssKb || 0) * 1024; } else { b.cpuPct += r.pcpu || 0; b.memBytes += (r.rssKb || 0) * 1024; }
      for (const c of children.get(r.pid) ?? []) stack.push(c);
    }
    live.push({ sessionId: a.sessionId ?? null, name: a.name ?? null, kind, pid: a.pid, startedAt: Number.isFinite(a.startedAt) ? a.startedAt : null });
  }
  for (const k of WORKER_KINDS) { byKind[k].cpuPct = r1(byKind[k].cpuPct); byKind[k].heavyCpuPct = r1(byKind[k].heavyCpuPct); }
  return { byKind, total: live.length, live, rosterWorkingNoPid: noPid };
}

/** A worker discovered by the roster more than this long after its recorded start was ALREADY running: not a dispatch. */
export const START_DISCOVERY_SLACK_MS = 10 * 60_000;

/**
 * PURE. EDGE-TRIGGERED lifecycle events from the change in the live set between two samples. `prev` is the previous
 * sample's `{sessionId: {name, kind}}` map (`undefined` on the very first sample: a baseline, no events). A start
 * carries the roster's own `startedAt` as its time when it falls inside the interval since the previous sample
 * (`discovered: false`); a worker first SEEN long after its recorded start (a roster refresh that attached a pid to
 * an old row) is `discovered: true` and must not be counted as a dispatch. A finish is stamped with the sample time
 * (an upper bound on the true end, at most one interval late).
 * @param {{prev:Record<string,{name:string|null,kind:string}>|undefined, live:Array<object>, nowMs:number, prevMs:number|null}} o
 * @returns {{events:object[], next:Record<string,{name:string|null,kind:string}>}}
 */
export function diffWorkers({ prev, live, nowMs, prevMs }) {
  const next = {};
  for (const w of live) if (w.sessionId) next[w.sessionId] = { name: w.name, kind: w.kind };
  if (prev === undefined || prev === null) return { events: [], next };
  const events = [];
  for (const w of live) {
    if (!w.sessionId || prev[w.sessionId]) continue;
    const fresh = Number.isFinite(w.startedAt) && w.startedAt <= nowMs && (prevMs == null || w.startedAt >= prevMs - START_DISCOVERY_SLACK_MS);
    events.push({ event: 'start', kind: w.kind, name: w.name, sessionId: w.sessionId, at: new Date(fresh ? w.startedAt : nowMs).toISOString(), discovered: !fresh });
  }
  for (const [id, p] of Object.entries(prev)) if (!next[id]) events.push({ event: 'finish', kind: p.kind, name: p.name, sessionId: id, at: new Date(nowMs).toISOString(), discovered: false });
  events.sort((a, b) => a.at.localeCompare(b.at) || a.sessionId.localeCompare(b.sessionId));
  return { events, next };
}

export { COMMAND_CLASSES };
