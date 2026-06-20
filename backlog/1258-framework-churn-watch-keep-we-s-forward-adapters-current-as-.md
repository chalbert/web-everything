---
kind: epic
size: 3
childlessReason: program
status: open
dateOpened: "2026-06-20"
tags: []
---

# Framework-churn watch — keep WE's forward adapters current as vendor framework APIs move

Candidate front-B watch program: track API churn across the major vendor frameworks (React/Vue/Svelte/Solid) so WE's forward/generation adapters (#463) do not silently rot, and new adapter targets get discovered. Front A: adapters still generate conformant output against current framework APIs. Front B: a framework ships a breaking API change or a new framework gains traction → file adapter-maintenance or new-target items. L0/candidate — filed now to record the watch; build the discovery mechanism once the platform-standards watch proves the pattern. Lighter priority than the platform-standards keystone.

## The two fronts

- **Front A:** WE's forward/generation adapters (#463) still emit conformant output against current framework APIs.
- **Front B:** a vendor framework (React/Vue/Svelte/Solid) ships a breaking API change, or a new framework gains traction → file adapter-maintenance or new-target items.

## Status — L0 / candidate

Recorded so the watch is not lost. Build the discovery mechanism after the platform-standards watch ([#1257](/backlog/1257-platform-standards-watch-keep-we-current-as-the-web-platform/)) proves the pattern; lighter priority than that keystone. Classified per the [Program Test](/backlog/1249-define-program-strictly-the-four-part-bar-for-a-perpetual-on/); a sibling in the currency portfolio.
