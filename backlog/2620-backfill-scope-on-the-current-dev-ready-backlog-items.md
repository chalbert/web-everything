---
bornAs: xgntiy7
kind: story
size: 3
parent: "2612"
status: resolved
blockedBy: ["2619"]
dateOpened: "2026-07-22"
dateStarted: "2026-07-27"
dateResolved: "2026-07-27"
tags: [conveyor, readiness, scope, backfill]
scope:
  - we:backlog/
---

# Backfill scope on the current dev-ready backlog items

Author `scope:` frontmatter on the existing dev-ready backlog items so the conveyor has real scope-bearing,
parallelizable work to dispatch — instead of holding everything `needs-probe` and auto-preparing it before any
build. This is the one-time catch-up for the readiness-flow authoring built in #2619: the flow writes
`scope:` for *new* items going forward; this backfills the *current* ready pool.

## What to build

- Run the touch-set probe over the current dev-ready items (`status: open`, unblocked, agent-buildable) and
  write a coarse, prefix-shaped `scope:` onto each, human-reviewed per the card-mutation guard (#2302).
- Keep prefixes coarse (a directory prefix, not every file) — `we:scripts/readiness/dispatch-plan.mjs` (#2609)
  does a prefix-aware overlap check.
- Outcome: the dispatcher can fan out disjoint items across the lane pool immediately, instead of every item
  routing through auto-prepare first because it is `needs-probe`.

Instance of [state lives where its nature dictates](../docs/agent/platform-decisions.md#state-lives-where-its-nature-dictates)
(#2617) — durable readiness authored upstream, script-read forever.

## Progress

Done — backfilled `scope:` onto the dev-ready needs-scope conveyor/delivery items. Per the finer-lease
operator directive, each scope was authored **file-level** (the specific source files + their tests the item
will touch), not a coarse directory prefix, so the finer-lease engine can parallelize them. Each item's
touch-set was probed by reading the item and the real code it names.

- **#2621** (claim CLI carve-out) — file-level: `we:scripts/backlog.mjs` (the stop-message code) +
  `we:scripts/__tests__/backlog-cli-snapshot.test.mjs` (the CLI-output snapshot that exercises `claim`).
- **#2622** (pr-land `--park`) — file-level: `we:scripts/pr-land.mjs` + `we:scripts/__tests__/pr-land.test.mjs`.
- **#2707** (jury red-team + fail-closed) — file-level: `we:skills-src/jury/SKILL.md`,
  `we:skills-src/jury/subject-jury.workflow.js`, `we:scripts/lib/jury-core.mjs`,
  `we:scripts/lib/__tests__/jury-core.test.mjs`.
- **#2605** (drain-daemon nudge/SSE — cross-locus, impl in plateau-app) — file-level:
  `plateau:tools/drain-daemon/{daemon,cli,lib,lib.test}.mjs` (drain LOGIC stays single-sourced in
  `we:scripts/merge-ai-prs.mjs`, so that file is deliberately **not** in scope).
- **#2648** (console decision-present feed — cross-locus, impl in plateau-app) — **directory floor**
  `plateau:src/backlog-view/` (documented in the item): a **new** feed module whose exact file is
  build-time-determined, so a file-level list would risk under-scoping. Sound floor over granularity here.

Skipped (left unscoped) — **#2614** (delivery learnings drop-box + close-session sweep): its work already
landed on `main` (three `WE #2614:` commits, wired into the `closing-session` skill) but the item was never
`resolved`. Scoping an already-delivered item would only dispatch a delivery agent that bounces it
`stale/superseded`. Recommend the operator **resolve #2614** rather than scope it.
