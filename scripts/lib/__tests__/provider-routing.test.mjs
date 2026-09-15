/**
 * @file provider-routing.test.mjs — unit tests for scripts/lib/provider-routing.mjs (#3690).
 *
 * Verifies:
 *   - Pure, deterministic execution (identical inputs -> deep-equal results).
 *   - Provider recommendation cascade: Gemini fit, Codex fit, Both (high-stakes & thin history),
 *     and Claude fallback at Haiku, Sonnet, and Opus tiers.
 *   - Statute-tier paths strictly force Claude Opus regardless of external model track record.
 *   - Supervision level backdown plan (#3690): clean streak counting, informative trial gating,
 *     calibration-miss hard veto on most recent record, and 'other'-verified skipping.
 */
import { describe, it, expect } from 'vitest';
import {
  selectProvider,
  selectSupervisionLevel,
  isStatuteTierPath,
  isHighStakesTask,
  isWithinProvenEnvelope,
  RECOMMENDATIONS,
  CLAUDE_TIERS,
  SUPERVISION_LEVELS,
  DEFAULT_BACKDOWN_THRESHOLDS,
  PROVEN_TASK_ENVELOPES,
} from '../provider-routing.mjs';

// ── Fixture Scorecard Helpers ──────────────────────────────────────────────────

function makeRecord({
  provider = 'codex',
  model = 'gpt-6-astra',
  taskType = 'bugfix',
  scoredAt = '2026-09-15T01:00:00.000Z',
  outcome = 'landed',
  verifiedBy = 'claude-subagent',
  findings = null,
  taskDescription = 'Test delegation task',
  pr = null,
  handle = null,
} = {}) {
  return {
    v: 1,
    provider,
    model,
    taskType,
    scoredAt,
    outcome,
    verifiedBy,
    findings,
    taskDescription,
    pr,
    handle,
    subjectClass: 'work-agent',
    dispatchKind: 'session-delegation',
  };
}

describe('provider-routing — constants and helpers', () => {
  it('freezes enum objects', () => {
    expect(Object.isFrozen(RECOMMENDATIONS)).toBe(true);
    expect(Object.isFrozen(CLAUDE_TIERS)).toBe(true);
    expect(Object.isFrozen(SUPERVISION_LEVELS)).toBe(true);
    expect(Object.isFrozen(DEFAULT_BACKDOWN_THRESHOLDS)).toBe(true);
    expect(Object.isFrozen(PROVEN_TASK_ENVELOPES)).toBe(true);
  });

  describe('isStatuteTierPath', () => {
    it('identifies platform-decisions.md as statute-tier', () => {
      expect(isStatuteTierPath('docs/agent/platform-decisions.md')).toBe(true);
      expect(isStatuteTierPath('./docs/agent/platform-decisions.md')).toBe(true);
      expect(isStatuteTierPath('/docs/agent/platform-decisions.md')).toBe(true);
    });

    it('identifies any path under docs/agent/ as statute-tier', () => {
      expect(isStatuteTierPath('docs/agent/conventions.md')).toBe(true);
      expect(isStatuteTierPath('docs/agent/statute-additions.md')).toBe(true);
      expect(isStatuteTierPath('docs/agent/testing.md')).toBe(true);
    });

    it('returns false for non-statute paths', () => {
      expect(isStatuteTierPath('scripts/lib/provider-routing.mjs')).toBe(false);
      expect(isStatuteTierPath('src/index.njk')).toBe(false);
      expect(isStatuteTierPath('README.md')).toBe(false);
      expect(isStatuteTierPath('')).toBe(false);
      expect(isStatuteTierPath(null)).toBe(false);
    });
  });

  describe('isWithinProvenEnvelope', () => {
    it('accepts doc-fix within 100 LOC and 2 files', () => {
      expect(isWithinProvenEnvelope('doc-fix', 50, 1)).toBe(true);
      expect(isWithinProvenEnvelope('doc-fix', 100, 2)).toBe(true);
      expect(isWithinProvenEnvelope('doc-fix', 150, 1)).toBe(false);
      expect(isWithinProvenEnvelope('doc-fix', 50, 3)).toBe(false);
    });

    it('accepts bugfix within 250 LOC and 4 files', () => {
      expect(isWithinProvenEnvelope('bugfix', 200, 3)).toBe(true);
      expect(isWithinProvenEnvelope('bugfix', 250, 4)).toBe(true);
      expect(isWithinProvenEnvelope('bugfix', 260, 2)).toBe(false);
      expect(isWithinProvenEnvelope('bugfix', 100, 5)).toBe(false);
    });
  });

  describe('isHighStakesTask', () => {
    it('returns false if not bugfix or conflict-resolution', () => {
      expect(isHighStakesTask({ taskType: 'doc-fix' }, { filesTouched: ['scripts/lib/foo.test.mjs', 'scripts/conveyor/run.mjs'] })).toBe(false);
    });

    it('returns false if no test file is touched', () => {
      expect(isHighStakesTask({ taskType: 'bugfix' }, { filesTouched: ['scripts/conveyor/run.mjs'] })).toBe(false);
    });

    it('returns false if only test files are touched without critical subsystem or 3+ impl files', () => {
      expect(isHighStakesTask({ taskType: 'bugfix' }, { filesTouched: ['tests/foo.test.js'] })).toBe(false);
      expect(isHighStakesTask({ taskType: 'bugfix' }, { filesTouched: ['tests/foo.test.js', 'demos/foo.js'] })).toBe(false);
    });

    it('returns true if test file AND critical subsystem (e.g. scripts/conveyor/) are touched', () => {
      expect(isHighStakesTask(
        { taskType: 'bugfix' },
        { filesTouched: ['scripts/lib/__tests__/foo.test.mjs', 'scripts/conveyor/runner.mjs'] }
      )).toBe(true);
    });

    it('returns true if test file AND core blocks/plugs standards paths are touched', () => {
      expect(isHighStakesTask(
        { taskType: 'conflict-resolution' },
        { filesTouched: ['blocks/nav/nav.test.ts', 'blocks/nav/nav.ts'] }
      )).toBe(true);
    });

    it('returns true if test file AND 3+ implementation files are touched', () => {
      expect(isHighStakesTask(
        { taskType: 'bugfix' },
        { filesTouched: ['tests/app.spec.ts', 'demos/a.js', 'demos/b.js', 'demos/c.js'] }
      )).toBe(true);
    });
  });
});

describe('selectProvider — cascade branches', () => {
  it('determinism: produces byte-identical return values on identical inputs', () => {
    const task = { description: 'Fix parser bug', taskType: 'bugfix' };
    const context = {
      filesTouched: ['scripts/lib/parser.mjs'],
      estimatedSize: 80,
      scorecards: [
        makeRecord({ provider: 'gemini', model: 'gemini-3.1-pro', taskType: 'bugfix', findings: null }),
      ],
    };

    const res1 = selectProvider(task, context);
    const res2 = selectProvider(task, context);

    expect(res1).toEqual(res2);
    expect(JSON.stringify(res1)).toBe(JSON.stringify(res2));
  });

  // Branch 1: Gemini Fit
  it('branch 1: recommends gemini when gemini is fit with a clean verified track record', () => {
    const task = { description: 'Fix tokenizer regex', taskType: 'bugfix' };
    const scorecards = [
      makeRecord({
        provider: 'gemini',
        model: 'gemini-3.1-pro',
        taskType: 'bugfix',
        scoredAt: '2026-09-15T01:00:00.000Z',
        verifiedBy: 'claude-subagent',
        findings: null,
      }),
    ];
    const context = {
      filesTouched: ['scripts/lib/tokenizer.mjs'],
      estimatedSize: 45,
      scorecards,
    };

    const res = selectProvider(task, context);
    expect(res.recommendation).toBe(RECOMMENDATIONS.GEMINI);
    expect(res.claudeTier).toBeNull();
    expect(res.auditTrail[0].result).toBe('fit');
    expect(res.reasoning).toContain('Gemini is fit');
  });

  // Branch 2: Codex Fit
  it('branch 2: recommends codex when gemini is unfit but codex has a clean track record', () => {
    const task = { description: 'Fix buffer allocation', taskType: 'bugfix' };
    const scorecards = [
      // Gemini has an unverified trial (only 'other')
      makeRecord({
        provider: 'antigravity',
        model: 'gemini-3.1-pro',
        taskType: 'bugfix',
        scoredAt: '2026-09-15T01:00:00.000Z',
        verifiedBy: 'other',
        findings: null,
      }),
      // Codex has a clean claude-verified trial
      makeRecord({
        provider: 'codex',
        model: 'gpt-6-astra',
        taskType: 'bugfix',
        scoredAt: '2026-09-15T02:00:00.000Z',
        verifiedBy: 'claude-subagent',
        findings: null,
      }),
    ];
    const context = {
      filesTouched: ['scripts/lib/buffer.mjs'],
      estimatedSize: 60,
      scorecards,
    };

    const res = selectProvider(task, context);
    expect(res.recommendation).toBe(RECOMMENDATIONS.CODEX);
    expect(res.claudeTier).toBeNull();
    expect(res.auditTrail[0].result).toBe('unfit'); // Gemini unfit
    expect(res.auditTrail[1].result).toBe('fit'); // Codex fit
    expect(res.reasoning).toContain('Codex is fit');
  });

  // Branch 3: Both Together (High-Stakes)
  it('branch 3 (high-stakes): recommends both when task is high-stakes and single providers do not fit', () => {
    const task = { description: 'Resolve conveyor deadlock during drain pass', taskType: 'bugfix' };
    const scorecards = [
      // Codex has an unresolved finding on its most recent trial for bugfix
      makeRecord({
        provider: 'codex',
        model: 'gpt-6-astra',
        taskType: 'bugfix',
        scoredAt: '2026-09-15T04:00:00.000Z',
        verifiedBy: 'independent-claude',
        findings: 'Deadlock detection race condition in worker loop',
      }),
    ];
    const context = {
      filesTouched: [
        'scripts/conveyor/drain.mjs',
        'scripts/conveyor/__tests__/drain.test.mjs',
      ],
      estimatedSize: 120,
      scorecards,
    };

    const res = selectProvider(task, context);
    expect(res.recommendation).toBe(RECOMMENDATIONS.BOTH);
    expect(res.claudeTier).toBeNull();
    expect(res.auditTrail.find((a) => a.criterion === 'both-together')?.result).toBe('fit');
    expect(res.reasoning).toContain('Both Gemini and Codex are recommended');
  });

  // Branch 3: Both Together (Thin History)
  it('branch 3 (thin history): recommends both when trials exist on record but neither has an informative trial', () => {
    const task = { description: 'Build simple JSON formatter script', taskType: 'build-new-feature' };
    const scorecards = [
      // Clean trial exists for codex, but size exceeds codex envelope for single dispatch
      makeRecord({
        provider: 'codex',
        model: 'gpt-6-astra',
        taskType: 'build-new-feature',
        scoredAt: '2026-09-15T01:00:00.000Z',
        verifiedBy: 'claude-subagent',
        findings: null, // clean, never informative
      }),
    ];
    // Scope is 320 LOC (exceeds proven envelope of 300 LOC so neither codex nor gemini fits alone)
    const context = {
      filesTouched: ['scripts/lib/json-format.mjs'],
      estimatedSize: 320,
      scorecards,
    };

    const res = selectProvider(task, context);
    expect(res.recommendation).toBe(RECOMMENDATIONS.BOTH);
    expect(res.claudeTier).toBeNull();
    expect(res.reasoning).toContain('too thin');
  });

  // Branch 4: Claude Haiku
  it('branch 4 (haiku): recommends claude haiku for trivial single-file doc-fix with concrete testable criteria', () => {
    const task = { description: 'Fix typo in documentation comment', taskType: 'doc-fix' };
    const context = {
      filesTouched: ['docs/reference.md'],
      estimatedSize: 5,
      scorecards: [], // No external model history
    };

    const res = selectProvider(task, context);
    expect(res.recommendation).toBe(RECOMMENDATIONS.CLAUDE);
    expect(res.claudeTier).toBe(CLAUDE_TIERS.HAIKU);
    expect(res.reasoning).toContain('haiku');
  });

  // Branch 4: Claude Sonnet
  it('branch 4 (sonnet): recommends claude sonnet as default for bounded multi-file work', () => {
    const task = { description: 'Refactor CLI option parsing across modules', taskType: 'bugfix' };
    const context = {
      filesTouched: ['scripts/cli-opts.mjs', 'scripts/run-opts.mjs'],
      estimatedSize: 180,
      scorecards: [], // No external model history
    };

    const res = selectProvider(task, context);
    expect(res.recommendation).toBe(RECOMMENDATIONS.CLAUDE);
    expect(res.claudeTier).toBe(CLAUDE_TIERS.SONNET);
    expect(res.reasoning).toContain('sonnet');
  });

  // Branch 4: Claude Opus (Architectural Decision)
  it('branch 4 (opus): recommends claude opus for architectural-decision tasks', () => {
    const task = {
      description: 'Design polyglot server runtime forward adapters',
      taskType: 'architectural-decision',
    };
    const context = {
      filesTouched: ['plans/polyglot-adapters.md'],
      estimatedSize: 250,
      scorecards: [
        makeRecord({ provider: 'codex', model: 'gpt-6-astra', taskType: 'architectural-decision', findings: null }),
      ],
    };

    const res = selectProvider(task, context);
    expect(res.recommendation).toBe(RECOMMENDATIONS.CLAUDE);
    expect(res.claudeTier).toBe(CLAUDE_TIERS.OPUS);
    expect(res.reasoning).toContain('opus');
  });

  // Branch 4: Claude Opus (Triage Research)
  it('branch 4 (opus): recommends claude opus for triage-research tasks', () => {
    const task = {
      description: 'Investigate flaky WebWorker state synchronization under load',
      taskType: 'triage-research',
    };
    const context = {
      filesTouched: ['research/worker-sync.md'],
      estimatedSize: 100,
      scorecards: [],
    };

    const res = selectProvider(task, context);
    expect(res.recommendation).toBe(RECOMMENDATIONS.CLAUDE);
    expect(res.claudeTier).toBe(CLAUDE_TIERS.OPUS);
    expect(res.reasoning).toContain('triage-research');
  });

  // Statute-tier path override
  it('statute-tier path forces Claude Opus regardless of clean external model track record', () => {
    const task = { description: 'Update platform decision on auto-land seam', taskType: 'doc-fix' };
    const scorecards = [
      makeRecord({ provider: 'gemini', model: 'gemini-3.1-pro', taskType: 'doc-fix', findings: null }),
      makeRecord({ provider: 'codex', model: 'gpt-6-astra', taskType: 'doc-fix', findings: null }),
    ];
    const context = {
      filesTouched: ['docs/agent/platform-decisions.md'],
      estimatedSize: 20,
      scorecards,
    };

    const res = selectProvider(task, context);
    expect(res.recommendation).toBe(RECOMMENDATIONS.CLAUDE);
    expect(res.claudeTier).toBe(CLAUDE_TIERS.OPUS);
    expect(res.reasoning).toContain('statute-tier');
  });

  // Thin history on judgment-requiring task forces Claude, not Both
  it('thin history on architectural task forces Claude Opus (not Both)', () => {
    const task = { description: 'Architectural evaluation of session store', taskType: 'architectural-decision' };
    const context = {
      filesTouched: ['plans/session-store.md'],
      estimatedSize: 150,
      scorecards: [
        makeRecord({ provider: 'codex', model: 'gpt-6-astra', taskType: 'architectural-decision', findings: null }),
      ],
    };

    const res = selectProvider(task, context);
    expect(res.recommendation).toBe(RECOMMENDATIONS.CLAUDE);
    expect(res.claudeTier).toBe(CLAUDE_TIERS.OPUS);
  });
});

describe('selectSupervisionLevel — progressive backdown plan (#3690)', () => {
  it('determinism: produces identical output on identical inputs', () => {
    const records = [
      makeRecord({ scoredAt: '2026-09-15T01:00:00.000Z', findings: 'caught bug' }),
      makeRecord({ scoredAt: '2026-09-15T02:00:00.000Z', findings: null }),
    ];
    const r1 = selectSupervisionLevel('codex', 'gpt-6-astra', 'bugfix', records);
    const r2 = selectSupervisionLevel('codex', 'gpt-6-astra', 'bugfix', records);
    expect(r1).toEqual(r2);
  });

  it('streak-not-yet-met case -> returns full supervision', () => {
    const records = [
      makeRecord({ scoredAt: '2026-09-15T01:00:00.000Z', findings: 'caught bug' }), // informative
      makeRecord({ scoredAt: '2026-09-15T02:00:00.000Z', findings: null }), // clean 1
      makeRecord({ scoredAt: '2026-09-15T03:00:00.000Z', findings: null }), // clean 2
      makeRecord({ scoredAt: '2026-09-15T04:00:00.000Z', findings: null }), // clean 3
    ];

    const res = selectSupervisionLevel('codex', 'gpt-6-astra', 'bugfix', records, { minCleanStreak: 5 });
    expect(res.level).toBe(SUPERVISION_LEVELS.FULL);
    expect(res.reasoning).toContain('below required threshold 5');
    expect(res.auditTrail.find((a) => a.criterion === 'trailing-clean-streak')?.result).toBe('fail');
  });

  it('streak-met-but-never-informative case -> returns full supervision', () => {
    const records = [
      makeRecord({ scoredAt: '2026-09-15T01:00:00.000Z', findings: null }), // clean 1
      makeRecord({ scoredAt: '2026-09-15T02:00:00.000Z', findings: null }), // clean 2
      makeRecord({ scoredAt: '2026-09-15T03:00:00.000Z', findings: null }), // clean 3
      makeRecord({ scoredAt: '2026-09-15T04:00:00.000Z', findings: null }), // clean 4
      makeRecord({ scoredAt: '2026-09-15T05:00:00.000Z', findings: null }), // clean 5
    ];

    const res = selectSupervisionLevel('codex', 'gpt-6-astra', 'bugfix', records, {
      minCleanStreak: 5,
      requireInformativeTrial: true,
    });
    expect(res.level).toBe(SUPERVISION_LEVELS.FULL);
    expect(res.reasoning).toContain('no informative trial');
    expect(res.auditTrail.find((a) => a.criterion === 'informative-trial-requirement')?.result).toBe('fail');
  });

  it('streak-met-and-informative case -> returns spot-check supervision', () => {
    const records = [
      makeRecord({ scoredAt: '2026-09-15T00:30:00.000Z', findings: 'Independent review caught quoting bug' }), // informative
      makeRecord({ scoredAt: '2026-09-15T01:00:00.000Z', findings: null }), // clean 1
      makeRecord({ scoredAt: '2026-09-15T02:00:00.000Z', findings: null }), // clean 2
      makeRecord({ scoredAt: '2026-09-15T03:00:00.000Z', findings: null }), // clean 3
      makeRecord({ scoredAt: '2026-09-15T04:00:00.000Z', findings: null }), // clean 4
      makeRecord({ scoredAt: '2026-09-15T05:00:00.000Z', findings: null }), // clean 5
    ];

    const res = selectSupervisionLevel('codex', 'gpt-6-astra', 'bugfix', records, {
      minCleanStreak: 5,
      requireInformativeTrial: true,
    });
    expect(res.level).toBe(SUPERVISION_LEVELS.SPOT_CHECK);
    expect(res.reasoning).toContain('Spot-check supervision approved');
    expect(res.auditTrail.every((a) => a.result === 'clean' || a.result === 'pass')).toBe(true);
  });

  it('most-recent-record-has-a-finding case -> returns full supervision (hard veto) even with long prior streak', () => {
    const records = [
      makeRecord({ scoredAt: '2026-09-15T01:00:00.000Z', findings: 'prior finding' }),
      makeRecord({ scoredAt: '2026-09-15T02:00:00.000Z', findings: null }),
      makeRecord({ scoredAt: '2026-09-15T03:00:00.000Z', findings: null }),
      makeRecord({ scoredAt: '2026-09-15T04:00:00.000Z', findings: null }),
      makeRecord({ scoredAt: '2026-09-15T05:00:00.000Z', findings: null }),
      makeRecord({ scoredAt: '2026-09-15T06:00:00.000Z', findings: null }),
      makeRecord({ scoredAt: '2026-09-15T07:00:00.000Z', findings: null }),
      // Most recent trial (08:00) caught a regression
      makeRecord({ scoredAt: '2026-09-15T08:00:00.000Z', findings: 'New defect found by independent review' }),
    ];

    const res = selectSupervisionLevel('codex', 'gpt-6-astra', 'bugfix', records, { minCleanStreak: 5 });
    expect(res.level).toBe(SUPERVISION_LEVELS.FULL);
    expect(res.reasoning).toContain('Calibration-miss hard veto');
    expect(res.auditTrail.find((a) => a.criterion === 'most-recent-trial-veto')?.result).toBe('veto-fired');
  });

  it('an other-verified record in the middle of a streak neither breaks nor extends it', () => {
    const records = [
      makeRecord({ scoredAt: '2026-09-15T00:30:00.000Z', findings: 'prior finding' }), // informative
      makeRecord({ scoredAt: '2026-09-15T01:00:00.000Z', verifiedBy: 'claude-subagent', findings: null }), // clean 1
      makeRecord({ scoredAt: '2026-09-15T02:00:00.000Z', verifiedBy: 'claude-subagent', findings: null }), // clean 2
      // 'other'-verified trial in the middle (e.g. smoke test)
      makeRecord({ scoredAt: '2026-09-15T03:00:00.000Z', verifiedBy: 'other', findings: null }), // skipped!
      makeRecord({ scoredAt: '2026-09-15T04:00:00.000Z', verifiedBy: 'independent-claude', findings: null }), // clean 3
      makeRecord({ scoredAt: '2026-09-15T05:00:00.000Z', verifiedBy: 'independent-claude', findings: null }), // clean 4
      makeRecord({ scoredAt: '2026-09-15T06:00:00.000Z', verifiedBy: 'claude-subagent', findings: null }), // clean 5
    ];

    const res = selectSupervisionLevel('codex', 'gpt-6-astra', 'bugfix', records, { minCleanStreak: 5 });
    expect(res.level).toBe(SUPERVISION_LEVELS.SPOT_CHECK);
    const streakEntry = res.auditTrail.find((a) => a.criterion === 'trailing-clean-streak');
    expect(streakEntry?.dataConsulted).toContain('streak=5');
  });

  it('handles empty scorecards gracefully, defaulting to full supervision', () => {
    const res = selectSupervisionLevel('codex', 'gpt-6-astra', 'bugfix', []);
    expect(res.level).toBe(SUPERVISION_LEVELS.FULL);
    expect(res.auditTrail.find((a) => a.criterion === 'trailing-clean-streak')?.result).toBe('fail');
  });

  it('respects caller-supplied threshold overrides', () => {
    const records = [
      makeRecord({ scoredAt: '2026-09-15T01:00:00.000Z', findings: null }),
      makeRecord({ scoredAt: '2026-09-15T02:00:00.000Z', findings: null }),
    ];

    // minCleanStreak: 2, requireInformativeTrial: false -> should pass
    const res = selectSupervisionLevel('codex', 'gpt-6-astra', 'bugfix', records, {
      minCleanStreak: 2,
      requireInformativeTrial: false,
    });
    expect(res.level).toBe(SUPERVISION_LEVELS.SPOT_CHECK);
  });
});
