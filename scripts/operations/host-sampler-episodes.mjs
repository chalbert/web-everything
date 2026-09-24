/**
 * @file scripts/operations/host-sampler-episodes.mjs
 * @description HEAVY-RUN EPISODES and the HARDWARE PROFILE (epic #3383, operator addition 2026-09-21: "the load each
 * lane adds to a heavy command, so we can determine an algorithm for how many lanes can run on a particular
 * hardware"). Sampling every 30 s says HOW LOADED the host was; it cannot say what ONE `check:standards` or `vitest`
 * run COST, how long it took, or how much slower it got with three others running beside it. This module records one
 * EPISODE per heavy command invocation, edge-triggered (a record when the run ENDS, carrying its whole life), so a
 * model of "wall time as a function of concurrency" can be fitted per family and transferred to other hardware by
 * ratio (the {@link parseHardwareProfile} record says what the hardware was).
 *
 * WHAT IS A RUN. A heavy ROOT is a process of a heavy class (`vitest`, `check-standards`, `verify-lane`, `playwright`)
 * with NO heavy ancestor at any depth; its process tree is the run. `verify-lane` therefore owns the `vitest` and
 * `check-standards` it spawns, and a `node (vitest)` under an `npm run test:unit` is ONE vitest run, not two.
 * Identity is `pid` + start time (`ps etime`, accurate to a second), so a reused pid is a new run.
 *
 * HOW LONG, HOW MUCH. Start is exact (`now - etime`). End is the midpoint between the last sample that saw the run
 * and the first that did not (`end_uncertainty_s` says how wide that is: half the interval, 15 s at the normal
 * cadence, 2.5 s in burst mode). CPU-seconds is the SUM over the tree's processes of their cumulative CPU time
 * (`ps time`) at the last sighting, so a child that started and exited between two samples is not in it: a
 * second, independent estimate integrates the tree's `%cpu` over the samples (`cpu_s_integral`). Runs shorter than
 * one interval can be missed entirely; the record says when a run had already started before it was first seen.
 *
 * PURE: every fact is injected. The IO edge (the two extra `ps` reads per sample WHILE a heavy run exists, and none
 * otherwise) lives in `host-sampler.mjs`.
 */
import { HEAVY_CLASSES, classifyCommandClass, refineWithRoster } from './host-sampler-classes.mjs';
import { MAX_HOPS, makeLaneResolver } from './host-sampler-attribution.mjs';

/** Two starts within this many ms are the same run (`etime` has 1 s resolution and the clock moves between samples). */
export const START_TOLERANCE_MS = 5000;

const r1 = (v) => Math.round(v * 10) / 10;
const r3 = (v) => Math.round(v * 1000) / 1000;
const baseName = (p) => String(p ?? '').replace(/^.*\//, '');

// ── parsers (BSD `ps`) ──────────────────────────────────────────────────────────────────────────────────

/** `[[dd-]hh:]mm:ss[.cc]` (BSD `ps time`, minutes may exceed 59) → seconds, or null. */
export function parseCpuTime(s) {
  const m = /^(?:(\d+)-)?(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)$/.exec(String(s ?? '').trim());
  if (!m) return null;
  return Number(m[1] || 0) * 86400 + Number(m[2] || 0) * 3600 + Number(m[3]) * 60 + Number(m[4]);
}

/** PURE. `ps -o pid=,time= -p a,b` output → `{pid: cpuSeconds}`. */
export function parsePsTimes(text) {
  const out = {};
  for (const line of String(text ?? '').split('\n')) {
    const m = /^\s*(\d+)\s+(\S+)\s*$/.exec(line);
    const t = m ? parseCpuTime(m[2]) : null;
    if (t != null) out[Number(m[1])] = t;
  }
  return out;
}

/**
 * PURE. `ps -M -o pid= -p a,b` output → `{pid: threadCount}`. `-M` prints ONE ROW PER THREAD with the default columns
 * (USER PID TT %CPU ... COMMAND) and the requested `pid` column appended LAST, so the last token of every row is the
 * owning pid and the header row (whose last token is a word) is skipped.
 */
export function parseThreadCounts(text) {
  const out = {};
  for (const line of String(text ?? '').split('\n')) {
    const last = line.trim().split(/\s+/).pop();
    if (/^\d+$/.test(last)) out[Number(last)] = (out[Number(last)] || 0) + 1;
  }
  return out;
}

// ── finding the runs ────────────────────────────────────────────────────────────────────────────────────

/**
 * PURE. The heavy runs present in one `ps` snapshot: each heavy root with its process tree, lane, session and holder.
 * @param {{rows:object[], lanes?:object[], cwds?:Record<number,string>, sessionByPid?:Map<number,object>|null,
 *   holders?:Map<number|string,object>, nowMs:number, redact?:(s:string)=>string}} o
 * @returns {Array<{rootPid:number, startMs:number, family:string, childFamilies:Record<string,number>, treePids:number[],
 *   cpuPct:number, rssBytes:number, procs:number, lane:string|null, session:{name:string|null,kind:string}|null,
 *   holder:object|null, command:string}>}
 */
export function findHeavyRuns({ rows, lanes = [], cwds = {}, sessionByPid = null, holders = new Map(), waiting = [], nowMs, redact = (s) => s }) {
  const byPid = new Map(rows.map((r) => [r.pid, r]));
  const cls = new Map(rows.map((r) => [r.pid, refineWithRoster(classifyCommandClass(r.command), r.pid, sessionByPid)]));
  const children = new Map();
  for (const r of rows) { if (!children.has(r.ppid)) children.set(r.ppid, []); children.get(r.ppid).push(r); }
  const isHeavy = (r) => HEAVY_CLASSES.includes(cls.get(r.pid));
  const heavyAncestor = (r) => {
    const seen = new Set([r.pid]);
    for (let cur = byPid.get(r.ppid), hop = 0; cur && !seen.has(cur.pid) && hop < MAX_HOPS; hop++) { if (isHeavy(cur)) return true; seen.add(cur.pid); cur = byPid.get(cur.ppid); }
    return false;
  };
  const { laneOf } = makeLaneResolver({ byPid, lanes, cwds, sessionByPid });
  const holderOf = (r) => {
    const seen = new Set();
    for (let cur = r, hop = 0; cur && !seen.has(cur.pid) && hop < MAX_HOPS; hop++) { seen.add(cur.pid); if (holders.has(cur.pid)) return holders.get(cur.pid); cur = byPid.get(cur.ppid); }
    return null;
  };
  const sessionOf = (r) => {
    const seen = new Set();
    for (let cur = r, hop = 0; cur && !seen.has(cur.pid) && hop < MAX_HOPS; hop++) {
      seen.add(cur.pid);
      const s = sessionByPid?.get(cur.pid);
      if (s) return { name: s.name ?? null, kind: s.kind };
      cur = byPid.get(cur.ppid);
    }
    return null;
  };
  // A process waiting in the admission queue, keyed by pid → its marker (`heavy-admission.mjs#markWaiting`).
  const waiterByPid = new Map((Array.isArray(waiting) ? waiting : []).filter((w) => Number.isInteger(w?.pid)).map((w) => [w.pid, w]));
  const waiterOf = (r) => {
    const seen = new Set();
    for (let cur = r, hop = 0; cur && !seen.has(cur.pid) && hop < MAX_HOPS; hop++) { seen.add(cur.pid); if (waiterByPid.has(cur.pid)) return waiterByPid.get(cur.pid); cur = byPid.get(cur.ppid); }
    return null;
  };
  // Lane fallback when the process tree itself gives none (#3383 capacity audit 2026-09-23: 26-66% of runs were
  // `unattributed` while their slot holder named the lane): the lane path the admission queue recorded as the owner.
  const laneOfOwner = (owner) => {
    const p = String(owner ?? '').replace(/#\d+$/, '');
    return p ? lanes.find((l) => p === l.path || p.startsWith(`${l.path}/`)) ?? null : null;
  };
  const runs = [];
  for (const root of rows) {
    if (!isHeavy(root) || heavyAncestor(root)) continue;
    const tree = []; const seen = new Set(); const stack = [root];
    while (stack.length) { const r = stack.pop(); if (seen.has(r.pid)) continue; seen.add(r.pid); tree.push(r); for (const c of children.get(r.pid) ?? []) stack.push(c); }
    const childFamilies = {};
    for (const r of tree) { const c = cls.get(r.pid); if (HEAVY_CLASSES.includes(c)) childFamilies[c] = (childFamilies[c] || 0) + 1; }
    const holder = holderOf(root) ?? tree.map((r) => holders.get(r.pid)).find(Boolean) ?? null;
    const waiter = waiterOf(root) ?? tree.map((r) => waiterByPid.get(r.pid)).find(Boolean) ?? null;
    const own = laneOf(root);
    const fallback = own ? null : laneOfOwner(holder?.owner) ?? laneOfOwner(waiter?.owner);
    const lane = own ? own.lane : fallback;
    runs.push({
      rootPid: root.pid, startMs: nowMs - (Number.isFinite(root.etimeS) ? root.etimeS * 1000 : 0), family: cls.get(root.pid), childFamilies,
      treePids: tree.map((r) => r.pid).sort((a, b) => a - b), cpuPct: r1(tree.reduce((t, r) => t + (r.pcpu || 0), 0)), rssBytes: tree.reduce((t, r) => t + (r.rssKb || 0) * 1024, 0), procs: tree.length,
      // the slot's pid may sit ABOVE the root (a `heavy-admission.mjs run` wrapper) or INSIDE its tree (a shell that runs `verify-lane.mjs`, which holds its own slot)
      lane: lane ? `${lane.pool}/${lane.lane}` : null, laneSource: own ? own.source : (fallback ? 'admission-owner' : null),
      session: sessionOf(root), holder, waiting: waiter != null, command: redact(String(root.command)).slice(0, 120),
    });
  }
  return runs.sort((a, b) => a.rootPid - b.rootPid);
}

// ── the edge-triggered state machine ────────────────────────────────────────────────────────────────────

/**
 * PURE. Advance the in-flight run table by one sample and return the runs that ENDED since the previous one.
 * `prev` is the persisted table `{[id]: state}` (`undefined` on the very first sample: nothing to compare with, every
 * run present is recorded as already in flight). A run absent now but present before has ENDED.
 * @param {{prev:Record<string,object>|undefined, runs:ReturnType<typeof findHeavyRuns>, probe?:{cpu?:Record<number,number>, threads?:Record<number,number>},
 *   ctx:{activeLanes:number|null, workersLive:number|null, busyPct:number|null, idlePct:number|null},
 *   waiters?:Record<string,number>, nowMs:number, intervalS:number}} o
 * @returns {{next:Record<string,object>, finished:object[]}}
 */
export function stepEpisodes({ prev, runs, probe = {}, ctx, waiters = {}, nowMs, intervalS }) {
  const before = prev ?? {};
  const next = {}; const finished = [];
  const matched = new Set();
  for (const run of runs) {
    const id = Object.keys(before).find((k) => before[k].rootPid === run.rootPid && Math.abs(before[k].startMs - run.startMs) <= START_TOLERANCE_MS);
    const st = id ? before[id] : null;
    if (id) matched.add(id);
    const others = runs.length - 1;
    const dt = st ? Math.max(0, (nowMs - st.lastSeenMs) / 1000) : 0;
    const cpuByPid = { ...(st?.cpuByPid ?? {}) };
    for (const pid of run.treePids) { const t = probe.cpu?.[pid]; if (Number.isFinite(t)) cpuByPid[pid] = Math.max(cpuByPid[pid] ?? 0, t); }
    const threads = run.treePids.reduce((t, pid) => t + (probe.threads?.[pid] ?? 0), 0);
    // An UNSLOTTED holder (a `heavy-admission.mjs run` wrapper that failed open) is not an admission.
    const slotted = run.holder && !run.holder.unslotted ? run.holder : null;
    // Prefer the wait the holder recorded at acquire; fall back to the older inference from waiting markers seen
    // in an earlier sample (only works for waits longer than one interval, and for slots won by an older writer).
    const acquiredMs = slotted && Number.isFinite(slotted.heldForS) ? nowMs - slotted.heldForS * 1000 : null;
    const waitedFrom = slotted?.pid != null ? waiters[String(slotted.pid)] : undefined;
    const inferredWaitS = acquiredMs != null && Number.isFinite(waitedFrom) ? Math.max(0, r1((acquiredMs - waitedFrom) / 1000)) : null;
    const waitNow = Number.isFinite(slotted?.waitS) ? slotted.waitS : inferredWaitS;
    const admState = slotted ? 'held' : run.holder?.unslotted ? 'unslotted' : run.waiting ? 'waiting' : 'none';
    const s = st ?? {
      id: `hr-${run.rootPid}-${Math.round(run.startMs / 1000)}`, rootPid: run.rootPid, startMs: run.startMs, firstSeenMs: nowMs, family: run.family, command: run.command,
      lane: run.lane, laneSource: run.laneSource ?? null, session: run.session, admitted: false, holder: null, waitS: null,
      admSamples: { held: 0, waiting: 0, unslotted: 0, none: 0 },
      atStart: { others, activeLanes: ctx.activeLanes, workers: ctx.workersLive, busyPct: ctx.busyPct, idlePct: ctx.idlePct },
      peakOthers: 0, peakActiveLanes: 0, peakWorkers: 0, peakBusy: 0, peakRss: 0, peakProcs: 0, peakThreads: 0, peakCpuPct: 0, cpuIntegralS: 0, concIntegral: 0, concDt: 0, samples: 0,
    };
    const admSamples = { held: 0, waiting: 0, unslotted: 0, none: 0, ...(s.admSamples ?? {}) };
    admSamples[admState] += 1;
    next[s.id] = {
      ...s, lastSeenMs: nowMs, family: s.family, cpuByPid, childFamilies: run.childFamilies,
      admitted: s.admitted || !!slotted, holder: s.holder ?? slotted?.id ?? run.holder?.id ?? null,
      waitS: s.waitS ?? waitNow, admSamples,
      lane: s.lane ?? run.lane, laneSource: s.lane ? (s.laneSource ?? null) : (run.laneSource ?? null), session: s.session ?? run.session,
      peakOthers: Math.max(s.peakOthers, others), peakActiveLanes: Math.max(s.peakActiveLanes, ctx.activeLanes ?? 0), peakWorkers: Math.max(s.peakWorkers, ctx.workersLive ?? 0), peakBusy: Math.max(s.peakBusy, ctx.busyPct ?? 0),
      peakRss: Math.max(s.peakRss, run.rssBytes), peakProcs: Math.max(s.peakProcs, run.procs), peakThreads: Math.max(s.peakThreads, threads), peakCpuPct: Math.max(s.peakCpuPct, run.cpuPct),
      cpuIntegralS: s.cpuIntegralS + (run.cpuPct / 100) * dt, concIntegral: s.concIntegral + (others + 1) * dt, concDt: s.concDt + dt, samples: s.samples + 1,
    };
  }
  for (const [id, st] of Object.entries(before)) {
    if (matched.has(id)) continue;
    finished.push(episodeRecord(st, { endedBetween: [st.lastSeenMs, nowMs], intervalS }));
  }
  return { next, finished };
}

/**
 * PURE. The flat episode record (every value a scalar or short string, so it fits one telemetry line) for a run
 * that ended between `lastSeenMs` and the sample that noticed. See the file header for how each number is measured.
 * @param {object} st the run's persisted state
 * @param {{endedBetween:[number,number], intervalS:number, calibration?:boolean}} o
 */
export function episodeRecord(st, { endedBetween, intervalS, calibration = false }) {
  const [lo, hi] = endedBetween;
  const endMs = Math.round((lo + hi) / 2);
  const wallS = Math.max(0, r1((endMs - st.startMs) / 1000));
  const cpuSum = Object.values(st.cpuByPid ?? {}).reduce((t, v) => t + v, 0);
  // Two estimates, both under-counting (see the file header): the sum of cumulative CPU of the processes alive at the last
  // sighting misses children that already exited; the %cpu integral misses what happened between samples. The larger is closer.
  const cpuS = r1(Math.max(cpuSum, st.cpuIntegralS ?? 0));
  return {
    id: st.id, calibration, family: st.family ?? null,
    child_families: Object.entries(st.childFamilies ?? {}).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}:${v}`).join(','),
    lane: st.lane ?? 'unattributed', session: st.session?.name ?? null, worker_kind: st.session?.kind ?? null, root_pid: st.rootPid ?? null, root_command: st.command ?? null,
    start: new Date(st.startMs).toISOString(), end: new Date(endMs).toISOString(), wall_s: wallS, end_uncertainty_s: r1(Math.max(0, hi - lo) / 2000),
    started_before_first_seen: st.firstSeenMs - st.startMs > 1.5 * intervalS * 1000,
    cpu_s: cpuS, cpu_s_cumulative: r1(cpuSum), cpu_s_integral: r1(st.cpuIntegralS ?? 0), avg_cores: wallS > 0 ? r3(cpuS / wallS) : null, peak_cpu_pct: r1(st.peakCpuPct ?? 0),
    peak_rss_bytes: st.peakRss ?? 0, peak_procs: st.peakProcs ?? 0, peak_threads: st.peakThreads || null,
    admitted: !!st.admitted, admission_holder: st.holder ?? null, admission_wait_s: st.waitS ?? null,
    admission_class: admissionClass(st), admission_samples: admissionSamplesText(st.admSamples), lane_source: st.laneSource ?? null,
    conc_start: (st.atStart?.others ?? 0) + 1, conc_peak: (st.peakOthers ?? 0) + 1, conc_mean: st.concDt > 0 ? r3(st.concIntegral / st.concDt) : (st.atStart?.others ?? 0) + 1,
    active_lanes_start: st.atStart?.activeLanes ?? null, active_lanes_peak: st.peakActiveLanes ?? 0, workers_start: st.atStart?.workers ?? null, workers_peak: st.peakWorkers ?? 0,
    busy_pct_start: st.atStart?.busyPct ?? null, idle_pct_start: st.atStart?.idlePct ?? null, busy_pct_peak: st.peakBusy || null, samples: st.samples ?? 0,
  };
}

/** A heavy-named run whose tree never used more than this much CPU and spawned no other heavy family did no heavy work. */
export const LIGHT_RUN_PEAK_CPU_PCT = 20;

/** The admission classes of an episode, in the order {@link admissionClass} tests them. */
export const ADMISSION_CLASSES = Object.freeze(['admitted', 'unslotted', 'waiting', 'light', 'bypass']);

/**
 * PURE. Why a run was, or was not, under the admission queue (#3383 capacity audit 2026-09-23: about half the
 * episodes read `admitted: false` and nothing said why). `admitted`: a held slot sat above or inside its tree in some
 * sample. `unslotted`: only an admission wrapper that failed open. `waiting`: every sample saw it queued, never
 * running. `light`: heavy by name only (a `verify-lane.mjs check` poll, an idle shell): peak CPU under
 * {@link LIGHT_RUN_PEAK_CPU_PCT} and no other heavy family in its tree. `bypass`: real heavy work with no slot.
 * @param {object} st the run's persisted state
 * @returns {typeof ADMISSION_CLASSES[number]}
 */
export function admissionClass(st) {
  const a = st?.admSamples ?? {};
  if (st?.admitted) return 'admitted';
  if ((a.unslotted ?? 0) > 0) return 'unslotted';
  if ((a.waiting ?? 0) > 0 && (a.none ?? 0) === 0) return 'waiting';
  const otherFamilies = Object.keys(st?.childFamilies ?? {}).filter((f) => f !== st?.family).length;
  if ((st?.peakCpuPct ?? 0) < LIGHT_RUN_PEAK_CPU_PCT && otherFamilies === 0) return 'light';
  return 'bypass';
}

const admissionSamplesText = (a) => ['held', 'waiting', 'unslotted', 'none'].map((k) => `${k}:${a?.[k] ?? 0}`).join(',');

/** The fields of the episode record, in order (documentation and a test pin them). @test-only-export-ok: the documented field list; the test pins every record against it */
export const EPISODE_FIELDS = Object.freeze(Object.keys(episodeRecord({ id: 'x', startMs: 0, firstSeenMs: 0, lastSeenMs: 0, cpuByPid: {}, atStart: {}, peakOthers: 0, peakCpuPct: 0, peakRss: 0, peakProcs: 0, peakThreads: 0, cpuIntegralS: 0, concIntegral: 0, concDt: 0, samples: 0 }, { endedBetween: [0, 0], intervalS: 30 })));

/** PURE. The waiting markers as `{pid: requestedAtMs}`, carried between samples so a run's admission wait can be computed when it starts. */
export function nextWaiters(prev, admission, nowMs) {
  const out = {};
  for (const w of admission?.waiting ?? []) {
    const t = Date.parse(w.requestedAt);
    if (Number.isInteger(w.pid) && Number.isFinite(t)) out[String(w.pid)] = t;
  }
  // a waiter that just got its slot leaves the waiting list in the same instant its run appears: keep the previous
  // sample's markers for ONE more sample so `stepEpisodes` can still read them, then drop anything older than a day
  for (const [pid, t] of Object.entries(prev ?? {})) if (!(pid in out) && nowMs - t < 86_400_000) out[pid] = t;
  return out;
}

// ── HARDWARE PROFILE ────────────────────────────────────────────────────────────────────────────────────

/** The sysctl keys the profile reads (all read-only; a missing key, e.g. `hw.perflevel*` on Intel, is skipped). */
export const HARDWARE_KEYS = Object.freeze([
  'hw.ncpu', 'hw.physicalcpu', 'hw.logicalcpu', 'hw.perflevel0.physicalcpu', 'hw.perflevel1.physicalcpu', 'hw.memsize', 'hw.model',
  'machdep.cpu.brand_string', 'kern.osproductversion', 'kern.osversion',
]);

/**
 * PURE. `sysctl <keys>` output (`key: value` lines) → the hardware profile a fitted model needs to be transferred to
 * other hardware by ratio. Performance/efficiency split is null where the OS has no `hw.perflevel*` (Intel).
 * @param {string} text
 */
export function parseHardwareProfile(text) {
  const kv = {};
  for (const line of String(text ?? '').split('\n')) {
    const m = /^([a-zA-Z0-9_.]+):\s*(.*?)\s*$/.exec(line);
    if (m) kv[m[1]] = m[2];
  }
  const int = (k) => (Number.isFinite(Number(kv[k])) && kv[k] !== undefined && kv[k] !== '' ? Number(kv[k]) : null);
  const memBytes = int('hw.memsize');
  const p = int('hw.perflevel0.physicalcpu'); const e = int('hw.perflevel1.physicalcpu');
  if (int('hw.ncpu') == null && memBytes == null && !kv['machdep.cpu.brand_string']) return null;
  return {
    ncpu: int('hw.ncpu'), physicalCpu: int('hw.physicalcpu'), logicalCpu: int('hw.logicalcpu'),
    performanceCores: p, efficiencyCores: e, memBytes, memGiB: memBytes == null ? null : Math.round((memBytes / 1024 ** 3) * 10) / 10,
    chip: kv['machdep.cpu.brand_string'] ?? null, model: kv['hw.model'] ?? null, osVersion: kv['kern.osproductversion'] ?? null, osBuild: kv['kern.osversion'] ?? null,
    architecture: p != null || /^Apple /.test(kv['machdep.cpu.brand_string'] ?? '') ? 'apple-silicon' : (kv['machdep.cpu.brand_string'] ? 'intel' : null),
  };
}

/** The hardware profile is re-recorded once a day. */
export const HARDWARE_PROFILE_EVERY_MS = 24 * 3_600_000;

/** PURE. Is a profile record due? Once per sampler process start, and once a day after. */
export function hardwareProfileDue({ emittedThisProcess, lastAtMs, nowMs }) {
  return !emittedThisProcess || !Number.isFinite(lastAtMs) || nowMs - lastAtMs >= HARDWARE_PROFILE_EVERY_MS;
}

export { baseName };
