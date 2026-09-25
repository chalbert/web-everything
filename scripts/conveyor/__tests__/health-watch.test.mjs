/**
 * @file scripts/conveyor/__tests__/health-watch.test.mjs
 * @description #4077 (health daemon slice 1) — the IO shell's own pure-ish probe helpers, exercised over real
 *   temp dirs (node:fs mkdtempSync), plus one end-to-end `tick()` run against a forced lane-starvation fixture.
 *   `tick()` also reads the real GitHub App status file from the home dir — read-only, harmless, left alone.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, appendFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  probeDaemonLogs, probeLeases, probeSelfSync, probeLanePools, tick, healthSectionLines, healthDir,
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
