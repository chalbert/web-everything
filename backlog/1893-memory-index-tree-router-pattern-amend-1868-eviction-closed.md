---
kind: decision
status: resolved
dateOpened: "2026-06-27"
dateResolved: "2026-06-27"
codifiedIn: "docs/agent/platform-decisions.md#memory-index-tree"
tags: []
---

# Memory index tree (router pattern) — amend #1868 eviction-closed

Adopt the agent memory index as a three-tier tree: an always-loaded category map plus a small core-invariants block in we:MEMORY.md, recall-gated per-category sub-indexes, and numbered leaf files reached by an explicit-read router (we:scripts/memory-resolve.mjs). This supersedes the conclusion of #1868 that line-eviction is closed — that negative recall test covered only fully-unindexed files, whereas every sub-index here stays reachable from the always-loaded map, so the index drops from about 20KB to about 3KB while rule-level awareness is preserved for the core invariants. Codified in we:docs/agent/memory-management.md.

## What #1868 concluded, and the gap

#1868 (ratified 2026-06-27) ran a fresh-session recall test and found the harness auto-loads **only** we:MEMORY.md; a topic file's body is never surfaced by its `description`. It generalised this to "eviction-to-recall-only is **closed** — an unindexed topic file is unreachable," leaving right-homing to platform-decisions + pruning as the only reclaim.

The gap: #1868's test subject was a **fully unindexed** file (no pointer anywhere). It did **not** test a file that is unindexed in we:MEMORY.md but **pointed to by an always-loaded line** indirectly. The tree exploits exactly that: the always-loaded map links each sub-index; a relevant prompt makes the agent open the sub-index, then resolve the leaf number. That is the **router pattern #1868 itself endorses** for platform-decisions / we:AGENTS.md ("an explicit-read path that works, not via memory recall") — applied one level deeper.

## The decision

1. **Three tiers.** Tier 1 = we:MEMORY.md (always-loaded): a ~10-line category map + a ~12-line core-invariants block. Tier 2 = `index-<category>` sub-indexes (recall-gated; bare `- N. Title — hook` lines). Tier 3 = leaf files `N-slug` (the fact), reached via the we:scripts/memory-resolve.mjs router (by number or slug; `--cat` prints the body).
2. **Rigor safeguard (binds the shrink, from #1868's invariant).** The most load-bearing rules (~12) stay always-loaded in the core-invariants block, so the shrink never costs rule-level awareness for what must never be missed.
3. **Self-enforcing shape.** we:scripts/check-memory.mjs is tree-aware: a leaf is "indexed" if linked OR referenced by `- N.` from we:MEMORY.md or any sub-index; the map may link **only** `index-*` sub-indexes (a leaf link there is denied — the anti-regression guard that stops the flat surface regrowing).

## Residual to watch

The live risk #1868 cared about: whether the agent reliably opens the right sub-index for **subtle** relevance (not just obvious cases like "monetization"). The core-invariants block hedges the highest-stakes rules; recall reliability on the long tail is the thing to monitor, and the trigger to revisit if a relevant rule is repeatedly missed.

Relates to #1517 (memory policy), #1855 (model-usage watch), #1868 (amended), #1879/#1878 (open memory levers).
