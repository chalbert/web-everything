/**
 * @file scripts/conveyor/__tests__/hung-session.test.mjs
 * @description Unit proof of the shared hung-transcript detector (epic #3383 continuation, live 2026-09-24):
 *   the PURE classifier ({@link classifyHungSession}), the env-driven threshold resolver
 *   ({@link resolveHungThresholdMs}), and the IO shell ({@link readHungInfo}) against a REAL temp
 *   `~/.claude/projects/<slug>/<sessionId>.jsonl`-shaped fixture (no network, no real home dir — the
 *   store root is stubbed via `CLAUDE_PROJECTS_DIR`, the same knob `agent-health.mjs`'s own tests use).
 *   This is the ONE implementation `reconcile-core.mjs#markHungSessions` and `session-reaper.mjs`'s hung
 *   axis both import — see either file's docblock for why a shared module matters here.
 *
 *   `readHungInfo`'s tests drive staleness through the TRANSCRIPT'S OWN embedded entry `timestamp`, not
 *   `utimesSync` on the file's mtime — measured live (chalbert/web-everything `review-2599`, 2026-09-24) that
 *   this environment can bump a transcript's mtime with no new content, so mtime-only staleness would have
 *   been the wrong signal to pin here. One dedicated case proves the mtime FALLBACK path directly.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { classifyHungSession, resolveHungThresholdMs, DEFAULT_HUNG_THRESHOLD_MS, PENDING_CALL_GRACE_MULTIPLIER } from '../hung-session.mjs';
import {
  NO_OUTCOME_KINDS, resolveNoOutcomeWindowMs, resolveNoOutcomeCeilingMs, classifyNoOutcomeStall, OUTCOME_UNREADABLE,
} from '../hung-session.mjs';
import { DEFAULT_LEASE_TTL_MINUTES } from '../../lib/lane-lease.mjs';

describe('classifyHungSession — PURE core', () => {
  const NOW = 1_000_000_000;
  const THRESHOLD = 30 * 60_000;

  it('fresh transcript (age < threshold) is never hung, pending or not', () => {
    expect(classifyHungSession({ lastActivityMs: NOW - 1, nowMs: NOW, thresholdMs: THRESHOLD }))
      .toEqual({ hung: false, reason: 'fresh', ageMs: 1 });
    expect(classifyHungSession({ lastActivityMs: NOW - (THRESHOLD - 1), nowMs: NOW, thresholdMs: THRESHOLD, pendingToolUse: true }))
      .toEqual({ hung: false, reason: 'fresh', ageMs: THRESHOLD - 1 });
  });

  it('stale with NOTHING pending → hung at once, right at the threshold', () => {
    const ageMs = THRESHOLD;
    expect(classifyHungSession({ lastActivityMs: NOW - ageMs, nowMs: NOW, thresholdMs: THRESHOLD }))
      .toEqual({ hung: true, reason: 'stale-no-activity', ageMs });
  });

  it('stale WITH a pending tool_use gets extra grace — not hung until PENDING_CALL_GRACE_MULTIPLIER x threshold', () => {
    const withinGrace = THRESHOLD * PENDING_CALL_GRACE_MULTIPLIER - 1;
    expect(classifyHungSession({ lastActivityMs: NOW - withinGrace, nowMs: NOW, thresholdMs: THRESHOLD, pendingToolUse: true }))
      .toEqual({ hung: false, reason: 'pending-foreground-call-within-grace', ageMs: withinGrace });
  });

  it('stale WITH a pending tool_use PAST the grace multiplier is hung too — conservative, not infinite', () => {
    const pastGrace = THRESHOLD * PENDING_CALL_GRACE_MULTIPLIER;
    expect(classifyHungSession({ lastActivityMs: NOW - pastGrace, nowMs: NOW, thresholdMs: THRESHOLD, pendingToolUse: true }))
      .toEqual({ hung: true, reason: 'stale-with-pending-call-past-grace', ageMs: pastGrace });
  });

  it('any non-finite/invalid input answers no-signal, never a guess', () => {
    expect(classifyHungSession({})).toEqual({ hung: false, reason: 'no-signal', ageMs: null });
    expect(classifyHungSession({ lastActivityMs: NaN, nowMs: NOW, thresholdMs: THRESHOLD })).toEqual({ hung: false, reason: 'no-signal', ageMs: null });
    expect(classifyHungSession({ lastActivityMs: NOW, nowMs: NOW, thresholdMs: 0 })).toEqual({ hung: false, reason: 'no-signal', ageMs: null });
    expect(classifyHungSession({ lastActivityMs: NOW, nowMs: NOW, thresholdMs: -1 })).toEqual({ hung: false, reason: 'no-signal', ageMs: null });
  });
});

describe('resolveHungThresholdMs — WE_HUNG_TRANSCRIPT_MINUTES, IO shell only', () => {
  it('defaults to 30 minutes when unset/empty', () => {
    expect(resolveHungThresholdMs({})).toBe(DEFAULT_HUNG_THRESHOLD_MS);
    expect(resolveHungThresholdMs({ WE_HUNG_TRANSCRIPT_MINUTES: '' })).toBe(DEFAULT_HUNG_THRESHOLD_MS);
  });
  it('reads a valid override in minutes', () => {
    expect(resolveHungThresholdMs({ WE_HUNG_TRANSCRIPT_MINUTES: '10' })).toBe(10 * 60_000);
  });
  it('falls back to the default on garbage, and floor-clamps a sub-1-minute value rather than disabling the axis', () => {
    expect(resolveHungThresholdMs({ WE_HUNG_TRANSCRIPT_MINUTES: 'not-a-number' })).toBe(DEFAULT_HUNG_THRESHOLD_MS);
    expect(resolveHungThresholdMs({ WE_HUNG_TRANSCRIPT_MINUTES: '0' })).toBe(DEFAULT_HUNG_THRESHOLD_MS);
    expect(resolveHungThresholdMs({ WE_HUNG_TRANSCRIPT_MINUTES: '-5' })).toBe(DEFAULT_HUNG_THRESHOLD_MS);
    expect(resolveHungThresholdMs({ WE_HUNG_TRANSCRIPT_MINUTES: '0.2' })).toBe(60_000); // clamped up to 1 minute
  });
});

// #4090 (epic #3383/#4075, statute `#conveyor-session-lifecycle-policy` clause 2) — the no-net-outcome axis.
describe('NO_OUTCOME_KINDS — names exactly the statute\'s four kinds (prepare-decision mirrors prepare)', () => {
  it('covers conveyor/fix/review/prepare/prepare-decision, never ci-heal/inspect', () => {
    expect([...NO_OUTCOME_KINDS].sort()).toEqual(['conveyor', 'fix', 'prepare', 'prepare-decision', 'review']);
  });
});

describe('resolveNoOutcomeWindowMs / resolveNoOutcomeCeilingMs — the per-kind settings', () => {
  it('default fallback minutes match the statute\'s own stated defaults', () => {
    expect(resolveNoOutcomeWindowMs('conveyor', {})).toBe(45 * 60_000);
    expect(resolveNoOutcomeCeilingMs('conveyor', {})).toBe(240 * 60_000);
    expect(resolveNoOutcomeWindowMs('fix', {})).toBe(30 * 60_000);
    expect(resolveNoOutcomeCeilingMs('fix', {})).toBe(120 * 60_000);
    expect(resolveNoOutcomeWindowMs('review', {})).toBe(30 * 60_000);
    expect(resolveNoOutcomeCeilingMs('review', {})).toBe(60 * 60_000);
    expect(resolveNoOutcomeWindowMs('prepare', {})).toBe(45 * 60_000);
    expect(resolveNoOutcomeCeilingMs('prepare', {})).toBe(180 * 60_000);
    expect(resolveNoOutcomeWindowMs('prepare-decision', {})).toBe(45 * 60_000);
    expect(resolveNoOutcomeCeilingMs('prepare-decision', {})).toBe(180 * 60_000);
  });

  it('null for a kind the statute never named — never a guessed window/ceiling', () => {
    expect(resolveNoOutcomeWindowMs('ci-heal', {})).toBeNull();
    expect(resolveNoOutcomeCeilingMs('inspect', {})).toBeNull();
  });

  it('env override, per kind, named WE_NO_OUTCOME_<KIND>_WINDOW_MIN / _CEILING_MIN', () => {
    expect(resolveNoOutcomeWindowMs('review', { WE_NO_OUTCOME_REVIEW_WINDOW_MIN: '15' })).toBe(15 * 60_000);
    expect(resolveNoOutcomeCeilingMs('fix', { WE_NO_OUTCOME_FIX_CEILING_MIN: '90' })).toBe(90 * 60_000);
    expect(resolveNoOutcomeWindowMs('prepare-decision', { WE_NO_OUTCOME_PREPARE_DECISION_WINDOW_MIN: '20' })).toBe(20 * 60_000);
  });

  it('an unparsable/non-positive override falls back to the default, never disables the axis', () => {
    expect(resolveNoOutcomeWindowMs('review', { WE_NO_OUTCOME_REVIEW_WINDOW_MIN: 'nope' })).toBe(30 * 60_000);
    expect(resolveNoOutcomeCeilingMs('review', { WE_NO_OUTCOME_REVIEW_CEILING_MIN: '0' })).toBe(60 * 60_000);
    expect(resolveNoOutcomeCeilingMs('review', { WE_NO_OUTCOME_REVIEW_CEILING_MIN: '-5' })).toBe(60 * 60_000);
  });

  it('the ceiling NEVER exceeds the lane lease TTL, even if an operator configures a larger one (statute)', () => {
    expect(DEFAULT_LEASE_TTL_MINUTES).toBe(240);
    expect(resolveNoOutcomeCeilingMs('conveyor', { WE_NO_OUTCOME_CONVEYOR_CEILING_MIN: '9999' })).toBe(DEFAULT_LEASE_TTL_MINUTES * 60_000);
    expect(resolveNoOutcomeCeilingMs('review', { WE_NO_OUTCOME_REVIEW_CEILING_MIN: '500' })).toBe(DEFAULT_LEASE_TTL_MINUTES * 60_000);
  });
});

describe('classifyNoOutcomeStall — PURE, the two-trigger verdict (window vs ceiling)', () => {
  const T0 = 1_000_000;
  it('active when neither the window nor the ceiling has elapsed', () => {
    expect(classifyNoOutcomeStall({ startedAtMs: T0, lastOutcomeAtMs: T0 + 1000, nowMs: T0 + 2000, windowMs: 10_000, ceilingMs: 100_000 }))
      .toEqual({ stall: false, reason: 'active' });
  });
  it('stalls on the WINDOW once no outcome has landed for windowMs, measured from the LAST outcome', () => {
    expect(classifyNoOutcomeStall({ startedAtMs: T0, lastOutcomeAtMs: T0 + 5000, nowMs: T0 + 5000 + 10_000, windowMs: 10_000, ceilingMs: 999_999 }))
      .toEqual({ stall: true, reason: 'no-outcome-window' });
  });
  it('with NO outcome ever, the window is measured from startedAtMs, never treated as automatically fresh', () => {
    expect(classifyNoOutcomeStall({ startedAtMs: T0, lastOutcomeAtMs: null, nowMs: T0 + 10_000, windowMs: 10_000, ceilingMs: 999_999 }))
      .toEqual({ stall: true, reason: 'no-outcome-window' });
  });
  it('the CEILING wins even while outcomes keep landing inside the window — an absolute cap', () => {
    expect(classifyNoOutcomeStall({ startedAtMs: T0, lastOutcomeAtMs: T0 + 99_000, nowMs: T0 + 100_000, windowMs: 10_000, ceilingMs: 100_000 }))
      .toEqual({ stall: true, reason: 'ceiling' });
  });
  it('windowMs/ceilingMs of null (an uncovered kind) disables that trigger, never a guess', () => {
    expect(classifyNoOutcomeStall({ startedAtMs: T0, lastOutcomeAtMs: null, nowMs: T0 + 999_999_999, windowMs: null, ceilingMs: null }))
      .toEqual({ stall: false, reason: 'active' });
  });
  it('no-signal when startedAtMs/nowMs are not finite numbers — never a guess', () => {
    expect(classifyNoOutcomeStall({ startedAtMs: null, nowMs: T0, windowMs: 1, ceilingMs: 1 })).toEqual({ stall: false, reason: 'no-signal' });
    expect(classifyNoOutcomeStall({ startedAtMs: T0, nowMs: undefined, windowMs: 1, ceilingMs: 1 })).toEqual({ stall: false, reason: 'no-signal' });
  });
  it('historical outcomes grant a new session its full window — an outcome OLDER than startedAtMs clamps to the start', () => {
    // PR #2676 review: a fix session dispatched onto a lane whose build commit is 3h old, 5 min into its own run.
    const MIN = 60_000;
    const o = { startedAtMs: T0, lastOutcomeAtMs: T0 - 180 * MIN, windowMs: 30 * MIN, ceilingMs: 120 * MIN };
    expect(classifyNoOutcomeStall({ ...o, nowMs: T0 + 5 * MIN })).toEqual({ stall: false, reason: 'active' });
    // …and the window still runs from its OWN start, so it stalls once that elapses with nothing new.
    expect(classifyNoOutcomeStall({ ...o, nowMs: T0 + 30 * MIN })).toEqual({ stall: true, reason: 'no-outcome-window' });
  });
  it('an UNREADABLE outcome source never authorizes a WINDOW stop — only the ceiling can stop on it', () => {
    const o = { startedAtMs: T0, lastOutcomeAtMs: OUTCOME_UNREADABLE, windowMs: 10_000, ceilingMs: 100_000 };
    expect(classifyNoOutcomeStall({ ...o, nowMs: T0 + 50_000 })).toEqual({ stall: false, reason: 'no-signal' });
    expect(classifyNoOutcomeStall({ ...o, nowMs: T0 + 100_000 })).toEqual({ stall: true, reason: 'ceiling' });
  });
});

function entryLine(type, ts, content) {
  return JSON.stringify({ type, timestamp: ts, message: { role: type, content } });
}

describe('readHungInfo — the IO shell, against a REAL temp project store', () => {
  let root, projects, cwd, sessionId, transcriptFile, readHungInfo;

  beforeEach(async () => {
    root = mkdtempSync(join(tmpdir(), 'hung-session-test-'));
    projects = join(root, 'projects');
    cwd = '/Users/fixture/workspace/lane-9';
    sessionId = 'sess-fixture-0001';
    const slug = cwd.replaceAll('/', '-');
    mkdirSync(join(projects, slug), { recursive: true });
    transcriptFile = join(projects, slug, `${sessionId}.jsonl`);
    vi.stubEnv('CLAUDE_PROJECTS_DIR', projects);
    vi.resetModules();
    ({ readHungInfo } = await import('../hung-session.mjs'));
  });
  afterEach(() => { vi.unstubAllEnvs(); rmSync(root, { recursive: true, force: true }); });

  it('a transcript whose newest EMBEDDED entry timestamp is recent is not hung', () => {
    const now = Date.now();
    writeFileSync(transcriptFile, entryLine('assistant', new Date(now - 30_000).toISOString(), [{ type: 'text', text: 'ok' }]) + '\n');
    const info = readHungInfo({ cwd, sessionId }, now, 30 * 60_000);
    expect(info.hung).toBe(false);
    expect(info.reason).toBe('fresh');
    expect(info.transcriptPath).toBe(transcriptFile);
  });

  it('a transcript whose newest embedded entry timestamp is stale past the threshold, nothing pending, is hung', () => {
    const now = Date.now();
    const staleTs = new Date(now - 45 * 60_000).toISOString();
    writeFileSync(transcriptFile, entryLine('assistant', staleTs, [{ type: 'text', text: 'done for now' }]) + '\n');
    const info = readHungInfo({ cwd, sessionId }, now, 30 * 60_000);
    expect(info.hung).toBe(true);
    expect(info.reason).toBe('stale-no-activity');
  });

  it("IGNORES the file's mtime when the content itself is stale — the exact live false-negative this axis fixes", () => {
    // Measured live: a transcript's real last line was ~3h old while `fs.statSync` reported the file touched
    // minutes ago. Bump mtime to "now" but keep stale CONTENT — must still read as hung off the embedded ts.
    const now = Date.now();
    const staleTs = new Date(now - 3 * 60 * 60_000).toISOString();
    writeFileSync(transcriptFile, entryLine('assistant', staleTs, [{ type: 'text', text: 'login expired' }]) + '\n');
    utimesSync(transcriptFile, new Date(now), new Date(now)); // mtime bumped to "just now"
    const info = readHungInfo({ cwd, sessionId }, now, 30 * 60_000);
    expect(info.hung).toBe(true);
    expect(info.reason).toBe('stale-no-activity');
  });

  it('FALLS BACK to mtime only when nothing in the tail carries a parseable timestamp at all', () => {
    // No `timestamp` field anywhere in this line — the fallback path, and only the fallback path, applies.
    writeFileSync(transcriptFile, `${JSON.stringify({ type: 'permission-mode' })}\n`);
    const staleMs = Date.now() - 45 * 60_000;
    utimesSync(transcriptFile, new Date(staleMs), new Date(staleMs));
    const now = Date.now();
    const info = readHungInfo({ cwd, sessionId }, now, 30 * 60_000);
    expect(info.hung).toBe(true);
    expect(info.reason).toBe('stale-no-activity');
  });

  it('a stale transcript whose newest entry is a still-pending tool_use gets grace, not an immediate hung verdict', () => {
    const now = Date.now();
    const staleTs = new Date(now - 45 * 60_000).toISOString(); // past the 30-min threshold, within the 3x grace
    writeFileSync(transcriptFile, entryLine('assistant', staleTs, [{ type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'node scripts/verify-lane.mjs' } }]) + '\n');
    const info = readHungInfo({ cwd, sessionId }, now, 30 * 60_000);
    expect(info.hung).toBe(false);
    expect(info.reason).toBe('pending-foreground-call-within-grace');
  });

  it('missing cwd/sessionId on the row answers no-signal, never a guess', () => {
    expect(readHungInfo({}, Date.now(), 30 * 60_000)).toEqual({ hung: false, reason: 'no-signal', ageMs: null });
    expect(readHungInfo({ cwd }, Date.now(), 30 * 60_000)).toEqual({ hung: false, reason: 'no-signal', ageMs: null });
  });

  it('a session id with no transcript on disk answers no-signal, never a guess', () => {
    const info = readHungInfo({ cwd, sessionId: 'no-such-session' }, Date.now(), 30 * 60_000);
    expect(info).toEqual({ hung: false, reason: 'no-signal', ageMs: null });
  });
});
