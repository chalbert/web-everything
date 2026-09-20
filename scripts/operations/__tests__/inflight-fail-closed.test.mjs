/** #3383 — A partial legacy run-store view is never permission to dispatch. */
import { it, expect } from 'vitest';
import { inFlightDispatchesFor, stampLiveness } from '../dispatch-lane-io.mjs';
import { shapeDispatchRead } from '../dispatch-lane.mjs';
it.each(['list', 'read'])('%s failure survives liveness stamping and refuses dispatch', (which) => {
  const store = { dir: '/tmp/fake-runs', list: () => ['bad'], read: () => { throw new Error('corrupt'); } };
  if (which === 'list') store.list = () => { throw new Error('EACCES'); };
  const result = inFlightDispatchesFor('xone', { store });
  expect(result[`${which}Failed`]).toBe(true);
  expect(result.unreadable).toBe(which === 'read' ? 1 : 0);
  const finding = shapeDispatchRead({ resolvedNum: 'xone', inFlightDispatches: stampLiveness(result) }, { num: 'xone' });
  expect(finding).toMatchObject({ dispatching: false, hold: 'store-unreadable' });
  expect(finding.holdReason).toContain('/tmp/fake-runs');
});
