/**
 * @file scripts/conveyor/__tests__/health-watch.test.mjs
 * @description #4077 (health daemon slice 1) — the IO shell's own pure-ish probe helpers, exercised over real
 *   temp dirs (node:fs mkdtempSync), plus one end-to-end `tick()` run against a forced lane-starvation fixture.
 *   `tick()` also reads the real GitHub App status file from the home dir — read-only, harmless, left alone.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, appendFileSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  probeDaemonLogs, probeLeases, probeSelfSync, probeLanePools, tick, healthSectionLines, healthDir,
  probeDaemonStatus, daemonNameForLabel, runTickWithWatchdog, probeAuthExpiredSessions, probeAgents,
  probePrs, probeStaleState, probeMergedPrs, probeProcesses, probeMachineLoad,
} from '../health-watch.mjs';

let dir;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'health-watch-test-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

// ── probeDaemonLogs ──────────────────────────────────────────────────────────────────────────────────────────

describe('probeDaemonLogs', () => {
  it('bootstraps on the first read, then reads only the newly appended text incrementally', () => {
    const logsDir = join(dir, 'logs');
    mkdirSync(logsDir);
    const logPath = join(logsDir, 'foo-daemon.log');
    writeFileSync(logPath, 'foo-daemon: tick (1) — dispatched 1, refused 0\n');

    const first = probeDaemonLogs(logsDir, {});
    expect(first.samples.length).toBe(1);
    expect(first.samples[0].name).toBe('foo-daemon');
    expect(first.samples[0].bootstrap).toBe(true);
    expect(first.samples[0].text).toContain('tick (1)');

    appendFileSync(logPath, 'foo-daemon: tick (2) — dispatched 1, refused 0\n');
    const second = probeDaemonLogs(logsDir, first.cursors);
    expect(second.samples[0].bootstrap).toBe(false);
    expect(second.samples[0].text).toBe('foo-daemon: tick (2) — dispatched 1, refused 0\n');
    expect(second.samples[0].text).not.toContain('tick (1)');

    // Truncation/rotation (new size smaller than the recorded cursor) forces bootstrap again.
    writeFileSync(logPath, 'foo-daemon: tick (1) — dispatched 1, refused 0\n');
    const third = probeDaemonLogs(logsDir, second.cursors);
    expect(third.samples[0].bootstrap).toBe(true);
  });

  it('returns no samples for a missing logs dir', () => {
    expect(probeDaemonLogs(join(dir, 'nope'), {})).toEqual({ samples: [], cursors: {} });
  });
});

// ── probeLeases ──────────────────────────────────────────────────────────────────────────────────────────────

describe('probeLeases', () => {
  it('maps a reconcile-* owner to its bare log name when that name is registered', () => {
    const lockRoot = join(dir, 'locks');
    mkdirSync(join(lockRoot, 'lane-1'), { recursive: true });
    writeFileSync(join(lockRoot, 'lane-1', 'lock.json'), JSON.stringify({
      owner: 'Mac:123:reconcile-fix-dispatch-daemon', pid: process.pid, heartbeatAt: new Date('2026-09-25T10:00:00Z').toISOString(),
    }));
    const out = probeLeases(lockRoot, new Set(['fix-dispatch-daemon']));
    expect(out.length).toBe(1);
    expect(out[0].log).toBe('fix-dispatch-daemon');
    expect(out[0].role).toBe('reconcile-fix-dispatch-daemon');
    expect(out[0].pidAlive).toBe(true);
    expect(out[0].heartbeatAt).toBe(Date.parse('2026-09-25T10:00:00Z'));
  });

  it('maps a pass-daemon:<name> owner to the bare name', () => {
    const lockRoot = join(dir, 'locks');
    mkdirSync(join(lockRoot, 'lane-2'), { recursive: true });
    writeFileSync(join(lockRoot, 'lane-2', 'lock.json'), JSON.stringify({
      owner: 'Mac:1:pass-daemon:lease-reaper', pid: process.pid, heartbeatAt: new Date().toISOString(),
    }));
    const out = probeLeases(lockRoot, new Set(['lease-reaper']));
    expect(out.length).toBe(1);
    expect(out[0].log).toBe('lease-reaper');
    expect(out[0].role).toBe('pass-daemon:lease-reaper');
  });

  it('returns [] for a missing lock root', () => {
    expect(probeLeases(join(dir, 'nope'), new Set())).toEqual([]);
  });
});

// ── probeSelfSync ────────────────────────────────────────────────────────────────────────────────────────────

describe('probeSelfSync', () => {
  it('parses alerts.jsonl and rebuild.json times to ms', () => {
    const syncDir = join(dir, 'self-sync');
    mkdirSync(syncDir, { recursive: true });
    writeFileSync(join(syncDir, 'clone1.alerts.jsonl'), `${JSON.stringify({ at: '2026-09-25T10:00:00Z', kind: 'smoke-rejected', detail: { failed: 'gh' } })}\n`);
    writeFileSync(join(syncDir, 'clone1.rebuild.json'), JSON.stringify({ adopted: { at: '2026-09-25T10:05:00Z' }, rejected: null, quarantine: null, inProgress: null }));

    const out = probeSelfSync(syncDir);
    expect(out.length).toBe(1);
    expect(out[0].cloneKey).toBe('clone1');
    expect(out[0].alerts[0].kind).toBe('smoke-rejected');
    expect(out[0].alerts[0].at).toBe(Date.parse('2026-09-25T10:00:00Z'));
    expect(out[0].rebuild.adopted.at).toBe(Date.parse('2026-09-25T10:05:00Z'));
  });
});

// ── probeLanePools ───────────────────────────────────────────────────────────────────────────────────────────

describe('probeLanePools', () => {
  it('picks the LAST checked/health line even when trailing content after it is truncated', () => {
    const logsDir = join(dir, 'logs');
    mkdirSync(logsDir, { recursive: true });
    const lines = [
      `${JSON.stringify({ checked: true, health: { total: 2, leased: 1, acquirable: 1, dirtyUnleased: 0 } })}`,
      `${JSON.stringify({ checked: true, health: { total: 2, leased: 2, acquirable: 0, dirtyUnleased: 0 } })}`,
      '{"plan":[{"lane":1,"acti', // truncated trailing garbage — must not match or confuse the regex
    ].join('\n');
    writeFileSync(join(logsDir, 'lane-pool-health-watch-we.log'), lines);

    const out = probeLanePools(logsDir);
    expect(out.length).toBe(1);
    expect(out[0].repo).toBe('we');
    expect(out[0].health.acquirable).toBe(0); // the LAST line's value, not the first
    expect(out[0].health.leased).toBe(2);
  });

  it('skips a repo with no lane-pool-health-watch log', () => {
    expect(probeLanePools(join(dir, 'empty'))).toEqual([]);
  });
});

// ── probeAuthExpiredSessions — live incident, night of 2026-09-25/26 ET ─────────────────────────────────────
describe('probeAuthExpiredSessions', () => {
  const bgAgent = (over = {}) => ({ name: 'ci-heal-2711', kind: 'background', cwd: '/x/dispatch/abc', sessionId: 's-1', startedAt: '2026-09-26T10:53:00.000Z', ...over });

  it('flags a background session the injected reader confirms auth-expired, carrying its own startedAt', () => {
    const readInfo = () => ({ authExpired: true, reason: 'claude-auth' });
    const out = probeAuthExpiredSessions([bgAgent()], { readInfo });
    expect(out).toEqual([{ name: 'ci-heal-2711', startedAt: Date.parse('2026-09-26T10:53:00.000Z') }]);
  });

  it('never flags a session the reader clears, or one that throws', () => {
    expect(probeAuthExpiredSessions([bgAgent()], { readInfo: () => ({ authExpired: false, reason: 'no-signal' }) })).toEqual([]);
    expect(probeAuthExpiredSessions([bgAgent()], { readInfo: () => { throw new Error('unreadable'); } })).toEqual([]);
    expect(probeAuthExpiredSessions([bgAgent()], { readInfo: () => null })).toEqual([]);
  });

  it('skips a non-background row (interactive terminal session), or one missing cwd/sessionId, without calling the reader', () => {
    let called = false;
    const readInfo = () => { called = true; return { authExpired: true }; };
    probeAuthExpiredSessions([{ ...bgAgent(), kind: 'interactive' }], { readInfo });
    probeAuthExpiredSessions([{ ...bgAgent(), cwd: undefined }], { readInfo });
    probeAuthExpiredSessions([{ ...bgAgent(), sessionId: undefined }], { readInfo });
    expect(called).toBe(false);
  });

  it('empty/non-array input is never a guess', () => {
    expect(probeAuthExpiredSessions(undefined)).toEqual([]);
    expect(probeAuthExpiredSessions([])).toEqual([]);
  });

  it('probeAgents itself carries cwd/sessionId through — what this probe needs to resolve a transcript', () => {
    const exec = () => JSON.stringify([{ name: 'ci-heal-2711', state: 'blocked', kind: 'background', startedAt: '2026-09-26T10:53:00.000Z', cwd: '/x', sessionId: 's-1' }]);
    expect(probeAgents({ exec })).toEqual([{ name: 'ci-heal-2711', state: 'blocked', kind: 'background', startedAt: '2026-09-26T10:53:00.000Z', cwd: '/x', sessionId: 's-1' }]);
  });
});

// ── probeProcesses / probeMachineLoad — machine-overload's own inputs (#4075 continuation, card xzdgabp) ─────

describe('probeProcesses', () => {
  it('shells `ps -Ao pid,ppid,pcpu,etime,command` and parses it via parsePsOutput', () => {
    const exec = (cmd, args) => {
      expect(cmd).toBe('ps');
      expect(args).toEqual(['-Ao', 'pid,ppid,pcpu,etime,command']);
      return '  PID  PPID %CPU     ELAPSED COMMAND\n    1     0   0.0  01:00:00 /sbin/launchd\n';
    };
    expect(probeProcesses({ exec })).toEqual([{ pid: 1, ppid: 0, pcpu: 0, etime: '01:00:00', command: '/sbin/launchd' }]);
  });
});

describe('probeMachineLoad', () => {
  it('normalizes os.loadavg() + core count into {load1,load5,load15,cpuCount}', () => {
    const out = probeMachineLoad({ getLoadAvg: () => [293, 210, 90], getCpuCount: () => 8 });
    expect(out).toEqual({ load1: 293, load5: 210, load15: 90, cpuCount: 8 });
  });

  it('never reports a zero/negative core count (would divide-by-zero downstream)', () => {
    expect(probeMachineLoad({ getLoadAvg: () => [1, 1, 1], getCpuCount: () => 0 }).cpuCount).toBe(1);
  });
});

// ── tick() end-to-end: the machine-overload incident fixture (#4075 continuation, card xzdgabp) ─────────────
//    Reproduces the LIVE incident (2026-09-26 ~10:34-10:55 ET) via `--ps-fixture`/`--machine-load-fixture` — no
//    load generator is ever run to test this smell.

describe('tick() — machine-overload: normal snapshot never opens, the incident fixture does', () => {
  const psFixture = (dir2, copies) => {
    const path = join(dir2, 'xzdgabp-ps-fixture.txt');
    const lines = ['  PID  PPID %CPU     ELAPSED COMMAND', '    1     0   0.0  05-01:00:00 /sbin/launchd'];
    let pid = 25000;
    for (let i = 0; i < copies; i += 1) {
      const scriptPid = pid++;
      const nodePid = pid++;
      lines.push(`${scriptPid}     1  92.0       00:19:40 /bin/sh /Users/nicolasgilbert/workspace/webeverything/scratchpad/spawn-hog2.sh`);
      lines.push(`${nodePid} ${scriptPid}  98.0       00:00:02 node -e 1`);
    }
    writeFileSync(path, lines.join('\n'));
    return path;
  };
  const loadFixture = (dir2, load1, cpuCount) => {
    const path = join(dir2, 'xzdgabp-load-fixture.json');
    writeFileSync(path, JSON.stringify({ load1, load5: load1, load15: load1, cpuCount }));
    return path;
  };

  it('a normal-load snapshot never opens an episode (2 ticks)', async () => {
    const stateRoot = join(dir, 'state-normal');
    const flags = {
      'state-root': stateRoot, 'logs-dir': join(dir, 'logs-normal'), 'lock-root': join(dir, 'locks-normal'),
      'self-sync-dir': join(dir, 'sync-normal'), 'no-gh': true, 'no-diagnose': true,
      'ps-fixture': psFixture(dir, 0), 'machine-load-fixture': loadFixture(dir, 1.2, 8),
    };
    mkdirSync(flags['logs-dir'], { recursive: true });
    mkdirSync(flags['lock-root'], { recursive: true });
    mkdirSync(flags['self-sync-dir'], { recursive: true });

    const first = await tick(flags);
    const second = await tick(flags);
    expect(first.transitions.find((t) => t.key.startsWith('machine-overload'))).toBeUndefined();
    expect(second.transitions.find((t) => t.key.startsWith('machine-overload'))).toBeUndefined();
    expect(second.section.join('\n')).not.toContain('machine-overload');
  });

  it('opens exactly one machine-overload episode after 2 ticks of the incident fixture, naming the culprit', async () => {
    const stateRoot = join(dir, 'state-incident');
    const flags = {
      'state-root': stateRoot, 'logs-dir': join(dir, 'logs-incident'), 'lock-root': join(dir, 'locks-incident'),
      'self-sync-dir': join(dir, 'sync-incident'), 'no-gh': true, 'no-diagnose': true,
      'ps-fixture': psFixture(dir, 50), 'machine-load-fixture': loadFixture(dir, 293, 8),
    };
    mkdirSync(flags['logs-dir'], { recursive: true });
    mkdirSync(flags['lock-root'], { recursive: true });
    mkdirSync(flags['self-sync-dir'], { recursive: true });

    const first = await tick(flags);
    expect(first.transitions.find((t) => t.type === 'opened' && t.key.startsWith('machine-overload'))).toBeUndefined();

    const second = await tick(flags);
    const opens = second.transitions.filter((t) => t.type === 'opened' && t.key.startsWith('machine-overload'));
    expect(opens.length).toBe(1);
    // Notified even in shadow mode (the one opt-in exception, same as claude-auth-expired).
    expect(second.plan.find((p) => p.kind === 'notify' && p.key === opens[0].key)?.suppressed).toBeFalsy();

    const episodesDir = join(healthDir(stateRoot), 'episodes');
    const report = readdirSync(episodesDir).find((f) => f.includes('machine-overload') && f.endsWith('.md'));
    expect(report).toBeTruthy();
    const text = readFileSync(join(episodesDir, report), 'utf8');
    expect(text).toContain('50 ×');
    expect(text).toContain('spawn-hog2.sh');
    expect(text).toContain('orphaned, parent launchd');
    expect(text).toContain('stop tree 25000');
  });
});

// ── tick() end-to-end: a forced lane-starvation fixture ─────────────────────────────────────────────────────

describe('tick() — forced lane-starvation fixture', () => {
  it('opens exactly one lane-starvation episode after 2 ticks (openAfter=2) and writes exactly one report', async () => {
    const stateRoot = join(dir, 'state');
    const logsDir = join(dir, 'logs');
    const lockRoot = join(dir, 'locks'); // empty on purpose: no leases → daemon-silent stays inert
    const syncDir = join(dir, 'self-sync'); // empty on purpose: no alerts → clone-stale stays inert
    mkdirSync(logsDir, { recursive: true });
    mkdirSync(lockRoot, { recursive: true });
    mkdirSync(syncDir, { recursive: true });

    writeFileSync(join(logsDir, 'lane-pool-health-watch-we.log'),
      `${JSON.stringify({ checked: true, health: { total: 2, leased: 2, acquirable: 0, dirtyUnleased: 0 } })}\n`);
    const fixLog = join(logsDir, 'fix-dispatch-daemon.log');
    writeFileSync(fixLog, [
      'fix-dispatch-daemon: tick (1) — dispatched 0, refused 3',
      'fix-dispatch-daemon: refused no-lane chalbert/web-everything PR #2661 — no free lane in the pool',
      'fix-dispatch-daemon: refused no-lane chalbert/web-everything PR #2662 — no free lane in the pool',
      'fix-dispatch-daemon: refused no-lane chalbert/web-everything PR #2663 — no free lane in the pool',
      '',
    ].join('\n'));

    const flags = {
      'state-root': stateRoot, 'logs-dir': logsDir, 'lock-root': lockRoot, 'self-sync-dir': syncDir,
      'no-gh': true, 'no-diagnose': true,
    };

    const first = await tick(flags);
    expect(first.transitions.find((t) => t.type === 'opened' && t.key.startsWith('lane-starvation'))).toBeUndefined();

    // A second no-lane tick block, appended — the incremental read of just the new lines.
    appendFileSync(fixLog, [
      'fix-dispatch-daemon: tick (2) — dispatched 0, refused 3',
      'fix-dispatch-daemon: refused no-lane chalbert/web-everything PR #2664 — no free lane in the pool',
      'fix-dispatch-daemon: refused no-lane chalbert/web-everything PR #2665 — no free lane in the pool',
      'fix-dispatch-daemon: refused no-lane chalbert/web-everything PR #2666 — no free lane in the pool',
      '',
    ].join('\n'));

    const second = await tick(flags);
    const laneStarvationOpens = second.transitions.filter((t) => t.type === 'opened' && t.key.startsWith('lane-starvation'));
    expect(laneStarvationOpens.length).toBe(1);

    const episodesDir = join(healthDir(stateRoot), 'episodes');
    const reportFiles = readdirSync(episodesDir).filter((f) => f.startsWith('') && f.includes('lane-starvation') && f.endsWith('.md'));
    expect(reportFiles.length).toBe(1);

    const lines = healthSectionLines({ stateRoot });
    expect(lines[0]).toContain('last health tick completed');
  });
});

// ── probeDaemonStatus (the declared #4067 daemon-status read as the daemon inventory) ───────────────────────

describe('probeDaemonStatus', () => {
  it('maps launchd labels to the log names the smells key on', () => {
    expect(daemonNameForLabel('com.we.fix-dispatch-daemon')).toBe('fix-dispatch-daemon');
    expect(daemonNameForLabel('com.we.conveyor-pass-daemon.merge-orphan-sweep')).toBe('merge-orphan-sweep');
    expect(daemonNameForLabel('com.plateau.drain-daemon')).toBe('plateau-drain-daemon');
  });

  it('turns assessed daemon-status rows into lease rows, with the drain judged on its newest activity', () => {
    const collect = () => ({ observedAt: 'x', daemons: [] });
    const assess = () => ({ daemons: [
      { name: 'com.we.review-daemon', readable: true, running: true, kind: 'review-daemon', state: 'alive',
        lease: { entry: { pid: 42, heartbeatAt: '2026-09-25T15:00:00.000Z' } }, tick: { found: true, logMtimeMs: Date.parse('2026-09-25T15:01:00.000Z') } },
      { name: 'com.plateau.drain-daemon', readable: true, running: true, kind: 'drain-daemon', state: 'alive', lease: { entry: null },
        tick: { found: true, at: '2026-09-25T15:17:31.332Z', lastActivityAt: '2026-09-25T15:37:21.553Z' } },
      { name: 'com.we.broken', readable: false, running: false },
    ] });
    const rows = probeDaemonStatus({ collect, assess });
    expect(rows.map((r) => r.log)).toEqual(['review-daemon', 'plateau-drain-daemon']);
    expect(rows[0]).toMatchObject({ pid: 42, pidAlive: true, heartbeatAt: Date.parse('2026-09-25T15:00:00.000Z') });
    expect(rows[1].lastActivityAt).toBe(Date.parse('2026-09-25T15:37:21.553Z'));
    expect(rows[1].heartbeatAt).toBeNull();
  });
});

// ── stale-claim's probes (x4axhga) ───────────────────────────────────────────────────────────────────────────

describe('probePrs — carries headRefName (stale-claim\'s open-PR exclusion needs it)', () => {
  it('threads headRefName through from the gh read', () => {
    const exec = () => JSON.stringify([{ number: 7, title: 'x', headRefName: 'lane/4169-soak-harness', labels: [], statusCheckRollup: [], updatedAt: 't' }]);
    const out = probePrs({ exec });
    expect(out[0]).toMatchObject({ number: 7, headRefName: 'lane/4169-soak-harness' });
  });
});

describe('probeStaleState', () => {
  it('shells the declared stale-state read and returns its verdict (records/gaps), not the whole run envelope', () => {
    const exec = () => JSON.stringify({ runId: 'x', verdict: { observedAt: 'now', records: [{ kind: 'claim', id: '4169' }], gaps: ['g'] } });
    const out = probeStaleState({ exec });
    expect(out).toEqual({ observedAt: 'now', records: [{ kind: 'claim', id: '4169' }], gaps: ['g'] });
  });
});

describe('probeMergedPrs', () => {
  it('pairs the merged-PR list (one gh call) with the real backlog/ cards read (reused from backlog-stranded-sweep.mjs, never a second scan)', () => {
    const calls = [];
    const exec = (cmd, args) => { calls.push(args); return JSON.stringify([{ number: 2689, title: 'x0zg44l: soak', headRefName: 'lane/x0zg44l-soak', body: '' }]); };
    const out = probeMergedPrs({ exec });
    // The backlog cards are WE's, so the merged-PR list must be WE's too — never whatever repo the cwd resolves to.
    expect(calls[0]).toEqual(expect.arrayContaining(['--repo', 'chalbert/web-everything']));
    expect(out.prs).toEqual([{ number: 2689, title: 'x0zg44l: soak', headRefName: 'lane/x0zg44l-soak', body: '' }]);
    // The real repo's backlog/ dir has hundreds of cards — proves this reads the real reader, not a stub.
    expect(out.cards.length).toBeGreaterThan(50);
    expect(out.cards[0]).toHaveProperty('stem');
    expect(out.cards[0]).toHaveProperty('body');
  });
});

// ── review round 1 (PR #2672) regressions ─────────────────────────────────────────────────────────────────────

describe('persisted state is scrubbed', () => {
  it('a credential in a refusal line never reaches state.json', async () => {
    const tok = `ghp_${'Q'.repeat(36)}`;
    const logsDir = join(dir, 'logs'); mkdirSync(logsDir);
    const lockRoot = join(dir, 'locks'); mkdirSync(lockRoot);
    const syncDir = join(dir, 'sync'); mkdirSync(syncDir);
    const stateRoot = join(dir, 'state');
    writeFileSync(join(logsDir, 'fix-dispatch-daemon.log'), [
      'reconcile-fix-dispatch-daemon: tick (a) — dispatched 0, refused 1',
      `reconcile-fix-dispatch-daemon: refused dispatch-failed chalbert/web-everything PR #9 — auth header token ${tok} rejected`,
      '',
    ].join('\n'));
    const flags = { 'state-root': stateRoot, 'logs-dir': logsDir, 'lock-root': lockRoot, 'self-sync-dir': syncDir, 'no-gh': true, 'no-diagnose': true };
    await tick(flags);
    const { readFileSync } = await import('node:fs');
    const stateText = readFileSync(join(healthDir(stateRoot), 'state.json'), 'utf8');
    expect(stateText).toContain('chalbert/web-everything#9');
    expect(stateText).not.toContain(tok);
  });
});

describe('runTickWithWatchdog', () => {
  it('kills a tick that outlives its budget from OUTSIDE the tick process and records overrun.json', async () => {
    const stateRoot = join(dir, 'state');
    const hd = healthDir(stateRoot);
    mkdirSync(hd, { recursive: true });
    const hang = join(dir, 'hang.mjs');
    writeFileSync(hang, 'const end = Date.now() + 10_000; while (Date.now() < end) { /* a synchronous hang */ }\n');
    const code = await runTickWithWatchdog([], { dir: hd, killAfterMs: 300, script: hang });
    expect(code).toBe(3);
    const { readFileSync } = await import('node:fs');
    expect(JSON.parse(readFileSync(join(hd, 'overrun.json'), 'utf8')).killedAfterMs).toBe(300);
  }, 15_000);
});

// ── review round 2 (PR #2672) regressions ─────────────────────────────────────────────────────────────────────

describe('round 2: tick output, silences, partial lines', () => {
  const setup = () => {
    const logsDir = join(dir, 'logs'); mkdirSync(logsDir, { recursive: true });
    const lockRoot = join(dir, 'locks'); mkdirSync(lockRoot, { recursive: true });
    const syncDir = join(dir, 'sync'); mkdirSync(syncDir, { recursive: true });
    const stateRoot = join(dir, 'state');
    return { logsDir, stateRoot, flags: { 'state-root': stateRoot, 'logs-dir': logsDir, 'lock-root': lockRoot, 'self-sync-dir': syncDir, 'no-gh': true, 'no-diagnose': true } };
  };

  it("tick()'s own return value (printed section, --json summary) never carries a raw credential", async () => {
    const { logsDir, flags } = setup();
    const tok = `ghp_${'Z'.repeat(36)}`;
    // Bootstrap-read ticks are spread back at the interval, so 16 unproductive ticks span 30 min: the episode
    // opens on the first tick and its summary/recommendation carry the refusal text.
    const block = `reconcile-fix-dispatch-daemon: tick (a) — dispatched 0, refused 1\nreconcile-fix-dispatch-daemon: refused dispatch-failed chalbert/web-everything PR #9 — auth header token ${tok} rejected\n`;
    writeFileSync(join(logsDir, 'fix-dispatch-daemon.log'), `reconcile-fix-dispatch-daemon: started on Mac:1, tick every 120000ms.\n${block.repeat(16)}`);
    const summary = await tick(flags);
    expect(summary.transitions.some((t) => t.key === 'daemon-owed-no-dispatch::fix-dispatch-daemon')).toBe(true);
    expect(JSON.stringify(summary)).not.toContain(tok);
  });

  it('a silence set while a tick runs survives the tick (silences.json is never written by the tick)', async () => {
    const { flags, stateRoot } = setup();
    const hd = healthDir(stateRoot);
    mkdirSync(hd, { recursive: true });
    const silence = [{ smell: 'clone-stale', subject: null, card: '4078', expiresAt: Date.now() + 3_600_000 }];
    writeFileSync(join(hd, 'silences.json'), JSON.stringify(silence));
    await tick(flags);
    const { readFileSync } = await import('node:fs');
    expect(JSON.parse(readFileSync(join(hd, 'silences.json'), 'utf8'))).toEqual(silence);
    expect(JSON.parse(readFileSync(join(hd, 'state.json'), 'utf8')).silences).toBeUndefined();
  });

  it('a refusal line split across two reads (no trailing newline yet) is parsed whole on the next read', () => {
    const logsDir = join(dir, 'logs'); mkdirSync(logsDir);
    const f = join(logsDir, 'fix-dispatch-daemon.log');
    writeFileSync(f, 'reconcile-fix-dispatch-daemon: started on Mac:1, tick every 120000ms.\n');
    const a = probeDaemonLogs(logsDir, {});
    appendFileSync(f, 'reconcile-fix-dispatch-daemon: tick (a) — dispatched 0, refused 1\nreconcile-fix-dispatch-daemon: refused no-lane chalbert/fronti');
    const b = probeDaemonLogs(logsDir, a.cursors);
    expect(b.samples[0].text).not.toContain('chalbert/fronti');
    appendFileSync(f, 'erui PR #7 — no free lane\n');
    const c = probeDaemonLogs(logsDir, b.cursors);
    expect(c.samples[0].text).toBe('reconcile-fix-dispatch-daemon: refused no-lane chalbert/frontierui PR #7 — no free lane\n');
  });
});

// ── review round 3 (PR #2672) regressions ─────────────────────────────────────────────────────────────────────

describe('round 3: probe-error scrub and active-card silences', () => {
  const base = () => {
    const lockRoot = join(dir, 'locks'); mkdirSync(lockRoot, { recursive: true });
    const syncDir = join(dir, 'sync'); mkdirSync(syncDir, { recursive: true });
    return { 'lock-root': lockRoot, 'self-sync-dir': syncDir, 'no-gh': true, 'no-diagnose': true };
  };

  it('a credential in a probe error never reaches state.json, last-tick.json or the returned summary', async () => {
    const tok = `ghp_${'P'.repeat(36)}`;
    const badLogs = join(dir, `logs-${tok}`);
    writeFileSync(badLogs, 'not a directory'); // readdirSync throws ENOTDIR, its message naming this path
    const stateRoot = join(dir, 'state');
    const summary = await tick({ ...base(), 'state-root': stateRoot, 'logs-dir': badLogs });
    expect(Object.keys(summary.probeErrors)).toContain('daemonLogs');
    const { readFileSync } = await import('node:fs');
    const hd = healthDir(stateRoot);
    for (const text of [JSON.stringify(summary), readFileSync(join(hd, 'state.json'), 'utf8'), readFileSync(join(hd, 'last-tick.json'), 'utf8')]) {
      expect(text).not.toContain(tok);
    }
  });

  const runWithSilence = async (status) => {
    const stateRoot = join(dir, `state-${status}`);
    const hd = healthDir(stateRoot);
    mkdirSync(hd, { recursive: true });
    const logsDir = join(dir, `logs-${status}`); mkdirSync(logsDir, { recursive: true });
    const backlogDir = join(dir, `backlog-${status}`); mkdirSync(backlogDir, { recursive: true });
    writeFileSync(join(backlogDir, '9001-some-card.md'), `---\nkind: story\nstatus: ${status}\n---\n# card\n`);
    writeFileSync(join(hd, 'overrun.json'), JSON.stringify({ at: new Date().toISOString(), killedAfterMs: 180000 }));
    writeFileSync(join(hd, 'silences.json'), JSON.stringify([{ smell: 'health-tick-overrun', subject: null, card: '9001', expiresAt: Date.now() - 1000 }]));
    const summary = await tick({ ...base(), 'state-root': stateRoot, 'logs-dir': logsDir, 'backlog-dir': backlogDir });
    const { readFileSync } = await import('node:fs');
    return { summary, state: JSON.parse(readFileSync(join(hd, 'state.json'), 'utf8')) };
  };

  it('an expired silence whose tracking card is still active keeps the episode tracked', async () => {
    const { summary, state } = await runWithSilence('active');
    expect(summary.transitions.map((t) => t.type)).toContain('opened');
    expect(summary.transitions.map((t) => t.type)).not.toContain('silence-expired');
    expect(state.episodes['health-tick-overrun::health-watch'].tracked).toMatchObject({ card: '9001' });
  });

  it('once the tracking card is no longer active, the expired silence re-raises the episode', async () => {
    const { summary, state } = await runWithSilence('resolved');
    expect(summary.transitions.map((t) => t.type)).toContain('silence-expired');
    expect(state.episodes['health-tick-overrun::health-watch'].tracked).toBeNull();
  });
});
