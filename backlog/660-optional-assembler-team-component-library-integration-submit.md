---
kind: story
size: 8
parent: "646"
status: open
blockedBy: ["646"]
dateOpened: "2026-06-15"
relatedProject: webdocs
tags: [devtools, composition, assembler, integration, component-library, optional, future]
---

# Optional assembler↔team component-library integration — submit PRs, update existing components

A future, optional capability layered on the #646 composition assembler: instead of only emitting an ejectable recipe for the author to paste, the assembler integrates with the consuming team's own component library — opening a PR against their repo, updating an existing component in place, or scaffolding a new one in their conventions. Strictly opt-in and downstream of the assembler shell + decided emit format (#652: plain markup payload + registry-item wrapper — the [constellation-placement](docs/agent/platform-decisions.md#constellation-placement) rule). Honours minimize-lock-in: the integration is a convenience transport around the same plain payload, never a new lock. Ratified as a caveat to #652.

## Why optional / why deferred

The core assembler (#646) ends at *emit the plain ejectable recipe*; the author owns it from there. This card is the convenience tier on top: rather than copy-paste, the assembler delivers the same payload **into the team's codebase** — as a PR, an in-place update to an existing component, or a new scaffold in the team's conventions. It is genuinely optional (the assembler is complete without it) and must stay a transport, not a lock — the thing delivered is still the #652 plain-markup payload (+ optional CEM descriptor / `registry-item` wrapper), never a WE-owned project-facing format.

## Scope to settle when picked up

- **Delivery mechanism** — git/PR integration (GitHub/GitLab APIs) vs. a local file-write/codemod against the team's repo; how "update existing component in place" diffs against what's already there.
- **Conventions adaptation** — how the emitted markup is reshaped into the team's component conventions (file layout, naming) without re-introducing lock-in.
- **Constellation home** — the served integration surface follows the #091 managed-offering split (the [monetization](docs/agent/platform-decisions.md#monetization) rule) (standard in WE, served surface in plateau-app); confirm at slice time.

Blocked on #646's foundational slice (the assembler shell + decided emit format) existing first.
