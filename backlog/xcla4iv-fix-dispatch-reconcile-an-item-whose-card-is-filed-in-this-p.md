---
kind: story
size: 3
parent: "3383"
status: resolved
scope: ["we:scripts/conveyor/pr-work-unit.mjs", "we:scripts/conveyor/reconcile-fix-dispatch.mjs", "we:scripts/conveyor/__tests__/pr-work-unit.test.mjs", "we:scripts/conveyor/__tests__/reconcile-fix-dispatch.test.mjs"]
dateOpened: "2026-09-24"
dateStarted: "2026-09-24"
dateResolved: "2026-09-24"
tags: []
---

# Fix dispatch reconcile: an item whose card is filed IN this PR still refuses no-scope

we:scripts/conveyor/reconcile-fix-dispatch.mjs#planFixesFromReconcile / we:scripts/conveyor/pr-work-unit.mjs#resolvePrWorkUnit gate the item-carrying scope fallback on findItem(itemNum) resolving non-null. Live case: PR #2553 (branch lane/xzi292i-stuck-pr-watch): the card backlog/xzi292i-*.md is filed IN the PR's own diff (the standard file-item-in-PR workflow) so it does not exist on main yet, findItem returns null, and the whole item is treated as an unresolvable ghost and refused no-scope every tick even though the card's own scope: frontmatter is sitting right there in the diff and we:scripts/conveyor/reconcile-fix-dispatch.mjs#fetchPrDiffScope itself would find real files. Fix: when the item does not resolve on main but the PR diff contains backlog/<itemNum>-*.md, read the card scope from the PR head ref via gh api contents (falling back to the PR diff paths as the fence if the card itself declares none), keep attribution as the item id, and keep isSafeFallbackScopeEntry filtering. A genuine ghost item number (no card anywhere in the diff) must still refuse no-scope exactly as today. Likely single home is we:scripts/conveyor/pr-work-unit.mjs#resolvePrWorkUnit (already the shared resolver we:scripts/conveyor/reconcile-fix-dispatch.mjs and we:scripts/operations/ci-heal-pr-dispatch.mjs both consume) rather than a second hand-rolled path.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
