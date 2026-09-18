/**
 * @file provider-routing.test.mjs — unit tests for scripts/lib/provider-routing.mjs (#3690).
 *
 * Verifies:
 *   - Pure, deterministic execution (identical inputs -> deep-equal results).
 *   - Provider recommendation cascade: Gemini fit, Codex fit, Both (high-stakes & thin history),
 *     and Claude fallback at Haiku, Sonnet, and Opus tiers.
 *   - Default agy Claude alternates: native identity/reliability vetoes, audit entries and determinism.
 *   - Statute-tier paths strictly force Claude Opus regardless of external model track record.
 *   - Supervision level backdown plan (#3690): clean streak counting, informative trial gating,
 *     calibration-miss hard veto on most recent record, and 'other'-verified skipping.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  selectProvider,
  selectSupervisionLevel,
  isStatuteTierPath,
  isHighStakesTask,
  isWithinProvenEnvelope,
  RECOMMENDATIONS,
  CLAUDE_TIERS,
  AGY_CLAUDE_MODEL_BY_TIER,
  SUPERVISION_LEVELS,
  DEFAULT_BACKDOWN_THRESHOLDS,
  PROVEN_TASK_ENVELOPES,
  THIN_TRIAL_THRESHOLD,
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
        outcome: 'reworked',
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

describe('selectProvider — default Antigravity alternate backend (agy Claude route)', () => {
  it('freezes exactly the two real agy Claude tier mappings', () => {
    expect(Object.isFrozen(AGY_CLAUDE_MODEL_BY_TIER)).toBe(true);
    expect(Object.keys(AGY_CLAUDE_MODEL_BY_TIER).sort()).toEqual(['opus', 'sonnet']);
    expect(AGY_CLAUDE_MODEL_BY_TIER).toEqual({
      sonnet: 'claude-sonnet-4-6',
      opus: 'claude-opus-4-6-thinking',
    });
    expect('haiku' in AGY_CLAUDE_MODEL_BY_TIER).toBe(false);
  });

  it('offers Sonnet by default with identical, deterministic output for omitted, true and false quota flags', () => {
    const task = { description: 'Refactor CLI option parsing across modules', taskType: 'bugfix' };
    const context = {
      filesTouched: ['scripts/cli-opts.mjs', 'scripts/run-opts.mjs'],
      estimatedSize: 180,
      scorecards: [],
    };
    const res = selectProvider(task, context);
    const explicitTrue = selectProvider(task, { ...context, quotaStrained: true });
    const explicitFalse = selectProvider(task, { ...context, quotaStrained: false });

    expect(res.recommendation).toBe(RECOMMENDATIONS.CLAUDE);
    expect(res.claudeTier).toBe(CLAUDE_TIERS.SONNET);
    expect(res.alternateBackend).toEqual({
      tool: 'scripts/gemini-direct-task.mjs',
      cliModel: 'claude-sonnet-4-6',
      reason: expect.any(String),
    });
    expect(res.alternateBackend.reason).toContain('gemini-direct-task.mjs');
    expect(res.alternateBackend.reason).toContain('claude-sonnet-4-6');
    expect(res.alternateBackend.reason).toContain('Default capacity-relief');
    expect(explicitTrue).toEqual(res);
    expect(explicitFalse).toEqual(res);
    expect(res.auditTrail.map((a) => a.criterion)).toEqual([
      'gemini-fitness', 'codex-fitness', 'both-together', 'claude-tier', 'agy-alternate-backend',
    ]);
    expect(res.auditTrail.at(-1)).toEqual({
      criterion: 'agy-alternate-backend',
      result: 'offered',
      dataConsulted: "claudeTier='sonnet', taskType='bugfix', statute=false, latestAntigravityTrial=none",
      reasoning: expect.stringContaining('claude-sonnet-4-6'),
    });
    expect(selectProvider(task, context)).toEqual(res);
    expect(JSON.stringify(selectProvider(task, context))).toBe(JSON.stringify(res));
  });

  it.each([
    { filesTouched: Array.from({ length: 9 }, (_, i) => `scripts/module-${i}.mjs`), estimatedSize: 180 },
    { filesTouched: ['scripts/module.mjs'], estimatedSize: 501 },
    { filesTouched: ['scripts/module.mjs'], estimatedSize: 180, acceptanceTestable: false },
  ])('offers Opus by default for effort sizing/caution: %j', (context) => {
    const res = selectProvider({ taskType: 'bugfix' }, context);

    expect(res.recommendation).toBe(RECOMMENDATIONS.CLAUDE);
    expect(res.claudeTier).toBe(CLAUDE_TIERS.OPUS);
    expect(res.alternateBackend).toEqual({
      tool: 'scripts/gemini-direct-task.mjs',
      cliModel: 'claude-opus-4-6-thinking',
      reason: expect.stringContaining('claude-opus-4-6-thinking'),
    });
    expect(res.auditTrail).toHaveLength(5);
    expect(res.auditTrail.at(-1)).toMatchObject({ criterion: 'agy-alternate-backend', result: 'offered' });
  });

  it.each([
    { outcome: 'rejected', findings: null },
    { outcome: 'reworked', findings: 'Unresolved write_to_file failure' },
  ])('vetoes only the taskType with the latest unclean Antigravity trial: %j', (failure) => {
    // An older informative trial bypasses Step 3's thin-history branch; scope exceeds
    // the external fitness envelope so these calls exercise the Claude branch.
    const context = {
      filesTouched: ['scripts/cli-opts.mjs', 'scripts/run-opts.mjs'],
      estimatedSize: 280,
      scorecards: [
        makeRecord({ provider: 'antigravity', outcome: 'reworked', findings: 'Earlier review finding' }),
        makeRecord({ provider: 'antigravity', model: 'claude-sonnet-4-6', scoredAt: '2026-09-15T03:00:00.000Z', verifiedBy: 'other', ...failure }),
        makeRecord({ provider: 'antigravity', scoredAt: '2026-09-15T02:00:00.000Z' }),
        makeRecord({ provider: 'gemini', scoredAt: '2026-09-15T04:00:00.000Z' }),
      ],
    };
    const snapshot = JSON.stringify(context);
    const res = selectProvider({ taskType: 'bugfix' }, context);

    expect(res.recommendation).toBe(RECOMMENDATIONS.CLAUDE);
    expect(res.claudeTier).toBe(CLAUDE_TIERS.SONNET);
    expect(res.alternateBackend).toBeNull();
    expect(res.auditTrail).toHaveLength(5);
    expect(res.auditTrail.at(-1)).toMatchObject({ criterion: 'agy-alternate-backend', result: 'recent-failure' });
    const otherTask = selectProvider({ taskType: 'build-new-feature' }, context);
    expect(otherTask.recommendation).toBe(RECOMMENDATIONS.CLAUDE);
    expect(otherTask.alternateBackend.cliModel).toBe('claude-sonnet-4-6');
    expect(otherTask.auditTrail.at(-1).result).toBe('offered');
    expect(JSON.stringify(selectProvider({ taskType: 'bugfix' }, context))).toBe(JSON.stringify(res));
    expect(JSON.stringify(context)).toBe(snapshot);
  });

  it('restores the default when a later clean Antigravity trial supersedes failure across models', () => {
    const context = {
      filesTouched: ['scripts/cli-opts.mjs', 'scripts/run-opts.mjs'],
      estimatedSize: 280,
      model: 'claude-sonnet-4-6',
      scorecards: { records: [
        makeRecord({ provider: 'antigravity', model: 'claude-opus-4-6-thinking', scoredAt: '2026-09-15T02:00:00.000Z', verifiedBy: 'other' }),
        makeRecord({ provider: 'antigravity', model: 'claude-sonnet-4-6', outcome: 'rejected', findings: 'Unresolved build crash' }),
        makeRecord({ provider: 'gemini', scoredAt: '2026-09-15T03:00:00.000Z', outcome: 'rejected' }),
      ] },
    };
    const res = selectProvider({ taskType: 'bugfix' }, context);

    expect(res.recommendation).toBe(RECOMMENDATIONS.CLAUDE);
    expect(res.alternateBackend.cliModel).toBe('claude-sonnet-4-6');
    expect(res.auditTrail.at(-1)).toMatchObject({ criterion: 'agy-alternate-backend', result: 'offered' });
  });

  it('requires native Opus for statute-tier work even with quota strain and clean Antigravity history', () => {
    const task = { description: 'Update platform decision on auto-land seam', taskType: 'doc-fix' };
    const context = {
      filesTouched: ['docs/agent/platform-decisions.md'],
      estimatedSize: 20,
      scorecards: [
        makeRecord({ provider: 'gemini', model: 'gemini-3.1-pro', taskType: 'doc-fix' }),
        makeRecord({ provider: 'codex', model: 'gpt-6-astra', taskType: 'doc-fix' }),
        makeRecord({ provider: 'antigravity', model: 'claude-opus-4-6-thinking', taskType: 'doc-fix' }),
      ],
      quotaStrained: true,
    };
    const res = selectProvider(task, context);

    expect(res.recommendation).toBe(RECOMMENDATIONS.CLAUDE);
    expect(res.claudeTier).toBe(CLAUDE_TIERS.OPUS);
    expect(res.alternateBackend).toBeNull();
    expect(res.auditTrail).toHaveLength(5);
    expect(res.auditTrail.at(-1)).toMatchObject({ criterion: 'agy-alternate-backend', result: 'forced-native' });
    expect(res).toEqual(selectProvider(task, { ...context, quotaStrained: false }));
  });

  it.each(['architectural-decision', 'triage-research'])('requires native Opus for %s regardless of Antigravity history', (taskType) => {
    for (const trial of [
      { outcome: 'landed', findings: null },
      { outcome: 'reworked', findings: 'Unresolved build failure' },
    ]) {
      const res = selectProvider({ taskType }, {
        filesTouched: ['scripts/module.mjs'],
        estimatedSize: 20,
        quotaStrained: true,
        scorecards: [makeRecord({ provider: 'antigravity', model: 'claude-opus-4-6-thinking', taskType, ...trial })],
      });
      expect(res.recommendation).toBe(RECOMMENDATIONS.CLAUDE);
      expect(res.claudeTier).toBe(CLAUDE_TIERS.OPUS);
      expect(res.alternateBackend).toBeNull();
      expect(res.auditTrail).toHaveLength(5);
      expect(res.auditTrail.at(-1)).toMatchObject({ criterion: 'agy-alternate-backend', result: 'forced-native' });
    }
  });

  it('returns null and audits why Haiku has no alternate', () => {
    const task = { description: 'Fix typo in documentation comment', taskType: 'doc-fix' };
    const context = {
      filesTouched: ['docs/reference.md'],
      estimatedSize: 5,
      scorecards: [],
    };
    const res = selectProvider(task, context);

    expect(res.recommendation).toBe(RECOMMENDATIONS.CLAUDE);
    expect(res.claudeTier).toBe(CLAUDE_TIERS.HAIKU);
    expect(res.alternateBackend).toBeNull();
    expect(res.auditTrail).toHaveLength(5);
    expect(res).toEqual(selectProvider(task, { ...context, quotaStrained: true }));
    expect(res.auditTrail.at(-1)).toEqual({
      criterion: 'agy-alternate-backend',
      result: 'not-applicable',
      dataConsulted: "claudeTier='haiku', taskType='doc-fix', statute=false, latestAntigravityTrial=none",
      reasoning: expect.stringContaining('Haiku has no agy-hosted equivalent'),
    });
  });

  it('leaves Gemini, Codex and Both return objects untouched by quota strain', () => {
    const task = { description: 'Fix parser bug', taskType: 'bugfix' };
    const cases = [
      {
        recommendation: RECOMMENDATIONS.GEMINI,
        filesTouched: ['scripts/lib/parser.mjs'],
        scorecards: [makeRecord({ provider: 'gemini', model: 'gemini-3.1-pro' })],
      },
      {
        recommendation: RECOMMENDATIONS.CODEX,
        filesTouched: ['scripts/lib/parser.mjs'],
        scorecards: [makeRecord()],
      },
      {
        recommendation: RECOMMENDATIONS.BOTH,
        filesTouched: ['scripts/conveyor/drain.mjs', 'scripts/conveyor/__tests__/drain.test.mjs'],
        scorecards: [makeRecord({ outcome: 'reworked', findings: 'Deadlock detection race condition in worker loop' })],
      },
    ];
    for (const { recommendation, filesTouched, scorecards } of cases) {
      const context = { filesTouched, scorecards, estimatedSize: 120 };
      const res = selectProvider(task, { ...context, quotaStrained: true });
      expect(res.recommendation).toBe(recommendation);
      expect('alternateBackend' in res).toBe(false);
      expect(res).toEqual(selectProvider(task, context));
    }
  });
});

describe('selectSupervisionLevel — progressive backdown plan (#3690)', () => {
  it('counts explanatory landed accepts toward the clean streak without a hard veto', () => {
    const triple = { provider: 'antigravity', model: 'gemini-3.8-flash-low', taskType: 'conflict-resolution' };
    const records = [
      makeRecord({ ...triple, scoredAt: '2026-09-15T00:00:00.000Z', outcome: 'reworked', findings: 'Independent review caught a dropped merge-parent change' }),
      ...[1, 2, 3].map((hour) => makeRecord({ ...triple, scoredAt: `2026-09-15T0${hour}:00:00.000Z` })),
      ...[2291, 2292].map((pr, index) => makeRecord({
        ...triple,
        pr,
        scoredAt: `2026-09-15T0${index + 4}:00:00.000Z`,
        outcome: 'landed',
        verifiedBy: 'independent-claude',
        findings: 'Independent claude -p process verified via 3-way diff against both merge parents plus two real vitest runs (34/34 targeted, 1822/1822 broader operations suite) before any push. Verdict ACCEPT; pushed to origin/lane/op-runner-activity.',
      })),
    ];

    const res = selectSupervisionLevel(triple.provider, triple.model, triple.taskType, records);

    expect(res.level).toBe(SUPERVISION_LEVELS.SPOT_CHECK);
    expect(res.auditTrail.find((a) => a.criterion === 'most-recent-trial-veto')?.result).toBe('clean');
    expect(res.auditTrail.find((a) => a.criterion === 'trailing-clean-streak')).toMatchObject({
      result: 'pass',
      dataConsulted: expect.stringContaining('streak=5, threshold=5'),
    });
  });

  it.each([
    { outcome: 'reworked', findings: 'Independent review caught a dropped merge-parent change' },
    { outcome: 'rejected', findings: 'Independent review caught a dropped merge-parent change' },
    { outcome: 'reworked', findings: null },
    { outcome: 'rejected', findings: null },
  ])('vetoes a real-problem outcome and resets the clean streak: %j', (failure) => {
    const triple = { provider: 'antigravity', model: 'gemini-3.8-flash-low', taskType: 'conflict-resolution' };
    const records = [
      ...[1, 2, 3, 4, 5].map((hour) => makeRecord({ ...triple, scoredAt: `2026-09-15T0${hour}:00:00.000Z` })),
      makeRecord({ ...triple, scoredAt: '2026-09-15T06:00:00.000Z', verifiedBy: 'independent-claude', ...failure }),
    ];

    const res = selectSupervisionLevel(triple.provider, triple.model, triple.taskType, records);

    expect(res.level).toBe(SUPERVISION_LEVELS.FULL);
    expect(res.auditTrail.find((a) => a.criterion === 'most-recent-trial-veto')?.result).toBe('veto-fired');
    expect(res.auditTrail.find((a) => a.criterion === 'trailing-clean-streak')).toMatchObject({
      result: 'fail',
      dataConsulted: expect.stringContaining('streak=0, threshold=5'),
    });
  });

  it('determinism: produces identical output on identical inputs', () => {
    const records = [
      makeRecord({ scoredAt: '2026-09-15T01:00:00.000Z', outcome: 'reworked', findings: 'caught bug' }),
      makeRecord({ scoredAt: '2026-09-15T02:00:00.000Z', findings: null }),
    ];
    const r1 = selectSupervisionLevel('codex', 'gpt-6-astra', 'bugfix', records);
    const r2 = selectSupervisionLevel('codex', 'gpt-6-astra', 'bugfix', records);
    expect(r1).toEqual(r2);
  });

  it('streak-not-yet-met case -> returns full supervision', () => {
    const records = [
      makeRecord({ scoredAt: '2026-09-15T01:00:00.000Z', outcome: 'reworked', findings: 'caught bug' }), // informative
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
      makeRecord({ scoredAt: '2026-09-15T00:30:00.000Z', outcome: 'reworked', findings: 'Independent review caught quoting bug' }), // informative
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

  it('most-recent-record-is-reworked case -> returns full supervision (hard veto) even with long prior streak', () => {
    const records = [
      makeRecord({ scoredAt: '2026-09-15T01:00:00.000Z', outcome: 'reworked', findings: 'prior finding' }),
      makeRecord({ scoredAt: '2026-09-15T02:00:00.000Z', findings: null }),
      makeRecord({ scoredAt: '2026-09-15T03:00:00.000Z', findings: null }),
      makeRecord({ scoredAt: '2026-09-15T04:00:00.000Z', findings: null }),
      makeRecord({ scoredAt: '2026-09-15T05:00:00.000Z', findings: null }),
      makeRecord({ scoredAt: '2026-09-15T06:00:00.000Z', findings: null }),
      makeRecord({ scoredAt: '2026-09-15T07:00:00.000Z', findings: null }),
      // Most recent trial (08:00) caught a regression
      makeRecord({ scoredAt: '2026-09-15T08:00:00.000Z', outcome: 'reworked', findings: 'New defect found by independent review' }),
    ];

    const res = selectSupervisionLevel('codex', 'gpt-6-astra', 'bugfix', records, { minCleanStreak: 5 });
    expect(res.level).toBe(SUPERVISION_LEVELS.FULL);
    expect(res.reasoning).toContain('Calibration-miss hard veto');
    expect(res.auditTrail.find((a) => a.criterion === 'most-recent-trial-veto')?.result).toBe('veto-fired');
  });

  it('an other-verified record in the middle of a streak neither breaks nor extends it', () => {
    const records = [
      makeRecord({ scoredAt: '2026-09-15T00:30:00.000Z', outcome: 'reworked', findings: 'prior finding' }), // informative
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

describe('selectProvider — explorationHint (model-capability-ratings)', () => {
  // Synthetic test ratings only; these do not claim any real benchmark performance.
  function makeRating(overrides = {}) {
    return {
      provider: 'codex',
      model: 'test-coding-model',
      verified: true,
      source: 'https://example.test/synthetic-benchmark',
      asOf: '2026-09-01',
      lastUpdated: '2026-09-15',
      categories: {
        contextIngestion: { value: null, unit: 'points', note: '' },
        autonomousAgenticWork: { value: 80, unit: 'points', note: '' },
        algorithmicSpeedIdeSync: { value: null, unit: 'points', note: '' },
        cliToolUse: { value: 60, unit: 'points', note: '' },
        overallCodingIndex: { value: 70, unit: 'points', note: '' },
      },
      ...overrides,
    };
  }
  const task = { taskType: 'bugfix' };

  it('surfaces a verified rating with provenance when both groups have zero trials', () => {
    const entry = makeRating();
    const { explorationHint } = selectProvider(task, {
      scorecards: [], capabilityRatings: { version: 1, entries: [entry], dropped: [] },
    });
    expect(THIN_TRIAL_THRESHOLD).toBe(3);
    expect(explorationHint).toEqual({
      suggestedProvider: 'codex', suggestedModel: 'test-coding-model',
      category: 'autonomousAgenticWork', value: 80, unit: 'points',
      asOf: entry.asOf, source: entry.source,
      reason: "Real trial history for taskType 'bugfix' is thin (gemini/antigravity: 0, codex: 0 trials, threshold 3); verified external rating suggests trying codex/test-coding-model (autonomousAgenticWork=80) next.",
    });
  });

  it.each([false, undefined])('never surfaces verification=%s', (verified) => {
    expect(selectProvider(task, { capabilityRatings: [makeRating({ verified })] }).explorationHint).toBeNull();
  });

  it('returns null when ratings or context are omitted, or the registry is empty', () => {
    expect(selectProvider(task, { scorecards: [] }).explorationHint).toBeNull();
    expect(selectProvider(task).explorationHint).toBeNull();
    expect(selectProvider(task, { capabilityRatings: { version: 1, entries: [], dropped: [] } }).explorationHint).toBeNull();
  });

  it.each([3, 4])('does not consult ratings with %i trials in each group, including antigravity', (count) => {
    const scorecards = Array.from({ length: count }, (_, i) => [
      makeRecord({ provider: i % 2 ? 'gemini' : 'antigravity' }), makeRecord(),
    ]).flat();
    const registry = { version: 1, entries: [makeRating()], dropped: [] };
    expect(selectProvider(task, { scorecards, capabilityRatings: registry }).explorationHint).toBeNull();
    // Prove the gate prevents consultation, rather than merely discarding a ranked hint.
    expect(selectProvider(task, {
      scorecards,
      get capabilityRatings() { throw new Error('Registry must not be consulted'); },
    }).explorationHint).toBeNull();
  });

  it.each(['gemini', 'codex'])('consults when only %s has thin task-specific history', (thinProvider) => {
    const scorecards = ['gemini', 'codex'].flatMap((provider) =>
      Array.from({ length: provider === thinProvider ? 2 : 3 }, () => makeRecord({ provider }))
    );
    scorecards.push(makeRecord({ provider: thinProvider, taskType: 'doc-fix' }), makeRecord({ provider: 'claude' }), null);
    const result = selectProvider(task, { scorecards: { records: scorecards }, capabilityRatings: [makeRating()] });
    expect(result.explorationHint.suggestedProvider).toBe('codex');
    expect(result.explorationHint.reason).toContain(
      `gemini/antigravity: ${thinProvider === 'gemini' ? 2 : 3}, codex: ${thinProvider === 'codex' ? 2 : 3} trials`
    );
  });

  it.each([
    ['bugfix', 'autonomousAgenticWork'], ['build-new-feature', 'autonomousAgenticWork'],
    ['self-fix', 'autonomousAgenticWork'], ['conflict-resolution', 'cliToolUse'],
    ['doc-fix', 'cliToolUse'], ['triage-research', 'overallCodingIndex'],
  ])('uses %s default category %s', (taskType, category) => {
    expect(selectProvider({ taskType }, { capabilityRatings: [makeRating()] }).explorationHint.category).toBe(category);
  });

  it('category override changes the ranking and winning provider/model', () => {
    const codex = makeRating();
    const gemini = makeRating({ provider: 'gemini', model: 'test-cli-model', categories: {
      ...codex.categories,
      autonomousAgenticWork: { value: 40, unit: 'points', note: '' },
      cliToolUse: { value: 90, unit: 'points', note: '' },
    } });
    const context = { capabilityRatings: [codex, gemini] };
    expect(selectProvider(task, context).explorationHint.suggestedProvider).toBe('codex');
    expect(selectProvider(task, { ...context, capabilityCategory: 'cliToolUse' }).explorationHint).toMatchObject({
      suggestedProvider: 'gemini', suggestedModel: 'test-cli-model', category: 'cliToolUse', value: 90,
    });
  });

  it('skips unknown values and unsupported providers, keeps measured zero and stable ties', () => {
    const unknown = makeRating({ categories: {
      ...makeRating().categories, autonomousAgenticWork: { value: null, unit: 'points', note: '' },
    } });
    const zero = makeRating({ provider: 'antigravity', model: 'test-zero-model', categories: {
      ...makeRating().categories, autonomousAgenticWork: { value: 0, unit: 'points', note: '' },
    } });
    const context = { capabilityRatings: [unknown, makeRating({ provider: 'claude' }), zero, { ...zero, provider: 'gemini' }] };
    expect(selectProvider(task, context).explorationHint).toMatchObject({ suggestedProvider: 'antigravity', value: 0 });
    expect(selectProvider(task, { capabilityRatings: [unknown] }).explorationHint).toBeNull();
    expect(selectProvider(task, { ...context, capabilityCategory: 'unknown-category' }).explorationHint).toBeNull();
  });

  it.each([
    ['gemini', { scorecards: [makeRecord({ provider: 'gemini' })] }],
    ['codex', { scorecards: [makeRecord()] }],
    ['both', { filesTouched: ['scripts/lib/parser.mjs', 'scripts/lib/__tests__/parser.test.mjs'] }],
    ['claude', { scorecards: [], quotaStrained: true }],
  ])('adds only explorationHint on the %s branch, preserving all existing output bytes', (recommendation, context) => {
    const { explorationHint: absent, ...baseline } = selectProvider(task, context);
    const withRatings = { ...context, capabilityRatings: [makeRating()] };
    const snapshot = JSON.stringify(withRatings);
    const { explorationHint, ...result } = selectProvider(task, withRatings);
    expect(result.recommendation).toBe(recommendation);
    expect(absent).toBeNull();
    expect(explorationHint.suggestedModel).toBe('test-coding-model');
    expect(JSON.stringify(result)).toBe(JSON.stringify(baseline));
    expect(JSON.stringify(withRatings)).toBe(snapshot);
    expect(selectProvider(task, withRatings)).toEqual({ ...result, explorationHint });
  });
});

describe('selectSupervisionLevel — architectural separation from model-capability-ratings', () => {
  it('retains its five declared parameters and identical behavior on identical evidence', () => {
    // JavaScript .length stops before the first default: backdownThresholds = {}.
    expect(selectSupervisionLevel.length).toBe(4);
    expect(selectSupervisionLevel.toString().split('\n')[0]).toBe(
      'function selectSupervisionLevel(provider, model, taskType, scorecards, backdownThresholds = {}) {'
    );
    const scorecards = [makeRecord()];
    const thresholds = { minCleanStreak: 1, requireInformativeTrial: false };
    const first = selectSupervisionLevel('codex', 'gpt-6-astra', 'bugfix', scorecards, thresholds);
    const second = selectSupervisionLevel('codex', 'gpt-6-astra', 'bugfix', scorecards, thresholds);
    expect(first.level).toBe(SUPERVISION_LEVELS.SPOT_CHECK);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('contains no capability registry, imported helper, or exploration references in its source span', () => {
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../provider-routing.mjs'), 'utf8');
    const start = source.indexOf('export function selectSupervisionLevel');
    expect(start).toBeGreaterThanOrEqual(0);
    // route-import-graph.mjs extracts imports, but has no function-span helper.
    // Start AFTER the parameter list so the default {} is not mistaken for the body.
    const openingBrace = source.indexOf('{', source.indexOf(')', start) + 1);
    expect(openingBrace).toBeGreaterThan(start);
    let depth = 0;
    let end = -1;
    for (let i = openingBrace; i < source.length; i++) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}') {
        depth--;
        if (depth === 0) { end = i + 1; break; }
      }
    }
    expect(end).toBeGreaterThan(openingBrace);
    const span = source.slice(start, end);
    // Check the counter captured the entire function, including its final return.
    expect(span).toBe(`export ${selectSupervisionLevel.toString()}`);
    expect(span).not.toContain('model-capability-ratings');
    expect(span).not.toMatch(/isUsableForExploration|getExplorationHint|capabilityRatings|capabilityCategory|explorationHint|THIN_TRIAL_THRESHOLD|forcedNativeIdentity|latestAntigravityTrial|agyAlternateResult/);
  });
});
