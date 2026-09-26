/**
 * Explain dispatch admission using the live dispatcher's read and predicate.
 * No scheduler, IO, or predicate is defined here. `gates` is the actual short-circuit
 * path through shapeDispatchRead; `buildAdmission` carries the upstream planner's
 * own trace (a build hold can still route to a prepare or repair launch).
 */
import { op } from './registry.mjs';
import { compute } from './step-kinds.mjs';
import { shapeDispatchRead, DEFAULT_EXPECTED_WITHIN_MINUTES } from './dispatch-lane.mjs';

export const DISPATCH_ELIGIBILITY_OP = 'dispatch-eligibility';

export function dispatchEligibilityOperation({ readTick } = {}) {
  if (typeof readTick !== 'function') {
    throw new TypeError('dispatch-eligibility: needs a `readTick` reader');
  }
  return op(DISPATCH_ELIGIBILITY_OP, {
    input: {
      item: { type: 'string', required: false, default: '' },
      bookkeepingFile: { type: 'string', required: false, default: '' },
      expectedWithinMinutes: { type: 'number', required: false, default: DEFAULT_EXPECTED_WITHIN_MINUTES },
    },
    verdictFrom: 'assess',
    read: compute({
      reads: ['input.item', 'input.bookkeepingFile', 'input.expectedWithinMinutes'],
      fn: ({ input }) => {
        const raw = readTick({ num: input.item, all: !input.item, bookkeepingFile: input.bookkeepingFile, verbose: false });
        const rows = input.item ? [raw] : raw;
        if (!Array.isArray(rows)) throw new TypeError('dispatch-eligibility: whole-queue reader must return an array');
        return rows.map((row) => {
          let read;
          try {
            read = shapeDispatchRead(row, { num: row.resolvedNum, expectedWithinMinutes: input.expectedWithinMinutes });
          } catch (error) {
            if (input.item) throw error;
            // A malformed item must not hide the rest of the queue. Do not invent a
            // gate trace for a shaping call that did not return its evidence.
            read = { num: row.resolvedNum, dispatching: false, gates: [], error: String(error?.message ?? error) };
          }
          // Keep the admission evidence, not every filled agent brief and the whole tick's
          // hypothetical bookkeeping repeated once per queue item.
          return {
            num: read.num,
            ...(read.error !== undefined ? { error: read.error } : {}),
            dispatching: read.dispatching,
            holdReason: read.holdReason,
            gates: read.gates,
            launchKind: read.launchKind,
            lane: read.lane,
            bookkeepingSource: read.bookkeepingSource,
            droppedBookkeeping: read.droppedBookkeeping,
            unreadableRunRecords: read.unreadableRunRecords,
            dispatchLiveness: read.dispatchLiveness,
            observedAt: row.observedAt ?? null,
            // #3906 — the computed route and the worker model the tier table plans, so the whole-queue report
            // shows WHO would run each item, not only WHETHER it would dispatch.
            route: routeSummary(row.routing),
            plannedWorkerModel: row.plannedWorkerModel ?? null,
            buildAdmission: row.admission ?? null,
            markers: {
              status: row.item?.status ?? null,
              deliveryAgent: row.item?.deliveryAgent ?? null,
              deliveryTarget: row.item?.deliveryTarget ?? null,
              deliveryBase: row.item?.deliveryBase ?? null,
            },
          };
        });
      },
    }),
    assess: compute({
      reads: ['findings.read'],
      fn: ({ findings }) => ({
        items: findings.read.map((row) => ({
          num: row.num,
          ...(row.error !== undefined ? { error: row.error } : {}),
          eligible: row.dispatching,
          firstBlockingGate: firstBlockingGate(row),
          reason: row.holdReason,
          gates: row.gates,
          buildAdmission: row.buildAdmission,
          markers: row.markers,
          launchKind: row.launchKind,
          lane: row.lane,
          observedAt: row.observedAt,
          guardsFrom: row.bookkeepingSource,
          droppedBookkeeping: row.droppedBookkeeping,
          unreadableRunRecords: row.unreadableRunRecords,
          dispatchLiveness: row.dispatchLiveness,
          route: row.route,
          plannedWorkerModel: row.plannedWorkerModel,
        })),
      }),
    }),
  });
}

/** #3906 — the routing record's decision fields, without its audit trail (the report stays one line per item). */
function routeSummary(routing) {
  if (!routing || typeof routing !== 'object') return null;
  return {
    outcome: routing.outcome ?? null, taskType: routing.taskType ?? null, routed: routing.routed ?? null,
    executed: routing.executed ?? null, model: routing.model ?? null, tier: routing.tier ?? null,
    supervision: routing.supervision ?? null, refusal: routing.refusal ?? null,
  };
}

/** Name the failing condition already recorded by the dispatcher, without evaluating it again. */
function firstBlockingGate(row) {
  const failed = row.gates.find((gate) => !gate.pass);
  if (failed?.name !== 'tick-launch') return failed?.name ?? null;
  const observation = failed.observed;
  if (observation.suppressed) return `tick-${observation.suppressed.by}`;
  return row.buildAdmission?.prepare?.gates.find((gate) => !gate.pass)?.name
    ?? row.buildAdmission?.gates.find((gate) => !gate.pass)?.name
    ?? row.buildAdmission?.selection?.find((gate) => !gate.pass)?.name
    ?? row.buildAdmission?.held?.reason
    ?? failed.name;
}
