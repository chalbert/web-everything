---
kind: story
size: 3
status: open
scope: ["we:scripts/check-standards-rules.mjs"]
dateOpened: "2026-09-14"
tags: []
---

# Flag open non-decision backlog items with an unresolved fork/ratification marker but no humanGate

we:scripts/check-standards-rules.mjs already carries a 'Dangling-residue guard' (~line 942-967) that flags a kind:decision item (resolved or preparedDate'd) whose body defers a live choice in prose outside a ## Fork N section. That guard is scoped to kind==='decision' only. A sibling gap exists for non-decision items (story/task) that embed a fork/ratification decision directly in body prose instead of spinning it out to its own kind:decision item: nothing structural marks that the embedded fork is still open vs already ratified. we:src/_data/backlog.js deriveTier() (~line 196) computes Tier A for any non-decision-kind item whose blockers are all resolved and which carries no humanGate/projectPending — it cannot see prose-only fork/ratification language in the body. So an item that flags 'this default is not build-ready until the embedded fork is ratified' has nothing forcing that: the moment its blockedBy clears, it becomes agent-claimable, and the documented claim-first discipline (next-backlog-item skill) has an agent claim before reading the body. Confirmed via review of PR #1985 (we:backlog/x7wehz2-a-permanent-decision-ledger-artifact-backed-by-the-db-capabi.md, kind:story): filed with an explicitly flagged open fork and no humanGate; the fork was ratified by the operator via a follow-up comment/commit before this gap caused an actual bad claim, but nothing in the tooling would have caught it if the operator had not been watching live. Likely fix direction (not prescriptive): a WARN-level rule in we:scripts/check-standards-rules.mjs mirroring the existing decision-kind dangling-residue guard, scoped to non-decision, still-open items — scan body prose for fork/ratification-marker language ('open fork', 'left for ratification', 'not marked build-ready', 'RATIFIED (' etc.) and flag when present with no humanGate in frontmatter. Do not fix we:scripts/check-standards-rules.mjs as part of filing this — this card is scoping/evidence only.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
