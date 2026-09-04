---
bornAs: xmlh0rb
kind: story
size: 3
parent: "3443"
status: open
blockedBy: ["3482", "3483"]
scope: ["we:skills-src/conveyor/runner.mjs"]
dateOpened: "2026-09-04"
tags: []
---

# Graduate we:skills-src/conveyor/runner.mjs reconcile-pass wiring (the review step goes live) from lane/mechanical-dispatcher to main

Part 3 of 3 of the core reconcile-pass payload, and the piece #3443s own Done-when #2 explicitly held back pending #3437 -- #3437 is confirmed status:resolved and its name-based-bind fix (bind review-dispatch sessions by session name, not just cwd/HEAD-oid) is confirmed present on main in we:scripts/conveyor/reconcile-core.mjs as of 2026-09-04, so this is now unblocked. Wires the reconcile pass into we:skills-src/conveyor/runner.mjs so the runner actually dispatches review/fix continuously on its tick loop instead of only build/prepare -- this is the flip it live moment the whole epic has been building toward, and it should get the most scrutiny of any slice in this group: land it last, after the we:scripts/operations/route-pr-outcome.mjs and we:skills-src/conveyor/supervisor.mjs slices are on main, and validate with a single manual tick before trusting a live continuous loop against it (mirroring #3437s own Done-when #4 caution about not looping against an unproven fix).

## Done when

1. **Executable** — `git diff origin/main...origin/lane/mechanical-dispatcher -- we:skills-src/conveyor/runner.mjs` reports no diff not already accounted for by the sibling tick-core/alerting hardening slice, `we:skills-src/conveyor/__tests__/runner.test.mjs` passes on `main`, and a single manual tick (never a continuous loop, per #3437's own Done-when #4) confirms no double-dispatch on a re-armed PR.
2. Landed as its own PR through the normal lane → `we:scripts/verify-lane.mjs` → `we:scripts/operations/run.mjs open-pr --mode=land` pipeline, never a direct push, and never before both `blockedBy` slices above.
