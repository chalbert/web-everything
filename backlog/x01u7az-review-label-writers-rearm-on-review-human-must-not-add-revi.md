---
kind: task
parent: "3383"
status: resolved
dateOpened: "2026-09-24"
dateStarted: "2026-09-24"
dateResolved: "2026-09-24"
tags: []
---

# Review-label writers: rearm on review:human must not add review:pending; clear-human must drop stale advisory:*; lane litter allowlist missing .conveyor/ starves review dispatch

Three live review-label bugs on chalbert/web-everything, 2026-09-24. (1) `decideSetLabel`'s `rearm` branch added
`review:pending` unconditionally, so re-arming a `review:human` bounce left BOTH hold labels live (PR #2549) —
fixed to add nothing when gate-self, since the human hold already is the pending-review state. (2)
`clear-human` dropped `review:human` but left a stamped `advisory:*` label behind with no gate left for it to
describe (PR #2578) — fixed to drop it in the same write. (3) `we:scripts/lib/lane-litter.mjs`'s known-safe-
scratch allowlist never matched `.conveyor/` or `.delivery-commit-msg-*.txt`, so ~65 of ~90 pool lanes read
"dirty" from nothing but that litter, starving `--purpose=review-loop` acquires (PR #2582 — seven straight
`blocked-on-infra` review dispatches, no advisory ever landed). A one-time `we:scripts/conveyor/review-hold-reconcile.mjs`
sweep cleans the two label strays that predate the fix.

## Done when

1. **Executable** — `npm run test:unit -- we:scripts/__tests__/review-set-label.test.mjs` and
   `we:scripts/conveyor/__tests__/rearm-review.test.mjs` fail before this item (rearm on a `review:human` PR
   asserted `addLabel === review:pending`) and pass after (`addLabel === ''`, human stays the sole hold);
   `we:scripts/lib/__tests__/lane-litter.test.mjs` fails before (`.conveyor/` / `.delivery-commit-msg-*.txt` not
   allowlisted) and passes after. **DONE.**
2. Real read-only proof against chalbert/web-everything: `node we:scripts/conveyor/review-hold-reconcile.mjs
   sweep --repo=chalbert/web-everything --dry-run` reports exactly `{num:2549, remove:[review:pending]}` and
   `{num:2578, remove:[advisory:accepted]}`, nothing else. **DONE.**
3. Real read-only proof on the live shared lane pool: `node we:scripts/lane-pool.mjs list --acquirable
   --no-cache --repo=.` goes from 0 acquirable lanes (unfixed `we:scripts/lib/lane-litter.mjs`, matching the
   observed `review-2582` starvation) to 23 acquirable lanes (fixed). **DONE.**
