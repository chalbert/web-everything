---
bornAs: xppl2eb
kind: story
size: 3
parent: "3443"
status: open
blockedBy: ["3484"]
scope: ["we:scripts/operations/dispatch-lane.mjs", "we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/operations/explore-io.mjs"]
dateOpened: "2026-09-04"
tags: []
---

# Graduate we:scripts/operations/dispatch-lane.mjs + we:scripts/operations/dispatch-lane-io.mjs hardening from lane/mechanical-dispatcher to main

Two independent hardening commits on origin/lane/mechanical-dispatcher never landed on main: attempt-tagging each dispatch retry so classifyDispatchPr cannot misattribute a siblings PR (#3110), and residual test coverage for the fix/ci-heal launch-kind widening (the widening itself already landed on main under #3332; only the extra we:scripts/operations/__tests__/dispatch-lane-defaults.test.mjs coverage is still missing). Also carries the WE_DISPATCH_KIND env var wiring through we:scripts/operations/dispatch-lane-io.mjs that the verify request/check slice gate on -- land this AFTER that slice (the sibling card graduating we:scripts/verify-lane.mjs + we:scripts/conveyor/verify-dispatch.mjs + we:scripts/guard-bash.mjs), since we:scripts/guard-bash.mjs reads WE_DISPATCH_KIND and this is where it gets stamped onto the spawn. Touches we:scripts/operations/dispatch-lane.mjs, we:scripts/operations/dispatch-lane-io.mjs, we:scripts/operations/explore-io.mjs, and a wide set of already-existing dispatch-*.test.mjs files (post-rebase fixture fixups included) -- whoever builds this should verify current overlap against main first since the branch was rebased tonight and exact hunks may already partially apply.

## Done when

1. **Executable** — `git diff origin/main...origin/lane/mechanical-dispatcher -- we:scripts/operations/dispatch-lane.mjs we:scripts/operations/dispatch-lane-io.mjs we:scripts/operations/explore-io.mjs` reports no diff not already accounted for by an explicit, cited "already landed under #NNN" note, and the affected `dispatch-*.test.mjs` suite passes on `main`.
2. Landed as its own small PR through the normal lane → `we:scripts/verify-lane.mjs` → `we:scripts/operations/run.mjs open-pr --mode=land` pipeline, never a direct push, and never before the `blockedBy` slice above.
