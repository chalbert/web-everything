---
bornAs: x7fkzn0
kind: story
size: 3
parent: "3443"
status: active
scope: ["we:scripts/operations/route-pr-outcome.mjs", "we:scripts/operations/route-pr-outcome-io.mjs", "we:scripts/operations/run.mjs", "we:scripts/operations/__tests__/http-adapter.test.mjs"]
dateOpened: "2026-09-04"
dateStarted: "2026-09-05"
tags: []
---

# Graduate we:scripts/operations/route-pr-outcome.mjs (new module) from lane/mechanical-dispatcher to main

Part 1 of 3 of the core reconcile-pass payload (#3437s name-based-bind fix is confirmed landed on main as of 2026-09-04, unblocking this whole group per #3443s own Done-when #2). Two wholly new modules on origin/lane/mechanical-dispatcher, missing from main entirely: we:scripts/operations/route-pr-outcome.mjs and we:scripts/operations/route-pr-outcome-io.mjs, with their tests (we:scripts/operations/__tests__/route-pr-outcome.test.mjs, we:scripts/operations/__tests__/route-pr-outcome-io-live.test.mjs). Also carries session-identity plumbing changes in we:scripts/operations/dispatch-lane-io.mjs, we:scripts/operations/explore-io.mjs, we:scripts/operations/run.mjs, we:scripts/operations/wake.mjs that route-pr-outcome depends on, plus their test updates. CAUTION -- overlap risk: we:scripts/operations/dispatch-lane-io.mjs is ALSO touched by the sibling dispatch-lane hardening slice (WE_DISPATCH_KIND wiring); whoever builds either slice should diff the other slices hunks first to avoid duplicate/conflicting edits to the same file. Land this before the we:skills-src/conveyor/supervisor.mjs slice and before the we:skills-src/conveyor/runner.mjs reconcile-pass-wiring slice -- both are expected to depend on route-pr-outcome existing on main, though the exact call graph should be confirmed by whoever builds this, not assumed from this cards prose.

## Done when

1. **Executable** — `we:scripts/operations/route-pr-outcome.mjs` and `we:scripts/operations/route-pr-outcome-io.mjs` exist on `main` with their tests passing, and `git diff origin/main...origin/lane/mechanical-dispatcher -- we:scripts/operations/dispatch-lane-io.mjs we:scripts/operations/explore-io.mjs we:scripts/operations/run.mjs we:scripts/operations/wake.mjs` reports no diff not already accounted for by the sibling dispatch-lane-hardening slice.
2. Landed as its own small PR through the normal lane → `we:scripts/verify-lane.mjs` → `we:scripts/operations/run.mjs open-pr --mode=land` pipeline, never a direct push.

## Progress

- 2026-09-05: Built and landed with a NARROWER scope than declared. The card's claim that
  `we:scripts/operations/dispatch-lane-io.mjs` / `we:scripts/operations/explore-io.mjs` /
  `we:scripts/operations/wake.mjs` carry "session-identity plumbing that route-pr-outcome depends on" does not
  hold: `we:scripts/operations/route-pr-outcome.mjs` imports only `we:scripts/operations/registry.mjs` /
  `we:scripts/operations/step-kinds.mjs`, and `we:scripts/operations/route-pr-outcome-io.mjs` imports only
  `we:scripts/lib/review-core.mjs` / `we:scripts/lib/review-escalation.mjs` / `we:scripts/review-detail.mjs`
  (already on `main`) — neither touches, nor is touched by, any of those three files. Their actual diff on
  `origin/lane/mechanical-dispatcher` is unrelated #3331 (`--bg` ignores `--session-id`; handle-prefix + name
  matching) and #3110 (`classifyDispatchPr` attempt-tag) hardening, already tracked by their own open items
  (`backlog/3331-*.md`, `backlog/3110-*.md`) — and #3331's hunk additionally needs
  `we:scripts/conveyor/lease-reaper.mjs` changes (`laneRefAttemptTag`/`sessionSlugAttemptTag`) that sit outside
  every one of this cluster's declared scopes, including this one and `#3488`'s. Landed instead: the two new
  modules + tests, the isolated `we:scripts/operations/run.mjs` `ROUTE_PR_OUTCOME_OP` wiring hunk (verified
  byte-identical to the lane branch's), and one additional real dependency the card missed entirely —
  `we:scripts/operations/__tests__/http-adapter.test.mjs`'s pinned read-only-operations allow-list, which reds
  without the `ROUTE_PR_OUTCOME_OP` entry. `scope:` above narrowed to match. `#3331`/`#3110` remain open,
  unaffected, for whoever builds those slices.
