---
type: idea
workItem: story
size: 5
parent: "586"
status: open
blockedBy: ["587"]
dateOpened: "2026-06-14"
tags: []
---

# Build the reaction block + intent (ReactionSummary contract)

Build the reaction interaction per #370 Fork 5: a block (each reaction an aria-pressed toggle) backed by an intent for declarative dimensions. Contract baseline = Atlassian ReactionSummary: count · users[] (roster, display limit) · reacted (toggle-your-own) · optimisticallyUpdated. NOT a protocol (data contract, no engine-interop). Multi-user sync is a composed webrealtime concern, never baked in. A11y (load-bearing): composed accessible name (emoji+count+reacted-state), announce local toggle only — never every remote tick, keyboard-reachable roster. Reaction set = open config-driven named-set registry (default-less; sentiment default; allowAllEmojis escape).
