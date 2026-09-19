/**
 * @file scripts/operations/stale-state.mjs
 * @description Read-only stale-state inventory. IO is injected; both steps are compute.
 * Verdicts describe observed owner liveness, never TTL expiry or item completion.
 */
import { op } from './registry.mjs';
import { compute } from './step-kinds.mjs';

export const STALE_STATE_OP = 'stale-state';

export function staleStateOperation({ readState } = {}) {
  if (typeof readState !== 'function') throw new TypeError('stale-state: needs a readState() reader');
  return op(STALE_STATE_OP, {
    input: {},
    verdictFrom: 'assess',
    read: compute({ reads: [], fn: () => {
      const result = readState();
      if (!result || !Array.isArray(result.records) || !Array.isArray(result.gaps)) {
        throw new Error('stale-state.read: reader must return { records: [...], gaps: [...] }');
      }
      return result;
    } }),
    assess: compute({ reads: ['findings.read'], fn: ({ findings }) => ({
      ...findings.read,
      records: findings.read.records.map((record) => ({
        ...record,
        verdict: record.ownerPidAlive === true ? 'live' : record.ownerPidAlive === false ? 'dead' : 'unknown',
      })),
    }) }),
  });
}
