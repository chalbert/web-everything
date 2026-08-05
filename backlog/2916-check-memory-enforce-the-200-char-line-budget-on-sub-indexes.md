---
bornAs: xsc5shk
kind: task
status: open
dateOpened: "2026-08-05"
tags: [agent-memory, gate, context-budget]
---

# check-memory: enforce the 200-char line budget on sub-indexes and gate leaf naming

`we:docs/agent/memory-management.md` states the index-line budget as ≤ 200 chars and
`we:scripts/check-memory.mjs` prints it on every run — but `checkBudget()` is applied to
`we:agent-memory-src/MEMORY.md` only, never to the sub-indexes it already enumerates as `indexSources`. So
sub-index lines have drifted unchecked: the land-bar hook landed at 554 chars (2.7× budget, longest rule line in
the corpus) and the gate reported "within budget". A sub-index loads whole on a keyword match, so an oversized
hook is a recurring context cost, not a one-time one.

Three rules, same file:

1. **Line budget on sub-indexes.** Run `checkBudget()`'s per-line rule over every sub-index (reuse the existing
   `indexSources` list). ~10 pre-existing violations → land warn-only, then ratchet.
2. **No new hand-numbered leaves.** Reject a newly-added leaf whose filename carries a numeric prefix. Max
   existing is 146 and every leaf added since is slug-only, but the land-bar leaf was numbered 232 — the file
   count (231) + 1. Two incompatible "next number" heuristics can coexist today, and the repo already ruled
   against hand-picked ids in `we:agent-memory-src/scaffold-hash-ids-never-hand-number.md`. Also update the
   stale "create the next numbered leaf" line in `we:docs/agent/memory-management.md` so doc and gate agree.
3. **`name:` must equal the filename slug.** `we:scripts/memory-resolve.mjs` matches on the filename slug and
   ignores frontmatter, so a mismatch makes the `[[slug]]` cross-link form dead-end. ~30 pre-existing files
   drift → grandfather via a snapshot list, error only on new/changed leaves.

**Why non-blocking:** all three are convention drift that no current gate can see; nothing is broken today.

**Prevention for:** review findings on PR #1040 (simplicity + standards lenses).

**Locus:** `we:scripts/check-memory.mjs`
