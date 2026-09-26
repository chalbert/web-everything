/**
 * @file scripts/conveyor/health-smells/__tests__/machine-overload.test.mjs
 * @description #4075 continuation (card xzdgabp) — the PURE `evaluate()` of the `machine-overload` smell, over
 *   a real-shaped `ps -Ao pid,ppid,pcpu,etime,command` fixture reproducing the 2026-09-26 ~10:34-10:55 ET
 *   incident: an orphaned scratchpad/spawn-hog2.sh (reparented to launchd) forked ~50 copies, each spawning
 *   `node -e 1`. No fs/child_process here — every probe is a plain fixture, exactly like the other smell tests
 *   (see `../__tests__/stale-claim.test.mjs`).
 */
import { describe, it, expect } from 'vitest';
import machineOverload, { buildProcessTrees, summarizeProcessFamilies } from '../machine-overload.mjs';
import { parsePsOutput } from '../../health-watch-core.mjs';

const HEADER = '  PID  PPID %CPU     ELAPSED COMMAND';

function normalPsFixture() {
  return [
    HEADER,
    '    1     0   0.0  5-01:00:00 /sbin/launchd',
    '   88     1   0.1  4-23:59:50 /usr/libexec/logd',
    '  501     1   0.3  4-23:59:00 /System/Library/CoreServices/loginwindow.app/Contents/MacOS/loginwindow',
    ' 1200     1   0.5    08:00:00 /Applications/Visual Studio Code.app/Contents/Frameworks/Code Helper (Renderer).app/Contents/MacOS/Code Helper (Renderer)',
    ' 1300  1200   0.2    07:00:00 /Applications/Visual Studio Code.app/Contents/MacOS/Electron',
  ].join('\n');
}

/** The incident's own shape: an orphaned script (ppid 1, living in scratchpad/) forked into `copies` trees,
 *  each spawning one `node -e 1` child — matching the live report's "~50 copies … each spawning node -e 1". */
function incidentPsFixture(copies = 50) {
  const lines = [
    HEADER,
    '    1     0   0.0  5-01:00:00 /sbin/launchd',
    '   88     1   0.1  4-23:59:50 /usr/libexec/logd',
    '  501     1   0.3  4-23:59:00 /System/Library/CoreServices/loginwindow.app/Contents/MacOS/loginwindow',
  ];
  let pid = 25000;
  for (let i = 0; i < copies; i += 1) {
    const scriptPid = pid++;
    const nodePid = pid++;
    const elapsed = String(19 + (i % 5)).padStart(2, '0');
    lines.push(`${scriptPid}     1  92.0       00:${elapsed}:40 /bin/sh /Users/nicolasgilbert/workspace/webeverything/scratchpad/spawn-hog2.sh`);
    lines.push(`${nodePid} ${scriptPid}  98.0       00:00:02 node -e 1`);
  }
  return lines.join('\n');
}

describe('buildProcessTrees / summarizeProcessFamilies', () => {
  it('collapses 50 orphaned one-hop trees sharing the same root command into one family', () => {
    const rows = parsePsOutput(incidentPsFixture(50));
    const trees = buildProcessTrees(rows);
    // 3 system roots (launchd/logd/loginwindow, each a 1-member tree) + 50 spawn-hog2.sh roots = 53 trees.
    expect(trees.length).toBe(53);

    const families = summarizeProcessFamilies(trees);
    const hog = families.find((f) => f.command.includes('spawn-hog2.sh'));
    expect(hog).toBeTruthy();
    expect(hog.instances).toBe(50);
    expect(hog.totalMembers).toBe(100); // 50 scripts + 50 node children
    expect(hog.orphaned).toBe(true);
    expect(hog.scratchOrTmp).toBe(true);
    expect(hog.likelyRunaway).toBe(true);
    expect(hog.childCommands).toContain('node -e 1');
  });

  it('does not flag an orphaned (ppid 1) tree whose command is NOT in a scratch/tmp dir', () => {
    const rows = parsePsOutput(normalPsFixture());
    const families = summarizeProcessFamilies(buildProcessTrees(rows));
    expect(families.length).toBeGreaterThan(0);
    expect(families.every((f) => !f.likelyRunaway)).toBe(true);
  });
});

describe('machine-overload.evaluate — RED before the fix, GREEN after: the incident fixture', () => {
  it('does not breach on a normal-load, normal-process snapshot', () => {
    const processes = parsePsOutput(normalPsFixture());
    const out = machineOverload.evaluate({ processes, machineLoad: { load1: 2.1, load5: 1.9, load15: 1.7, cpuCount: 8 } });
    expect(out).toHaveLength(1);
    expect(out[0].subject).toBe('machine');
    expect(out[0].breach).toBe(false);
  });

  it('breaches and NAMES the culprit tree on the incident fixture (loadavg 293 / 8 cores)', () => {
    const processes = parsePsOutput(incidentPsFixture(50));
    const out = machineOverload.evaluate({ processes, machineLoad: { load1: 293, load5: 210, load15: 90, cpuCount: 8 } });
    const r = out[0];
    expect(r.breach).toBe(true);
    expect(r.measure.perCoreLoad).toBeCloseTo(293 / 8, 1);
    expect(r.measure.likelyRunawayCommand).toContain('spawn-hog2.sh');
    expect(r.measure.topFamilies[0].instances).toBe(50);

    // The episode text NAMES the culprit — count, path, orphan status, and what it spawns.
    expect(r.summary).toContain('50 ×');
    expect(r.summary).toContain('spawn-hog2.sh');
    expect(r.summary).toContain('orphaned, parent launchd');
    expect(r.summary).toContain('node -e 1');

    // The proposed action names the tree + its root pid; the watch itself never kills anything.
    expect(r.recommendation).toContain('stop tree 25000');
    expect(r.recommendation).toContain('never kills anything itself');
  });

  it('also breaches on idle-CPU-near-zero alone, with only a mildly elevated loadavg', () => {
    const processes = parsePsOutput(incidentPsFixture(10)); // 10 trees x 2 members = 20 procs at ~92%/98% cpu
    const out = machineOverload.evaluate({ processes, machineLoad: { load1: 1.0, load5: 1.0, load15: 1.0, cpuCount: 2 } });
    expect(out[0].measure.perCoreLoad).toBeLessThan(machineOverload.loadPerCoreThreshold);
    expect(out[0].measure.idlePct).toBeLessThanOrEqual(machineOverload.idleFloorPct);
    expect(out[0].breach).toBe(true);
  });

  it('closes cleanly: an empty/missing snapshot never breaches (no false positive on a probe hiccup)', () => {
    const out = machineOverload.evaluate({ processes: [], machineLoad: { load1: 0, load5: 0, load15: 0, cpuCount: 8 } });
    expect(out[0].breach).toBe(false);
    expect(out[0].measure.topFamilies).toEqual([]);
  });
});
