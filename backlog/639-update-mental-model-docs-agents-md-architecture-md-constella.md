---
kind: task
status: resolved
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
tags: []
---

# Update mental-model docs (we:AGENTS.md, we:architecture.md, constellation) — plugs live in Frontier UI

The Tier-0 router docs still encode the inherited 'plugs live in WE' model (we:AGENTS.md:9, we:docs/agent/architecture.md:18, plus constellation references). Update them to the #606 ruling: the plugs runtime is implementation owned by Frontier UI (@frontierui/plugs); WE holds only the contracts (we:plugs.json, intents, protocols, block protocols) and consumes the runtime as a client in its demos. Keeps the canonical mental model aligned with the decision.

## Progress

Updated the Tier-0 mental-model docs to the #606 ruling (plugs runtime = implementation owned by Frontier UI; WE holds contracts + consumes as a client):

- **[we:AGENTS.md](/AGENTS.md)** "Mental model" — reframed the Plugs (and Blocks) bullets: the runtime is `@frontierui/plugs` / `@frontierui/blocks` (ruling #606); WE owns only the *contracts* (`we:src/_data/plugs.json`, block protocols) and consumes the runtime as a client; the `plugs/` tree here is the vendored copy pending the #170 re-point. (Hand-authored section, preserved through `gen:inventory`.)
- **[we:docs/agent/architecture.md](/docs/agent/architecture.md)** "Plugs vs Blocks" — added the #606 ownership note + reworked the table's "Location" → "Canonical home" (`@frontierui/*`, vendored pending #170) and added a "plug/block contracts (what WE owns)" row.
- The `we:docs/agent/backlog-workflow.md` constellation mention (L444) is about **locus/gating** — already correct, no stale plugs-ownership claim, left as-is.
- Docs-only. Gate: my changes add 0 errors; the 2 remaining `check:standards` errors are a **concurrent session's incomplete `workflow` protocol** (webworkflows — missing `flow-progress` intent + `we:project-webworkflows.njk`), not this item. Commit → webeverything (we:AGENTS.md, we:architecture.md only).
