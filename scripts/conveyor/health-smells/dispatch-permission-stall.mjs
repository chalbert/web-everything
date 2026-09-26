/**
 * Health smell — #xrv69j6 (epic #4075). A dispatched BACKGROUND session that hits Claude Code's own
 * outside-cwd Edit/Write permission gate has nobody there to answer it (`--bg`, no attending human) and sits
 * blocked forever — `claude agents --json` reports it as `state: "blocked"`, `status: "waiting"`,
 * `waitingFor: "permission prompt"` (`we:scripts/conveyor/health-watch.mjs#probeAgents`). Live case:
 * `fix-2735` (session `61d6f087…`, cwd `~/workspace/.operations/dispatch/7d6149ba-…`) sat blocked 36+ minutes
 * on 2026-09-26, stalling PR #2735 (`review-status:fix-stalled`) with nothing surfacing it to the operator.
 * `we:scripts/operations/dispatch-lane-io.mjs#createDispatchSinks` now pre-grants a dispatched session's lane
 * at spawn so this should stop happening going forward; this smell is the backstop for whatever still slips
 * through (a lane the grant could not resolve, an older still-running session dispatched before the fix, a
 * cause this card did not anticipate) — it is NARROW on purpose, a slice of the fuller treatment #3149
 * ("Surface stuck background-agent permission prompts to the orchestrator") and #4191 ("Surface reconcile/
 * tick notes … to the operator", parent #4075) already scope — PR comments, `operator-queue.mjs`, richer
 * per-session liveness. Both stay open for that; this only wires the health WATCH.
 *
 * `startedAt` AS THE "BLOCKED SINCE" PROXY. `claude agents --json` carries no separate "entered this state
 * at" timestamp, only the session's own start time — a loose proxy for a GENERIC background session, but a
 * tight one for a session THIS PIPELINE dispatched: its brief's opening scripted step
 * (`we:skills-src/conveyor/delivery-agent-brief.md` / `we:skills-src/conveyor/fix-agent-brief.md`, both step
 * 1) runs `we:scripts/lane-pool.mjs acquire` — the very first Edit/Write into a lane — within seconds of the
 * session starting. So for a dispatched session specifically, `startedAt` is a tight floor on "blocked
 * since". Scoped to `kind === 'background'` and a dispatched-looking session `name` (the slugs
 * `we:scripts/conveyor/session-slug.mjs#mintSessionSlug` mints: `conveyor-`, `fix-`, `ci-heal-`, `prepare-`,
 * `prepare-decision-`, `investigate-`) for exactly that reason — an INTERACTIVE session's permission wait is
 * a different, attended condition this smell has no business flagging.
 *
 * `openAfter: 1` because the breach condition already bakes in the 10-minute floor (`thresholdMs`) — the
 * same shape `claude-auth-expired.mjs`'s own `windowMs` uses, not a second, tick-counted hysteresis on top.
 */
import { MINUTE } from '../health-watch-core.mjs';

const DISPATCHED_NAME_RE = /^(conveyor|prepare-decision|prepare|investigate|fix|ci-heal)-/;

/** Which `probes.agents` rows this smell is about — background, dispatched-looking, blocked on exactly the
 *  permission-prompt wait. Exported so the evaluate body and its own test can share one definition. Pure. */
export function stuckOnPermissionPrompt(agents) {
  return (Array.isArray(agents) ? agents : []).filter((a) => (
    a?.kind === 'background'
    && a?.state === 'blocked'
    && a?.waitingFor === 'permission prompt'
    && DISPATCHED_NAME_RE.test(String(a?.name || ''))
  ));
}

export default {
  id: 'dispatch-permission-stall',
  scope: 'host',
  cadence: 'every-tick',
  probes: ['agents'],
  openAfter: 1,
  closeAfter: 1,
  severity: 'high',
  action: 'alert',
  notifyEvenInShadow: true,
  thresholdMs: 10 * MINUTE,
  recommendationHint: 'A dispatched background session is stuck on an unanswerable permission prompt — '
    + 'nobody is there to click yes. Grant its lane rather than waiting it out; see we:backlog/xrv69j6-*.md.',
  evaluate({ agents }, { now }) {
    return stuckOnPermissionPrompt(agents).map((a) => {
      const startedAt = typeof a.startedAt === 'number' ? a.startedAt : Date.parse(a.startedAt ?? '');
      const ageMs = Number.isFinite(startedAt) ? now - startedAt : null;
      const ageMin = ageMs != null ? Math.round(ageMs / MINUTE) : null;
      return {
        subject: a.name,
        breach: ageMs != null && ageMs >= this.thresholdMs,
        measure: { name: a.name, sessionId: a.sessionId ?? null, cwd: a.cwd ?? null, ageMinutes: ageMin },
        summary: `${a.name} has been blocked on a permission prompt for `
          + `${ageMin != null ? `~${ageMin} min` : 'an unknown time'} — nobody is there to answer it.`,
        recommendation: `Grant its lane directly (\`<cwd>/.claude/settings.local.json\`'s `
          + '`permissions.additionalDirectories`/`allow`) and resume it, or redispatch — going forward '
          + '`we:scripts/operations/dispatch-lane-io.mjs` grants the lane at spawn, so a fresh dispatch should '
          + 'not hit this at all. See we:backlog/xrv69j6-*.md.',
      };
    });
  },
};
