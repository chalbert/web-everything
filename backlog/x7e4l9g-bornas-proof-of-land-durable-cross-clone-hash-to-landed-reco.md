---
kind: story
size: 3
parent: "x6yoscx"
status: open
blockedBy: ["xunndgr"]
dateOpened: "2026-07-10"
tags: []
---

# bornAs proof-of-land: durable cross-clone hash-to-landed record

At land, we:scripts/lane-drain.mjs numberPendingHashes stamps bornAs:<hash> into each numbered item frontmatter — a durable, cross-clone, renumber-immune record that a hash has landed. we:scripts/backlog/id.mjs applyLedger gains a one-line guard that NEVER rewrites a bornAs: value (all other hash cross-refs still rewritten hash-to-NNN), so the birth hash survives instead of being clobbered to the assigned number (the permanent-strand deadlock the adversary found). Add a landedNumberFor(hash) reader that greps origin/main. Single-source contract, documented in-code: local we:id-ledger.json = numbering bookkeeping; bornAs-on-main = the sole cross-clone landed proof, derived from the ledger so they cannot diverge. Tests: the deadlock regression (bornAs intact while blockedBy rewrites hash-to-NNN); the reader resolves a landed hash and returns null for an unlanded one.
