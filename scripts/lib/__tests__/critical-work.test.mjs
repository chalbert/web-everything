/**
 * @file critical-work.test.mjs — unit tests for scripts/lib/critical-work.mjs (#4034).
 *
 * Verifies:
 *   - `criticalWorkVerdict` composes the EXISTING proxies (dispatch-risk, never-spot-check, human-required,
 *     gate-self, daemon-drain) rather than reimplementing them — asserted by calling the shared sources
 *     (`deriveRisk`/`deriveComplexity` from dispatch-contracts.mjs, `NEVER_SPOT_CHECK_PATH_PREFIXES` from
 *     dispatch-thresholds.mjs) directly alongside it.
 *   - `isMissRecord`/`isCriticalMiss` read only the explicit `outcome` (never inferred from `findings`), and
 *     fail closed on missing scope evidence.
 *   - `criticalMissesFor` filters by taskType, accepts both the bare-array and `{records}` store shapes, and
 *     fails closed on legacy rows with no `filesTouched`.
 *   - Real-card fixtures (#4124, #4108, #4131, #4081, #4071) prove the `we:` prefix normalisation and pin the
 *     module's real-world verdicts.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  criticalWorkVerdict,
  isMissRecord,
  isCriticalMiss,
  criticalMissesFor,
  MISS_OUTCOMES,
} from '../critical-work.mjs';
import { deriveRisk, deriveComplexity } from '../dispatch-contracts.mjs';
import { NEVER_SPOT_CHECK_PATH_PREFIXES } from '../dispatch-thresholds.mjs';

describe('critical-work.mjs is pure (#4034)', () => {
  it('imports only the three shared proxy sources and uses no impure primitive', () => {
    const source = readFileSync('scripts/lib/critical-work.mjs', 'utf8');
    for (const forbidden of ['node:fs', 'Date.now', 'new Date', 'process.env', 'Math.random']) expect(source).not.toContain(forbidden);
    expect([...source.matchAll(/from '([^']+)'/g)].map((m) => m[1])).toEqual(['./dispatch-contracts.mjs', './dispatch-thresholds.mjs', './gate-config.mjs']);
  });
});

describe('criticalWorkVerdict + isCriticalMiss — the dispatch-risk proxy (#4034)', () => {
  it('is a critical miss for a reworked record whose task scores deriveRisk high', () => {
    const taskType = 'bugfix';
    const filesTouched = ['scripts/lib/example.mjs', 'scripts/lib/__tests__/example.test.mjs'];
    const complexity = deriveComplexity(taskType, 0, filesTouched.length);
    // Prove the shared source itself scores this high BEFORE trusting the composition over it.
    expect(deriveRisk(taskType, filesTouched, complexity, true)).toBe('high');

    const record = { outcome: 'reworked', taskType, filesTouched };
    expect(isMissRecord(record)).toBe(true);
    expect(isCriticalMiss(record)).toBe(true);
  });
});

describe('criticalWorkVerdict + isCriticalMiss — the never-spot-check proxy, every group (#4034)', () => {
  it('is a critical miss for a path in each NEVER_SPOT_CHECK_PATH_PREFIXES group, naming the group', () => {
    for (const [group, prefixes] of Object.entries(NEVER_SPOT_CHECK_PATH_PREFIXES)) {
      const prefix = prefixes[0];
      const path = prefix.endsWith('/') ? `${prefix}x.mjs` : `${prefix}${prefix.includes('.') ? '' : '-x.mjs'}`;

      const record = { outcome: 'reworked', taskType: 'bugfix', filesTouched: [path] };
      expect(isCriticalMiss(record), `group ${group}, path ${path}`).toBe(true);

      const verdict = criticalWorkVerdict({ taskType: 'bugfix', filesTouched: [path] });
      const neverSpotCheck = verdict.reasons.find((r) => r.proxy === 'never-spot-check');
      expect(neverSpotCheck, `group ${group}, path ${path}`).toBeTruthy();
      expect(neverSpotCheck.detail.split(',')).toContain(group);
    }
  });
});

describe('criticalWorkVerdict + isCriticalMiss — the human-required proxy (#4034)', () => {
  it('is a critical miss for humanRequired: true even on an otherwise non-critical scope', () => {
    const taskType = 'build-new-feature';
    const filesTouched = ['blocks/foo/bar.ts'];
    // The bare scope, with no humanRequired, is NOT critical — proves the flag is what does the work.
    expect(criticalWorkVerdict({ taskType, filesTouched }).critical).toBe(false);

    const record = { outcome: 'reworked', taskType, filesTouched, humanRequired: true };
    expect(isCriticalMiss(record)).toBe(true);
  });
});

describe('criticalWorkVerdict + isCriticalMiss — no proxy fires (real card #4081 scope, #4034)', () => {
  it('is NOT a critical miss for a reworked record matching none of the proxies', () => {
    const record = {
      outcome: 'reworked',
      taskType: 'build-new-feature',
      filesTouched: ['scripts/operations/operator-queue.mjs'],
    };
    expect(isCriticalMiss(record)).toBe(false);
  });
});

describe('isCriticalMiss — only an explicit reworked/rejected outcome counts (#4034)', () => {
  it('is NOT a critical miss for a landed (clean) record even on a critical scope, nor for outcome null', () => {
    const criticalScope = ['docs/agent/platform-decisions.md'];
    expect(isCriticalMiss({ outcome: 'landed', taskType: 'doc-fix', filesTouched: criticalScope })).toBe(false);
    expect(isCriticalMiss({ outcome: null, taskType: 'doc-fix', filesTouched: criticalScope })).toBe(false);
    expect(isMissRecord({ outcome: 'landed' })).toBe(false);
    expect(MISS_OUTCOMES).toEqual(['reworked', 'rejected']);
  });
});

describe('isCriticalMiss — fails closed on missing scope evidence (#4034)', () => {
  it('a reworked record with no filesTouched and no evidence is a critical miss; matching evidence clears it', () => {
    const record = { outcome: 'reworked', taskType: 'build-new-feature' };
    expect(isCriticalMiss(record)).toBe(true);
    expect(isCriticalMiss(record, { filesTouched: ['scripts/operations/operator-queue.mjs'] })).toBe(false);
  });
});

describe('criticalWorkVerdict — real-card fixtures prove the we: prefix normalisation (#4034)', () => {
  it('#4124 scope is critical via never-spot-check, gate-self and daemon-drain', () => {
    const verdict = criticalWorkVerdict({
      taskType: 'bugfix',
      filesTouched: ['we:scripts/merge-ai-prs.mjs', 'we:scripts/lane-drain.mjs', 'we:scripts/readiness/drain-lock.mjs'],
    });
    expect(verdict.critical).toBe(true);
    const proxies = verdict.reasons.map((r) => r.proxy);
    expect(proxies).toEqual(expect.arrayContaining(['never-spot-check', 'gate-self', 'daemon-drain']));
  });

  it('#4108 scope is critical via never-spot-check (irreversible) and gate-self', () => {
    const verdict = criticalWorkVerdict({ taskType: 'bugfix', filesTouched: ['we:scripts/merge-ai-prs.mjs'] });
    expect(verdict.critical).toBe(true);
    const proxies = verdict.reasons.map((r) => r.proxy);
    expect(proxies).toEqual(expect.arrayContaining(['never-spot-check', 'gate-self']));
    const neverSpotCheck = verdict.reasons.find((r) => r.proxy === 'never-spot-check');
    expect(neverSpotCheck.detail).toContain('irreversible');
  });

  it('#4131 scope is critical via daemon-drain', () => {
    const verdict = criticalWorkVerdict({
      taskType: 'bugfix',
      filesTouched: ['we:scripts/conveyor/health-watch-core.mjs', 'we:scripts/conveyor/health-watch.mjs'],
    });
    expect(verdict.critical).toBe(true);
    expect(verdict.reasons.some((r) => r.proxy === 'daemon-drain')).toBe(true);
  });

  it('#4081 scope is NOT critical', () => {
    const verdict = criticalWorkVerdict({ taskType: 'build-new-feature', filesTouched: ['we:scripts/operations/operator-queue.mjs'] });
    expect(verdict).toEqual({ critical: false, reasons: [] });
  });

  it('#4071 scope is NOT critical', () => {
    const verdict = criticalWorkVerdict({
      taskType: 'build-new-feature',
      filesTouched: ['we:scripts/lib/telemetry.mjs', 'we:scripts/operations/telemetry-summary-io.mjs'],
    });
    expect(verdict).toEqual({ critical: false, reasons: [] });
  });

  it('a docs/agent path is critical', () => {
    expect(criticalWorkVerdict({ taskType: 'doc-fix', filesTouched: ['docs/agent/some-rule.md'] }).critical).toBe(true);
  });

  it('an empty scope is critical with proxy unknown-scope (fail closed)', () => {
    const verdict = criticalWorkVerdict({ taskType: 'build-new-feature', filesTouched: [] });
    expect(verdict.critical).toBe(true);
    expect(verdict.reasons).toEqual([{ proxy: 'unknown-scope', detail: expect.any(String) }]);
  });
});

describe('criticalMissesFor (#4034)', () => {
  const legacyRow = (extra = {}) => ({
    provider: 'codex',
    model: 'gpt-6-astra',
    taskType: 'bugfix',
    outcome: 'reworked',
    pr: null,
    dispatchKind: 'session-delegation',
    taskDescription: 'Harden codex-direct-task.mjs / gemini-direct-task.mjs — round 1 of 3',
    ...extra,
  });

  it('returns only the critical misses of the requested taskType, over a mixed array', () => {
    const scorecards = [
      legacyRow({ scoredAt: '2026-09-01T00:00:00Z' }),
      { provider: 'codex', model: 'gpt-6-astra', taskType: 'doc-fix', outcome: 'reworked', scoredAt: '2026-09-02T00:00:00Z' },
      { provider: 'gemini', model: 'gemini-3.1-pro', taskType: 'bugfix', outcome: 'landed', scoredAt: '2026-09-03T00:00:00Z' },
    ];
    const misses = criticalMissesFor(scorecards, 'bugfix');
    expect(misses).toHaveLength(1);
    expect(misses[0]).toMatchObject({ provider: 'codex', model: 'gpt-6-astra', taskType: 'bugfix' });
  });

  it('accepts the {records} store shape', () => {
    const scorecards = { records: [legacyRow({ scoredAt: '2026-09-01T00:00:00Z' })] };
    expect(criticalMissesFor(scorecards, 'bugfix')).toHaveLength(1);
  });

  it('fails closed on legacy rows with no filesTouched evidence (2 entries); clears once filesTouched is a non-critical scope (0 entries)', () => {
    const rows = [
      legacyRow({ scoredAt: '2026-09-01T00:00:00Z' }),
      legacyRow({ scoredAt: '2026-09-05T00:00:00Z' }),
    ];
    expect(criticalMissesFor(rows, 'bugfix')).toHaveLength(2);

    const rowsWithScope = rows.map((r) => ({ ...r, filesTouched: ['scripts/codex-direct-task.mjs', 'scripts/gemini-direct-task.mjs'] }));
    expect(criticalMissesFor(rowsWithScope, 'bugfix')).toHaveLength(0);
  });
});

describe('module load order (#4034)', () => {
  it('critical-work.mjs and provider-routing.mjs both load with no TDZ error', async () => {
    const providerRouting = await import('../provider-routing.mjs');
    expect(typeof providerRouting.selectProvider).toBe('function');
    expect(typeof criticalWorkVerdict).toBe('function');
  });
});
