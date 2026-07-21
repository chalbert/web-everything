/**
 * @file scripts/readiness/__tests__/scope-lease-collect.test.mjs
 * @description Unit proof of the LIVE scope-lease COLLECTOR's PURE core (WE epic #2560 — the IO boundary for the
 *   pure observer). Drives {@link qualifyPaths}, {@link parseObservedFiles}, {@link resolvePredictedScope} and
 *   {@link collectSnapshot} directly with raw strings + injected fakes (NO real git/fs), and an END-TO-END pure
 *   test that composes the real observer ({@link liveScopePicture}) over a collected snapshot. Pins:
 *   the predicted=observed default, the leased-only filter, session pass-through, the committed∪uncommitted
 *   observed union (rename-aware), and that a collected overlap surfaces through the observer.
 */
import { describe, it, expect } from 'vitest';
import {
  qualifyPaths,
  parseObservedFiles,
  resolvePredictedScope,
  collectSnapshot,
} from '../scope-lease-collect.mjs';
import { liveScopePicture } from '../scope-lease-live.mjs';

describe('qualifyPaths — repo-qualify, skip empties, pass through when no key', () => {
  it('qualifies each path with the repo key', () => {
    expect(qualifyPaths('we', ['src/a.ts', 'src/b.ts'])).toEqual(['we:src/a.ts', 'we:src/b.ts']);
  });
  it('skips empty / whitespace entries', () => {
    expect(qualifyPaths('we', ['src/a.ts', '', '   ', null, undefined])).toEqual(['we:src/a.ts']);
  });
  it('passes paths through unqualified when repoKey is null / empty', () => {
    expect(qualifyPaths(null, ['src/a.ts'])).toEqual(['src/a.ts']);
    expect(qualifyPaths('', ['src/a.ts'])).toEqual(['src/a.ts']);
  });
  it('tolerates a non-array files input', () => {
    expect(qualifyPaths('we', null)).toEqual([]);
  });
});

describe('parseObservedFiles — union committed diff + porcelain, rename-aware, deduped, qualified', () => {
  it('unions the committed range and the uncommitted working tree', () => {
    const observed = parseObservedFiles({
      diffOut: 'src/a.ts\nsrc/b.ts\n',
      porcelainOut: ' M src/c.ts\n?? src/d.ts\n',
      repoKey: 'we',
    });
    expect(observed.sort()).toEqual(['we:src/a.ts', 'we:src/b.ts', 'we:src/c.ts', 'we:src/d.ts'].sort());
  });
  it('handles a porcelain rename `old -> new` (keeps the new path)', () => {
    const observed = parseObservedFiles({
      diffOut: '',
      porcelainOut: 'R  src/old.ts -> src/new.ts\n',
      repoKey: 'we',
    });
    expect(observed).toEqual(['we:src/new.ts']);
  });
  it('dedupes a path present in both the committed diff and the working tree', () => {
    const observed = parseObservedFiles({
      diffOut: 'src/a.ts\n',
      porcelainOut: ' M src/a.ts\n',
      repoKey: 'we',
    });
    expect(observed).toEqual(['we:src/a.ts']);
  });
  it('tolerates empty inputs → empty list', () => {
    expect(parseObservedFiles({})).toEqual([]);
    expect(parseObservedFiles({ diffOut: '', porcelainOut: '', repoKey: 'we' })).toEqual([]);
  });
  it('passes paths through unqualified when repoKey is null', () => {
    expect(parseObservedFiles({ diffOut: 'src/a.ts\n', repoKey: null })).toEqual(['src/a.ts']);
  });
});

describe('resolvePredictedScope — the #2560 predicted=observed default', () => {
  it('with a non-empty plan → the normalized plan (breach detection ON)', () => {
    expect(resolvePredictedScope({ observed: ['we:src/a.ts'], plan: ['we:src/a', 'we:src/a'] }))
      .toEqual(['we:src/a']); // normScope dedupes
  });
  it('with a null plan → observed values, but a FRESH array (predicted must not alias observed)', () => {
    const observed = ['we:src/a.ts', 'we:src/b.ts'];
    const predicted = resolvePredictedScope({ observed, plan: null });
    expect(predicted).toEqual(observed);
    expect(predicted).not.toBe(observed); // a distinct array — no shared-reference mutation footgun
  });
  it('with an empty-array plan → observed values, still a fresh (non-aliasing) array', () => {
    const observed = ['we:src/a.ts'];
    const predicted = resolvePredictedScope({ observed, plan: [] });
    expect(predicted).toEqual(observed);
    expect(predicted).not.toBe(observed);
  });
  it('a non-empty declared scope WINS over both plan and observed (#2560 marker-declared source)', () => {
    expect(resolvePredictedScope({
      observed: ['we:src/obs.ts'],
      plan: ['we:src/plan'],
      declared: ['we:src/dec', 'we:src/dec'], // normScope dedupes
    })).toEqual(['we:src/dec']);
  });
  it('an empty declared scope falls through to plan (then observed)', () => {
    expect(resolvePredictedScope({ observed: ['we:src/obs.ts'], plan: ['we:src/plan'], declared: [] }))
      .toEqual(['we:src/plan']);
  });
});

// A tiny lane-status factory matching lane-pool's `status --json` row shape.
// `predictedScope` (#2560) → the lease marker's advisory declared scope (from `acquire --scope=`), when set.
const laneRow = (lane, { leased = true, session = `sess-${lane}`, path = `/pool/lane-${lane}`, predictedScope } = {}) => ({
  lane,
  path,
  exists: true,
  head: 'abc1234',
  branch: 'main',
  clean: true,
  behind: 0,
  deps: 'ok',
  lease: leased ? { session, ...(predictedScope ? { predictedScope } : {}) } : null,
  leased,
});

describe('collectSnapshot — pool rows → the observer lease shape', () => {
  it('filters out non-leased lanes (leased:false)', () => {
    const poolStatus = { lanes: [laneRow(1), laneRow(2, { leased: false })] };
    const observedForLane = () => ['we:src/a.ts'];
    const leases = collectSnapshot({ poolStatus, observedForLane });
    expect(leases).toHaveLength(1);
    expect(leases[0].lane).toBe(1);
  });

  it('maps session from the lease and echoes lane', () => {
    const poolStatus = { lanes: [laneRow(7, { session: 'drain-7' })] };
    const leases = collectSnapshot({ poolStatus, observedForLane: () => [] });
    expect(leases[0].session).toBe('drain-7');
    expect(leases[0].lane).toBe(7);
  });

  it('session is null when the lease has none', () => {
    const poolStatus = { lanes: [{ ...laneRow(1), lease: {} }] };
    const leases = collectSnapshot({ poolStatus, observedForLane: () => [] });
    expect(leases[0].session).toBe(null);
  });

  it('predicted = observed when no plan (the default)', () => {
    const poolStatus = { lanes: [laneRow(1)] };
    const observed = ['we:src/a.ts', 'we:src/b.ts'];
    const leases = collectSnapshot({ poolStatus, observedForLane: () => observed });
    expect(leases[0].predictedScope).toEqual(observed);
    expect(leases[0].observedScope).toEqual(observed);
  });

  it('predicted = plan when planForLane supplies one', () => {
    const poolStatus = { lanes: [laneRow(1)] };
    const leases = collectSnapshot({
      poolStatus,
      observedForLane: () => ['we:src/a/x.ts'],
      planForLane: () => ['we:src/a'],
    });
    expect(leases[0].predictedScope).toEqual(['we:src/a']);
    expect(leases[0].observedScope).toEqual(['we:src/a/x.ts']);
  });

  it('marker predictedScope (from acquire --scope=) WINS over both observed and any plan (#2560)', () => {
    const poolStatus = { lanes: [laneRow(1, { predictedScope: ['we:src/declared.ts'] })] };
    const leases = collectSnapshot({
      poolStatus,
      observedForLane: () => ['we:src/observed.ts'],
      planForLane: () => ['we:src/planned'],
    });
    expect(leases[0].predictedScope).toEqual(['we:src/declared.ts']); // marker scope, not observed/plan
    expect(leases[0].observedScope).toEqual(['we:src/observed.ts']);
  });

  it('produces the exact observer lease shape (no breachAttempt)', () => {
    const poolStatus = { lanes: [laneRow(1)] };
    const leases = collectSnapshot({ poolStatus, observedForLane: () => ['we:src/a.ts'] });
    expect(Object.keys(leases[0]).sort()).toEqual(['lane', 'observedScope', 'predictedScope', 'session']);
    expect('breachAttempt' in leases[0]).toBe(false);
  });

  it('tolerates a pool status with no lanes', () => {
    expect(collectSnapshot({ poolStatus: {}, observedForLane: () => [] })).toEqual([]);
  });
});

describe('END-TO-END (pure) — collectSnapshot → liveScopePicture', () => {
  it('two leased lanes whose observed scopes OVERLAP ⇒ the observer reports the overlap, clean:false', () => {
    const poolStatus = { lanes: [laneRow(1), laneRow(2)] };
    const observedByLane = {
      1: ['we:src/shared.ts', 'we:src/a.ts'],
      2: ['we:src/shared.ts', 'we:src/b.ts'], // overlaps lane-1 on we:src/shared.ts
    };
    const leases = collectSnapshot({ poolStatus, observedForLane: (l) => observedByLane[l.lane] });
    const picture = liveScopePicture({ leases });
    expect(picture.overlaps).toHaveLength(1);
    expect([picture.overlaps[0].a, picture.overlaps[0].b].sort()).toEqual([1, 2]);
    expect(picture.overlaps[0].outcome).toBeTruthy(); // an outcome is present (wait, by default policy)
    expect(picture.clean).toBe(false);
    // predicted=observed ⇒ no false breach on either lane.
    expect(picture.breachedLanes).toEqual([]);
  });

  it('two leased lanes with DISJOINT observed scopes ⇒ clean:true, no overlaps', () => {
    const poolStatus = { lanes: [laneRow(1), laneRow(2)] };
    const observedByLane = {
      1: ['we:src/a.ts'],
      2: ['we:src/b.ts'],
    };
    const leases = collectSnapshot({ poolStatus, observedForLane: (l) => observedByLane[l.lane] });
    const picture = liveScopePicture({ leases });
    expect(picture.overlaps).toEqual([]);
    expect(picture.clean).toBe(true);
  });
});
