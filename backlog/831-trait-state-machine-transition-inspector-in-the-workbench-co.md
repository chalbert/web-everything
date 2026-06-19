---
type: idea
workItem: story
size: 3
parent: "746"
status: resolved
blockedBy: ["447"]
locus: frontierui
dateOpened: "2026-06-17"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: frontierui/blocks/lifecycle/AttributeLifecycle.ts
tags: []
---

# Trait state-machine transition inspector in the workbench — consume #447 attribute-lifecycle runtime

The deferred observability half of #750. The workbench trait-state panel (fui:workbench/mount.ts) currently shows each trait's CURRENT applied state (on/off/value, live vs re-mount). This adds the TRANSITION half: a per-trait state machine showing states + transitions over time as the user interacts. Blocked on a consumable FUI attribute-lifecycle runtime — #447 merged FUI's attribute-lifecycle advances into WE docs but did not ship an importable transitions/state-machine API in frontierui (verified: no AttributeLifecycle/transition export in blocks/).

Build: expose the custom-attribute lifecycle (connect/observe/disconnect transitions) as a consumable runtime, then render its transition stream per active trait in the Trait state panel. Acceptance: toggling/configuring a trait shows the resulting state transitions in real time. Locus frontierui.

## Progress

**Resolved 2026-06-17 (batch-2026-06-17). Locus: frontierui.**

- **Consumable runtime** — shipped `fui:blocks/lifecycle/AttributeLifecycle.ts` exporting `observeAttributeLifecycle(host, attrs, onTransition)` → an `AttributeLifecycleHandle` (the importable transition/state-machine API #447 never shipped). It watches one host element with a `MutationObserver` (`attributeOldValue`, `attributeFilter`) — the same primitive the `CustomAttributeRegistry` uses, so it's a thin observer, not a second SoT — and emits the per-attribute state machine `(absent) ──add──▶ connected ──change──▶ observed ──remove/stop──▶ disconnected`, each `AttributeTransition` carrying `attr`/`kind`/`from`/`to`/`seq`. `stop()` flushes `disconnected` for still-present attrs.
- **Workbench panel** — `fui:workbench/mount.ts` renders a new **Trait transitions** panel beside the Trait-state panel. `renderStage()` re-attaches the observer to each fresh instance (a construct-time re-mount reads as `disconnected`→`connected`; a live-observed trait as `observed` in place); a `transitionHistory` accumulator + a re-pointable sink replay pre-panel transitions then go live. The stale "lands once #447 ships" comment is updated.
- **Tests** — `fui:attribute-lifecycle.test.ts` (5 happy-dom cases: initial-connected, the connected→observed→disconnected stream, watch-set filtering, `stop()` flush+detach, monotonic seq) and an e2e (`fui:workbench.spec.ts`) that **passed against the live workbench** (toggle `resize` → connected then disconnected; re-configure `placeholder` → observed; Clear empties). FUI `check:standards` green; workbench + runtime typecheck clean.

`graduatedTo` → `fui:frontierui/blocks/lifecycle/AttributeLifecycle.ts`.
