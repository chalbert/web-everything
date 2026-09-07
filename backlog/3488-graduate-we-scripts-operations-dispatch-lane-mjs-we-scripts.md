---
bornAs: xppl2eb
kind: story
size: 3
parent: "3443"
status: resolved
blockedBy: ["3484"]
scope: ["we:scripts/operations/dispatch-lane.mjs", "we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/conveyor/lease-reaper.mjs"]
dateOpened: "2026-09-04"
dateStarted: "2026-09-07"
dateResolved: "2026-09-07"
tags: []
---

# Graduate we:scripts/operations/dispatch-lane.mjs + we:scripts/operations/dispatch-lane-io.mjs hardening from lane/mechanical-dispatcher to main

Two independent hardening commits on origin/lane/mechanical-dispatcher never landed on main: attempt-tagging each dispatch retry so classifyDispatchPr cannot misattribute a siblings PR (#3110), and residual test coverage for the fix/ci-heal launch-kind widening (the widening itself already landed on main under #3332; only the extra we:scripts/operations/__tests__/dispatch-lane-defaults.test.mjs coverage is still missing). Also carries the WE_DISPATCH_KIND env var wiring through we:scripts/operations/dispatch-lane-io.mjs that the verify request/check slice gate on -- land this AFTER that slice (the sibling card graduating we:scripts/verify-lane.mjs + we:scripts/conveyor/verify-dispatch.mjs + we:scripts/guard-bash.mjs), since we:scripts/guard-bash.mjs reads WE_DISPATCH_KIND and this is where it gets stamped onto the spawn. Touches we:scripts/operations/dispatch-lane.mjs, we:scripts/operations/dispatch-lane-io.mjs, we:scripts/operations/explore-io.mjs, and a wide set of already-existing dispatch-*.test.mjs files (post-rebase fixture fixups included) -- whoever builds this should verify current overlap against main first since the branch was rebased tonight and exact hunks may already partially apply.

## Done when

1. **Executable** — `git diff origin/main...origin/lane/mechanical-dispatcher -- we:scripts/operations/dispatch-lane.mjs we:scripts/operations/dispatch-lane-io.mjs we:scripts/operations/explore-io.mjs` reports no diff not already accounted for by an explicit, cited "already landed under #NNN" note, and the affected `dispatch-*.test.mjs` suite passes on `main`.
2. Landed as its own small PR through the normal lane → `we:scripts/verify-lane.mjs` → `we:scripts/operations/run.mjs open-pr --mode=land` pipeline, never a direct push, and never before the `blockedBy` slice above.

## Progress

- 2026-09-07: **Scope narrowed on build.** Cherry-picked the branch's `a6eb93de` (#3110 attempt-tagging) onto
  current `main`, which turned out to ALSO require `we:scripts/conveyor/lease-reaper.mjs` (`laneRefAttemptTag`
  / `sessionSlugAttemptTag`) — outside this card's declared scope but a genuine same-commit dependency, exactly
  as #3482's own progress note predicted. Landed: `we:scripts/operations/dispatch-lane.mjs` (full branch parity,
  zero remaining diff) and `we:scripts/operations/dispatch-lane-io.mjs`'s attempt-tag portion, plus
  `we:scripts/conveyor/lease-reaper.mjs` + its test, plus the residual #3332 test coverage in
  `we:scripts/operations/__tests__/dispatch-lane-defaults.test.mjs`.

  **`we:scripts/operations/explore-io.mjs` DROPPED from this slice's scope**, and `we:scripts/operations/dispatch-lane-io.mjs`
  does NOT reach full branch parity — both still diff from `origin/lane/mechanical-dispatcher` after this PR,
  and that diff is entirely **#3331** (PROBE: does claude --bg honour --session-id?, its own separate open
  backlog item, parent #3029 — NOT a child of #3443, not previously identified as entangled with this card).
  Investigated by reading the branch's actual commit history (`git log -S"parseBackgroundedHandle"`): #3331's
  fix lives in one grab-bag commit (`59f9f48d`, "recover session-identity fix, we:scripts/operations/route-pr-outcome.mjs,
  runner wiring, we:skills-src/conveyor/supervisor.mjs" — a post-lane-pool-wipe recovery commit bundling FOUR
  unrelated features) and its production footprint alone is `we:scripts/operations/dispatch-lane-io.mjs`,
  `we:scripts/operations/explore-io.mjs`, and `we:scripts/operations/wake.mjs`, plus a wide test footprint
  (`we:scripts/operations/__tests__/dispatch-abort.test.mjs`,
  `we:scripts/operations/__tests__/dispatch-crosses-processes.test.mjs`,
  `we:scripts/operations/__tests__/dispatch-lane-defaults.test.mjs`,
  `we:scripts/operations/__tests__/dispatch-lane-fixture-harness.test.mjs`,
  `we:scripts/operations/__tests__/dispatch-lane.test.mjs`,
  `we:scripts/operations/__tests__/dispatch-spawn-live.test.mjs`,
  `we:scripts/operations/__tests__/explore.test.mjs`,
  `we:scripts/operations/__tests__/helpers/fake-claude.mjs`,
  `we:scripts/operations/__tests__/http-adapter.test.mjs`,
  `we:scripts/operations/__tests__/wake-cli.test.mjs`) — each of those test files ALSO carries substantial independent
  main-only history since the branch's last main-merge, so none of it safely takes a wholesale branch checkout;
  every one needs its own real three-way reconciliation. That is a full slice's worth of work in its own right,
  not a hitchhiker on this card's #3110 scope, so it is deliberately left OUT here and should be filed/built as
  its own dedicated graduation slice for #3331 (a real correctness fix — `claude --bg` proven to ignore
  `--session-id`, matching should be by the CLI's own printed short-id prefix instead) rather than folded in
  silently.
