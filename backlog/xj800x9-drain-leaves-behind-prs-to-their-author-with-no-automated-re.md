---
kind: story
size: 3
status: open
dateOpened: "2026-08-17"
tags: []
---

# Drain's auto-rebase-drop can't clear a we:AGENTS.md inventory conflict, so it falls through to manual fixup

**Correction (2026-08-17): the original framing of this item was wrong** — an independent reviewer of the filing PR confirmed we:scripts/merge-ai-prs.mjs already has a default-on automated rebase-drop pass for BEHIND PRs (`isRebaseDropCandidate`, we:scripts/merge-ai-prs.mjs:615; the rebase-drop pass at we:scripts/merge-ai-prs.mjs:2993-3070; `git log --grep="drain: rebase"` shows it running constantly in production, including on the exact PRs this item cites).

The real, narrower gap is what that pass cannot do. we:scripts/lib/rebase-drop-manifest.mjs's own `manifestConflictDisposition` distinguishes a resolvable manifest hunk from a genuinely conflicting one — and a real conflict on we:AGENTS.md's generated inventory (any two branches that both touched files the inventory tracks, diverging from a common ancestor) is classified `'real'`, which the auto-rebase-drop cannot resolve on its own; `rebaseDropContent` only resolves non-overlapping hunks. When that happens the PR is left BEHIND for a human, exactly as observed live tonight on #1437/#1436/#1426/#1443: each had already been through at least one automated "drain: rebase ... onto origin/main" pass (visible in their own commit history) and still needed a manual `npm run gen:inventory` + re-push to become landable, because the auto-pass's conflict resolution on we:AGENTS.md specifically couldn't complete it.

Worth investigating: since we:AGENTS.md is a *derived* artifact (regenerable from source, never hand-edited), a conflict on it should in principle always be mechanically resolvable — regenerate against the rebased tip rather than trying to merge the file's own diff — a narrower, more tractable fix than "detect and resolve arbitrary merge conflicts." If regeneration-on-conflict for specifically-derived files (we:AGENTS.md, and any other generated artifact the rebase-drop pass touches) can be added to `rebaseDropContent`'s resolution strategy, this residual manual-fixup class goes away entirely.

Secondary, less certain: the review also flagged that lanes never commit derived artifacts directly per #2183/#2290 (the drain regenerates them on main post-land via `regenDerivedOnLand`), which may mean the manual we:AGENTS.md-regen-and-push workaround used tonight cuts against that convention — worth checking whether the correct fix is upstream of a PR ever needing its own we:AGENTS.md commit at all, rather than downstream in the rebase-drop pass.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
