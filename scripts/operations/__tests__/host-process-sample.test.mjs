/**
 * @file scripts/operations/__tests__/host-process-sample.test.mjs
 * @description Tests for the per-process attribution follow-on to #3383 (`host-process-sample.mjs`) — the
 * categorization logic that buckets a `ps` snapshot into the six `host.process.*` categories.
 *
 * NO REAL `ps` CALL ANYWHERE IN THIS FILE. `parsePsOutput`/`categorizeProcess`/`summarizeProcessSample`/
 * `processCategoryMetrics` are pure and are tested against FIXTURE text (a trimmed, real
 * `ps -Awwo pid=,pcpu=,rss=,command=` capture, shaped by hand for exact, predictable values); the one IO edge,
 * `readProcessSample`, is tested with an INJECTED fake `exec`, never the real binary.
 */
import { describe, it, expect } from 'vitest';

import {
  PROCESS_CATEGORIES, parsePsOutput, categorizeProcess, summarizeProcessSample, processCategoryMetrics,
  readProcessSample,
} from '../host-process-sample.mjs';
import { METRIC_NAMES, METRIC_UNITS } from '../telemetry.mjs';

// A REAL capture shape (trimmed to one representative line per category, command lines shortened but kept
// recognisable) — see the module's own docblock for why matching is on the FULL command line, not `comm`.
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
 1328   2.0 840224 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
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

describe('categorizeProcess — the six-way match, checked in priority order', () => {
  it('files the conveyor driver under `conveyor`, never `other`', () => {
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

  it('files Visual Studio Code and its helpers under `vscode`', () => {
    expect(categorizeProcess('/Applications/Visual Studio Code.app/Contents/MacOS/Code')).toBe('vscode');
    expect(categorizeProcess('/Applications/Visual Studio Code.app/Contents/Frameworks/Code Helper.app/Contents/MacOS/Code Helper --type=gpu-process')).toBe('vscode');
  });

  it('files Google Chrome and its helpers under `chrome`', () => {
    expect(categorizeProcess('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')).toBe('chrome');
    expect(categorizeProcess('/Applications/Google Chrome.app/Contents/Frameworks/Google Chrome Framework.framework/Helpers/Google Chrome Helper.app/Contents/MacOS/Google Chrome Helper --type=gpu-process')).toBe('chrome');
  });

  it('files anything unmatched under the `other` catch-all, never dropped', () => {
    expect(categorizeProcess('/Applications/Spotify.app/Contents/MacOS/Spotify')).toBe('other');
    expect(categorizeProcess('/sbin/launchd')).toBe('other');
  });

  it('is total on hostile input — never throws, always returns a category', () => {
    for (const junk of [undefined, null, 42, {}, []]) {
      expect(() => categorizeProcess(junk)).not.toThrow();
      expect(PROCESS_CATEGORIES).toContain(categorizeProcess(junk));
    }
  });
});

describe('summarizeProcessSample — buckets a parsed row list into per-category CPU/memory totals', () => {
  it('sums cpu% and rss (as bytes) per category from the fixture capture', () => {
    const rows = parsePsOutput(FIXTURE_PS_OUTPUT);
    const totals = summarizeProcessSample(rows);
    expect(totals.conveyor.cpuPct).toBeCloseTo(11.0);
    expect(totals.conveyor.memBytes).toBe(210432 * 1024);
    expect(totals.drain.cpuPct).toBeCloseTo(0.5);
    // Two dispatched processes (claude + codex) sum together.
    expect(totals.dispatched_agents.cpuPct).toBeCloseTo(145.2 + 60.0);
    expect(totals.dispatched_agents.count).toBe(2);
    expect(totals.vscode.count).toBe(2);
    expect(totals.chrome.count).toBe(2);
    // other: launchd, logd, the bare interactive claude, and Spotify Helper — 4 processes.
    expect(totals.other.count).toBe(4);
  });

  it('every category in PROCESS_CATEGORIES is always present, even at zero — an empty sample is not an empty object', () => {
    const totals = summarizeProcessSample([]);
    for (const cat of PROCESS_CATEGORIES) {
      expect(totals[cat]).toEqual({ cpuPct: 0, memBytes: 0, count: 0 });
    }
  });

  it('the six categories account for the WHOLE sample — the honesty check that makes `other` load-bearing', () => {
    const rows = parsePsOutput(FIXTURE_PS_OUTPUT);
    const totals = summarizeProcessSample(rows);
    const summedCount = Object.values(totals).reduce((s, c) => s + c.count, 0);
    expect(summedCount).toBe(rows.length);
    const summedCpu = Object.values(totals).reduce((s, c) => s + c.cpuPct, 0);
    const rawCpu = rows.reduce((s, r) => s + r.pcpu, 0);
    expect(summedCpu).toBeCloseTo(rawCpu);
  });

  it('is total on hostile input — never throws', () => {
    for (const junk of [undefined, null, 'nope', [null, undefined, 42, { command: 'x', pcpu: 'nope', rssKb: 'nope' }]]) {
      expect(() => summarizeProcessSample(junk)).not.toThrow();
    }
  });
});

describe('processCategoryMetrics — shapes the totals into the telemetry sample array', () => {
  it('emits exactly 12 samples — two per category, cpu_pct and mem_bytes', () => {
    const totals = summarizeProcessSample(parsePsOutput(FIXTURE_PS_OUTPUT));
    const metrics = processCategoryMetrics(totals);
    expect(metrics).toHaveLength(PROCESS_CATEGORIES.length * 2);
    for (const cat of PROCESS_CATEGORIES) {
      expect(metrics.some((m) => m.name === `host.process.${cat}.cpu_pct`)).toBe(true);
      expect(metrics.some((m) => m.name === `host.process.${cat}.mem_bytes`)).toBe(true);
    }
  });

  it('every sample carries a name from the closed METRIC_NAMES vocabulary and a valid unit', () => {
    const metrics = processCategoryMetrics(summarizeProcessSample(parsePsOutput(FIXTURE_PS_OUTPUT)));
    for (const m of metrics) {
      expect(METRIC_NAMES).toContain(m.name);
      expect(METRIC_UNITS).toContain(m.unit);
      expect(Number.isFinite(m.value)).toBe(true);
    }
    expect(metrics.find((m) => m.name === 'host.process.chrome.cpu_pct').unit).toBe('percent');
    expect(metrics.find((m) => m.name === 'host.process.chrome.mem_bytes').unit).toBe('bytes');
  });

  it('is total on a bare/junk totals object', () => {
    for (const junk of [undefined, null, {}]) {
      expect(() => processCategoryMetrics(junk)).not.toThrow();
      const metrics = processCategoryMetrics(junk);
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
    // `summarizeProcessSample`/`processCategoryMetrics` must accept this real shape with no coercion surprises.
    expect(() => processCategoryMetrics(summarizeProcessSample(rows))).not.toThrow();
  });
});
