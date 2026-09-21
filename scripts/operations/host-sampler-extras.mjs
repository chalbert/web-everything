/**
 * @file scripts/operations/host-sampler-extras.mjs
 * @description Generous-collection half of the host sampler (epic #3383, operator amendment 2026-09-20): the
 * wide `ps` parse (ppid + elapsed), process ATTRIBUTION (to a `claude agents` session by ancestry, to a lane by
 * cwd), and memory / swap / compressor / disk / thermal parsers. PURE except {@link readExtras} and
 * {@link readCwds}, the IO edge (each collector is a sub-10 ms spawn, measured; see the result file).
 *
 * ATTRIBUTION NEVER GUESSES. A process maps to a session only if walking its parent chain reaches a live agent
 * pid; it maps to a lane only if its cwd (lsof) is inside a lane, else its argv names a lane path, else its
 * session's cwd is inside a lane. Anything else is the literal bucket `unattributed`.
 */
import { execFileSync } from 'node:child_process';

export const UNATTRIBUTED = 'unattributed';
export const TOP_PROCESSES = 30;
export const BURST_TOP_PROCESSES = 15;
export const TOP_MIN_CPU_PCT = 0.5;
export const TOP_MIN_RSS_BYTES = 400 * 1024 * 1024;
export const MAX_ANCESTRY_HOPS = 40;

/** `[[dd-]hh:]mm:ss` (BSD `ps etime`) → seconds, or null. */
export function parseEtime(s) {
  const m = /^(?:(\d+)-)?(?:(\d+):)?(\d+):(\d+)$/.exec(String(s ?? ''));
  if (!m) return null;
  return (Number(m[1] || 0) * 86400) + (Number(m[2] || 0) * 3600) + (Number(m[3]) * 60) + Number(m[4]);
}

/**
 * PURE. Parse `ps -Awwo pid=,ppid=,pcpu=,rss=,etime=,command=` into rows. A line that does not match is skipped,
 * exactly like `host-process-sample.mjs#parsePsOutput`, whose row shape this extends (`ppid`, `etimeS`).
 */
export function parsePsWide(text) {
  const rows = [];
  for (const raw of String(text ?? '').split('\n')) {
    const m = /^\s*(\d+)\s+(\d+)\s+([\d.]+)\s+(\d+)\s+(\S+)\s+(\S.*)$/.exec(raw);
    if (!m) continue;
    rows.push({ pid: Number(m[1]), ppid: Number(m[2]), pcpu: Number(m[3]), rssKb: Number(m[4]), etimeS: parseEtime(m[5]), command: m[6] });
  }
  return rows;
}

/** Path helpers shared with lane attribution. */
const inside = (p, root) => typeof p === 'string' && (p === root || p.startsWith(`${root}/`));
const mentions = (cmd, root) => cmd.includes(`${root}/`) || cmd.includes(`${root} `) || cmd.endsWith(root);

/** PURE. The processes worth recording: at least {@link TOP_MIN_CPU_PCT} CPU or {@link TOP_MIN_RSS_BYTES} RSS,
 *  top `n` by CPU (ties by RSS, then pid). Exported so the IO edge resolves cwds for exactly these pids. */
export function pickTop(rows, n = TOP_PROCESSES) {
  return rows
    .filter((r) => r.pcpu >= TOP_MIN_CPU_PCT || r.rssKb * 1024 >= TOP_MIN_RSS_BYTES)
    .sort((a, b) => b.pcpu - a.pcpu || b.rssKb - a.rssKb || a.pid - b.pid)
    .slice(0, n);
}

/**
 * PURE. Attribute the top processes (see {@link pickTop}).
 * @param {{rows:object[], agents:Array<{pid?:number,name?:string,sessionId?:string,cwd?:string}>,
 *   lanes:Array<{pool:string,lane:string,path:string}>, cwds?:Record<number,string>, n?:number,
 *   familyOf:(cmd:string)=>string, redact:(cmd:string)=>string}} o
 * @returns {Array<object>} `{pid, ppid, family, command, cpuPct, memBytes, elapsedS, session, sessionId, lane, laneSource}`
 */
export function selectAndAttribute({ rows, agents = [], lanes = [], cwds = {}, n = TOP_PROCESSES, familyOf, redact }) {
  const byPid = new Map(rows.map((r) => [r.pid, r]));
  const agentByPid = new Map(agents.filter((a) => Number.isInteger(a.pid)).map((a) => [a.pid, a]));
  const laneOfPath = (p) => lanes.find((l) => inside(p, l.path)) || null;
  return pickTop(rows, n).map((r) => {
    // ancestry: self, then parents, until a live agent pid (cycle- and depth-guarded)
    let agent = null;
    const seen = new Set();
    for (let cur = r, hops = 0; cur && !seen.has(cur.pid) && hops < MAX_ANCESTRY_HOPS; hops++) {
      seen.add(cur.pid);
      if (agentByPid.has(cur.pid)) { agent = agentByPid.get(cur.pid); break; }
      cur = byPid.get(cur.ppid);
    }
    let lane = laneOfPath(cwds[r.pid]);
    let laneSource = lane ? 'cwd' : null;
    if (!lane) { lane = lanes.find((l) => mentions(r.command, l.path)) || null; if (lane) laneSource = 'argv'; }
    if (!lane && agent) { lane = laneOfPath(agent.cwd); if (lane) laneSource = 'session-cwd'; }
    return {
      pid: r.pid, ppid: r.ppid ?? null, family: familyOf(r.command), command: redact(r.command).slice(0, 160),
      cpuPct: r.pcpu, memBytes: r.rssKb * 1024, elapsedS: r.etimeS ?? null,
      session: agent ? (agent.name ?? UNATTRIBUTED) : UNATTRIBUTED, sessionId: agent?.sessionId ?? null,
      lane: lane ? `${lane.pool}/${lane.lane}` : UNATTRIBUTED, laneSource,
    };
  });
}

/** PURE. `lsof -a -d cwd -Fpn` output → `{pid: cwd}`. */
export function parseLsofCwd(text) {
  const out = {};
  let pid = null;
  for (const line of String(text ?? '').split('\n')) {
    if (line.startsWith('p')) pid = Number(line.slice(1));
    else if (line.startsWith('n') && Number.isInteger(pid)) out[pid] = line.slice(1);
  }
  return out;
}

// ── MEMORY / SWAP / COMPRESSOR ──────────────────────────────────────────────────────────────────────────

/** PURE. macOS `vm_stat` → bytes per state plus the cumulative paging counters. */
export function parseVmStat(text) {
  const t = String(text ?? '');
  const size = Number(/page size of (\d+) bytes/.exec(t)?.[1] ?? 16384);
  const pages = (label) => Number(new RegExp(`^${label}:\\s+(\\d+)\\.`, 'm').exec(t)?.[1] ?? 0);
  const free = pages('Pages free'); const inactive = pages('Pages inactive'); const spec = pages('Pages speculative'); const purge = pages('Pages purgeable');
  return {
    pageSize: size,
    freeBytes: free * size, activeBytes: pages('Pages active') * size, inactiveBytes: inactive * size, wiredBytes: pages('Pages wired down') * size,
    compressedBytes: pages('Pages occupied by compressor') * size,
    availableBytes: (free + inactive + spec + purge) * size,
    pageins: pages('Pageins'), pageouts: pages('Pageouts'), swapins: pages('Swapins'), swapouts: pages('Swapouts'),
  };
}

/** PURE. `sysctl -n vm.swapusage kern.memorystatus_vm_pressure_level` output (two lines). */
export function parseSwapAndPressure(text) {
  const [swap = '', level = ''] = String(text ?? '').split('\n');
  const toBytes = (v, u) => Number(v) * ({ K: 1024, M: 1024 ** 2, G: 1024 ** 3 }[u] ?? 1);
  const used = /used = ([\d.]+)([KMG])/.exec(swap);
  const total = /total = ([\d.]+)([KMG])/.exec(swap);
  return { swapUsedBytes: used ? toBytes(used[1], used[2]) : 0, swapTotalBytes: total ? toBytes(total[1], total[2]) : 0, pressureLevel: Number(level.trim()) || 1 };
}

/** PURE. `iostat -Id` last line: cumulative `KB/t xfrs MB` for the first disk. */
export function parseIostat(text) {
  const last = String(text ?? '').trim().split('\n').pop() ?? '';
  const n = last.trim().split(/\s+/).map(Number);
  return n.length >= 3 && n.slice(0, 3).every(Number.isFinite) ? { xfrs: n[1], megabytes: n[2] } : null;
}

/** PURE. Rate between two cumulative iostat readings (never negative — a counter reset yields null). */
export function diskRate(prev, cur, dtSeconds) {
  if (!prev || !cur || !(dtSeconds > 0)) return null;
  const dMb = cur.megabytes - prev.megabytes; const dX = cur.xfrs - prev.xfrs;
  if (dMb < 0 || dX < 0) return null;
  return { bytesPerS: Math.round((dMb * 1024 * 1024) / dtSeconds), xfrsPerS: Math.round((dX / dtSeconds) * 10) / 10 };
}

/** PURE. `pmset -g therm` → CPU speed limit percent (100 when nothing is recorded) and whether a warning exists. */
export function parseTherm(text) {
  const t = String(text ?? '');
  const limit = /CPU_Speed_Limit\s*=\s*(\d+)/.exec(t);
  const sched = /Scheduler_Limit\s*=\s*(\d+)/.exec(t);
  const warned = /warning level/i.test(t) && !/No thermal warning level has been recorded/i.test(t);
  return { cpuSpeedLimitPct: limit ? Number(limit[1]) : 100, schedulerLimitPct: sched ? Number(sched[1]) : 100, warned };
}

/** PURE. `df -k /` → free bytes on the volume. */
export function parseDf(text) {
  const line = String(text ?? '').trim().split('\n').pop() ?? '';
  const cols = line.trim().split(/\s+/);
  const availKb = Number(cols[3]);
  return Number.isFinite(availKb) ? { freeBytes: availKb * 1024, usedPct: Number.parseInt(cols[4], 10) || null } : null;
}

// ── IO EDGE ─────────────────────────────────────────────────────────────────────────────────────────────

// A non-zero exit that still printed output is a SUCCESS for our purposes: `lsof -p a,b,c` exits 1 when ANY pid has
// vanished since `ps`, yet prints every other pid's cwd. Discarding that output (the original `catch { return '' }`)
// left the cwd cache empty on a busy host, so lane attribution read `unattributed` for nearly every process.
const run = (exec, cmd, args) => {
  try { return exec(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000, maxBuffer: 4 * 1024 * 1024 }); } catch (e) { return typeof e?.stdout === 'string' ? e.stdout : ''; }
};

/** Resolve cwds for `pids` with ONE `lsof`. Returns `{}` on any failure (attribution then falls to argv/session). */
export function readCwds(pids, { exec = execFileSync } = {}) {
  if (!pids.length) return {};
  return parseLsofCwd(run(exec, 'lsof', ['-a', '-d', 'cwd', '-Fpn', '-p', pids.join(',')]));
}

/**
 * Read every non-`ps` collector. `slow` (df, pmset) is refreshed only when the caller says so (cached between);
 * `iostat` needs the previous cumulative reading, which the caller keeps in its state file.
 * @returns {{mem:object|null, swap:object|null, io:object|null, therm:object|null, disk:object|null}}
 */
export function readExtras({ exec = execFileSync, slow = true } = {}) {
  const vm = run(exec, 'vm_stat', []);
  return {
    mem: vm ? parseVmStat(vm) : null,
    swap: parseSwapAndPressure(run(exec, 'sysctl', ['-n', 'vm.swapusage', 'kern.memorystatus_vm_pressure_level'])),
    io: parseIostat(run(exec, 'iostat', ['-Id'])),
    therm: slow ? parseTherm(run(exec, 'pmset', ['-g', 'therm'])) : null,
    disk: slow ? parseDf(run(exec, 'df', ['-k', '/'])) : null,
  };
}
