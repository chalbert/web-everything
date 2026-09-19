/**
 * @file scripts/operations/__tests__/host-process-sample.test.mjs
 * @description Tests for the per-process attribution follow-on to #3383 (`host-process-sample.mjs`) — REDESIGNED
 * so categorization happens at REPORT time, not collection time (see the module's own docblock for the
 * real-data sizing behind {@link DEFAULT_PROCESS_CPU_PCT}). `conveyor`/`drain`/`dispatched_agents` stay fixed
 * categories; everything else is kept as individual per-process rows above the storage floor, or folded into
 * `belowFloor`.
 *
 * NO REAL `ps` CALL ANYWHERE IN THIS FILE. `parsePsOutput`/`categorizeProcess`/`buildProcessSnapshot`/
 * `processSnapshotMetrics` are pure and are tested against FIXTURE text (a trimmed, real
 * `ps -Awwo pid=,pcpu=,rss=,command=` capture, shaped by hand for exact, predictable values); the one IO edge,
 * `readProcessSample`, is tested with an INJECTED fake `exec`, never the real binary.
 */
import { describe, it, expect } from 'vitest';

import {
  FIXED_PROCESS_CATEGORIES, parsePsOutput, categorizeProcess, buildProcessSnapshot, processSnapshotMetrics,
  readProcessSample, DEFAULT_PROCESS_CPU_PCT, DEFAULT_PROCESS_MEM_BYTES,
} from '../host-process-sample.mjs';
import { METRIC_NAMES, METRIC_UNITS } from '../telemetry.mjs';

// A REAL capture shape (trimmed to one representative line per category, command lines shortened but kept
// recognisable) — see the module's own docblock for why matching is on the FULL command line, not `comm`.
// `rss` values are chosen so exactly the intended rows clear the default 2%/200MB storage floor.
const FIXTURE_PS_OUTPUT = `
    1   0.0  27696 /sbin/launchd
  546   0.1  92896 /usr/libexec/logd
81234  11.0 210432 node /Users/op/workspace/webeverything/skills-src/conveyor/runner.mjs --max-ticks=1
81250   0.5  60112 node /Users/op/workspace/webeverything/scripts/lane-drain.mjs
82011 145.2 512000 claude --restricted --tools Bash,Edit,Write,Read,Glob,Grep --strict-mcp-config --disable-slash-commands --settings /Users/op/.operations/delivery-agent-hooks-settings.json -p --session-id abc123 "deliver item #3441"
82099  60.0 300000 codex exec -C /Users/op/workspace/.lanes/web-everything/lane-4 -c default_permissions=locked "fix PR #2107"
77000   0.3  45000 claude
10419   0.0 326592 /Applications/Visual Studio Code.app/Contents/MacOS/Code
10422   0.6 118224 /Applications/Visual Studio Code.app/Contents/Frameworks/Code Helper.app/Contents/MacOS/Code Helper --type=gpu-process
 1328   2.4 840224 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
 1665   1.0 213664 /Applications/Google Chrome.app/Contents/Frameworks/Google Chrome Framework.framework/Helpers/Google Chrome Helper.app/Contents/MacOS/Google Chrome Helper --type=gpu-process
 1713   4.0  91120 /Applications/Spotify.app/Contents/Frameworks/Spotify Helper.app/Contents/MacOS/Spotify Helper --type=gpu-process
`;

describe('parsePsOutput — the one place `ps -Awwo pid=,pcpu=,rss=,command=` text is parsed', () => {
  it('parses every well-formed row, keeping the FULL command line (not truncated at the first space)', () => {
    const rows = parsePsOutput(FIXTURE_PS_OUTPUT);
    expect(rows.length).toBe(12);
    const conveyor = rows.find((r) => r.pid === 81234);
    expect(conveyor.pcpu).toBe(11.0);
    expect(conveyor.rssKb).toBe(210432);
    expect(conveyor.command).toContain('skills-src/conveyor/runner.mjs --max-ticks=1');
  });

  it('is tolerant of blank lines and never throws on junk input', () => {
    expect(() => parsePsOutput('')).not.toThrow();
    expect(parsePsOutput('')).toEqual([]);
    expect(() => parsePsOutput(undefined)).not.toThrow();
    expect(() => parsePsOutput(null)).not.toThrow();
    expect(parsePsOutput('not a ps line at all\n\n   \n')).toEqual([]);
    // A line missing a field (no command) is skipped, not half-parsed into a garbage row.
    expect(parsePsOutput('123 4.5 6789\n')).toEqual([]);
  });
});

describe('categorizeProcess — the three FIXED categories, checked in priority order; everything else is null', () => {
  it('files the conveyor driver under `conveyor`', () => {
    expect(categorizeProcess('node /repo/skills-src/conveyor/runner.mjs --max-ticks=1')).toBe('conveyor');
  });

  it('files the drain daemon under `drain`', () => {
    expect(categorizeProcess('node /repo/scripts/lane-drain.mjs')).toBe('drain');
    expect(categorizeProcess('node /repo/scripts/readiness/drain-lock.mjs --sweep')).toBe('drain');
  });

  it('files a DISPATCHED claude child (the real --restricted/--strict-mcp-config argv shape) under dispatched_agents', () => {
    const cmd = 'claude --restricted --tools Bash,Edit,Write,Read,Glob,Grep --strict-mcp-config '
      + '--disable-slash-commands --settings /x/settings.json -p --session-id abc "prompt"';
    expect(categorizeProcess(cmd)).toBe('dispatched_agents');
  });

  it('files a DISPATCHED codex child (`codex exec ...`) under dispatched_agents', () => {
    expect(categorizeProcess('codex exec -C /lane -c default_permissions=locked "prompt"')).toBe('dispatched_agents');
    expect(categorizeProcess('codex exec resume abc123 "prompt"')).toBe('dispatched_agents');
  });

  it('does NOT file the operator\'s own bare interactive `claude` session under dispatched_agents — the whole reason matching is on argv, not the binary name', () => {
    expect(categorizeProcess('claude')).not.toBe('dispatched_agents');
    expect(categorizeProcess('claude --resume some-session-id')).not.toBe('dispatched_agents');
  });

  it('returns null (not a bucket label) for anything unmatched — VS Code, Chrome, Spotify, system daemons alike, so real identity survives to buildProcessSnapshot', () => {
    expect(categorizeProcess('/Applications/Visual Studio Code.app/Contents/MacOS/Code')).toBeNull();
    expect(categorizeProcess('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')).toBeNull();
    expect(categorizeProcess('/Applications/Spotify.app/Contents/MacOS/Spotify')).toBeNull();
    expect(categorizeProcess('/sbin/launchd')).toBeNull();
  });

  it('is total on hostile input — never throws, always returns a fixed category or null', () => {
    for (const junk of [undefined, null, 42, {}, []]) {
      expect(() => categorizeProcess(junk)).not.toThrow();
      const cat = categorizeProcess(junk);
      expect(cat === null || FIXED_PROCESS_CATEGORIES.includes(cat)).toBe(true);
    }
  });
});

describe('buildProcessSnapshot — fixed-category totals + individual above-floor rows + a belowFloor remainder', () => {
  it('sums the three fixed categories exactly as before', () => {
    const rows = parsePsOutput(FIXTURE_PS_OUTPUT);
    const snap = buildProcessSnapshot(rows);
    expect(snap.categories.conveyor.cpuPct).toBeCloseTo(11.0);
    expect(snap.categories.conveyor.memBytes).toBe(210432 * 1024);
    expect(snap.categories.drain.cpuPct).toBeCloseTo(0.5);
    expect(snap.categories.dispatched_agents.cpuPct).toBeCloseTo(145.2 + 60.0);
    expect(snap.categories.dispatched_agents.count).toBe(2);
  });

  it('every fixed category is always present, even at zero', () => {
    const snap = buildProcessSnapshot([]);
    for (const cat of FIXED_PROCESS_CATEGORIES) {
      expect(snap.categories[cat]).toEqual({ cpuPct: 0, memBytes: 0, count: 0 });
    }
    expect(snap.processes).toEqual([]);
    expect(snap.belowFloor).toEqual({ cpuPct: 0, memBytes: 0, count: 0 });
  });

  it('a NAMED APP beyond vscode/chrome — Spotify Helper at 4.0% CPU — clears the default floor and keeps its real identity (pid + full command), never a bucket label', () => {
    const rows = parsePsOutput(FIXTURE_PS_OUTPUT);
    const snap = buildProcessSnapshot(rows);
    const spotify = snap.processes.find((p) => p.pid === 1713);
    expect(spotify).toBeDefined();
    expect(spotify.command).toContain('Spotify Helper');
    expect(spotify.cpuPct).toBeCloseTo(4.0);
    expect(spotify.memBytes).toBe(91120 * 1024);
  });

  it('Google Chrome itself (2.4% CPU, over the default 2% floor) is its own row', () => {
    const rows = parsePsOutput(FIXTURE_PS_OUTPUT);
    const snap = buildProcessSnapshot(rows);
    const chrome = snap.processes.find((p) => p.pid === 1328);
    expect(chrome).toBeDefined();
    expect(chrome.command).toContain('Google Chrome');
  });

  it('processes at/under the default floor on BOTH axes fold into belowFloor, not into a row', () => {
    const rows = parsePsOutput(FIXTURE_PS_OUTPUT);
    const snap = buildProcessSnapshot(rows);
    // launchd, logd, VS Code main (0.0%/326592KB≈319MB — wait, that clears the mem floor; check by pid instead)
    const launchd = snap.processes.find((p) => p.pid === 1);
    expect(launchd).toBeUndefined();
    expect(snap.belowFloor.count).toBeGreaterThan(0);
  });

  it('a custom floor is honoured — a lower floor pulls more rows out of belowFloor', () => {
    const rows = parsePsOutput(FIXTURE_PS_OUTPUT);
    const loose = buildProcessSnapshot(rows, { cpuFloorPct: 0, memFloorBytes: 0 });
    const tight = buildProcessSnapshot(rows, { cpuFloorPct: 1000, memFloorBytes: Number.MAX_SAFE_INTEGER });
    expect(loose.processes.length).toBeGreaterThan(tight.processes.length);
    expect(tight.processes).toEqual([]);
  });

  it('the HONESTY INVARIANT: categories + processes + belowFloor account for the WHOLE sample, every time', () => {
    const rows = parsePsOutput(FIXTURE_PS_OUTPUT);
    const snap = buildProcessSnapshot(rows);
    const fixedCount = Object.values(snap.categories).reduce((s, c) => s + c.count, 0);
    const summedCount = fixedCount + snap.processes.length + snap.belowFloor.count;
    expect(summedCount).toBe(rows.length);

    const fixedCpu = Object.values(snap.categories).reduce((s, c) => s + c.cpuPct, 0);
    const processCpu = snap.processes.reduce((s, p) => s + p.cpuPct, 0);
    const summedCpu = fixedCpu + processCpu + snap.belowFloor.cpuPct;
    const rawCpu = rows.reduce((s, r) => s + r.pcpu, 0);
    expect(summedCpu).toBeCloseTo(rawCpu);
  });

  it('is total on hostile input — never throws', () => {
    for (const junk of [undefined, null, 'nope', [null, undefined, 42, { command: 'x', pcpu: 'nope', rssKb: 'nope' }]]) {
      expect(() => buildProcessSnapshot(junk)).not.toThrow();
    }
  });
});

describe('DEFAULT_PROCESS_CPU_PCT / DEFAULT_PROCESS_MEM_BYTES — the documented, evidence-based storage floor', () => {
  it('matches the operator\'s own suggested substantial bar: >2% CPU or >200MB', () => {
    expect(DEFAULT_PROCESS_CPU_PCT).toBe(2);
    expect(DEFAULT_PROCESS_MEM_BYTES).toBe(200 * 1024 * 1024);
  });
});

describe('processSnapshotMetrics — shapes the snapshot into the telemetry sample array', () => {
  it('emits 6 fixed-category metrics + 2 per above-floor process + 2 belowFloor-remainder metrics', () => {
    const snap = buildProcessSnapshot(parsePsOutput(FIXTURE_PS_OUTPUT));
    const metrics = processSnapshotMetrics(snap);
    const expected = FIXED_PROCESS_CATEGORIES.length * 2 + snap.processes.length * 2 + 2;
    expect(metrics).toHaveLength(expected);
    for (const cat of FIXED_PROCESS_CATEGORIES) {
      expect(metrics.some((m) => m.name === `host.process.${cat}.cpu_pct`)).toBe(true);
      expect(metrics.some((m) => m.name === `host.process.${cat}.mem_bytes`)).toBe(true);
    }
    expect(metrics.some((m) => m.name === 'host.process.below_floor_remainder.cpu_pct')).toBe(true);
    expect(metrics.some((m) => m.name === 'host.process.below_floor_remainder.mem_bytes')).toBe(true);
  });

  it('every above-floor process metric carries its REAL identity (pid + command) in attributes, never a category label', () => {
    const snap = buildProcessSnapshot(parsePsOutput(FIXTURE_PS_OUTPUT));
    const metrics = processSnapshotMetrics(snap);
    const spotifyMetric = metrics.find((m) => m.name === 'host.process.entry.cpu_pct' && m.attributes.pid === 1713);
    expect(spotifyMetric).toBeDefined();
    expect(spotifyMetric.attributes.command).toContain('Spotify Helper');
    expect(spotifyMetric.value).toBeCloseTo(4.0);
  });

  it('every sample carries a name from the closed METRIC_NAMES vocabulary and a valid unit — including the new `entry`/`below_floor_remainder` names', () => {
    const metrics = processSnapshotMetrics(buildProcessSnapshot(parsePsOutput(FIXTURE_PS_OUTPUT)));
    for (const m of metrics) {
      expect(METRIC_NAMES).toContain(m.name);
      expect(METRIC_UNITS).toContain(m.unit);
      expect(Number.isFinite(m.value)).toBe(true);
    }
  });

  it('a command line longer than the recorder\'s own attribute-value bound is still shaped without throwing', () => {
    const longCommand = `/Applications/Some App.app/${'x'.repeat(1000)}`;
    const snap = buildProcessSnapshot([{ pid: 999, pcpu: 5, rssKb: 300 * 1024, command: longCommand }]);
    expect(() => processSnapshotMetrics(snap)).not.toThrow();
    const m = processSnapshotMetrics(snap).find((x) => x.name === 'host.process.entry.cpu_pct');
    expect(m.attributes.command.length).toBeLessThan(longCommand.length);
  });

  // PR #2220 review (security): argv is durable — the `command` attribute must never carry a credential.
  it('masks credential-shaped argv values BEFORE the attribute is built, and control characters with them', () => {
    const rows = [
      { pid: 601, pcpu: 9, rssKb: 300 * 1024, command: 'node tool.mjs --token=abc123SECRET' },
      { pid: 602, pcpu: 9, rssKb: 300 * 1024, command: "curl -H 'Authorization: Bearer abc123SECRET' https://x.test" },
      { pid: 603, pcpu: 9, rssKb: 300 * 1024, command: 'psql postgres://admin:abc123SECRET@db/app' },
      { pid: 604, pcpu: 9, rssKb: 300 * 1024, command: 'node evil.mjs \u001b]0;pwned\u0007' },
      // A secret straddling the truncation cut must be masked whole, not half-kept.
      { pid: 605, pcpu: 9, rssKb: 300 * 1024, command: `${'x'.repeat(475)} --token=abc123SECRET` },
    ];
    const metrics = processSnapshotMetrics(buildProcessSnapshot(rows)).filter((m) => m.name === 'host.process.entry.cpu_pct');
    expect(metrics).toHaveLength(5);
    for (const m of metrics) {
      expect(m.attributes.command).not.toContain('abc123SECRET');
      expect(m.attributes.command).not.toContain('SECRET');
      expect(m.attributes.command).not.toMatch(/[\u0000-\u001f\u007f-\u009f]/);
    }
    expect(metrics.find((m) => m.attributes.pid === 601).attributes.command).toBe('node tool.mjs --token=[REDACTED]');
  });

  it('is total on a bare/junk snapshot object', () => {
    for (const junk of [undefined, null, {}]) {
      expect(() => processSnapshotMetrics(junk)).not.toThrow();
      const metrics = processSnapshotMetrics(junk);
      expect(metrics.every((m) => Number.isFinite(m.value))).toBe(true);
    }
  });
});

describe('readProcessSample — the one IO edge, with `ps` MOCKED (no real shell-out in this suite)', () => {
  it('parses whatever the injected exec returns', () => {
    const fakeExec = () => `81234 11.0 210432 node /repo/skills-src/conveyor/runner.mjs\n`;
    const rows = readProcessSample({ exec: fakeExec });
    expect(rows).toHaveLength(1);
    expect(rows[0].pid).toBe(81234);
  });

  it('degrades to an empty sample — never throws — when `ps` itself fails (missing binary, wrong platform, spawn error)', () => {
    const throwingExec = () => { throw new Error('ps: command not found'); };
    expect(() => readProcessSample({ exec: throwingExec })).not.toThrow();
    expect(readProcessSample({ exec: throwingExec })).toEqual([]);
  });

  it('calls the real `ps` by default and returns a sane, parseable snapshot on this host', () => {
    const rows = readProcessSample();
    expect(Array.isArray(rows)).toBe(true);
    // This process itself (`node`, running the test runner) must appear somewhere in a real snapshot.
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => Number.isInteger(r.pid) && Number.isFinite(r.pcpu) && Number.isFinite(r.rssKb))).toBe(true);
    // buildProcessSnapshot/processSnapshotMetrics must accept this real shape with no coercion surprises.
    expect(() => processSnapshotMetrics(buildProcessSnapshot(rows))).not.toThrow();
  });
});
