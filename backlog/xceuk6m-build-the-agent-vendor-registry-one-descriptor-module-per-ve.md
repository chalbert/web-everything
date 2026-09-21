---
kind: story
size: 8
parent: "3383"
status: open
scope: ["we:scripts/operations/agent-provider-registry.mjs", "we:scripts/operations/agent-providers/", "we:scripts/operations/deliver-item-wrapper.mjs", "we:scripts/operations/fix-dispatch-wrapper.mjs", "we:scripts/operations/ci-heal-dispatch-wrapper.mjs", "we:scripts/operations/deliver-item-run.mjs", "we:scripts/operations/fix-run.mjs", "we:scripts/operations/ci-heal-run.mjs"]
dateOpened: "2026-09-21"
tags: []
---

# Build the agent-vendor registry: one descriptor module per vendor in one static index, replacing the three per-wrapper vendor tables (#3658)

Build what #3658 ratified (we:docs/agent/platform-decisions.md#agent-vendor-registry). Add we:scripts/operations/agent-provider-registry.mjs (static index, load-checked, throws a TypeError naming the file) and one we:scripts/operations/agent-providers/<vendor>.mjs per vendor (claude-restricted, codex; antigravity when its port exists), each declaring mechanics only: name, routingProvider, kinds -> spawn adapter, sandbox. Replace DELIVERY_AGENT_PROVIDERS, FIX_AGENT_PROVIDERS and CI_HEAL_AGENT_PROVIDERS with resolveAgentProvider(kind, name). Lands on the declared POC branch lane/mechanical-dispatcher and reaches main through #3443's slices; the files below exist only there. Add a test that the index and agent-providers/ list the same vendors.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
