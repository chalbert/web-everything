/**
 * @file scripts/conveyor/__tests__/canary-stages.test.mjs
 * @description x0nxuqd — unit proof of the real end-to-end dispatch canary's PURE stage evaluator
 *   (`we:scripts/conveyor/canary-stages.mjs`). Every case is a constructed fixture transcript, no real
 *   `claude --bg` spawn, no network, no filesystem — exactly the seam the prototype-based-dev doctrine
 *   (`we:docs/agent/prototype-based-dev.md`) says a live-only tool still needs a testable pure core for.
 *
 *   The headline fixture (`'permission-prompt stall'` below) is the whole reason this canary exists: a
 *   `we:scripts/conveyor/soak/*.soak.test.mjs` FAKE session can never reproduce PR #2701's real regression
 *   (a dispatched session's own edit into its lane clone hangs on an unanswered permission prompt because the
 *   session's cwd is now a scratch directory outside every trusted checkout) — this suite proves the evaluator
 *   correctly reads that exact transcript shape as a `no-permission-prompt` FAIL, red before the fix landed and
 *   green after (see the "red -> green" pair below).
 */
import { describe, it, expect } from 'vitest';
import {
  evaluateCanaryStages, detectPermissionPromptStall, CANARY_STAGES,
  DEFAULT_PERMISSION_PROMPT_GRACE_MS, LANE_ACQUIRED_RE, GATE_GREEN_RE,
} from '../canary-stages.mjs';

const NOW = 2_000_000_000;

/** Build a `summarizeEntry`-shaped assistant entry carrying one `tool_use` block. */
function toolUse(id, name, ts) {
  return { kind: 'assistant', ts, blocks: [{ kind: 'tool_use', id, name, input: '{}' }] };
}
/** Build a `summarizeEntry`-shaped user entry carrying one `tool_result` block. */
function toolResult(toolUseId, ts, { isError = false, content = 'ok' } = {}) {
  return { kind: 'user', ts, blocks: [{ kind: 'tool_result', toolUseId, isError, content }] };
}

describe('detectPermissionPromptStall — PURE core', () => {
  it('no entries -> not stalled', () => {
    expect(detectPermissionPromptStall({ entries: [], nowMs: NOW, newestEntryAtMs: null }))
      .toEqual({ stalled: false, toolName: null, ageMs: null });
  });

  it('a pending Edit call younger than the grace window is NOT yet a stall (still just latency)', () => {
    const entries = [toolUse('t1', 'Edit', NOW - 1000)];
    const r = detectPermissionPromptStall({ entries, nowMs: NOW, newestEntryAtMs: NOW - 1000, graceMs: DEFAULT_PERMISSION_PROMPT_GRACE_MS });
    expect(r.stalled).toBe(false);
  });

  it('RED: a pending Edit call older than the grace window IS a permission-prompt stall (#2701 shape)', () => {
    const stalledSince = NOW - (DEFAULT_PERMISSION_PROMPT_GRACE_MS + 5000);
    const entries = [toolUse('t1', 'Edit', stalledSince)];
    const r = detectPermissionPromptStall({ entries, nowMs: NOW, newestEntryAtMs: stalledSince, graceMs: DEFAULT_PERMISSION_PROMPT_GRACE_MS });
    expect(r).toEqual({ stalled: true, toolName: 'Edit', ageMs: DEFAULT_PERMISSION_PROMPT_GRACE_MS + 5000 });
  });

  it('GREEN: the same pending Edit call, once RESOLVED, is never a stall regardless of age', () => {
    const oldTs = NOW - (DEFAULT_PERMISSION_PROMPT_GRACE_MS + 5000);
    const entries = [toolUse('t1', 'Edit', oldTs), toolResult('t1', NOW - 1000)];
    const r = detectPermissionPromptStall({ entries, nowMs: NOW, newestEntryAtMs: NOW - 1000, graceMs: DEFAULT_PERMISSION_PROMPT_GRACE_MS });
    expect(r.stalled).toBe(false);
  });

  it('a pending Read (not a file-mutating tool) is never read as a permission-prompt stall', () => {
    const oldTs = NOW - (DEFAULT_PERMISSION_PROMPT_GRACE_MS + 5000);
    const entries = [toolUse('t1', 'Read', oldTs)];
    const r = detectPermissionPromptStall({ entries, nowMs: NOW, newestEntryAtMs: oldTs, graceMs: DEFAULT_PERMISSION_PROMPT_GRACE_MS });
    expect(r.stalled).toBe(false);
  });

  it('no newest-entry timestamp available -> never guesses a stall', () => {
    expect(detectPermissionPromptStall({ entries: [toolUse('t1', 'Edit', null)], nowMs: NOW, newestEntryAtMs: null }).stalled).toBe(false);
  });
});

describe('evaluateCanaryStages — spawn failure short-circuits every later stage', () => {
  it('spawned:false fails every stage, never leaves one pending', () => {
    const { stages, overall } = evaluateCanaryStages({ spawned: false, nowMs: NOW });
    expect(overall).toBe('fail');
    expect(stages.map((s) => s.name)).toEqual(CANARY_STAGES);
    expect(stages.every((s) => s.status === 'fail')).toBe(true);
  });
});

describe('evaluateCanaryStages — the permission-prompt regression, red then green (PR #2701)', () => {
  const laneAcquireResult = [toolUse('t-acq', 'Bash', NOW - 200_000), toolResult('t-acq', NOW - 199_000, { content: 'acquired lane-49 for Mac:1234 (canary)' })];

  it('RED — pre-fix transcript: lane acquired, then the very next Edit hangs past the grace window with no answer', () => {
    const stalledSince = NOW - (DEFAULT_PERMISSION_PROMPT_GRACE_MS + 10_000);
    const entries = [...laneAcquireResult, toolUse('t-edit', 'Edit', stalledSince)];
    const { stages, overall } = evaluateCanaryStages({
      spawned: true, entries, nowMs: NOW, newestEntryAtMs: stalledSince,
      laneAcquiredGroundTruth: true, sessionFinished: null,
    });
    const byName = Object.fromEntries(stages.map((s) => [s.name, s]));
    expect(byName['lane-acquired'].status).toBe('pass');
    expect(byName['no-permission-prompt'].status).toBe('fail');
    expect(byName['no-permission-prompt'].detail).toMatch(/Edit/);
    expect(byName['edit-ok'].status).not.toBe('pass'); // never resolved — pending or fail, but not a false pass
    expect(overall).toBe('fail');
  });

  it('GREEN — post-fix transcript: the same Edit resolves cleanly, gate runs green, branch pushed, session finished, cleaned up', () => {
    const entries = [
      ...laneAcquireResult,
      toolUse('t-edit', 'Edit', NOW - 100_000),
      toolResult('t-edit', NOW - 99_000, { content: 'File created successfully' }),
      toolUse('t-gate', 'Bash', NOW - 80_000),
      toolResult('t-gate', NOW - 79_000, { content: '{"sha":"abc","status":"green","ok":true}' }),
      toolUse('t-push', 'Bash', NOW - 60_000),
      toolResult('t-push', NOW - 59_000, { content: 'pushed to canary/123' }),
    ];
    const { stages, overall } = evaluateCanaryStages({
      spawned: true, entries, nowMs: NOW, newestEntryAtMs: NOW - 59_000,
      laneAcquiredGroundTruth: true, pushedGroundTruth: true, sessionFinished: true,
      cleanup: { laneReleased: true, branchDeleted: true, scratchReaped: true },
    });
    expect(stages.map((s) => s.status)).toEqual(Array(CANARY_STAGES.length).fill('pass'));
    expect(overall).toBe('pass');
  });
});

describe('evaluateCanaryStages — mid-run stages read PENDING, not a premature pass/fail', () => {
  it('a fresh dispatch with no evidence yet is pending everywhere but "spawned", and never fails before its bounded timeout', () => {
    const { stages, overall } = evaluateCanaryStages({ spawned: true, entries: [], nowMs: NOW, timedOut: false });
    const byName = Object.fromEntries(stages.map((s) => [s.name, s]));
    expect(byName.spawned.status).toBe('pass');
    for (const name of CANARY_STAGES.slice(1)) expect(byName[name].status).toBe('pending');
    expect(overall).toBe('pending');
  });

  it('the same empty-evidence run, once the canary\'s own bounded watch times out, fails every still-undecided stage', () => {
    const { stages, overall } = evaluateCanaryStages({ spawned: true, entries: [], nowMs: NOW, timedOut: true });
    const byName = Object.fromEntries(stages.map((s) => [s.name, s]));
    expect(byName.spawned.status).toBe('pass');
    for (const name of CANARY_STAGES.slice(1)) expect(byName[name].status).toBe('fail');
    expect(overall).toBe('fail');
  });
});

describe('evaluateCanaryStages — cleaned-up only ever passes once every one of the three facts is true', () => {
  it('one leaked fact (e.g. the scratch folder) fails cleaned-up even though the session finished fine', () => {
    const { stages } = evaluateCanaryStages({
      spawned: true, entries: [], nowMs: NOW, sessionFinished: true, timedOut: true,
      cleanup: { laneReleased: true, branchDeleted: true, scratchReaped: false },
    });
    const cleaned = stages.find((s) => s.name === 'cleaned-up');
    expect(cleaned.status).toBe('fail');
    expect(cleaned.detail).toMatch(/scratchReaped/);
  });

  it('REGRESSION (caught live on this canary\'s own first real run): a still-ALIVE session never reads as cleaned-up, even when every cleanup fact is vacuously true (nothing was ever acquired/pushed to begin with)', () => {
    // The live shape: the spawned session stalled on an unanswered permission prompt (#2701) and was still a
    // real, running process when the canary's own bounded watch gave up. Nothing was ever acquired or pushed,
    // so a naive "were all three facts true?" check reads this as cleaned-up:pass — which a first cut of this
    // evaluator actually did, because it checked `allTrue` BEFORE `!finished`. `!finished` must win.
    const { stages, overall } = evaluateCanaryStages({
      spawned: true, entries: [], nowMs: NOW, sessionFinished: false, timedOut: true,
      cleanup: { laneReleased: true, branchDeleted: true, scratchReaped: null }, // scratch deliberately left alone
    });
    const byName = Object.fromEntries(stages.map((s) => [s.name, s]));
    expect(byName['session-finished'].status).toBe('fail');
    expect(byName['cleaned-up'].status).toBe('fail');
    expect(byName['cleaned-up'].detail).toMatch(/not yet finished/);
    expect(overall).toBe('fail');
  });
});

describe('regex fixtures used by the evaluator stay honest about what they match', () => {
  it('LANE_ACQUIRED_RE matches real lane-pool.mjs stdout', () => {
    expect(LANE_ACQUIRED_RE.test('acquired lane-49 for Mac:50622 (canary-file-4075) → /path')).toBe(true);
    expect(LANE_ACQUIRED_RE.test('no free lane in pool "we"')).toBe(false);
  });

  it('GATE_GREEN_RE matches a verify-lane check --json green read', () => {
    expect(GATE_GREEN_RE.test('{"sha":"x","status":"green","ok":true}')).toBe(true);
    expect(GATE_GREEN_RE.test('{"sha":"x","status":"red","ok":false}')).toBe(false);
  });
});
