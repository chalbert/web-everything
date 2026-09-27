/**
 * @file scripts/conveyor/health-smells-notify-list.mjs
 * Lives OUTSIDE `health-smells/` on purpose (mirrors `health-smells-shape.mjs`): every `.mjs` file in that
 * directory is disk-discovered as a smell module by `health-smells/index.mjs`, so this plain data file (no
 * default export) sitting inside it would fail the smell shape check and break the whole registry at import.
 * @description #4077 continuation — ONE declared place for "which signs notify even in shadow mode" (health-watch's
 *   global mode today). Before this file, that opt-in lived as a scattered `notifyEvenInShadow: true` field
 *   hand-added to each individual smell's own definition file — seven of them, accreted one incident at a time
 *   (`claude-auth-expired`, `daemon-held-on-last-good`, `dispatch-permission-stall`, `dispatch-refused-stale-clone`,
 *   `duplicate-live-sessions`, `machine-overload`, `bg-isolation-stall`), with no single place that named the
 *   whole notify surface. `health-watch-core.mjs#planActions` now checks a smell's `id` against this Set
 *   instead of reading a field off the smell object — see that function's own `notifySet` param.
 *
 * OPERATOR DECISION (Sun 2026-09-27 ~7:40 AM ET): the night of 2026-09-26→27 the watch opened a real episode
 * for every outage (rebuild freezes, 0 acquirable lanes, the drain's gh-rate-limit window, duplicate heals,
 * stalled fixers, orphaned PRs, a silent daemon) but notified on almost none of them, because the OLD scattered
 * flag's set did not line up with what actually fired that night. The operator reviewed the night's real
 * episodes and reset the notify surface to exactly these eight signs — one notification per episode, the
 * existing dedupe/cooldown/flap rules unchanged — and left every other sign record-only (shadow), INCLUDING
 * every sign the old scattered flag used to cover that is not relisted below (`claude-auth-expired`,
 * `daemon-held-on-last-good`, `dispatch-permission-stall`, `machine-overload`, `bg-isolation-stall` — real
 * signs, just not ones that fired last night; a later operator decision can re-add any of them here).
 */
export const NOTIFY_EVEN_IN_SHADOW = new Set([
  'drain-failing-repeatedly',   // drain gh-error / pass-failed streak — 2026-09-27 ~04:04-04:33Z
  'dispatch-refused-stale-clone',
  'lane-starvation',            // fewer than 5 acquirable lanes — 2026-09-27 ~01:30Z, 0 acquirable
  'gh-call-failures',
  'gh-graphql-budget',
  'duplicate-live-sessions',
  'pr-no-owner',
  'daemon-silent',
]);
