/**
 * @file promote-draft-pr-dispatch.test.mjs — draft-first PRs (operator-approved 2026-09-27):
 *   `runReconcilePromoteDraftDispatch`, the mechanical pass that calls `gh pr ready` on every PR
 *   `reconcile-core.mjs` planned `kind:'promote-draft'` for. No process is started and no real `gh` is
 *   shelled — `reconcile` and `provider` are injected, mirroring `ci-heal-pr-dispatch.test.mjs`'s own shape.
 */
import { describe, it, expect } from 'vitest';
import { runReconcilePromoteDraftDispatch } from '../promote-draft-pr-dispatch.mjs';

const FRESH = () => ({ fresh: true, behind: 0 });

describe('runReconcilePromoteDraftDispatch (draft-first PRs)', () => {
  it('calls provider.ready for every promote-draft entry, and nothing else', async () => {
    const readyCalls = [];
    const result = runReconcilePromoteDraftDispatch({
      root: '/repo',
      reconcile: () => ({
        dispatch: [
          { kind: 'promote-draft', prNumber: 101 },
          { kind: 'review', prNumber: 102 },
          { kind: 'ci-heal', prNumber: 103 },
          { kind: 'promote-draft', prNumber: 104 },
        ],
        refusals: [],
      }),
      provider: { ready: (pr) => { readyCalls.push(pr); } },
      checkStaleness: FRESH,
    });
    expect(readyCalls).toEqual([101, 104]);
    expect(result.promoted).toEqual([{ pr: 101 }, { pr: 104 }]);
    expect(result.refusals).toEqual([]);
  });

  it('an empty plan promotes nothing and refuses nothing', () => {
    const result = runReconcilePromoteDraftDispatch({
      root: '/repo', reconcile: () => ({ dispatch: [], refusals: [] }),
      provider: { ready: () => { throw new Error('must not be called'); } },
      checkStaleness: FRESH,
    });
    expect(result).toEqual({ promoted: [], refusals: [], reconcileRefusals: 0, reconcileRefusalDetails: [] });
  });

  it('a gh failure on one PR is reported as a refusal and does not stop the rest of the batch', () => {
    const readyCalls = [];
    const result = runReconcilePromoteDraftDispatch({
      root: '/repo',
      reconcile: () => ({
        dispatch: [{ kind: 'promote-draft', prNumber: 55 }, { kind: 'promote-draft', prNumber: 56 }],
        refusals: [],
      }),
      provider: {
        ready: (pr) => {
          readyCalls.push(pr);
          if (pr === 55) throw new Error('gh pr ready failed: HTTP 502');
        },
      },
      checkStaleness: FRESH,
    });
    expect(readyCalls).toEqual([55, 56]);
    expect(result.promoted).toEqual([{ pr: 56 }]);
    expect(result.refusals).toEqual([{ pr: 55, kind: 'ready-failed', why: 'gh pr ready failed: HTTP 502' }]);
  });

  it('carries the reconcile pass\'s own refusal count through, unmodified', () => {
    const result = runReconcilePromoteDraftDispatch({
      root: '/repo',
      reconcile: () => ({ dispatch: [], refusals: [{ kind: 'draft', prNumber: 9 }] }),
      provider: { ready: () => {} },
      checkStaleness: FRESH,
    });
    expect(result.reconcileRefusals).toBe(1);
    expect(result.reconcileRefusalDetails).toEqual([{ kind: 'draft', prNumber: 9 }]);
  });

  it('refuses an unknown --repo before ever calling reconcile or provider', () => {
    expect(() => runReconcilePromoteDraftDispatch({
      root: '/repo', repo: 'unknown/repo',
      reconcile: () => { throw new Error('must not be called'); },
      provider: { ready: () => { throw new Error('must not be called'); } },
      checkStaleness: FRESH,
    })).toThrow(/not a constellation repo/);
  });

  it('reads a shared `--prs-file=` snapshot instead of asking `reconcile` for a fresh gh read, when given one', () => {
    let seenReadPrs = null;
    runReconcilePromoteDraftDispatch({
      root: '/repo', prsFile: '/tmp/some-file.json',
      reconcile: (opts) => { seenReadPrs = typeof opts.readPrs; return { dispatch: [], refusals: [] }; },
      provider: { ready: () => {} },
      checkStaleness: FRESH,
    });
    expect(seenReadPrs).toBe('function');
  });
});
