---
bornAs: x82om9v
kind: story
size: 2
parent: "2612"
status: resolved
dateOpened: "2026-07-22"
dateStarted: "2026-07-23"
dateResolved: "2026-07-23"
tags: [conveyor, readiness, scope, lens]
scope:
  - we:src/_data/
  - we:src/_includes/backlog-badges.njk
  - we:src/backlog.njk
  - we:scripts/check-readiness.mjs
---

# Definition-of-Ready gains a has-predicted-scope lens

Surface a readiness lens / check that flags ready items missing a predicted `scope:`, so "has predicted scope"
becomes a **visible** part of Definition of Ready — a dev-ready item without `scope:` reads as *not fully
shaped* (it is held and auto-prepared before it can build, never dispatched blind).

## What to build

- A `/backlog` readiness lens (or a `check:readiness` note) that marks a `status: open`, unblocked item as
  missing its predicted touch-set when `scope:` is absent/empty — the same `needs-probe` condition
  `we:scripts/readiness/dispatch-plan.mjs` (#2609) holds on.
- It is a *surfacing* lens, not a hard gate: an unscoped item is `needs-probe` / unshaped, not blocked (per the
  PR #663 empty-scope refinement in [state lives where its nature dictates](../docs/agent/platform-decisions.md#state-lives-where-its-nature-dictates)).

**Optional / may fold into #2619** if the readiness-flow authoring already surfaces the missing-scope signal
cleanly — file separately only if the lens is a distinct surface.

## Progress

Delivered as a distinct surface (not folded into #2619):

- **Loader** (`we:src/_data/backlog.js`) — a pure, exported, unit-pinned predicate `deriveUnshapedNoScope(item)`
  (`tier === 'A' && kind !== 'epic' && !normalizeScope(item.scope)`) sets `item.unshapedNoScope`. It mirrors
  the dispatcher's `unshaped-no-scope` / needs-probe condition exactly; the badge and the CLI note both read
  this one field, so they cannot drift.
- **`/backlog` lens** — a `needs scope` warning badge (macro `unshapedScopeBadge` in
  `we:src/_includes/backlog-badges.njk`, `data-unshaped-scope` hook) renders beside the agent-ready tier badge
  on both the tile grid and the Prioritisation table row. Surfacing lens, not a hard gate.
- **`check:readiness` note** — an "Unshaped — agent-ready but missing predicted scope" section in the default
  report and the `--select` view, plus an `unshaped[]` array in `--json`.
- Pinned by `we:src/_data/__tests__/unshaped-no-scope.test.ts`; `check:standards` green.
