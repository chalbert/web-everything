import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  AGENT_LOAD_FAMILIES, FAMILIES, HEAVY_FAMILIES, SOURCE, acquireLock, buildSample, classifyFamily, measureSpawn, reconcileLanes,
  runOnce, sampleToMetrics, spinOvershoot, summarizeFamilies, summarizeSessions,
} from '../host-sampler.mjs';
import { parsePsOutput } from '../host-process-sample.mjs';
import { METRIC_NAMES, METRIC_UNITS, goldenSignals, parseTelemetryLines, validateTelemetryEvent } from '../telemetry.mjs';
import { createFileTelemetryStore } from '../telemetry-store.mjs';

const NOW = Date.parse('2026-09-20T16:00:00.000Z');
const AT = new Date(NOW).toISOString();

describe('classifyFamily — the closed family table', () => {
  const table = [
    // dev servers: the operator's own, never agent load
    ['node /w/lane-3/node_modules/.bin/eleventy --serve --port=8080 --quiet', 'dev-server'],
    ['npm exec @11ty/eleventy --serve --port=8080 --quiet', 'dev-server'],
    ['node /w/app/node_modules/.bin/vite --port 5173', 'dev-server'],
    ['node /w/app/node_modules/.bin/vite build', 'node-other'],
    ['npm start', 'dev-server'],
    ['npm run dev', 'dev-server'],
    // vitest vs node-other
    ['node (vitest)', 'vitest'],
    ['node (vitest 3)', 'vitest'],
    ['npm exec vitest run scripts', 'vitest'],
    ['node /w/node_modules/vitest/dist/workers/forks.js', 'vitest'],
    ['node /w/scripts/backlog.mjs build-queue --json', 'node-other'],
    ['node tests/interaction/serve.mjs', 'node-other'],
    ['grep vitest /tmp/log', 'other'],
    // claude: print vs session vs the idle pool
    ['/home/u/.nvm/v22/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe -p do-the-thing --output-format json', 'claude-print'],
    ['claude --print hello', 'claude-print'],
    ['claude', 'claude-session'],
    ['claude --resume abc123', 'claude-session'],
    ['claude bg-spare --bg-spare /tmp/cc-daemon-501/x/spare/a.claim.sock', 'claude-infra'],
    ['claude bg-pty-host --bg-pty-host /tmp/cc-daemon-501/x/spare/a.pty.sock 200 50 -- /x/claude.exe --bg-spare /tmp/a', 'claude-infra'],
    ['/x/@anthropic-ai/claude-code/bin/claude.exe daemon run --origin transient', 'claude-infra'],
    ['/Applications/Claude.app/Contents/Frameworks/Claude Helper.app/Contents/MacOS/Claude Helper --type=utility', 'other'],
    // codex
    ['codex exec -C /w/lane-1 do it', 'codex'],
    ['node scripts/codex-direct-task.mjs --task-file=/tmp/t.md', 'codex'],
    // browsers
    ['playwright test --project=chromium', 'playwright'],
    ['node /w/node_modules/playwright/cli.js test', 'playwright'],
    ['/Users/u/Library/Caches/ms-playwright/chromium-1200/chrome-mac/Chromium.app/Contents/MacOS/Chromium --headless', 'playwright'],
    ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome --type=renderer', 'chrome'],
    ['/Applications/Google Chrome.app/Contents/Frameworks/Google Chrome Helper (Renderer).app/Contents/MacOS/Google Chrome Helper (Renderer) --type=renderer', 'chrome'],
    ['/Applications/Visual Studio Code.app/Contents/Frameworks/Electron Framework.framework/Helpers/chrome_crashpad_handler --no-rate-limit', 'other'],
    // git / npm / other
    ['git status --porcelain', 'git'],
    ['/Library/Developer/CommandLineTools/usr/bin/git log -1 --format=%H', 'git'],
    ['git-remote-https origin https://github.com/x/y', 'git'],
    ['npm ci', 'npm'],
    ['npx tsc --noEmit', 'npm'],
    ['/usr/sbin/cfprefsd agent', 'other'],
  ];
  it.each(table)('%s → %s', (command, family) => {
    expect(classifyFamily(command)).toBe(family);
  });

  it('every classification lands in the closed FAMILIES list, and dev-server is never agent load', () => {
    for (const [cmd] of table) expect(FAMILIES).toContain(classifyFamily(cmd));
    expect(AGENT_LOAD_FAMILIES).not.toContain('dev-server');
    expect(AGENT_LOAD_FAMILIES).not.toContain('claude-infra');
    expect(HEAVY_FAMILIES).toEqual(['vitest', 'playwright']);
  });

  it('a flag value can never make an unrelated process look like another family', () => {
    expect(classifyFamily('/usr/bin/foo --user-data-dir=/Users/u/Library/Google/Chrome')).toBe('other');
    expect(classifyFamily('/bin/bash -c source snapshot.sh && vitest run')).toBe('other');
  });
});

const PS = [
  '100 95.0 900000 node /w/lane-3/node_modules/.bin/eleventy --serve --port=8080 --quiet',
  '101 96.5 800000 node /w/lane-3/node_modules/.bin/eleventy --serve --port=8210 --quiet',
  '110 40.0 500000 node (vitest)',
  '111 35.5 400000 node (vitest 1)',
  '112 0.5 90000 npm exec vitest run scripts',
  '120 12.0 300000 /x/@anthropic-ai/claude-code/bin/claude.exe -p do-it --output-format json',
  '121 1.0 200000 claude',
  '122 0.1 90000 claude bg-spare --bg-spare /tmp/a.claim.sock',
  '130 5.0 50000 git status --porcelain',
  '140 0.0 1000 /usr/sbin/cfprefsd agent',
  '141 0.0 1000 node /w/lane-9/scripts/foo.mjs',
].join('\n');

const HOST = { load: [14.25, 11.5, 9.75], cpuCount: 12, freeBytes: 2_000_000_000, totalBytes: 34_000_000_000 };
const rawFor = (over = {}) => ({
  at: AT, nowMs: NOW, host: HOST, psRows: parsePsOutput(PS), agents: null, sessionsAgeS: null,
  lanes: [], admission: { cap: 2, heldCount: 1, freeCount: 1, held: [], waiting: [], staleWaiting: [] },
  probe: { spawnMs: 41.5, spinOvershootMs: 0.25 }, ...over,
});

describe('summarizeFamilies', () => {
  it('sums CPU, RSS and COUNT per family and zero-fills every family', () => {
    const f = summarizeFamilies(parsePsOutput(PS));
    expect(Object.keys(f)).toEqual([...FAMILIES]);
    expect(f['dev-server']).toEqual({ cpuPct: 191.5, memBytes: (900000 + 800000) * 1024, count: 2 });
    expect(f.vitest).toMatchObject({ cpuPct: 76, count: 3 });
    expect(f['claude-print'].count).toBe(1);
    expect(f['claude-session'].count).toBe(1);
    expect(f['claude-infra'].count).toBe(1);
    expect(f.playwright).toEqual({ cpuPct: 0, memBytes: 0, count: 0 });
    expect(f['node-other'].count).toBe(1);
    expect(f.other.count).toBe(1);
  });
});

describe('summarizeSessions', () => {
  it('counts verdicts, live pids and unknown liveness — never guessing liveness', () => {
    const agents = [
      { kind: 'background', name: 'conveyor-1', state: 'working', sessionId: 'a' },
      { kind: 'background', name: 'conveyor-2', state: 'working', sessionId: 'b' },
      { kind: 'background', name: 'conveyor-3', state: 'working', sessionId: 'c' },
    ];
    const s = summarizeSessions({ agents, facts: { a: { pidAlive: true }, b: { pidAlive: false } }, now: NOW });
    expect(s).toMatchObject({ total: 3, live: 1, unknownLiveness: 1 });
    expect(s.verdicts).toMatchObject({ progressing: 2, 'dead-record': 1 });
  });
});

describe('reconcileLanes — stale-lease detection', () => {
  const lease = (over = {}) => ({ session: 's', acquiredAt: new Date(NOW - 3_600_000).toISOString(), ttlMinutes: 240, pid: 4242, ...over });
  const lane = (n, l, pool = 'we') => ({ pool, lane: `lane-${n}`, path: `/w/.lanes/${pool}/lane-${n}`, lease: l });

  it('separates leased (live process evidence), stale-lease (none), expired and free', () => {
    const r = reconcileLanes({
      nowMs: NOW,
      lanes: [
        lane(1, lease({ pid: 999 })), // holder pid is in the ps set
        lane(2, lease({ pid: 1 })), // backed by a live agent whose cwd is inside the lane
        lane(3, lease({ pid: 2 })), // backed by a live process whose command line names the lane
        lane(4, lease({ pid: 3 })), // STALE: unexpired marker, nothing alive
        lane(5, lease({ pid: 4, acquiredAt: new Date(NOW - 10 * 3_600_000).toISOString(), ttlMinutes: 60 })), // expired → free
        lane(6, null), // no marker → free
      ],
      psPids: new Set([999]),
      psCommands: ['node /w/.lanes/we/lane-3/node_modules/.bin/vitest run'],
      agentCwds: ['/w/.lanes/we/lane-2/scripts'],
    });
    expect(r).toMatchObject({ total: 6, leased: 3, staleLeases: 1, expired: 1, free: 2 });
    expect(r.staleLeaseLanes).toEqual(['we/lane-4']);
  });

  it('lane-5 evidence never backs lane-54 (prefix collision)', () => {
    const r = reconcileLanes({
      nowMs: NOW, lanes: [lane(54, lease({ pid: 7 }))], psCommands: ['node /w/.lanes/we/lane-5/x.mjs', 'node /w/.lanes/we/lane-5 y'], agentCwds: ['/w/.lanes/we/lane-5'],
    });
    expect(r).toMatchObject({ leased: 0, staleLeases: 1 });
  });

  it('counts per pool and reports a lease with no pid as unbacked unless something else proves it live', () => {
    const r = reconcileLanes({ nowMs: NOW, lanes: [lane(1, lease({ pid: null }), 'a'), lane(2, lease(), 'b')], psPids: new Set([4242]) });
    expect(r.perPool).toEqual({ a: { total: 1, leased: 0, staleLeases: 1 }, b: { total: 1, leased: 1, staleLeases: 0 } });
  });
});

describe('probes with an injected clock', () => {
  it('spinOvershoot is ~0 when the clock advances smoothly', () => {
    let t = 1000;
    expect(spinOvershoot({ now: () => (t += 1) })).toBe(0);
  });

  it('spinOvershoot reports the overshoot when the process is descheduled mid-wait', () => {
    const readings = [0, 10, 20, 30, 40, 260];
    let i = 0;
    expect(spinOvershoot({ now: () => readings[Math.min(i++, readings.length - 1)] })).toBe(210);
  });

  it('spinOvershoot honours a custom spin length and never goes negative', () => {
    let t = 0;
    expect(spinOvershoot({ now: () => (t += 25), spinMs: 50 })).toBe(0);
  });

  it('measureSpawn times exactly the spawn-and-reap call', () => {
    const clock = [100, 141.505];
    let i = 0; let ran = 0;
    expect(measureSpawn({ now: () => clock[i++], run: () => { ran += 1; } })).toBe(41.51);
    expect(ran).toBe(1);
  });
});

describe('sampler determinism over an injected ps fixture', () => {
  it('the same raw facts give byte-identical samples and metrics', () => {
    const a = sampleToMetrics(buildSample(rawFor()));
    const b = sampleToMetrics(buildSample(rawFor()));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('every metric is in the closed vocabulary with a valid unit, tagged source + sample', () => {
    for (const m of sampleToMetrics(buildSample(rawFor({ agents: { agents: [], facts: {} }, sessionsAgeS: 12 })))) {
      expect(METRIC_NAMES).toContain(m.name);
      expect(METRIC_UNITS).toContain(m.unit);
      expect(Number.isFinite(m.value)).toBe(true);
      expect(m.attributes).toMatchObject({ source: SOURCE, sample: AT });
    }
  });

  it('carries load, probe, per-family cpu/count/mem and the lane and admission gauges', () => {
    const byName = (n) => sampleToMetrics(buildSample(rawFor())).find((m) => m.name === n);
    expect(byName('host.cpu.load1').value).toBe(14.25);
    expect(byName('host.cpu.count').value).toBe(12);
    expect(byName('host.probe.spawn_ms').value).toBe(41.5);
    expect(byName('host.probe.spin_overshoot_ms').value).toBe(0.25);
    expect(byName('host.family.cpu_pct').attributes).toMatchObject({ 'cpu.vitest': 76, 'cpu.dev-server': 191.5, 'cpu.claude-print': 12 });
    expect(byName('host.family.count').attributes).toMatchObject({ 'n.vitest': 3, 'n.dev-server': 2, 'n.claude-infra': 1 });
    expect(byName('host.family.mem_bytes').attributes['mem.vitest']).toBe((500000 + 400000 + 90000) * 1024);
    expect(byName('heavy.admission.cap').value).toBe(2);
    expect(byName('heavy.admission.held').value).toBe(1);
    expect(byName('lane.pool.stale_leases')).toBeDefined();
  });

  it('records the top processes (cpu >= 0.5% or rss >= 400 MB) with redacted commands and attribution keys', () => {
    const rows = parsePsOutput(`${PS}\n150 60.0 1000 node /w/x.mjs --token=sk-abcdefghijklmnopqrstuvwxyz0123456789`);
    const entries = sampleToMetrics(buildSample(rawFor({ psRows: rows }))).filter((m) => m.name === 'host.process.entry.cpu_pct');
    expect(entries.length).toBeGreaterThan(5);
    expect(entries.length).toBeLessThanOrEqual(30);
    expect(entries.map((e) => e.value)).toEqual([...entries.map((e) => e.value)].sort((a, b) => b - a));
    expect(entries.every((e) => e.value >= 0.5 || e.attributes.mem_bytes >= 400 * 1024 * 1024)).toBe(true);
    expect(JSON.stringify(entries)).not.toContain('sk-abcdefghijklmnopqrstuvwxyz0123456789');
    expect(entries[0].attributes).toMatchObject({ lane: 'unattributed', session: 'unattributed' });
    for (const k of ['pid', 'ppid', 'family', 'command', 'mem_bytes', 'elapsed_s', 'lane', 'lane_source', 'session', 'session_id']) expect(entries[0].attributes).toHaveProperty(k);
  });

  it('re-derives session liveness from THIS sample\'s ps when the roster is cached', () => {
    const agents = { agents: [{ kind: 'background', name: 'fix-9', state: 'working', sessionId: 's1', pid: 555 }], facts: { s1: { pidAlive: true } } };
    const dead = buildSample(rawFor({ agents, sessionsAgeS: 200 }));
    expect(dead.sessions.live).toBe(0);
    expect(dead.sessions.verdicts['dead-record']).toBe(1);
    const alive = buildSample(rawFor({ agents, sessionsAgeS: 200, psRows: [...parsePsOutput(PS), { pid: 555, pcpu: 1, rssKb: 1, command: 'claude' }] }));
    expect(alive.sessions.live).toBe(1);
  });

  it('a stale wait marker does not read as a waiter: heavy.admission.waiting counts live waiters only', () => {
    const m = sampleToMetrics(buildSample(rawFor({ admission: { cap: 2, heldCount: 1, freeCount: 1, held: [], waiting: [], staleWaiting: [{}, {}, {}, {}] } })));
    const w = m.find((x) => x.name === 'heavy.admission.waiting');
    expect(w.value).toBe(0);
    expect(w.attributes.stale).toBe(4);
  });
});

describe('runOnce — writes records the existing telemetry reader parses', () => {
  let dir; let stateDir; let env;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'host-sampler-tel-'));
    stateDir = mkdtempSync(join(tmpdir(), 'host-sampler-state-'));
    env = { ...process.env, HOST_SAMPLER_DIR: stateDir, WE_TELEMETRY: '1' };
  });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); rmSync(stateDir, { recursive: true, force: true }); });

  const io = () => ({
    nowMs: () => NOW, ps: () => PS, host: HOST, lanes: [], sessions: { agents: [], facts: {} },
    admission: { cap: 2, heldCount: 0, freeCount: 2, held: [], waiting: [], staleWaiting: [] }, probe: { spawnMs: 40, spinOvershootMs: 0 },
  });

  it('appends valid records to the day file; readers parse every line and golden signals see the gauges', async () => {
    const store = createFileTelemetryStore({ dir });
    const r = await runOnce({ env, io: io(), store });
    expect(r.failed).toBe(0);
    expect(r.written).toBeGreaterThan(15);
    const text = readFileSync(join(dir, '2026-09-20.jsonl'), 'utf8');
    const { events, corrupt } = parseTelemetryLines(text);
    expect(corrupt).toBe(0);
    expect(events).toHaveLength(r.written);
    for (const e of events) {
      expect(validateTelemetryEvent(e)).toEqual({ ok: true, errors: [] });
      expect(e.kind).toBe('sampler');
      expect(e.resource).toHaveProperty('host');
      expect(e.attributes.source).toBe(SOURCE);
    }
    const g = goldenSignals(events).saturation.gauges;
    expect(g['host.cpu.load1'].max).toBe(14.25);
    expect(g['host.probe.spawn_ms']).toBeDefined();
  });

  it('is append-only: a second sample adds records and rewrites nothing', async () => {
    const store = createFileTelemetryStore({ dir });
    await runOnce({ env, io: io(), store });
    const first = readFileSync(join(dir, '2026-09-20.jsonl'), 'utf8');
    await runOnce({ env, io: { ...io(), nowMs: () => NOW + 30_000 }, store });
    const second = readFileSync(join(dir, '2026-09-20.jsonl'), 'utf8');
    expect(second.startsWith(first)).toBe(true);
    expect(second.length).toBeGreaterThan(first.length);
  });

  it('--dry-run writes nothing; a held sample lock skips instead of blocking; telemetry-off skips', async () => {
    const store = createFileTelemetryStore({ dir });
    const dry = await runOnce({ env, io: io(), store, dryRun: true });
    expect(dry.sample).toBeDefined();
    expect(dry.written).toBe(0);
    const release = acquireLock(join(stateDir, 'sample.lock'));
    expect(release).toBeTypeOf('function');
    const skipped = await runOnce({ env, io: io(), store });
    expect(skipped.skipped).toMatch(/lock/);
    release();
    const off = await runOnce({ env: { ...env, WE_TELEMETRY: '0' }, io: io(), store });
    expect(off.skipped).toMatch(/disabled/);
  });
});

describe('acquireLock', () => {
  let d;
  beforeEach(() => { d = mkdtempSync(join(tmpdir(), 'host-sampler-lock-')); });
  afterEach(() => { rmSync(d, { recursive: true, force: true }); });

  it('is exclusive for a live holder and reclaims a dead holder', () => {
    const f = join(d, 'x.lock');
    const rel = acquireLock(f, { pid: 111, pidAlive: () => true });
    expect(rel).toBeTypeOf('function');
    expect(acquireLock(f, { pid: 222, pidAlive: () => true })).toBeNull();
    rel();
    mkdirSync(d, { recursive: true });
    writeFileSync(f, '333');
    const reclaimed = acquireLock(f, { pid: 444, pidAlive: (p) => p !== 333 });
    expect(reclaimed).toBeTypeOf('function');
    expect(readFileSync(f, 'utf8')).toBe('444');
  });
});
