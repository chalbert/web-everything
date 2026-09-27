/**
 * Health smell — #x9fbg1x, live incident `fix-2748`/`fix-2770` (2026-09-26). A MORE SPECIFIC sibling of
 * `dispatch-permission-stall.mjs`: that smell already flags ANY dispatched background session stuck on
 * `waitingFor: "permission prompt"`, but cannot tell apart "needs its lane granted" from "stuck on Claude
 * Code's own background-session worktree-isolation guard" ("This background session hasn't isolated its
 * changes yet. Call EnterWorktree first…") — the guard `fix-2748`/`fix-2770` both hit, and which recurs across
 * 43+ transcripts since 2026-08-29. The distinguishing evidence lives only in the session's OWN transcript
 * (`we:scripts/conveyor/health-watch.mjs#probeBgIsolationStalls`, which shells the SAME detector
 * `reconcile-core.mjs#markBgIsolationStalls` uses — one implementation, not two), so this smell's `probes`
 * declares that pre-evaluated list rather than re-reading transcripts itself (`evaluate` stays pure over data,
 * per this registry's own contract).
 *
 * THE ACTUAL FIX IS `we:scripts/lib/dispatch-bg-isolation.mjs` (turns the guard off for every dispatched
 * session's own scratch cwd and every lane clone the pool provisions) — this smell is the backstop for
 * whatever still slips through a host that has not picked it up yet, mirroring `dispatch-permission-stall`'s
 * own "narrow backstop, not the fix" framing.
 */
import { MINUTE } from '../health-watch-core.mjs';

export default {
  id: 'bg-isolation-stall',
  scope: 'host',
  cadence: 'every-tick',
  probes: ['bgIsolationStalls'],
  openAfter: 1,
  closeAfter: 1,
  severity: 'high',
  action: 'alert',
  notifyEvenInShadow: true,
  recommendationHint: 'A dispatched session is stuck on Claude Code\'s own EnterWorktree/bgIsolation guard — '
    + 'its lane clone already IS its isolation. See we:scripts/lib/dispatch-bg-isolation.mjs.',
  evaluate({ bgIsolationStalls }) {
    return (Array.isArray(bgIsolationStalls) ? bgIsolationStalls : []).map((s) => ({
      subject: s.name,
      breach: true, // every row this probe returns already confirmed the stall from transcript evidence
      measure: { name: s.name, sessionId: s.sessionId ?? null, cwd: s.cwd ?? null },
      summary: `${s.name} is blocked on Claude Code's own background-session worktree-isolation guard `
        + '("Call EnterWorktree first…") — its lane clone already provides the isolation the guard is asking for.',
      recommendation: 'Do not tell the session to run `git worktree add` (this repo\'s single-branch-workflow '
        + 'guard refuses it — the exact deadlock this smell exists to catch). Confirm '
        + '`we:scripts/lib/dispatch-bg-isolation.mjs` reached this session\'s cwd '
        + '(`<cwd>/.claude/settings.local.json`\'s `worktree.bgIsolation`); if not, apply it by hand and resume, '
        + 'or redispatch once the fix is live.',
    }));
  },
};
