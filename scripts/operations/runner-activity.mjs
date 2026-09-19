/** Read-only runner report. The IO shell supplies observations; both declared steps are compute. */
import { op } from './registry.mjs';
import { compute } from './step-kinds.mjs';

export const RUNNER_ACTIVITY_OP = 'runner-activity';

/** A quiet queue is not a stall. Only stale driver evidence or the tick's own diagnosis says stalled. */
export function assessRunnerActivity(read) {
  if (!read || !Array.isArray(read.inFlightDispatches) || !Array.isArray(read.completedDispatches)) {
    throw new TypeError('runner-activity: unreadable snapshot is not a down runner');
  }
  const { runner, lastTick, observedAt, staleAfterMs } = read;
  let state;
  let stalled = false;
  let stalledReason;
  if (!runner.present) {
    state = 'down';
    stalledReason = 'No singleton runner lease exists; no runner is registered.';
  } else if (!runner.alive) {
    state = 'dead';
    stalledReason = 'The recorded PID is absent or no longer identifies the conveyor runner.';
  } else {
    const heartbeatAge = Date.parse(observedAt) - Date.parse(runner.heartbeatAt);
    const tickAge = lastTick.at == null ? heartbeatAge : Date.parse(observedAt) - Date.parse(lastTick.at);
    const stale = !Number.isFinite(heartbeatAge) || !Number.isFinite(tickAge)
      || heartbeatAge > staleAfterMs || tickAge > staleAfterMs;
    stalled = stale || lastTick.stalled.length > 0;
    state = stalled ? 'alive-and-stalled' : 'alive-and-idle';
    stalledReason = stale
      ? 'Runner process exists, but its heartbeat or last tick exceeds the runner lease window (or is unreadable).'
      : lastTick.stalled.length
        ? `Tick reports held-work stalls: ${lastTick.stalled.map((s) => `#${s.num}: ${s.reason}`).join('; ')}`
        : lastTick.at == null
          ? 'Runner heartbeat is fresh; no completed tick recorded yet. No stall established.'
          : 'Runner heartbeat and tick are fresh; the tick reports no stall. Quiet work is not a stall.';
  }
  // The requested three-way state vocabulary describes driver health. Dispatch activity is a separate axis.
  const dispatching = read.inFlightDispatches.some((r) => r.live === true);
  return { ...read, state, stalled, stalledReason, dispatching };
}

export function runnerActivityOperation({ readActivity } = {}) {
  if (typeof readActivity !== 'function') throw new TypeError('runner-activity needs a readActivity reader');
  return op(RUNNER_ACTIVITY_OP, {
    input: { limit: { type: 'number', required: false, default: 10 } },
    verdictFrom: 'assess',
    read: compute({
      reads: ['input.limit'],
      fn: ({ input }) => {
        if (!Number.isInteger(input.limit) || input.limit < 0 || input.limit > 1000) {
          throw new TypeError('runner-activity: limit must be an integer from 0 to 1000');
        }
        return readActivity(input);
      },
    }),
    assess: compute({ reads: ['findings.read'], fn: ({ findings }) => assessRunnerActivity(findings.read) }),
  });
}
