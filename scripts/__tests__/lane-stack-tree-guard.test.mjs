/**
 * @file scripts/__tests__/lane-stack-tree-guard.test.mjs
 * @description Unit proof of #2900 A1 — the PURE decision behind `recheck`/`record` refusing to certify from a
 * tree that is not a lane clone. The e2e suite (`lane-stack-e2e.test.mjs`) drives throwaway clones, which are
 * by construction neither lane clones NOR the script's own primary root, so it can exercise A2/A3 but not this
 * verdict. Hence the pure seam: `laneTreeVerdict` is where the whole A1 rule lives, and it is asserted here.
 *
 * The rule is deliberately NARROW. It refuses exactly one shape — the operator running the seam from the
 * checkout the script itself lives in — because that is the observed incident and the only case we can call
 * with certainty. Every other tree is allowed through to A2, which catches a vacuous certification on its own.
 */
import { describe, it, expect } from 'vitest';
import { laneTreeVerdict } from '../readiness/lane-tree-guard.mjs';

const PRIMARY = '/Users/dev/workspace/webeverything';
const LANE = '/Users/dev/workspace/.lanes/web-everything/lane-7';

describe('#2900 A1 — laneTreeVerdict', () => {
  it('REFUSES the primary checkout the script itself lives in — the observed incident', () => {
    expect(laneTreeVerdict({ tree: PRIMARY, selfRoot: PRIMARY }))
      .toEqual({ ok: false, reason: 'primary-checkout' });
  });

  it('REFUSES a subdirectory of that primary too (cwd need not be the root)', () => {
    expect(laneTreeVerdict({ tree: `${PRIMARY}/scripts`, selfRoot: PRIMARY }).ok).toBe(false);
  });

  it('ALLOWS a lane clone — the intended case', () => {
    expect(laneTreeVerdict({ tree: LANE, selfRoot: PRIMARY }))
      .toEqual({ ok: true, reason: 'lane-clone' });
    expect(laneTreeVerdict({ tree: `${LANE}/scripts`, selfRoot: PRIMARY }).ok).toBe(true);
  });

  it('ALLOWS anything when the script is itself running from a lane clone', () => {
    // A lane clone's own `scripts/lane-stack.mjs` measuring that lane: both sides are under /.lanes/.
    expect(laneTreeVerdict({ tree: LANE, selfRoot: LANE }).ok).toBe(true);
  });

  it('ALLOWS a foreign tree — a temp clone is not ours to judge; A2 covers it', () => {
    expect(laneTreeVerdict({ tree: '/var/folders/xx/lane-stack-e2e-abc/laneA', selfRoot: PRIMARY }))
      .toEqual({ ok: true, reason: 'foreign-tree' });
  });

  it('is a no-op on missing input rather than a throw — never unwinds a seam on a bad probe', () => {
    expect(laneTreeVerdict()).toEqual({ ok: true, reason: 'no-tree' });
    expect(laneTreeVerdict({ tree: '' }).ok).toBe(true);
    expect(laneTreeVerdict({ tree: PRIMARY, selfRoot: null }).ok).toBe(true);   // no root to compare → not our call
  });

  it('does not confuse a sibling repo that merely shares a path prefix', () => {
    // `…/webeverything-notes` must not read as "under …/webeverything".
    expect(laneTreeVerdict({ tree: `${PRIMARY}-notes`, selfRoot: PRIMARY }).ok).toBe(true);
  });
});
