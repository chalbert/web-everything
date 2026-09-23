---
bornAs: x024vz7
kind: story
size: 5
parent: "3963"
status: open
blockedBy: ["3956"]
scope: ["we:scripts/check-standards-rules.mjs", "we:scripts/merge-ai-prs.mjs", "we:scripts/lib/citation-check.mjs"]
dateOpened: "2026-09-23"
tags: []
---

# Multi-repo slice 10: one repo vocabulary

About five repo vocabularies coexist (repo key, GitHub slug, LOCI key, scope prefix, slug tag) and several files keep private copies of the repo table (we:scripts/merge-ai-prs.mjs:2298, we:scripts/lib/citation-check.mjs, the audit script) -- the same mix-up caused #3803 Fork 5's slug-vs-key guard bug. Derive LOCI, the drain's repo list, LOCUS_ROOTS and citation-check prefixes from the repo profile, and lint scope prefixes.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
