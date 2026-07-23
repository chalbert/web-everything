---
bornAs: x11yunv
kind: decision
size: 2
parent: "2612"
status: resolved
scaffoldedBy: "state-nature-statute"
dateScaffolded: "2026-07-22"
preparedDate: "2026-07-22"
dateOpened: "2026-07-22"
dateResolved: "2026-07-22"
codifiedIn: "docs/agent/platform-decisions.md#state-lives-where-its-nature-dictates"
tags: [conveyor, readiness, scope, dispatch, decision]
---

# Predicted scope is authored at readiness time, not dispatch time

Ruled 2026-07-22 (Nicolas, merit-based): an item's predicted `scope:` is a **readiness / shaping input**,
authored **upstream** when the item is made ready (`/prepare`, `/scaffold`, `/split`), not produced by the
dispatcher at dispatch time. A runtime scope-probe inside the conveyor is rejected on the merits. Born
resolved — this records the call so the follow-up build (#2612's scope-authoring stories) builds against it.

## Ruling (2026-07-22)

`scope:` is **spec** — the predicted touch-set an item declares as part of its Definition of Ready — and spec
is authored once, upstream, where a human can review it before the item is cleared for build. The conveyor's
deterministic dispatcher (`we:scripts/readiness/dispatch-plan.mjs`) **consumes** that authored scope to decide
overlap; it never **produces** it. Predicting scope is a shaping act, and shaping belongs in the readiness
flow, not in the scheduler.

This is an instance of the general statute rule [state lives where its nature
dictates](../docs/agent/platform-decisions.md#state-lives-where-its-nature-dictates) (clause 3 — a
dispatcher consumes readiness, never produces it): `scope` is durable readiness, so it is committed frontmatter
authored upstream and human-reviewable, exactly like `size` / `blockedBy` / `status`.

## Alternative considered — a runtime scope-probe in the conveyor

**Rejected on the merits, not on cost.** Have the dispatcher probe an unscoped item's touch-set at dispatch
time (spawn a probe, compute `scope`, then plan) instead of requiring it authored upstream:

- **shaping moves into the dispatcher** — the scheduler stops being a pure consumer of readiness and starts
  producing it, collapsing the readiness/dispatch split the [deterministic-core, thin-judgment
  rule](../docs/agent/platform-decisions.md#deterministic-core-thin-judgment) draws;
- **the prediction is produced late and blind to human review** — authored at dispatch, it is never seen by a
  human before the item is cleared, so a mis-prediction double-books files with no review gate to catch it;
- **it hides a second PR** — a dispatch-time write of `scope:` is a committed card mutation smuggled in behind
  the build, off the normal lane→PR path (#2302);
- **its only edge is freshness**, and freshness is already covered — the observed-scope breach detector
  reconciles a stale prediction against what the lane actually touches, so the dispatcher does not need a
  fresh probe to stay safe.

## Auto-prepare an unscoped item — never build it blind

Consistent with the empty-scope contract of PR #663 (durable home #2609): an item with no `scope:` is
`needs-probe` / unshaped and is **held** — never launched blind. The conveyor resolves the held state by
**auto-preparing** the item: it dispatches a *prepare-scope* task that predicts the item's touch-set and writes
`scope:` into the item's own `backlog/<num>.md`. That prepare task touches only the story's own file, so its
scope is known a priori (no chicken-and-egg) and it is parallel-safe (each prepare touches a different file).
So scope is always authored at readiness before any build — never predicted at build time, never dispatched
blind. This does not weaken the ruling: the prepare task authors scope *upstream* (a readiness step that
produces it), while the dispatcher still only *consumes* scope — it is not a dispatch-time probe.

## Lineage / links

Codified in [we:docs/agent/platform-decisions.md#state-lives-where-its-nature-dictates](../docs/agent/platform-decisions.md#state-lives-where-its-nature-dictates).
Sibling ruling from the same 2026-07-22 statute session: #2615 (buildQueued → session-local sidecar; born
`2615`). Consistent with the empty-scope contract of PR #663 (durable home #2609: unscoped = held, never
launched blind) — the conveyor resolves the hold by auto-preparing the item, not by building it blind. Applies
the card-mutation guard #2302, governs the `scope:` field built in #2609, and is read by the conveyor skill
#2613. Parent: the conveyor epic #2612.
