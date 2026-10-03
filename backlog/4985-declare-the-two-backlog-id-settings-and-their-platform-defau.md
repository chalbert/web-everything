---
bornAs: x2rabof
kind: story
size: 3
parent: "3383"
status: open
scope: ["we:config/platformDefaults.ts", "we:config/defineConfig.ts", "we:config/__tests__/", "we:scripts/lib/gate-config.mjs"]
dateOpened: "2026-10-03"
tags: []
---

# Declare the two backlog-id settings and their platform defaults, and refuse an unbuilt value

#3732 ruled (2026-10-03) that both backlog-id forks are configurable settings extending a platform default, per we:docs/agent/platform-decisions.md#config-extends-platform-default. Declare the two dimensions: where numbering happens (producer-at-pr-open default, integration-branch) and how far reach-main reaches (tip-tree default, full-history-squash). Add the resolver the other build stories read. A declared value that is not built refuses when selected, naming itself; it never falls back silently.

## Done when

1. **Executable** — a unit test under `we:config/__tests__/` proves each setting resolves to its platform default (`producer-at-pr-open`, `tip-tree`) when the project config is silent, and to an override when one is set. It fails before this lands (the dimensions do not exist) and passes after.
2. **Executable** — the same test proves that selecting `integration-branch` or `full-history-squash` returns a refusal that names the unbuilt value, and never resolves to the default.
3. The platform defaults are data only in `we:config/platformDefaults.ts`; WE holds no implementation (#1282). Statute: `we:docs/agent/platform-decisions.md#backlog-ids-numbered-before-publish`.
