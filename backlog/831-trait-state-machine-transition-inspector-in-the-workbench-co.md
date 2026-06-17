---
type: idea
workItem: story
size: 3
parent: "746"
status: open
blockedBy: ["447"]
locus: frontierui
dateOpened: "2026-06-17"
tags: []
---

# Trait state-machine transition inspector in the workbench — consume #447 attribute-lifecycle runtime

The deferred observability half of #750. The workbench trait-state panel (workbench/mount.ts) currently shows each trait's CURRENT applied state (on/off/value, live vs re-mount). This adds the TRANSITION half: a per-trait state machine showing states + transitions over time as the user interacts. Blocked on a consumable FUI attribute-lifecycle runtime — #447 merged FUI's attribute-lifecycle advances into WE docs but did not ship an importable transitions/state-machine API in frontierui (verified: no AttributeLifecycle/transition export in blocks/). Build: expose the custom-attribute lifecycle (connect/observe/disconnect transitions) as a consumable runtime, then render its transition stream per active trait in the Trait state panel. Acceptance: toggling/configuring a trait shows the resulting state transitions in real time. Locus frontierui.
