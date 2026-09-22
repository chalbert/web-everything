/**
 * @file ci-heal-dispatch-routing.test.mjs — #3844 (Fork 4 "fix path" of #3801): `ci-heal` is the OTHER repair
 * kind {@link REPAIR_KINDS} names, so it walks the exact same `fixSizeSource` chain a `fix` dispatch does
 * (`we:scripts/conveyor/__tests__/reconcile-fix-routing.test.mjs`'s own new cases). Unlike `fix`, `ci-heal`
 * has no PR-bounce dispatch path of its own (`we:scripts/conveyor/reconcile-fix-dispatch.mjs` only ever plans
 * `kind: 'fix'` entries — `we:scripts/operations/dispatch-providers/ci-heal.mjs` is a detached-process
 * spawner with no `decideDispatchRoute` call of its own; the routing decision for it is made upstream, at
 * whichever io edge calls `decideDispatchRoute({kind: 'ci-heal', ...})`). So this file asserts the CONTRACT
 * directly — the same shape `we:scripts/lib/__tests__/dispatch-contracts-route.test.mjs` already asserts for
 * `build` — rather than through a spawn wrapper that carries no routing logic to test.
 */
import { describe, it, expect } from 'vitest';

import { decideDispatchRoute } from '../../../lib/dispatch-contracts.mjs';

const ciHealDispatch = (over = {}) => ({
  kind: 'ci-heal',
  cause: null,
  scopePaths: ['we:scripts/operations/dispatch-providers/ci-heal.mjs'],
  taskKey: { storyRef: '3844', round: 1, taskId: 'ci-heal' },
  ...over,
});

describe('a ci-heal dispatch takes its size from the same fixSizeSource chain a fix dispatch does', () => {
  it('records `card-size` and the size table\'s own estimate when the item declares a size', () => {
    const route = decideDispatchRoute(ciHealDispatch({ size: 2 }));
    expect(route).toMatchObject({ outcome: 'routed', sized: true, sizeSource: 'card-size', estimatedLoc: 80 });
  });

  it('falls to `measured-diff` — the PR\'s own changed-line count — when the dispatch declares no size', () => {
    const route = decideDispatchRoute(ciHealDispatch({ measuredDiffLoc: 120 }));
    expect(route).toMatchObject({ outcome: 'routed', sized: true, sizeSource: 'measured-diff', estimatedLoc: 120 });
  });

  it('falls all the way to `assumed` (the 13 band) with neither, and still dispatches under `unsizedCardPolicy: block`', () => {
    const route = decideDispatchRoute(ciHealDispatch());
    expect(route).toMatchObject({ outcome: 'routed', sized: false, sizeSource: 'assumed', estimatedLoc: 900 });
  });

  it('records `routed` against `executed` — the route decides nothing about which process actually runs, per #3844\'s own ruling', () => {
    const route = decideDispatchRoute(ciHealDispatch());
    expect(route.routed).toBe('claude');
    expect(route.executed).toBe('claude');
  });
});
