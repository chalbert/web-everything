---
bornAs: xmd4pfa
kind: story
size: 3
parent: "4075"
status: resolved
scope: ["we:scripts/conveyor/flows/flow-model.mjs", "we:scripts/conveyor/flows/__tests__/real-flows.test.mjs", "we:scripts/conveyor/flows/build-dispatch.flow.json", "we:scripts/lane-drain.mjs", "we:scripts/lib/citation-check.mjs", "we:scripts/__tests__/lane-drain-numbering.test.mjs"]
dateOpened: "2026-09-26"
dateResolved: "2026-09-26"
tags: []
---

# Flow citations must resolve renamed backlog cards via bornAs, not by hash filename

CAUSE: we:scripts/conveyor/flows/build-dispatch.flow.json (merged in #2744) cited a backlog file by its provisional hash name; the drain's JIT numbering later renamed that card to #4220, so we:scripts/conveyor/flows/__tests__/real-flows.test.mjs's citation-existence test fails and main CI is red for every PR. FIX: we:scripts/conveyor/flows/flow-model.mjs gains a resolveBornAsCite helper that resolves a dangling backlog cite through the target's bornAs frontmatter at check time; we:scripts/conveyor/flows/__tests__/real-flows.test.mjs's cite test uses it; we:scripts/conveyor/flows/build-dispatch.flow.json's stale citations are updated to the current path; we:scripts/lane-drain.mjs's numberPendingHashes gains a fourth rewrite sweep over the flow json files (alongside its existing backlog, docs and agent-memory sweeps) so a flow file's hash citations self-heal in the SAME land commit that numbers the card; we:scripts/lib/citation-check.mjs's rewrite-scope doc constant is updated to list the flows directory too.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
