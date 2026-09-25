/** #3383 — Guarded dispatch flow, with synchronous and async ports. Persist intent BEFORE invoking any effect. */
import { defaultGroundTruth } from './action-ground-truth.mjs';
import { isExpired, milliseconds } from './action-record.mjs';
const chain = (value, fn) => value && typeof value.then === 'function' ? value.then(fn) : fn(value);
const hold = (value) => ({ dispatched: false, held: true, reason: value.reason ?? 'held', record: value.record ?? null });
const preSpawn = (e) => e?.notApplied === true || (['ENOENT', 'EACCES'].includes(e?.code) && String(e?.syscall ?? '').startsWith('spawn'));
export function guardedDispatch({ resource, kind, owner, actions, reconcile = (record) => actions.reconcile(record, { ...defaultGroundTruth(), owner }), effect, now = Date.now, evidence }) {
  let effectInvoked = false;
  const unavailable = (e) => { if (!effectInvoked && e?.code === 'COORDINATION_UNAVAILABLE') return { ...hold({ reason: 'unavailable' }), error: e.message }; throw e; };
  const start = (claimed) => {
    if (!claimed.ok) return hold(claimed);
    const r = claimed.record;
    const dispatching = actions.transition(r.resource, r.attempt, { token: r.ownerToken, rev: r.rev, from: 'intent', to: 'dispatching', patch: { dispatchingSince: milliseconds(now()) } });
    if (!dispatching.ok) return hold(dispatching);
    const failed = (e) => {
      if (preSpawn(e)) actions.transition(r.resource, r.attempt, { token: r.ownerToken, from: 'dispatching', to: 'terminal', patch: { outcome: 'not-started' } });
      throw e;
    };
    const completed = (result) => {
      if (result?.notStarted === true) {
        const terminal = actions.transition(r.resource, r.attempt, { token: r.ownerToken, from: 'dispatching', to: 'terminal', patch: { outcome: 'not-started' } });
        return { dispatched: true, record: terminal.record ?? dispatching.record, result, notStarted: true,
          ...(terminal.ok ? {} : { ownershipLost: true, reason: terminal.reason }) };
      }
      const handle = typeof result === 'string' ? result : result?.handle;
      if (typeof handle !== 'string' || !handle.trim()) return { dispatched: true, record: dispatching.record, result, indeterminate: true };
      const observed = actions.transition(r.resource, r.attempt, { token: r.ownerToken, from: 'dispatching', to: 'observed', patch: { handle } });
      return { dispatched: true, record: observed.record ?? dispatching.record, result, ...(observed.ok ? {} : { ownershipLost: true, reason: observed.reason }) };
    };
    try {
      effectInvoked = true;
      const result = effect({ heartbeat: () => actions.heartbeat(r.resource, r.attempt, r.ownerToken).ok === true });
      return result && typeof result.then === 'function' ? result.then(completed, failed) : completed(result);
    } catch (e) { return failed(e); }
  };
  try {
    const result = chain(actions.claim({ resource, kind, owner, reconcile, evidence }), start);
    return result && typeof result.then === 'function' ? result.catch(unavailable) : result;
  } catch (e) { return unavailable(e); }
}
export async function reconcileActions({ actions, listAgents, findEffect, postconditionHolds, now = Date.now }) {
  const results = [];
  for (const record of actions.list()) {
    if (record.state === 'terminal') continue;
    if (record.state === 'observed') results.push(await actions.settle(record.resource, record.attempt, { postconditionHolds }));
    else if (isExpired(record, now())) results.push(await actions.reconcile(record, { listAgents, findEffect, now: now() }));
  }
  return results;
}
