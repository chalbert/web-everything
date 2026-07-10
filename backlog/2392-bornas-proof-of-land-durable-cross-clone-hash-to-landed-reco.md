---
kind: story
size: 3
parent: "2387"
status: resolved
blockedBy: []
dateOpened: "2026-07-10"
dateStarted: "2026-07-10"
dateResolved: "2026-07-10"
graduatedTo: none
tags: []
---

# bornAs proof-of-land: durable cross-clone hash-to-landed record

At land, we:scripts/lane-drain.mjs numberPendingHashes stamps bornAs:<hash> into each numbered item frontmatter — a durable, cross-clone, renumber-immune record that a hash has landed. we:scripts/backlog/id.mjs applyLedger gains a one-line guard that NEVER rewrites a bornAs: value (all other hash cross-refs still rewritten hash-to-NNN), so the birth hash survives instead of being clobbered to the assigned number (the permanent-strand deadlock the adversary found). Add a landedNumberFor(hash) reader that greps origin/main. Single-source contract, documented in-code: local we:id-ledger.json = numbering bookkeeping; bornAs-on-main = the sole cross-clone landed proof, derived from the ledger so they cannot diverge. Tests: the deadlock regression (bornAs intact while blockedBy rewrites hash-to-NNN); the reader resolves a landed hash and returns null for an unlanded one.

## Progress

- **Status:** done — implemented + tested, gate green (0 errors).
- **Done:**
  - `we:scripts/backlog/id.mjs` — added `BORN_AS_RE` + pure `stampBornAs(content, hash)` (inserts `bornAs: <hash>` as the first frontmatter field, idempotent). `applyLedger` now (a) rewrites hashes line-by-line, **guarding** any `bornAs:` value line from the blind hash→NNN swap, and (b) **stamps** the birth hash onto each item it numbers (after the rewrite, with the original hash) — so bornAs-on-main and the ledger are minted from the same assignment and cannot diverge.
  - `we:scripts/lane-drain.mjs` — `numberPendingHashes` carries the stamp through `applyLedger`; added exported `landedNumberFor(hash, CWD)` reader that greps `origin/main` for `^bornAs: <hash>$` and returns the landed NNN (or null).
  - Tests: `we:scripts/backlog/__tests__/id.test.mjs` — stampBornAs (insert/idempotent/no-frontmatter) + the **deadlock regression** (bornAs intact while `blockedBy` rewrites hash→NNN); updated two existing applyLedger cases for the new always-stamp behavior. `we:scripts/__tests__/lane-drain-numbering.test.mjs` — end-to-end stamp at land + `landedNumberFor` resolves a landed hash / null for an unlanded one / null for non-hash input.
- **Next:** none — ready to land. Consumers of `landedNumberFor` (the #2387 coordination gate) are the parent epic's remaining work, not this slice.
- **Notes:** cleared the now-stale `blockedBy: ["2391"]` (2391 resolved).
