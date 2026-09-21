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
