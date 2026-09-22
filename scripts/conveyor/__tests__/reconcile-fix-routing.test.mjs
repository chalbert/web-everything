/**
 * @file reconcile-fix-routing.test.mjs — #3717: the CAUSE reaches the router, on the one path that knows it.
 *
 * `conflict-resolution` is the router `taskType` that NO dispatch kind produces — only a CAUSE does, and
 * `we:scripts/conveyor/reconcile-fix-dispatch.mjs` is the only dispatch path that knows a bounce carried the
 * `merge-status:conflicting` label (`planFixesFromReconcile` reads it into `isConflict`). So this is where the
 * derivation's cause column stops being theoretical, and it is asserted through the REAL `dispatchFix` with
 * only its two process seams — the brief read and the spawn — injected.
 *
 * The sibling half, `review`, is asserted in `we:scripts/operations/__tests__/review-dispatch.test.mjs`'s own
 * suite through `reviewDispatchRoute`; a review is a judging role, so the provider cascade is never consulted
 * for it and there is no provider decision to assert beyond that.
 *
 * #3844 (Fork 4 "fix path" of #3801) extends this file with the `fixSizeSource` size chain — the SAME `dispatchFix`,
 * two more injected seams (`measureDiffLoc`, and `readSizePolicy` defaulted the same fail-closed way `readScorecards`
 * already is).
 */
import { describe, it, expect } from 'vitest';

import { dispatchFix } from '../reconcile-fix-dispatch.mjs';
import { reviewDispatchRoute } from '../../operations/review-dispatch.mjs';

const TEMPLATE = '# fix\nitem {{ITEM_NUM}} pr {{PR_NUM}} ref {{LANE_REF}} lane {{LANE}} slug {{SESSION_SLUG}} '
  + 'scope {{SCOPE}} {{ATTRIBUTION_KIND}} {{ATTRIBUTION_NUM}}\n';

function dispatch(planned, over = {}) {
  return dispatchFix(planned, {
    root: '/repo',
    readBrief: () => TEMPLATE,
    mintSessionId: () => '11111111-1111-4111-8111-111111111111',
    spawnAgent: () => 'backgrounded · 1ae0905c · fix-1764\n',
    readScorecards: () => [],
    ...over,
  });
}

// Each dispatch gets its OWN pr: `guardedDispatch` keys its once-only guard on the {resource, kind} pair, so
// two dispatches for one PR in one suite is a HELD second call (correct behaviour, not what this file tests).
let nextPr = 1764;
const planned = (over = {}) => ({
  itemNum: '3717', pr: (nextPr += 1), laneRef: 'lane/3717-route', lane: 9,
  scope: ['we:scripts/conveyor/reconcile-fix-dispatch.mjs'],
  ...over,
});

describe('a conflict-caused fix routes as conflict-resolution; an ordinary one as a bugfix', () => {
  it('records `conflict-resolution` when the bounce carried the conflict label', () => {
    const result = dispatch(planned({ isConflict: true }));
    expect(result.routing.taskType).toBe('conflict-resolution');
    expect(result.routing.outcome).toBe('routed');
  });

  it('records `bugfix` for a reviewer-finding bounce — the SAME kind, a different cause', () => {
    expect(dispatch(planned({ isConflict: false })).routing.taskType).toBe('bugfix');
    expect(dispatch(planned()).routing.taskType).toBe('bugfix');
  });

  it('carries both halves of the decision, so a routed-but-not-executed delegation stays visible', () => {
    const { routing } = dispatch(planned({ isConflict: true }));
    expect(routing.routed).toBe('claude');
    expect(routing.executed).toBe('claude');
    expect(routing.auditTrail.find((a) => a.criterion === 'task-type-derivation').reasoning)
      .toContain('conflict-caused');
  });

  it('computes the route from the DISPATCH, never from the brief it fills', () => {
    // the brief is a constant here; the two dispatches differ only in their cause, and so do their routes
    const a = dispatch(planned({ isConflict: true }));
    const b = dispatch(planned({ isConflict: false }));
    expect(a.prompt).toBe(b.prompt);
    expect(a.routing.taskType).not.toBe(b.routing.taskType);
  });
});

describe('a review dispatch takes the role path and chooses no provider at all', () => {
  it('has no taskType, no routed provider and a stated reason', () => {
    const route = reviewDispatchRoute();
    expect(route).toMatchObject({ outcome: 'role', role: 'review', taskType: null, routed: null, executed: null });
    expect(route.reason).toContain('judging role');
  });
});

// #3844 (Fork 4 "fix path" of #3801) — the reconcile fix path passes NO size to `decideDispatchRoute` (see
// `dispatchFix`'s own call site), so under the checked-in `unsizedCardPolicy: block` default that would
// silently stop every conflict-caused fix. `fixSizeSource` gives it two real numbers to try first: the
// item's own `size:` (already looked up by `planFixesFromReconcile`'s `findItemFn` call, carried onto
// `planned.size`), then the PR's own measured diff — both new seams on `dispatchFix`, injected below exactly
// like `readScorecards` already is.
describe('a fix dispatch takes its size from the fixSizeSource chain', () => {
  it('records `card-size` and the size table\'s own estimate when the item declares a size', () => {
    const result = dispatch(planned({ size: 2 }), { measureDiffLoc: () => { throw new Error('must not be called — card-size already answered it'); } });
    expect(result.routing).toMatchObject({ sized: true, sizeSource: 'card-size', estimatedLoc: 80 });
  });

  it('falls to `measured-diff` — the PR\'s own changed-line count — when the item declares no size', () => {
    const result = dispatch(planned(), { measureDiffLoc: () => 120 });
    expect(result.routing).toMatchObject({ sized: true, sizeSource: 'measured-diff', estimatedLoc: 120 });
  });

  it('falls all the way to `assumed` (the 13 band) with neither, and still dispatches under `unsizedCardPolicy: block`', () => {
    const result = dispatch(planned(), { measureDiffLoc: () => null });
    expect(result.routing).toMatchObject({ outcome: 'routed', sized: false, sizeSource: 'assumed', estimatedLoc: 900 });
  });

  it('never pays for the measured-diff `gh` read when the item already has a size', () => {
    let called = false;
    dispatch(planned({ size: 3 }), { measureDiffLoc: () => { called = true; return 999; } });
    expect(called).toBe(false);
  });
});
