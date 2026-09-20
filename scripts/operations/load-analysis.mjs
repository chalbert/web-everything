/**
 * @file scripts/operations/load-analysis.mjs
 * @description PURE load analysis over telemetry `metric` events (epic #3383): does the host actually saturate
 * as concurrency rises, and which concurrency dimension predicts it? No fs, no clock, no env — events in, a
 * plain report object out, so the same JSONL gives byte-identical output (see `load-report-cli.mjs` for IO).
 *
 * Reads BOTH writers of `host.cpu.load1`: the independent sampler (`attributes.source = 'host-sampler'`, one
 * `attributes.sample` id per sample) and the legacy runner ticks (grouped by `resource.pid` + `attributes.tick`,
 * because a tick's metrics do NOT share a timestamp). A sample is one group that contains a `host.cpu.load1`.
 *
 * Three concurrency dimensions, each bucketed the same way (n, load1 median/p90/max, probe p90, share of samples
 * with load1 above 1x and 1.5x the core count):
 *   sessions  live agent sessions           `host.sessions.live`          (sampler only)
 *   heavy     vitest + playwright processes `host.family.count` n.vitest + n.playwright (sampler only)
 *   leased    leased lanes                  `lane.pool.leased`            (sampler: unexpired lease with a live
 *             process; legacy runner: the runner's own capacity-cap-note count, kept because it is the only lane
 *             signal the historical files hold). A sample lacking a dimension is excluded from THAT dimension
 *             and counted in `missing`.
 */

import { percentile } from './telemetry.mjs';

export const SAMPLER_SOURCE = 'host-sampler';

/** Lower bounds of each bucket; the last is open-ended. `[0,1,3,6,10]` → `0`, `1-2`, `3-5`, `6-9`, `10+`. */
export const BUCKET_EDGES = Object.freeze({
  sessions: Object.freeze([0, 1, 3, 6, 10]),
  heavy: Object.freeze([0, 1, 2, 3, 5]),
  leased: Object.freeze([0, 1, 3, 6, 9]),
});

/** Minimum data before a limit recommendation is trustworthy (stated in the recommendation method). */
export const MIN_HOURS = 48;
export const WORST_COUNT = 6;

/** @param {number} n @param {readonly number[]} edges @returns {string} */
export function bucketLabel(n, edges) {
  let i = 0;
  for (let k = 0; k < edges.length; k++) if (n >= edges[k]) i = k;
  const lo = edges[i];
  const hi = i + 1 < edges.length ? edges[i + 1] - 1 : null;
  if (hi === null) return `${lo}+`;
  return lo === hi ? `${lo}` : `${lo}-${hi}`;
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const sortedAsc = (list) => list.filter((x) => x != null).sort((a, b) => a - b);
const round = (v, d = 2) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d);

/** Group metric events into samples (one per group holding a `host.cpu.load1`). @param {object[]} events */
export function groupSamples(events) {
  const groups = new Map();
  for (const e of Array.isArray(events) ? events : []) {
    if (!e || e.event !== 'metric' || typeof e.name !== 'string') continue;
    const a = e.attributes || {};
    const key = a.sample != null ? `s|${a.sample}` : (a.tick != null ? `t|${e.resource?.pid ?? ''}|${a.tick}` : `ts|${e.timestamp}`);
    let g = groups.get(key);
    if (!g) { g = { key, source: a.source === SAMPLER_SOURCE ? SAMPLER_SOURCE : 'runner', metrics: [] }; groups.set(key, g); }
    g.metrics.push(e);
  }
  const samples = [];
  for (const g of groups.values()) {
    const by = (name) => g.metrics.filter((m) => m.name === name);
    const one = (name) => num(by(name)[0]?.value);
    const load1 = one('host.cpu.load1');
    if (load1 == null) continue;
    const times = g.metrics.map((m) => Date.parse(m.timestamp)).filter(Number.isFinite);
    const fam = by('host.family.cpu_pct')[0]?.attributes;
    const famN = by('host.family.count')[0]?.attributes;
    const sessionsLive = one('host.sessions.live');
    const heavy = famN ? (num(famN['n.vitest']) ?? 0) + (num(famN['n.playwright']) ?? 0) : null;
    let topFamilies = [];
    if (fam) {
      topFamilies = Object.entries(fam).filter(([k, v]) => k.startsWith('cpu.') && num(v) > 0).map(([k, v]) => ({ name: k.slice(4), cpuPct: v }));
    } else {
      topFamilies = by('host.process.conveyor.cpu_pct').concat(...['drain', 'dispatched_agents', 'vscode', 'chrome', 'other'].map((c) => by(`host.process.${c}.cpu_pct`)))
        .filter((m) => num(m.value) > 0).map((m) => ({ name: m.name.split('.')[2], cpuPct: m.value }));
    }
    topFamilies.sort((x, y) => y.cpuPct - x.cpuPct || x.name.localeCompare(y.name));
    const procs = by('host.process.entry.cpu_pct').map((m) => {
      const a2 = m.attributes || {};
      return {
        cpuPct: num(m.value) ?? 0, command: String(a2.command ?? '').slice(0, 160), family: a2.family ?? null, pid: a2.pid ?? null,
        memBytes: num(a2.mem_bytes), elapsedS: num(a2.elapsed_s), lane: a2.lane ?? 'unattributed',
        session: a2.session ?? 'unattributed', sessionId: a2.session_id ?? null,
      };
    }).sort((x, y) => y.cpuPct - x.cpuPct || (x.pid ?? 0) - (y.pid ?? 0));
    const topProcesses = procs.slice(0, 3).map((p) => ({ cpuPct: p.cpuPct, command: p.command.slice(0, 90), family: p.family, lane: p.lane, session: p.session }));
    const sum = (name) => by(name).reduce((s, m) => s + (num(m.value) ?? 0), 0);
    samples.push({
      key: g.key, source: g.source, atMs: times.length ? Math.min(...times) : null, load1, load5: one('host.cpu.load5'),
      cores: one('host.cpu.count'), spawnMs: one('host.probe.spawn_ms'), spinMs: one('host.probe.spin_overshoot_ms'),
      sessions: sessionsLive, heavy, leased: one('lane.pool.leased'),
      staleLeases: one('lane.pool.stale_leases'), heavyWaiting: one('heavy.admission.waiting'),
      topFamilies: topFamilies.slice(0, 3), topProcesses, procs,
      famCpu: fam ? Object.entries(fam).filter(([k, v]) => k.startsWith('cpu.') && num(v) != null).map(([k, v]) => ({ name: k.slice(4), cpuPct: v })) : [],
      famCount: famN ? Object.fromEntries(Object.entries(famN).filter(([k, v]) => k.startsWith('n.') && num(v) != null).map(([k, v]) => [k.slice(2), v])) : {},
      mode: by('host.cpu.load1')[0]?.attributes?.mode ?? null, intervalS: num(by('host.cpu.load1')[0]?.attributes?.interval_s),
      pressure: one('host.mem.pressure_level'), swapUsed: one('host.mem.swap_used_bytes'), available: one('host.mem.available_bytes'),
      diskFree: one('host.disk.free_bytes'), diskIo: one('host.disk.io_bytes_per_s'), thermLimit: one('host.cpu.thermal_limit_pct'),
      admitted: sum('dispatch.admitted'), denied: sum('dispatch.denied'),
    });
  }
  return samples.sort((a, b) => (a.atMs ?? 0) - (b.atMs ?? 0) || a.key.localeCompare(b.key));
}

function stats(samples, coresOf) {
  const load = sortedAsc(samples.map((s) => s.load1));
  const spawn = sortedAsc(samples.map((s) => s.spawnMs));
  const spin = sortedAsc(samples.map((s) => s.spinMs));
  const over = (mult) => samples.filter((s) => s.load1 > coresOf(s) * mult).length;
  const n = samples.length;
  return {
    n,
    load1: { median: round(percentile(load, 0.5)), p90: round(percentile(load, 0.9)), max: round(load.length ? load[load.length - 1] : null) },
    probe: { spawnP90: round(percentile(spawn, 0.9)), spinP90: round(percentile(spin, 0.9)), n: spawn.length },
    overCores: over(1), over1_5x: over(1.5),
    shareOverCores: n ? round(over(1) / n, 3) : null,
    shareOver1_5x: n ? round(over(1.5) / n, 3) : null,
  };
}

/**
 * The report. @param {object[]} events telemetry events
 * @param {{sinceMs?:number, cores?:number}} [opts] `cores` overrides the per-sample `host.cpu.count`
 */
export function analyzeLoad(events, { sinceMs = null, cores = null, otel = null } = {}) {
  const inWindow = (Array.isArray(events) ? events : []).filter((e) => sinceMs == null || !(Date.parse(e?.timestamp) < sinceMs));
  const samples = groupSamples(inWindow);
  const modal = (() => {
    const c = {}; for (const s of samples) if (s.cores) c[s.cores] = (c[s.cores] || 0) + 1;
    const top = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
    return top ? Number(top[0]) : null;
  })();
  const coresOf = (s) => cores ?? s.cores ?? modal ?? 1;

  const buckets = {};
  const missing = {};
  const maxObserved = {};
  for (const [dim, key] of [['sessions', 'sessions'], ['heavy', 'heavy'], ['leased', 'leased']]) {
    const edges = BUCKET_EDGES[dim];
    const have = samples.filter((s) => s[key] != null);
    missing[dim] = samples.length - have.length;
    maxObserved[dim] = have.length ? Math.max(...have.map((x) => x[key])) : null;
    buckets[dim] = edges.map((_, i) => {
      const label = bucketLabel(edges[i], edges);
      const inBucket = have.filter((s) => bucketLabel(s[key], edges) === label);
      return { bucket: label, ...stats(inBucket, coresOf) };
    }).filter((b) => b.n > 0);
  }

  const worst = [...samples].sort((a, b) => b.load1 - a.load1 || (a.atMs ?? 0) - (b.atMs ?? 0)).slice(0, WORST_COUNT).map((s) => ({
    at: s.atMs == null ? null : new Date(s.atMs).toISOString(), source: s.source, load1: round(s.load1), cores: coresOf(s),
    sessions: s.sessions, heavy: s.heavy, leased: s.leased, spawnMs: s.spawnMs, spinMs: s.spinMs,
    topFamilies: s.topFamilies, topProcesses: s.topProcesses,
  }));

  const dispatchEvents = inWindow.filter((e) => e?.event === 'metric' && (e.name === 'dispatch.admitted' || e.name === 'dispatch.denied'));
  const agg = (name) => {
    const ms = dispatchEvents.filter((e) => e.name === name);
    return { records: ms.length, sum: ms.reduce((s, e) => s + (num(e.value) ?? 0), 0), recordsNonZero: ms.filter((e) => e.value > 0).length };
  };
  const byReason = {};
  for (const e of dispatchEvents) if (e.name === 'dispatch.denied' && e.value > 0) { const r = e.attributes?.reason ?? 'unclassified'; byReason[r] = (byReason[r] || 0) + e.value; }

  const stamped = samples.filter((s) => s.atMs != null);
  const sampler = samples.filter((s) => s.source === SAMPLER_SOURCE);
  const samplerTimes = sampler.map((s) => s.atMs).filter((t) => t != null);
  const spanHours = samplerTimes.length > 1 ? (Math.max(...samplerTimes) - Math.min(...samplerTimes)) / 3_600_000 : 0;
  const busySamplerSamples = sampler.filter((s) => s.load1 > coresOf(s)).length;

  return {
    window: {
      from: stamped.length ? new Date(stamped[0].atMs).toISOString() : null,
      to: stamped.length ? new Date(stamped[stamped.length - 1].atMs).toISOString() : null,
      samples: samples.length, sampler: sampler.length, runner: samples.length - sampler.length,
    },
    cores: cores ?? modal,
    overall: stats(samples, coresOf),
    buckets, missing, maxObserved, worst,
    dispatch: { admitted: agg('dispatch.admitted'), denied: { ...agg('dispatch.denied'), byReason } },
    heavyAdmission: { waitingSamplesAboveZero: samples.filter((s) => (s.heavyWaiting ?? 0) > 0).length, samplesWithMetric: samples.filter((s) => s.heavyWaiting != null).length },
    otel: otel ? joinOtel(samples, otel.filter((r) => sinceMs == null || !(Date.parse(r?.receivedAt) < sinceMs)), inWindow) : null,
    coverage: {
      samplerSpanHours: round(spanHours, 1), samplerSamples: sampler.length, busySamplerSamples,
      minHours: MIN_HOURS,
      sufficient: spanHours >= MIN_HOURS && busySamplerSamples > 0,
    },
  };
}

// ── OTEL JOIN ───────────────────────────────────────────────────────────────────────────────────────────

const TOKEN_TYPES = ['input', 'output', 'cacheRead', 'cacheCreation'];

/**
 * PURE. JOIN Claude Code's own OTEL usage records (`claude-otel-collector.mjs`, one record per counter delta:
 * `{name, value, attributes:{'session.id', model, type}}`) to the sampler's per-process CPU by SESSION ID, so CPU sits
 * next to tokens, cost and active time per session, per model and per provider. Only `session.id`, `model` and
 * `type` are read from an OTEL record; identity attributes (user.email, account ids) are never copied out.
 *
 * CPU here is a LOWER BOUND: only the recorded top processes carry a `session_id`, and CPU-seconds are
 * `cpu% / 100 * sampleIntervalSeconds` summed over samples. Codex/other providers come from the runner's own
 * `dispatch.tokens.*` metrics (attribute `provider`).
 * @param {ReturnType<typeof groupSamples>} samples @param {object[]} otelRecords @param {object[]} [events]
 */
export function joinOtel(samples, otelRecords, events = []) {
  const sessions = new Map();
  const get = (id) => { let x = sessions.get(id); if (!x) { x = { sessionId: id, name: null, cpuCoreSeconds: 0, cpuSamples: 0, tokens: Object.fromEntries(TOKEN_TYPES.map((t) => [t, 0])), costUsd: 0, activeSeconds: 0, models: new Set() }; sessions.set(id, x); } return x; };
  for (const s of samples) for (const p of s.procs ?? []) {
    if (!p.sessionId) continue;
    const x = get(p.sessionId);
    x.name = x.name ?? p.session;
    x.cpuCoreSeconds += (p.cpuPct / 100) * (s.intervalS ?? 30);
    x.cpuSamples += 1;
  }
  const byModel = {};
  for (const r of Array.isArray(otelRecords) ? otelRecords : []) {
    const a = r?.attributes || {};
    const id = a['session.id'];
    const v = num(r?.value);
    if (!id || v == null) continue;
    const x = get(id);
    if (a.model) x.models.add(String(a.model));
    const m = a.model ? (byModel[a.model] ||= { model: String(a.model), tokens: Object.fromEntries(TOKEN_TYPES.map((t) => [t, 0])), costUsd: 0 }) : null;
    if (r.name === 'claude_code.token.usage' && TOKEN_TYPES.includes(a.type)) { x.tokens[a.type] += v; if (m) m.tokens[a.type] += v; }
    else if (r.name === 'claude_code.cost.usage') { x.costUsd += v; if (m) m.costUsd += v; }
    else if (r.name === 'claude_code.active_time.total') x.activeSeconds += v;
  }
  const total = (t) => TOKEN_TYPES.reduce((n, k) => n + t[k], 0);
  const rows = [...sessions.values()].map((x) => ({
    sessionId: x.sessionId, name: x.name, cpuCoreSeconds: round(x.cpuCoreSeconds, 1), cpuSamples: x.cpuSamples,
    tokens: x.tokens, tokenTotal: total(x.tokens), costUsd: round(x.costUsd, 4), activeSeconds: round(x.activeSeconds, 0), models: [...x.models].sort(),
  })).sort((a, b) => b.cpuCoreSeconds - a.cpuCoreSeconds || b.costUsd - a.costUsd || a.sessionId.localeCompare(b.sessionId));
  const codex = {};
  for (const e of Array.isArray(events) ? events : []) {
    if (e?.event !== 'metric' || !/^dispatch\.tokens\./.test(e.name ?? '')) continue;
    const provider = e.attributes?.provider ?? 'unknown';
    const c = (codex[provider] ||= { provider, input: 0, output: 0, cache_read: 0, cache_write: 0 });
    const k = e.name.slice('dispatch.tokens.'.length);
    if (k in c) c[k] += num(e.value) ?? 0;
  }
  const claudeTokens = rows.reduce((n, r) => n + r.tokenTotal, 0);
  return {
    sessions: rows,
    byModel: Object.values(byModel).sort((a, b) => b.costUsd - a.costUsd || a.model.localeCompare(b.model)).map((m) => ({ ...m, costUsd: round(m.costUsd, 4) })),
    byProvider: [{ provider: 'claude', tokens: claudeTokens, costUsd: round(rows.reduce((n, r) => n + r.costUsd, 0), 4), cpuCoreSeconds: round(rows.reduce((n, r) => n + r.cpuCoreSeconds, 0), 1) }, ...Object.values(codex).sort((a, b) => a.provider.localeCompare(b.provider))],
    joined: rows.filter((r) => r.cpuSamples > 0 && r.tokenTotal > 0).length,
    withCpuOnly: rows.filter((r) => r.cpuSamples > 0 && r.tokenTotal === 0).length,
    withTokensOnly: rows.filter((r) => r.cpuSamples === 0 && r.tokenTotal > 0).length,
  };
}

const pct = (v) => (v == null ? '-' : `${Math.round(v * 100)}%`);
const f = (v) => (v == null ? '-' : String(v));

/** Render a report as fixed-width text. @param {ReturnType<typeof analyzeLoad>} r */
export function renderReport(r) {
  const out = [];
  out.push(`Load report  ${r.window.from ?? '?'} → ${r.window.to ?? '?'}  ${r.window.samples} samples (${r.window.sampler} sampler, ${r.window.runner} runner ticks)  cores ${f(r.cores)}`);
  const o = r.overall;
  out.push(`  overall: load1 median ${f(o.load1.median)}  p90 ${f(o.load1.p90)}  max ${f(o.load1.max)}  > cores in ${o.overCores}/${o.n} (${pct(o.shareOverCores)})  > 1.5x cores in ${o.over1_5x}/${o.n} (${pct(o.shareOver1_5x)})`);
  for (const [dim, title] of [['sessions', 'live agent sessions'], ['heavy', 'heavy processes (vitest+playwright)'], ['leased', 'leased lanes']]) {
    out.push('', `By ${title}${r.missing[dim] ? `  (${r.missing[dim]} samples lack this metric)` : ''}`);
    if (!r.buckets[dim].length) { out.push('  (no data)'); continue; }
    out.push('  bucket      n   load1 med/p90/max      probe p90 spawn/spin ms   >cores   >1.5x');
    for (const b of r.buckets[dim]) {
      out.push(`  ${b.bucket.padEnd(8)} ${String(b.n).padStart(5)}   ${`${f(b.load1.median)}/${f(b.load1.p90)}/${f(b.load1.max)}`.padEnd(20)}   ${`${f(b.probe.spawnP90)}/${f(b.probe.spinP90)}`.padEnd(22)}   ${pct(b.shareOverCores).padStart(5)}   ${pct(b.shareOver1_5x).padStart(5)}`);
    }
  }
  out.push('', `Worst ${r.worst.length} samples`);
  for (const w of r.worst) {
    const fam = w.topFamilies.map((x) => `${x.name} ${Math.round(x.cpuPct)}%`).join(', ') || 'no family data';
    const procs = w.topProcesses.map((p) => `${Math.round(p.cpuPct)}% ${p.command}`).join(' | ');
    out.push(`  ${w.at}  load1 ${w.load1} (${w.cores} cores)  [${w.source}]  sessions ${f(w.sessions)} heavy ${f(w.heavy)} leased ${f(w.leased)}  top: ${fam}${procs ? `\n      ${procs}` : ''}`);
  }
  const d = r.dispatch;
  out.push('', `Dispatch: admitted ${d.admitted.records} records (sum ${d.admitted.sum}); denied ${d.denied.records} records (${d.denied.recordsNonZero} non-zero, sum ${d.denied.sum})${Object.keys(d.denied.byReason).length ? `  by reason ${JSON.stringify(d.denied.byReason)}` : ''}`);
  out.push(`Heavy admission waiting > 0 in ${r.heavyAdmission.waitingSamplesAboveZero}/${r.heavyAdmission.samplesWithMetric} samples`);
  if (r.otel) {
    const o2 = r.otel;
    out.push('', `CPU vs usage per session (OTEL join: ${o2.joined} joined, ${o2.withCpuOnly} CPU-only, ${o2.withTokensOnly} tokens-only; CPU is a lower bound from the recorded top processes)`);
    for (const x of o2.sessions.filter((y) => y.cpuSamples > 0).slice(0, 8)) out.push(`  ${String(x.name ?? x.sessionId.slice(0, 8)).padEnd(24)} cpu ${String(x.cpuCoreSeconds).padStart(9)} core-s   tokens ${String(x.tokenTotal).padStart(10)}   cost $${x.costUsd}   ${x.models.join(',') || '-'}`);
    for (const m of o2.byModel.slice(0, 5)) out.push(`  model ${m.model.padEnd(20)} tokens ${Object.values(m.tokens).reduce((n, v) => n + v, 0)}  cost $${m.costUsd}`);
    for (const p of o2.byProvider) out.push(`  provider ${p.provider}: ${p.tokens != null ? `${p.tokens} tokens, $${p.costUsd}, ${p.cpuCoreSeconds} core-s` : JSON.stringify(p)}`);
  }
  const c = r.coverage;
  out.push(`Coverage: ${c.samplerSamples} sampler samples over ${c.samplerSpanHours} h, ${c.busySamplerSamples} above cores — ${c.sufficient ? 'enough' : `NOT yet enough (need >= ${c.minHours} h including a busy window)`} to set limits from this`);
  return out.join('\n');
}
