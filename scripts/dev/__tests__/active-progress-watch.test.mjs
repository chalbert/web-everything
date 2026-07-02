/**
 * @file scripts/dev/__tests__/active-progress-watch.test.mjs
 * @description Regression proof of the terminal run-status contract in the Active-work LIVE feed watcher
 *   (#2150, guarding the 77a66d18 fix). A TaskStop'd /workflow run carries status:'killed'; when that was
 *   absent from the watcher's TERMINAL set it was treated as in-flight and never aged out of
 *   /active-progress.json, so a stale run from a prior session stuck 'live' forever on /backlog#active.
 *   These pin: (1) 'killed' classifies terminal, (2) a stale terminal run ages out of the feed while a fresh
 *   or still-running one is kept. Importing the module must NOT start the watch loop (the main-guard) — if it
 *   did, this test file would spin up setInterval and hang, which is itself the guard's regression.
 */
import { describe, it, expect } from 'vitest';
import { TERMINAL, isTerminalStatus, terminalRunAgedOut } from '../active-progress-watch.mjs';

const RECENT_MS = 10 * 60_000; // the watcher's default --recent window (10 min)
const NOW = Date.parse('2026-07-02T12:00:00.000Z');

describe('active-progress watcher — terminal run-status contract (#2150)', () => {
  it('treats every harness terminal status — including killed — as terminal', () => {
    for (const status of ['completed', 'failed', 'aborted', 'cancelled', 'killed']) {
      expect(TERMINAL.has(status)).toBe(true);
      expect(isTerminalStatus(status)).toBe(true);
    }
  });

  it('killed is in the set (the 77a66d18 regression: without it a TaskStop\'d run stuck live)', () => {
    expect(TERMINAL.has('killed')).toBe(true);
  });

  it('does not treat a live/unknown status as terminal', () => {
    for (const status of ['running', 'pending', undefined, '', 'paused']) {
      expect(isTerminalStatus(status)).toBe(false);
    }
  });

  it('ages a STALE killed run out of the feed (dropped once past the --recent window)', () => {
    const staleMtime = NOW - (RECENT_MS + 60_000); // 11 min old
    expect(terminalRunAgedOut('killed', staleMtime, NOW, RECENT_MS)).toBe(true);
  });

  it('KEEPS a fresh killed run (it lingers briefly before dropping)', () => {
    const freshMtime = NOW - 60_000; // 1 min old
    expect(terminalRunAgedOut('killed', freshMtime, NOW, RECENT_MS)).toBe(false);
  });

  it('NEVER ages out a still-running run, however old', () => {
    const ancient = NOW - 10 * RECENT_MS;
    expect(terminalRunAgedOut('running', ancient, NOW, RECENT_MS)).toBe(false);
    expect(terminalRunAgedOut(undefined, ancient, NOW, RECENT_MS)).toBe(false);
  });

  it('ages out every terminal status uniformly, not just killed', () => {
    const stale = NOW - (RECENT_MS + 1);
    for (const status of [...TERMINAL]) {
      expect(terminalRunAgedOut(status, stale, NOW, RECENT_MS)).toBe(true);
    }
  });
});
