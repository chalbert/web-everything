/**
 * @file scripts/operations/__tests__/daemon-status-io.test.mjs
 * @description #4067 — pure parser/classifier unit tests plus an injected-fakes exercise of
 *   `collectDaemonStatus` end to end. No real launchd, lease dir, clone, or log file is touched — every
 *   dependency (`exec`, `readText`, `readdir`, `tailFs`, `gitRunner`) is faked.
 */
import { describe, it, expect } from 'vitest';
import {
  isDaemonLabel, classifyDaemonSpec, leaseKeyForClassification, passDaemonLeaseKeyMirror,
  parseFixDispatchTick, parseReviewDaemonTick, parseMergeOrphanSweepTick, lastMeaningfulLine,
  normalizeDrainLastPass, countCommitsBehindOrigin, cloneOverlayKey, readOverlaysForClone,
  readDrainDaemonState, tailFile, collectDaemonStatus, WE_DAEMON_OVERLAY_DIR_ENV,
  parseAlertLines, readRebuildStateForClone, readRecentAlertsForClone, WE_DAEMON_STATE_DIR_ENV,
} from '../daemon-status-io.mjs';

describe('isDaemonLabel', () => {
  it('accepts com.we.* and the one plateau drain-daemon label', () => {
    expect(isDaemonLabel('com.we.review-daemon')).toBe(true);
    expect(isDaemonLabel('com.plateau.drain-daemon')).toBe(true);
  });
  it('rejects anything else, including a look-alike plateau label', () => {
    expect(isDaemonLabel('com.plateau.wip-publisher')).toBe(false);
    expect(isDaemonLabel('com.apple.something')).toBe(false);
    expect(isDaemonLabel(null)).toBe(false);
  });
});

describe('classifyDaemonSpec', () => {
  it('identifies review-daemon and fix-dispatch-daemon by their bespoke script', () => {
    expect(classifyDaemonSpec({ programArguments: ['/node', '/x/skills-src/conveyor/review-daemon.mjs'] }))
      .toEqual({ kind: 'review-daemon' });
    expect(classifyDaemonSpec({ programArguments: ['/node', '/x/skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs'] }))
      .toEqual({ kind: 'fix-dispatch-daemon' });
  });
  it('identifies a pass-daemon watcher by its --pass= flag', () => {
    expect(classifyDaemonSpec({ programArguments: ['/node', '/x/skills-src/conveyor/pass-daemon.mjs', '--pass=lease-reaper'] }))
      .toEqual({ kind: 'pass-daemon', pass: 'lease-reaper' });
  });
  it('a pass-daemon launch missing --pass= is unknown, never a guessed pass name', () => {
    expect(classifyDaemonSpec({ programArguments: ['/node', '/x/skills-src/conveyor/pass-daemon.mjs'] }))
      .toEqual({ kind: 'unknown', script: 'pass-daemon.mjs' });
  });
  it('identifies the plateau drain daemon by its daemon.mjs entry point', () => {
    expect(classifyDaemonSpec({ programArguments: ['/node', '/x/tools/drain-daemon/daemon.mjs'] }))
      .toEqual({ kind: 'drain-daemon' });
  });
  it('a future/unrecognized script is unknown, never crashes', () => {
    expect(classifyDaemonSpec({ programArguments: ['/node', '/x/scripts/conveyor/something-new.mjs'] }))
      .toEqual({ kind: 'unknown', script: 'something-new.mjs' });
    expect(classifyDaemonSpec({})).toEqual({ kind: 'unknown', script: null });
  });
});

describe('leaseKeyForClassification', () => {
  it('review-daemon and fix-dispatch-daemon get their literal, real, live-verified lease keys', () => {
    expect(leaseKeyForClassification({ kind: 'review-daemon' })).toBe('<conveyor:review-daemon-lease>');
    expect(leaseKeyForClassification({ kind: 'fix-dispatch-daemon' })).toBe('<conveyor:reconcile-fix-dispatch-daemon-lease>');
  });
  it('a pass-daemon watcher derives its key from its pass name, matching pass-daemon.mjs#passDaemonLeaseKey', () => {
    expect(leaseKeyForClassification({ kind: 'pass-daemon', pass: 'lane-pool-health-watch-we' }))
      .toBe('<conveyor:pass-daemon:lane-pool-health-watch-we-lease>');
    expect(passDaemonLeaseKeyMirror('lease-reaper')).toBe('<conveyor:pass-daemon:lease-reaper-lease>');
  });
  it('the drain daemon and an unknown kind have no lease key', () => {
    expect(leaseKeyForClassification({ kind: 'drain-daemon' })).toBeNull();
    expect(leaseKeyForClassification({ kind: 'unknown' })).toBeNull();
  });
});

describe('parseFixDispatchTick', () => {
  it('reads the last tick summary and the per-repo refusal detail lines that follow it', () => {
    const text = [
      'reconcile-fix-dispatch-daemon: started on Mac:1, tick every 120000ms.',
      'reconcile-fix-dispatch-daemon: tick (a, b) — dispatched 1, refused 0',
      'reconcile-fix-dispatch-daemon: tick (a, b, c) — dispatched 0, refused 6',
      'reconcile-fix-dispatch-daemon: a tick failed (non-fatal, other repos unaffected): stale checkout',
      'reconcile-fix-dispatch-daemon: b tick failed (non-fatal, other repos unaffected): stale checkout',
    ].join('\n');
    const tick = parseFixDispatchTick(text);
    expect(tick).toEqual({
      found: true, repos: ['a', 'b', 'c'], dispatched: 0, refused: 6, attempted: 6, succeeded: 0,
      refusalDetails: [{ repo: 'a', error: 'stale checkout' }, { repo: 'b', error: 'stale checkout' }],
    });
  });
  it('drops node deprecation-warning noise and reports not-found on an empty/irrelevant tail', () => {
    expect(parseFixDispatchTick('(node:1) [DEP0040] DeprecationWarning: x\n')).toEqual({ found: false });
    expect(parseFixDispatchTick('')).toEqual({ found: false });
  });
  it('stops collecting refusal detail at the NEXT tick line, never bleeding into a later tick', () => {
    const text = [
      'reconcile-fix-dispatch-daemon: tick (a) — dispatched 0, refused 1',
      'reconcile-fix-dispatch-daemon: a tick failed (non-fatal, other repos unaffected): boom',
      'reconcile-fix-dispatch-daemon: tick (a) — dispatched 1, refused 0',
    ].join('\n');
    expect(parseFixDispatchTick(text)).toEqual({
      found: true, repos: ['a'], dispatched: 1, refused: 0, attempted: 1, succeeded: 1, refusalDetails: [],
    });
  });
});

describe('parseReviewDaemonTick', () => {
  it('reads a normal completed tick', () => {
    const text = 'review-daemon: tick (a, b, c) — 2 owed, dispatched 2, failed 0';
    expect(parseReviewDaemonTick(text)).toEqual({
      found: true, tickFailed: false, repos: ['a', 'b', 'c'], owed: 2, dispatched: 2, failed: 0,
      attempted: 2, succeeded: 2, refused: 0,
    });
  });
  it('a tick that threw reports tickFailed with the error, even after an earlier good tick', () => {
    const text = [
      'review-daemon: tick (a) — 2 owed, dispatched 2, failed 0',
      "review-daemon: tick failed (non-fatal): Cannot read properties of undefined (reading 'map')",
    ].join('\n');
    expect(parseReviewDaemonTick(text)).toEqual({
      found: true, tickFailed: true, error: "Cannot read properties of undefined (reading 'map')",
    });
  });
  it('a good tick AFTER an earlier failure reports the good tick, not the stale failure', () => {
    const text = [
      'review-daemon: tick failed (non-fatal): boom',
      'review-daemon: tick (a) — 0 owed, dispatched 0, failed 0',
    ].join('\n');
    expect(parseReviewDaemonTick(text).tickFailed).toBe(false);
  });
  it('no tick line at all is not-found', () => {
    expect(parseReviewDaemonTick('review-daemon: session-reap — 1 scanned, 0 stopped, 1 kept')).toEqual({ found: false });
  });
});

describe('parseMergeOrphanSweepTick', () => {
  it('reads the last (considered, merged) pair and derives refused', () => {
    const text = [
      'merge-ai-prs · pass timings: listing=1ms total=2ms (considered 1, merged 0)',
      'merge-ai-prs · pass timings: listing=1ms total=2ms (considered 2, merged 1)',
    ].join('\n');
    expect(parseMergeOrphanSweepTick(text)).toEqual({
      found: true, considered: 2, merged: 1, attempted: 2, succeeded: 1, refused: 1,
    });
  });
  it('not-found when the pattern never appears', () => expect(parseMergeOrphanSweepTick('nothing here')).toEqual({ found: false }));
});

describe('lastMeaningfulLine', () => {
  it('skips deprecation noise and returns the last real line', () => {
    expect(lastMeaningfulLine('review-daemon: session-reap — 1 scanned\n(node:1) [DEP0040] DeprecationWarning: x\n'))
      .toBe('review-daemon: session-reap — 1 scanned');
  });
  it('null on empty text', () => expect(lastMeaningfulLine('')).toBeNull());
});

describe('normalizeDrainLastPass', () => {
  it('maps considered/merged/failed/deferred/skipped into the shared attempted/succeeded/refused shape', () => {
    const lastPass = { at: '2026-09-25T13:00:16.069Z', considered: 2, merged: 1, failed: 0, deferred: 0, skippedPrs: [{ num: 1 }] };
    expect(normalizeDrainLastPass(lastPass)).toEqual({
      found: true, at: '2026-09-25T13:00:16.069Z', considered: 2, merged: 1, failed: 0, deferred: 0, skipped: 1,
      attempted: 2, succeeded: 1, refused: 1,
    });
  });
  it('a missing/malformed lastPass is not-found, never a crash', () => {
    expect(normalizeDrainLastPass(null)).toEqual({ found: false });
    expect(normalizeDrainLastPass(undefined)).toEqual({ found: false });
  });
});

describe('countCommitsBehindOrigin — injected git', () => {
  // countCommitsBehindOrigin issues `rev-parse --verify -q <ref>` (last arg is the ref, matching this repo's
  // own `--verify`-check convention — see handoff-home.mjs/docket-refresh-io.mjs/review-pr-io.mjs), then
  // `rev-list --count HEAD..origin/main`. Key on `${cmd} ${lastArg}` so a rev-parse override targets the
  // right ref regardless of which flags precede it.
  const runner = (overrides = {}) => (args) => {
    const key = args[0] === 'rev-list' ? 'rev-list' : `${args[0]} ${args[args.length - 1] ?? ''}`.trim();
    if (overrides[key]) return overrides[key];
    if (args[0] === 'rev-parse') return { status: 0, stdout: 'deadbeef\n' };
    if (args[0] === 'rev-list') return { status: 0, stdout: '3\n' };
    return { status: 1, stdout: '' };
  };
  it('a normal clone reports how far behind it is', () => {
    expect(countCommitsBehindOrigin('/x', { run: runner() })).toEqual({ behind: 3 });
  });
  it('no clone path at all is reported, not silently treated as 0', () => {
    expect(countCommitsBehindOrigin(null, { run: runner() })).toEqual({ behind: null, reason: 'no clone path' });
  });
  it('an unreadable HEAD (not a git checkout) is null, not 0', () => {
    const run = runner({ 'rev-parse HEAD': { status: 1, stdout: '' } });
    expect(countCommitsBehindOrigin('/x', { run })).toEqual({ behind: null, reason: 'not a readable git checkout' });
  });
  it('never fetches — only rev-parse/rev-list are ever called', () => {
    const calls = [];
    const run = (args) => { calls.push(args[0]); return runner()(args); };
    countCommitsBehindOrigin('/x', { run });
    expect(calls).not.toContain('fetch');
  });
});

describe('overlay state — synchronous mirror of scripts/lib/daemon-overlays.mjs', () => {
  it('cloneOverlayKey is a stable 16-hex-char id', () => {
    const key = cloneOverlayKey('/some/clone/path');
    expect(key).toMatch(/^[0-9a-f]{16}$/);
    expect(cloneOverlayKey('/some/clone/path')).toBe(key);
  });
  it('a missing overlay state file reads as an empty, non-corrupt list', () => {
    const readText = () => { const e = new Error('nope'); e.code = 'ENOENT'; throw e; };
    expect(readOverlaysForClone('/x', { env: {}, readText })).toEqual({ available: true, overlays: [], corrupt: false });
  });
  it('a real overlay file (the live shape) is read back verbatim', () => {
    const key = cloneOverlayKey('/x');
    const files = { [`/ovl/${key}.json`]: JSON.stringify({ clone: '/x', overlays: [{ ref: 'lane/foo', pr: 1 }] }) };
    const readText = (p) => { if (!(p in files)) { const e = new Error('nope'); e.code = 'ENOENT'; throw e; } return files[p]; };
    expect(readOverlaysForClone('/x', { env: { [WE_DAEMON_OVERLAY_DIR_ENV]: '/ovl' }, readText }))
      .toEqual({ available: true, overlays: [{ ref: 'lane/foo', pr: 1 }], corrupt: false });
  });
  it('a malformed overlay file is corrupt, never silently read as "no overlays"', () => {
    const readText = () => 'not json';
    expect(readOverlaysForClone('/x', { env: {}, readText })).toEqual({ available: true, overlays: [], corrupt: true });
  });
  it('no clone path is unavailable, not merely empty', () => {
    expect(readOverlaysForClone(null)).toEqual({ available: false, overlays: [], corrupt: false });
  });
});

describe('rebuild state — synchronous mirror of scripts/lib/daemon-rebuild.mjs', () => {
  it('a missing rebuild-state file reads as the empty, non-corrupt state', () => {
    const readText = () => { const e = new Error('nope'); e.code = 'ENOENT'; throw e; };
    expect(readRebuildStateForClone('/x', { env: {}, readText })).toEqual({
      available: true, corrupt: false,
      state: { adopted: null, rejected: null, inProgress: null, quarantine: null, unverified: null },
    });
  });
  it('a real rebuild.json (the live shape) is read back verbatim, keyed by the SAME cloneOverlayKey as overlays', () => {
    const key = cloneOverlayKey('/x');
    const files = { [`/st/${key}.rebuild.json`]: JSON.stringify({ adopted: { head: 'abc', at: '2026-09-25T14:05:23.328Z' }, rejected: null }) };
    const readText = (p) => { if (!(p in files)) { const e = new Error('nope'); e.code = 'ENOENT'; throw e; } return files[p]; };
    expect(readRebuildStateForClone('/x', { env: { [WE_DAEMON_STATE_DIR_ENV]: '/st' }, readText })).toEqual({
      available: true, corrupt: false,
      state: { adopted: { head: 'abc', at: '2026-09-25T14:05:23.328Z' }, rejected: null, inProgress: null, quarantine: null, unverified: null },
    });
  });
  it('a malformed rebuild.json is corrupt, never silently read as "nothing adopted"', () => {
    expect(readRebuildStateForClone('/x', { env: {}, readText: () => 'not json' })).toEqual({
      available: true, corrupt: true,
      state: { adopted: null, rejected: null, inProgress: null, quarantine: null, unverified: null },
    });
  });
  it('no clone path is unavailable, not merely empty', () => {
    expect(readRebuildStateForClone(null)).toEqual({
      available: false, corrupt: false,
      state: { adopted: null, rejected: null, inProgress: null, quarantine: null, unverified: null },
    });
  });
});

describe('parseAlertLines', () => {
  it('parses one JSON object per line into {at, kind, detail}', () => {
    const text = [
      '{"at":"2026-09-25T13:30:44.866Z","kind":"smoke-rejected","detail":{"failed":"gh-api-repo"}}',
      '{"at":"2026-09-25T13:30:44.867Z","kind":"clone-held-stale","detail":{"reason":"smoke-rejected"}}',
    ].join('\n');
    expect(parseAlertLines(text)).toEqual([
      { at: '2026-09-25T13:30:44.866Z', kind: 'smoke-rejected', detail: { failed: 'gh-api-repo' } },
      { at: '2026-09-25T13:30:44.867Z', kind: 'clone-held-stale', detail: { reason: 'smoke-rejected' } },
    ]);
  });
  it('a corrupt line is dropped, never poisons the rest of the trail', () => {
    const text = '{"kind":"a"}\nnot json\n{"kind":"b"}\n';
    expect(parseAlertLines(text)).toEqual([{ at: null, kind: 'a', detail: null }, { at: null, kind: 'b', detail: null }]);
  });
  it('blank input is an empty list', () => {
    expect(parseAlertLines('')).toEqual([]);
    expect(parseAlertLines(null)).toEqual([]);
  });
});

describe('readRecentAlertsForClone', () => {
  it('reads the alert trail, bounded to the most recent maxAlerts entries', () => {
    const key = cloneOverlayKey('/x');
    const lines = ['a', 'b', 'c'].map((k) => JSON.stringify({ at: null, kind: k })).join('\n');
    const tailFs = {
      statSync: () => ({ size: Buffer.byteLength(lines), mtimeMs: 1 }),
      openSync: () => 1,
      readSync: (fd, buf) => { buf.write(lines); return buf.length; },
      closeSync: () => {},
    };
    const read = readRecentAlertsForClone('/x', { env: { [WE_DAEMON_STATE_DIR_ENV]: '/st' }, tailFs, maxAlerts: 2 });
    expect(read.available).toBe(true);
    expect(read.alerts.map((a) => a.kind)).toEqual(['b', 'c']);
  });
  it('a missing alerts file is an empty, available list — never a throw', () => {
    const tailFs = { statSync: () => { const e = new Error('nope'); e.code = 'ENOENT'; throw e; } };
    expect(readRecentAlertsForClone('/x', { env: {}, tailFs })).toEqual({ available: true, alerts: [] });
  });
  it('no clone path is unavailable, not merely empty', () => {
    expect(readRecentAlertsForClone(null)).toEqual({ available: false, alerts: [] });
  });
});

describe('readDrainDaemonState', () => {
  it('reads and parses state.json', () => {
    const readText = (p) => { expect(p).toBe('/root/state.json'); return JSON.stringify({ lastPass: { considered: 1 } }); };
    expect(readDrainDaemonState('/root', { readText })).toEqual({ lastPass: { considered: 1 } });
  });
  it('a missing stateRoot or a read failure is null, never a throw', () => {
    expect(readDrainDaemonState(null)).toBeNull();
    expect(readDrainDaemonState('/root', { readText: () => { throw new Error('nope'); } })).toBeNull();
  });
  it('malformed JSON is null', () => {
    expect(readDrainDaemonState('/root', { readText: () => 'not json' })).toBeNull();
  });
});

describe('tailFile', () => {
  const fakeFs = (content, { maxBytes } = {}) => ({
    statSync: () => ({ size: Buffer.byteLength(content), mtimeMs: 12345 }),
    openSync: () => 1,
    readSync: (fd, buf) => { buf.write(content.slice(-buf.length)); return buf.length; },
    closeSync: () => {},
  });
  it('reads the whole file when it fits under maxBytes', () => {
    const fs = fakeFs('hello world');
    expect(tailFile('/x', { maxBytes: 1000, fs })).toEqual({ text: 'hello world', mtimeMs: 12345, truncated: false });
  });
  it('a missing file is null', () => {
    const fs = { statSync: () => { const e = new Error('nope'); e.code = 'ENOENT'; throw e; } };
    expect(tailFile('/x', { fs })).toBeNull();
  });
});

describe('collectDaemonStatus — full injected join', () => {
  const plistFor = (label, { programArguments, workingDirectory = '/clone', logPath = '/log.log', env: envVars = {} }) => JSON.stringify({
    Label: label, ProgramArguments: programArguments, WorkingDirectory: workingDirectory,
    StandardOutPath: logPath, EnvironmentVariables: envVars,
  });

  it('joins liveness + lease + tick + git distance + overlays for a fix-dispatch-style daemon', () => {
    const label = 'com.we.fix-dispatch-daemon';
    const plistText = plistFor(label, { programArguments: ['/node', '/x/skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs'] });
    const exec = (cmd, args) => {
      if (cmd === 'launchctl') return '13048\t0\tcom.we.fix-dispatch-daemon\n';
      if (cmd === 'plutil') return plistText;
      throw new Error(`unexpected exec ${cmd}`);
    };
    const readText = (p) => {
      if (p.endsWith('lock.json')) return JSON.stringify({ owner: 'Mac:1:x', heartbeatAt: '2026-09-25T13:00:00.000Z' });
      throw Object.assign(new Error('nope'), { code: 'ENOENT' });
    };
    const tailFs = {
      statSync: () => ({ size: 100, mtimeMs: 999 }),
      openSync: () => 1,
      readSync: (fd, buf) => { buf.write('reconcile-fix-dispatch-daemon: tick (a) — dispatched 0, refused 3'); return buf.length; },
      closeSync: () => {},
    };
    const gitRunner = (args) => (args[0] === 'rev-parse' ? { status: 0, stdout: 'x\n' } : { status: 0, stdout: '5\n' });
    const read = collectDaemonStatus({
      env: {}, exec, readText, tailFs, gitRunner, readdir: () => [`${label}.plist`],
      now: () => new Date('2026-09-25T13:04:43.103Z'), launchAgentsDir: '/agents',
    });
    expect(read.daemons).toHaveLength(1);
    const d = read.daemons[0];
    expect(d.kind).toBe('fix-dispatch-daemon');
    expect(d.running).toBe(true);
    expect(d.lease.entry.heartbeatAt).toBe('2026-09-25T13:00:00.000Z');
    expect(d.tick).toMatchObject({ found: true, dispatched: 0, refused: 3, attempted: 3, succeeded: 0 });
    expect(d.commitsBehind).toEqual({ behind: 5 });
    expect(d.overlays).toEqual({ available: true, overlays: [], corrupt: false });
    expect(d.rebuild).toEqual({
      available: true, corrupt: false,
      state: { adopted: null, rejected: null, inProgress: null, quarantine: null, unverified: null },
    });
    expect(d.recentAlerts.available).toBe(true);
  });

  it('surfaces a real rebuild-held-stale alert on the joined row', () => {
    const label = 'com.we.fix-dispatch-daemon';
    const plistText = plistFor(label, { programArguments: ['/node', '/x/skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs'], workingDirectory: '/clone' });
    const key = cloneOverlayKey('/clone');
    const alertLine = JSON.stringify({ at: '2026-09-25T13:30:44.867Z', kind: 'clone-held-stale', detail: { reason: 'smoke-rejected' } });
    const exec = (cmd) => {
      if (cmd === 'launchctl') return '13048\t0\tcom.we.fix-dispatch-daemon\n';
      if (cmd === 'plutil') return plistText;
      throw new Error(`unexpected exec ${cmd}`);
    };
    const readText = (p) => {
      if (p.endsWith('lock.json')) return JSON.stringify({ owner: 'Mac:1:x', heartbeatAt: '2026-09-25T13:00:00.000Z' });
      throw Object.assign(new Error('nope'), { code: 'ENOENT' });
    };
    const alertsPath = `/st/${key}.alerts.jsonl`;
    let openedPath = null;
    const tailFs = {
      statSync: (p) => ({ size: p === alertsPath ? Buffer.byteLength(alertLine) : 100, mtimeMs: 999 }),
      openSync: (p) => { openedPath = p; return 1; },
      readSync: (fd, buf) => {
        const text = openedPath === alertsPath ? alertLine : 'reconcile-fix-dispatch-daemon: tick (a) — dispatched 1, refused 0';
        buf.write(text);
        return Buffer.byteLength(text);
      },
      closeSync: () => {},
    };
    const gitRunner = () => ({ status: 0, stdout: '0\n' });
    const read = collectDaemonStatus({
      env: { [WE_DAEMON_STATE_DIR_ENV]: '/st' }, exec, readText, tailFs, gitRunner, readdir: () => [`${label}.plist`],
      now: () => new Date('2026-09-25T13:04:43.103Z'), launchAgentsDir: '/agents',
    });
    const d = read.daemons[0];
    expect(d.recentAlerts).toEqual({ available: true, alerts: [{ at: '2026-09-25T13:30:44.867Z', kind: 'clone-held-stale', detail: { reason: 'smoke-rejected' } }] });
  });

  const noExec = () => { throw new Error('exec should not be needed for this test'); };

  it('a daemon whose plist cannot be read still gets a row, marked unreadable, never dropped', () => {
    const read = collectDaemonStatus({
      env: {}, exec: noExec, readdir: () => ['com.we.mystery.plist'], launchAgentsDir: '/agents',
    });
    expect(read.daemons).toEqual([{ name: 'com.we.mystery', label: 'com.we.mystery', readable: false, running: false }]);
  });

  it('skips launchd jobs outside the com.we.*/com.plateau.drain-daemon label pattern', () => {
    const read = collectDaemonStatus({
      env: {}, exec: noExec, readdir: () => ['com.apple.something.plist', 'com.plateau.wip-publisher.plist'], launchAgentsDir: '/agents',
    });
    expect(read.daemons).toEqual([]);
  });

  it('a missing LaunchAgents dir reads as zero daemons, never throws', () => {
    const read = collectDaemonStatus({ env: {}, exec: noExec, readdir: () => { throw new Error('ENOENT'); }, launchAgentsDir: '/nope' });
    expect(read.daemons).toEqual([]);
  });
});
