---
bornAs: xl1x55d
kind: task
tier: pinned
parent: "3457"
status: open
scope: ["we:scripts/operations/dispatch-lane.mjs", "we:scripts/readiness/dispatch-plan.mjs", "we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/operations/__tests__/"]
dateOpened: "2026-09-02"
tags: []
---

# Wire the dispatch already-done ground-truth check into we:scripts/operations/dispatch-lane.mjs and we:scripts/readiness/dispatch-plan.mjs

Ratified by #3457: implement the already-done cross-check at BOTH current dispatch chokepoints. (1) A guard inside we:scripts/operations/dispatch-lane.mjs, immediately before spawn, running one gh pr list --search call per dispatch attempt (never on a tick cadence); on a match, refuse the dispatch and surface the merged PR url as the reason. (2) An age-gated enrichment flag inside we:scripts/readiness/dispatch-plan.mjs — only items that have sat open/active past a minimum age get the gh pr list check, so a freshly-opened item never pays the cost while a long-stale one is still caught within a bounded delay on the automatic per-tick sweep. Names left open by the ruling for this item to settle: the exact gh pr search query shape (by #NNN in title/body vs. head-ref match vs. something else), the specific age threshold for the we:scripts/readiness/dispatch-plan.mjs enrichment gate, and what happens to a flagged item (hold the dispatch, auto-resolve it, or only surface it) — a real, small design choice of its own. A we:scripts/conveyor/queue.mjs add-time check remains optional and out of this items scope. Mirrors how #3427 scaffolded #3451 as its own follow-on at ratification.

## Done when

1. **Executable** — a new test in `we:scripts/operations/__tests__/` (or the nearest existing suite for
   `we:scripts/operations/dispatch-lane.mjs`) that fails before this item lands and passes after: (a) a
   fixture where a mocked `gh pr list --search` returns a merged PR for the dispatch target's item number —
   asserts `we:scripts/operations/dispatch-lane.mjs` refuses the dispatch and its refusal reason names the
   merged PR's URL; (b) a fixture reproducing the real `#3434`/`#3433` shape (an `open`/`active` item with a
   merged PR already closing it) proving the guard actually catches that case, not just a synthetic one; (c) a
   `we:scripts/readiness/dispatch-plan.mjs` fixture asserting a freshly-opened item (younger than the chosen
   age threshold) is never enriched with the ground-truth check, while an item older than the threshold is.
2. **Observable** — running `node we:scripts/operations/run.mjs dispatch-lane --num=<an item already closed
   by a merged PR>` against a live `gh pr list` result actually refuses the spawn instead of dispatching an
   agent, and `we:scripts/readiness/dispatch-plan.mjs --json`'s enriched output carries the ground-truth flag
   for a real stale fixture item.
3. **Assertable** — the PR body names, for the record: the exact `gh pr` search query shape chosen (by
   `#NNN` in title/body, a head-ref match, or another shape, and why), the specific age threshold chosen for
   the `we:scripts/readiness/dispatch-plan.mjs` enrichment gate, and what happens to a flagged item (hold the
   dispatch, auto-resolve it, or only surface it) — so `#3457`'s "left to the follow-on build item" list is
   traceably closed, not silently dropped.
