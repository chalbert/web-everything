---
kind: story
size: 3
tier: pinned
status: open
scope: ["we:scripts/conveyor/reconcile-core.mjs", "we:scripts/conveyor/main-red-recovery.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# CI-heal treats a red soak-replay-gate as red

The fix/ci-heal daemons classify `ci-red` only from `DEFAULT_MAIN_RED_ATTRIBUTED_CHECKS = ['test', 'smoke', 'daemon-soak']` in `we:scripts/conveyor/main-red-recovery.mjs` (consumed by `we:scripts/conveyor/reconcile-core.mjs`). `soak-replay-gate` is not in that list, and it is also not in the repo's branch-protection required-checks list, so a PR that is red ONLY on `soak-replay-gate` reads green to the daemons — nothing gets dispatched to fix it — while the drain still refuses to merge it because that check is red. The PR stalls with no automated path forward.

## Design

The daemons' hardcoded attributed-check list and the drain's actual merge-wait list are two independently maintained sources of truth for "what counts as red." They have already drifted once (this case); nothing stops them drifting again the next time a check the drain waits on is added or renamed. Fix direction: derive the red-check set the daemons attribute from the SAME set of checks the drain itself waits on before merging, instead of keeping `DEFAULT_MAIN_RED_ATTRIBUTED_CHECKS` as an independently hardcoded array.

## MVP

- Locate the drain's own list of checks it waits on before merge (its merge-readiness / required-check read path) and expose it as an importable value if it is not already one.
- Change `DEFAULT_MAIN_RED_ATTRIBUTED_CHECKS` in `we:scripts/conveyor/main-red-recovery.mjs` to derive from — or be replaced by — that single source, so `soak-replay-gate`, and any future check the drain waits on, is automatically in the attributed set without a second hand-edit.
- Keep the change narrow: one source of truth for the check list, not a rewrite of the classification logic itself.

## Test plan

- Unit test proving `soak-replay-gate` (or any check the drain waits on) is now included in the derived red-check set used by `failingRequiredCheckForAttribution` / `isAnyRequiredCheckFailed` in `we:scripts/conveyor/main-red-recovery.mjs`.
- Regression test: a PR red only on `test`/`smoke`/`daemon-soak` still classifies exactly as before — no behavior change for the existing cases.
- An agreement test (the pattern already used elsewhere in this codebase for the same drift risk, e.g. `we:scripts/operations/file-item.mjs`'s agreement test against `we:scripts/conveyor/queue.mjs`'s `NON_DISPATCHABLE`) so the two lists can never silently diverge again.

## Proof plan (soak break)

- Before: reconstruct a PR red only on `soak-replay-gate` and show the daemon's classification call returns "not ci-red" (nothing dispatched) while the drain still parks/refuses it.
- After: same input, same call, now correctly attributes it as red, and the fix/ci-heal daemon has something to act on.
- Prefer the actual live case if it is still open or reconstructable from history, over a synthetic one.

## Follow-ups

- Audit whether any OTHER daemon keeps its own hand-maintained copy of "what counts as red" that could drift from the drain's real wait list the same way.
- Consider whether `soak-replay-gate` should also be added to GitHub branch protection's required-checks list directly — a repo-settings change, not a code change, likely needing operator action, out of scope here.


## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
