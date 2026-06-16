---
type: idea
workItem: story
size: 5
status: open
parent: "746"
locus: frontierui
blockedBy: ["727", "809", "815"]
dateOpened: "2026-06-16"
relatedProject: webdocs
crossRef: { url: /backlog/447-merge-frontier-ui-s-attribute-lifecycle-runtime-advances-up-/, label: "Attribute-lifecycle runtime (#447)" }
tags: [webdocs, block-explorer, traits, live, state-machine, inspector]
---

# Live trait activation panel — toggle/activate traits live and watch the block adapt

Let the viewer **activate and configure a block's traits live** from the Block Explorer and watch the same block adapt in place — turn a trait on, change its config, see the behaviour appear without editing code. Pair it with a **trait state-machine inspector** that surfaces each active trait's current state and transitions (the attribute-lifecycle runtime, #447), so the panel is both a control surface and an observability surface — you see *what* you switched and *how* the trait responds.

## Build

- Trait control panel listing the block's available traits with enable/disable + per-trait config controls, bound to the live render (#727).
- State-machine inspector: show each active trait's state + transitions as the user interacts (consumes the #447 attribute-lifecycle runtime).
- Cross-link each trait row to its catalog detail page (shared with the anatomy view #748).

## Acceptance

- [ ] Activating/deactivating a trait live changes the rendered block's behaviour with no code change.
- [ ] The inspector reflects each trait's state and transitions in real time.
- [ ] A playground fixture exercises at least one trait toggled on/off on a live block.

## Notes

Hard-blocked on **#727** (the live render). The inspector depends on #447's lifecycle runtime; if that isn't yet available in FUI, ship the toggle/config half first and gate the inspector half on #447.

**Re-homed to FUI-locus (#809).** This panel is chrome inside the FUI-owned workbench (#815, iframe+chrome distribution), toggling traits host-side intra-FUI — not WE-owned chrome. `blockedBy #815`; built `@frontierui`.
