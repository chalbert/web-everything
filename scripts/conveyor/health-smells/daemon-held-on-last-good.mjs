/**
 * x5wbsbc (epic #4075/#3383) — health-watch sign for a daemon clone the rebuild has FROZEN on its last-good
 * build after a failed live smoke, instead of blocking delivery. Operator ruling 2026-09-26: when the new
 * `origin/main` (or an overlay) fails the live smoke, or the smoke harness/environment itself is broken, the
 * daemon-rebuild mechanism (`scripts/lib/daemon-rebuild.mjs`'s `smokeAndAdopt`/`hold`) leaves the clone on its
 * last-good build and keeps it dispatching from there instead of blocking delivery — a deliberate, correct
 * choice, but one that must not go unnoticed forever. This sign opens once a clone has sat held for more than
 * `heldForMs` (15 minutes) and names the reason plus the exact failing check(s), so the operator (or a fix
 * session) knows whether to fix the new tree or the smoke harness itself.
 *
 * Reads `~/.claude/daemon-self-sync-state/<cloneKey>.rebuild.json`'s `held` field, passed through by
 * `health-watch.mjs#probeSelfSync` (see `daemon-rebuild.mjs`'s own doc for the exact shape:
 * `{since, reason: 'smoke-rejected'|'smoke-harness-broken'|'smoke-transient'|'smoke-threw', failed, details,
 * lastGood, target, mainSha, updatedAt}`). Any later adoption clears `held` back to `null`, closing this
 * episode the very next tick.
 *
 * `notifyEvenInShadow: true` — same posture as `claude-auth-expired` (#4077 continuation): a clone silently
 * stuck dispatching from stale code is exactly the class of thing shadow mode's blanket notify-suppression
 * must not swallow.
 */
import { MINUTE, HOUR, fmtAge } from '../health-watch-core.mjs';

/** Past this age, the hold itself becomes the headline, whatever the reason (`measure.overMaxAge`). */
export const MAX_HELD_AGE_MS = 24 * HOUR;

export default {
  id: 'daemon-held-on-last-good',
  scope: 'host',
  cadence: 'every-tick',
  probes: ['selfSync'],
  openAfter: 1,
  closeAfter: 1,
  severity: 'high',
  action: 'alert',
  notifyEvenInShadow: true,
  heldForMs: 15 * MINUTE,
  recommendationHint: 'A daemon clone is held on its last-good build after a failed live smoke — its alerts file names the failing check(s); fix the tree (or, if the harness itself is broken, the tool the check exercises) — never the clone by hand.',
  evaluate({ selfSync }, { now }) {
    return (selfSync || []).map((c) => {
      const held = c.rebuild?.held ?? null;
      const since = held?.since ?? null;
      const heldMs = since != null ? now - since : null;
      const heldMin = heldMs != null ? Math.round(heldMs / MINUTE) : null;
      const breach = !!held && since != null && heldMs > this.heldForMs;
      const failedChecks = held?.failed || null;
      const lastGood12 = held?.lastGood ? String(held.lastGood).slice(0, 12) : null;
      const overMaxAge = heldMs != null && heldMs > MAX_HELD_AGE_MS;
      const reasonPart = held ? `${held.reason}${failedChecks ? `: ${failedChecks}` : ''}` : null;

      return {
        subject: `clone:${c.cloneKey}`,
        breach,
        measure: {
          heldReason: held?.reason ?? null,
          heldSinceIso: since != null ? new Date(since).toISOString() : null,
          heldMin,
          failedChecks,
          lastGood: held?.lastGood ?? null,
          target: held?.target ?? null,
          overMaxAge,
        },
        summary: held
          ? `clone ${c.cloneKey} held on its last-good build ${lastGood12 ?? '?'} for ${fmtAge(heldMs)}${reasonPart ? ` (${reasonPart})` : ''} — still dispatching from it.`
          : `clone ${c.cloneKey}: not held.`,
        recommendation: !held
          ? `clone ${c.cloneKey} is not currently held on its last-good build.`
          : held.reason === 'smoke-harness-broken'
            ? `The smoke harness/environment itself fails${failedChecks ? ` (${failedChecks})` : ''} — it fails the same way even on the last-good build, so this is not a regression in the new tree. Fix the tool the named check exercises, not the clone; it keeps dispatching from its last-good build (${lastGood12 ?? '?'}) meanwhile. Full history: ~/.claude/daemon-self-sync-state/${c.cloneKey}.alerts.jsonl.`
            : `The new origin/main (or an overlay) fails ${failedChecks || 'the smoke gate'} — fix that in the tree, not the clone. Per the 2026-09-26 operator ruling, the clone keeps dispatching from its last-good build (${lastGood12 ?? '?'}) meanwhile rather than blocking delivery. Full history: ~/.claude/daemon-self-sync-state/${c.cloneKey}.alerts.jsonl.`,
      };
    });
  },
};
