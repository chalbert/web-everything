/**
 * @file scripts/conveyor/__tests__/claude-auth-health.test.mjs
 * @description Card x5kagse (epic #4075/#3383) — unit proof of the shared "is the Claude login broken" read
 *   and the cheap resume probe, in isolation from either daemon that consumes them.
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  AUTH_PAUSE_LOG_MESSAGE, AUTH_EPISODE_KEY,
  readOpenAuthEpisode, directRecentAuthExpired, readClaudeAuthHealth,
  probeClaudeLoggedIn, decideClaudeAuthDispatchGate, planClaudeAuthDispatchGate,
} from '../claude-auth-health.mjs';
import { episodeKey } from '../health-watch-core.mjs';

function withHealthState(episodes) {
  const root = mkdtempSync(join(tmpdir(), 'claude-auth-health-'));
  const dir = join(root, '.conveyor', 'health');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'state.json'), JSON.stringify({ episodes }), 'utf8');
  return root;
}

describe('AUTH_EPISODE_KEY never drifts from the real smell\'s own episodeKey()', () => {
  it('matches health-watch-core.mjs#episodeKey(\'claude-auth-expired\', \'claude-auth\')', () => {
    expect(AUTH_EPISODE_KEY).toBe(episodeKey('claude-auth-expired', 'claude-auth'));
  });
});

describe('readOpenAuthEpisode', () => {
  it('returns the episode when status is open', () => {
    const root = withHealthState({ [AUTH_EPISODE_KEY]: { status: 'open', subject: 'claude-auth' } });
    try {
      expect(readOpenAuthEpisode({ stateRoot: root })).toEqual({ status: 'open', subject: 'claude-auth' });
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it('returns the episode when status is flapping', () => {
    const root = withHealthState({ [AUTH_EPISODE_KEY]: { status: 'flapping' } });
    try {
      expect(readOpenAuthEpisode({ stateRoot: root })).not.toBeNull();
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it('null when no such episode exists', () => {
    const root = withHealthState({});
    try { expect(readOpenAuthEpisode({ stateRoot: root })).toBeNull(); }
    finally { rmSync(root, { recursive: true, force: true }); }
  });

  it('null when the health store has never ticked (missing file) — never throws', () => {
    const root = mkdtempSync(join(tmpdir(), 'claude-auth-health-empty-'));
    try { expect(readOpenAuthEpisode({ stateRoot: root })).toBeNull(); }
    finally { rmSync(root, { recursive: true, force: true }); }
  });

  it('null once the episode has closed (closed episodes are removed from `episodes` by stepEpisodes itself, but a stale pending/closed row must not count either)', () => {
    const root = withHealthState({ [AUTH_EPISODE_KEY]: { status: 'pending' } });
    try { expect(readOpenAuthEpisode({ stateRoot: root })).toBeNull(); }
    finally { rmSync(root, { recursive: true, force: true }); }
  });
});

const bg = (overrides) => ({ kind: 'background', cwd: '/repo', sessionId: 's-1', startedAt: 0, ...overrides });

describe('directRecentAuthExpired', () => {
  it('broken when the single most recent dispatched session is auth-expired (n=1 default — the FIRST failure is enough)', () => {
    const now = 1_000_000;
    const agents = [bg({ sessionId: 'old', startedAt: now - 60_000 }), bg({ sessionId: 'new', startedAt: now - 1_000 })];
    const readInfo = (a) => ({ authExpired: a.sessionId === 'new' });
    expect(directRecentAuthExpired(agents, { readInfo, now })).toEqual({ broken: true, checked: 1 });
  });

  it('not broken when the most recent session is healthy, even if an older one failed', () => {
    const now = 1_000_000;
    const agents = [bg({ sessionId: 'old', startedAt: now - 60_000 }), bg({ sessionId: 'new', startedAt: now - 1_000 })];
    const readInfo = (a) => ({ authExpired: a.sessionId === 'old' });
    expect(directRecentAuthExpired(agents, { readInfo, now })).toEqual({ broken: false, checked: 1 });
  });

  it('ignores non-background rows and rows missing cwd/sessionId', () => {
    const now = 1_000_000;
    const agents = [
      { kind: 'interactive', cwd: '/repo', sessionId: 'x', startedAt: now },
      { kind: 'background', cwd: '/repo', startedAt: now }, // no sessionId
      bg({ sessionId: 'ok', startedAt: now - 500 }),
    ];
    const readInfo = () => ({ authExpired: false });
    expect(directRecentAuthExpired(agents, { readInfo, now })).toEqual({ broken: false, checked: 1 });
  });

  it('ignores sessions older than maxAgeMs — a quiet host does not read stale history as live breakage', () => {
    const now = 1_000_000;
    const agents = [bg({ startedAt: now - 200 * 60_000 })]; // 200 min ago
    const readInfo = () => ({ authExpired: true });
    expect(directRecentAuthExpired(agents, { readInfo, now, maxAgeMs: 90 * 60_000 })).toEqual({ broken: false, checked: 0 });
  });

  it('no dispatched sessions at all → not broken, checked 0', () => {
    expect(directRecentAuthExpired([], { readInfo: () => ({ authExpired: true }) })).toEqual({ broken: false, checked: 0 });
  });

  it('a reader throw is treated as "not auth-expired" for that row, never guessed as broken', () => {
    const now = 1_000_000;
    const agents = [bg({ startedAt: now - 100 })];
    const readInfo = () => { throw new Error('boom'); };
    expect(directRecentAuthExpired(agents, { readInfo, now })).toEqual({ broken: false, checked: 1 });
  });

  it('n=2 requires BOTH of the two most recent to be auth-expired', () => {
    const now = 1_000_000;
    const agents = [bg({ sessionId: 'a', startedAt: now - 100 }), bg({ sessionId: 'b', startedAt: now - 200 })];
    const readInfo = (a) => ({ authExpired: a.sessionId === 'a' }); // only one of the two
    expect(directRecentAuthExpired(agents, { readInfo, now, n: 2 })).toEqual({ broken: false, checked: 2 });
  });
});

describe('readClaudeAuthHealth', () => {
  it('an open health-episode wins even when the direct scan alone would say healthy', () => {
    const root = withHealthState({ [AUTH_EPISODE_KEY]: { status: 'open' } });
    try {
      const out = readClaudeAuthHealth({
        stateRoot: root, agents: [bg({ startedAt: Date.now() })],
      });
      expect(out.broken).toBe(true);
      expect(out.source).toBe('health-episode');
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it('falls back to the direct scan when no episode is open', () => {
    const root = withHealthState({});
    const now = Date.now();
    try {
      const agents = [bg({ startedAt: now - 1_000 })];
      const out = readClaudeAuthHealth({ stateRoot: root, agents, now });
      // default readInfo (readClaudeAuthExpiredInfo) can't resolve a real transcript for this fake row, so it
      // reads no-signal/false — proving the FALLBACK PATH is reached (source is direct-scan, not health-episode)
      // without needing a real transcript on disk.
      expect(out.source).toBe('direct-scan');
      expect(out.broken).toBe(false);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it('no-signal when neither source has anything to say', () => {
    const root = withHealthState({});
    try {
      expect(readClaudeAuthHealth({ stateRoot: root, agents: [] })).toEqual({ broken: false, source: 'no-signal' });
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});

describe('probeClaudeLoggedIn', () => {
  it('true when the CLI reports loggedIn:true', () => {
    expect(probeClaudeLoggedIn({ exec: () => JSON.stringify({ loggedIn: true }) })).toBe(true);
  });
  it('false when the CLI reports loggedIn:false', () => {
    expect(probeClaudeLoggedIn({ exec: () => JSON.stringify({ loggedIn: false }) })).toBe(false);
  });
  it('fails CLOSED (false) on a spawn error — never guesses logged-in', () => {
    expect(probeClaudeLoggedIn({ exec: () => { throw new Error('ENOENT'); } })).toBe(false);
  });
  it('fails CLOSED (false) on unparsable output', () => {
    expect(probeClaudeLoggedIn({ exec: () => 'not json' })).toBe(false);
  });
});

describe('decideClaudeAuthDispatchGate — the pure truth table', () => {
  it('not broken → never paused, whatever the probe says', () => {
    expect(decideClaudeAuthDispatchGate({ broken: false }, false)).toEqual({ paused: false, reason: null });
    expect(decideClaudeAuthDispatchGate({ broken: false }, true)).toEqual({ paused: false, reason: null });
  });
  it('broken + probe not logged in → paused, with the exact required log message', () => {
    expect(decideClaudeAuthDispatchGate({ broken: true }, false)).toEqual({ paused: true, reason: AUTH_PAUSE_LOG_MESSAGE });
  });
  it('broken + probe logged in → NOT paused this tick (the next real dispatch is itself the confirmation)', () => {
    expect(decideClaudeAuthDispatchGate({ broken: true }, true)).toEqual({ paused: false, reason: null });
  });
});

describe('planClaudeAuthDispatchGate — the IO shell wiring', () => {
  it('a clean health read never even calls the probe', () => {
    let probeCalled = false;
    const out = planClaudeAuthDispatchGate({
      listAgents: () => [],
      health: () => ({ broken: false, source: 'no-signal' }),
      probe: () => { probeCalled = true; return true; },
    });
    expect(out).toEqual({ paused: false, reason: null, source: 'no-signal' });
    expect(probeCalled).toBe(false);
  });

  it('a broken health read consults the probe and pauses when it fails', () => {
    const out = planClaudeAuthDispatchGate({
      listAgents: () => [],
      health: () => ({ broken: true, source: 'direct-scan' }),
      probe: () => false,
    });
    expect(out).toEqual({ paused: true, reason: AUTH_PAUSE_LOG_MESSAGE, source: 'direct-scan' });
  });

  it('a broken health read that the probe says has recovered is not paused', () => {
    const out = planClaudeAuthDispatchGate({
      listAgents: () => [],
      health: () => ({ broken: true, source: 'health-episode' }),
      probe: () => true,
    });
    expect(out).toEqual({ paused: false, reason: null, source: 'health-episode' });
  });

  it('a listAgents throw never crashes the gate — reads as an empty listing', () => {
    const out = planClaudeAuthDispatchGate({
      listAgents: () => { throw new Error('spawn ENOENT'); },
      health: (o) => ({ broken: Array.isArray(o.agents) && o.agents.length > 0, source: 'direct-scan' }),
      probe: () => false,
    });
    expect(out.paused).toBe(false); // health saw an empty (never undefined/throwing) agents array
  });
});
