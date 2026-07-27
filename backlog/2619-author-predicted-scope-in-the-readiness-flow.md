---
bornAs: xbzk108
kind: story
size: 5
tier: pinned
parent: "2612"
status: resolved
dateOpened: "2026-07-22"
dateStarted: "2026-07-27"
dateResolved: "2026-07-27"
tags: [conveyor, readiness, scope, prepare]
scope:
  - we:skills-src/prepare-decision-item/
  - we:skills-src/split-backlog-item/
  - we:scripts/backlog/scaffold.mjs
  - we:scripts/backlog/__tests__/scaffold.test.mjs
---

# Author predicted scope in the readiness flow

Make `/prepare` (and `/scaffold` / `/split`) predict and write an item's `scope:` frontmatter as part of
Definition of Ready, so the human sees the predicted touch-set **before** the item is cleared for build. This
is the upstream-authoring half of the ruling [state lives where its nature
dictates](../docs/agent/platform-decisions.md#state-lives-where-its-nature-dictates) (#2617): scope is
durable readiness, produced once at shape time by a probe agent's judgment, not by the dispatcher at dispatch
time.

## What to build

- The readiness flow (`/prepare` first, then `/scaffold` and `/split` where an item is shaped) runs the
  touch-set probe and writes a coarse, prefix-shaped `scope:` onto the item — the same field
  `we:scripts/readiness/dispatch-plan.mjs` (#2609) reads to hold overlapping items apart.
- The prediction is surfaced for **human review** before the item is cleared — the reviewer sees the touch-set
  on the card, consistent with the guard-gated card-mutation path (#2302).
- Keep it judgment-in / script-read: the probe (judgment) writes `scope:` once; the dispatcher (deterministic)
  only consumes it, per [#deterministic-core-thin-judgment](../docs/agent/platform-decisions.md#deterministic-core-thin-judgment).

Without this, every item is `needs-probe` and must be auto-prepared before it can build — the dispatcher has
nothing scope-bearing to parallelize until scope is authored at readiness.

## Progress

Done. The readiness flow now authors predicted `scope:` at shape time:

- `/split` — the work-investigation pass is named as the touch-set probe; each slice records its
  `file:line`-citable touch-set, coarsened to the narrowest covering prefix, and the scaffold step authors it
  via `--scope=`. Sub-epic slices stay scope-less (epics are held `needs-slice`, not by scope). The
  could-split report table now shows each slice's predicted scope so the human sees it before approving.
- `/prepare` — the (not care-gated) touch-set probe predicts the work a decision authorizes; it feeds the
  jury charter's `changedFiles` and seeds the `scope:` of each buildable child carved at close-out (each child
  gets its own slice, not the whole set). The decision item itself carries no build-`scope:`.
- `we:scripts/backlog/scaffold.mjs` — added `normalizeScope` (dedupe + trim + drop-empty, order-preserving; a
  local near-mirror of `we:scripts/readiness/scope-lease.mjs` `normScope`), used by `renderItem` so authored
  `scope:` frontmatter is deterministic.
- `we:scripts/backlog/__tests__/scaffold.test.mjs` — unit-proves `normalizeScope` and `renderItem`'s `scope:`
  emit (normalized inline array; omitted entirely when unscoped).
