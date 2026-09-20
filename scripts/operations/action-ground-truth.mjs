/** #3383 — Read-only ground truth for durable dispatch actions; all IO is injectable.
 * Residual risks: a mechanical review longer than the 15-minute absence grace could be re-dispatched
 * by a second driver; listing lag is guarded only by minObservedMs; a corrupt unrelated action/run
 * record blocks all dispatch until fixed with action-cli/by hand.
 */
import { execFileSync } from 'node:child_process';
import { defaultListAgents, isDispatchHandleLive } from './dispatch-lane-io.mjs';
import { AGENT_GONE_STATES } from '../conveyor/lease-reaper.mjs';
import { pidAlive } from './coordination-lock.mjs';
import { milliseconds, withResult } from './action-record.mjs';

export function createGroundTruthPorts({ run = execFileSync, listAgentsFn = defaultListAgents,
  isPidAlive = pidAlive, now = Date.now, minObservedMs = 10 * 60_000 } = {}) {
  const listAgents = () => withResult(listAgentsFn({ all: true }), (sessions) => {
    if (!Array.isArray(sessions) || sessions.some((s) => !s || typeof s.sessionId !== 'string' || !s.sessionId.trim())) {
      throw new Error('Unreadable agent listing');
    }
    return sessions.map(({ sessionId, name, state }) => ({ sessionId, handle: sessionId, name, state }));
  });
  const findEffect = (record) => withResult(listAgents(record), (sessions) => {
    const found = record.evidence?.sessionSlug && sessions.find((s) => s.name === record.evidence.sessionSlug);
    return found ? { found: true, handle: found.sessionId } : { found: false };
  });
  const postconditionHolds = (record) => {
    // Mechanical review run ids (review-pr-<uuid>) are not agent handles. Everything else is
    // conservatively checked as a session; the existing matcher owns short/full session-id matching.
    const handle = record.handle;
    const agentHandle = handle && !(record.kind === 'review' && /^(?:run|review-pr)-/.test(handle));
    const handleHolds = () => {
      if (!agentHandle) return false; // No applicable positive signal cannot prove completion.
      return withResult(listAgents(record), (sessions) => {
        // Existing detached providers use pid:<n>; accept the operator-facing detached:<n> alias too.
        const canonicalHandle = handle.replace(/^detached:(\d+)$/, 'pid:$1');
        const observedAt = record.observedAt ?? record.history?.find((h) => h.state === 'observed')?.at;
        // --all includes historical sessions. Reuse the reaper's terminal vocabulary, while
        // leaving identity/prefix matching to the dispatch helper. Unknown states still hold.
        const liveSessions = sessions.filter((s) => !AGENT_GONE_STATES.has(s.state));
        return isDispatchHandleLive(canonicalHandle, liveSessions, { isPidAlive }) === false
          && Number.isFinite(milliseconds(observedAt)) && milliseconds(now()) - milliseconds(observedAt) >= minObservedMs;
      });
    };
    if (record.subject.type !== 'pr') return handleHolds();
    return withResult(run('gh', ['pr', 'view', String(record.subject.id), '--repo', record.repo, '--json', 'state,labels'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000,
    }), (out) => {
      const pr = JSON.parse(String(out));
      if (!['OPEN', 'MERGED', 'CLOSED'].includes(pr?.state) || !Array.isArray(pr.labels)
        || pr.labels.some((l) => !l || typeof l.name !== 'string')) throw new Error('Unreadable PR evidence');
      const closed = pr.state === 'MERGED' || pr.state === 'CLOSED';
      const label = record.kind === 'review' ? 'review:pending' : record.kind === 'fix' ? 'review:changes' : null;
      const prHolds = closed || (label !== null && !pr.labels.some((l) => l.name === label));
      // Read all applicable signals, even when the label still holds the action, so read failures surface.
      return agentHandle ? withResult(handleHolds(), (absent) => (closed || label === null || prHolds) && absent) : prHolds;
    });
  };
  return { listAgents, findEffect, postconditionHolds };
}
export const defaultGroundTruth = () => createGroundTruthPorts();
