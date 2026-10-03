---
bornAs: xbmbmnf
kind: story
size: 3
status: open
scope: ["we:scripts/lane-drain.mjs", "we:scripts/__tests__/lane-drain-numbering.test.mjs"]
dateOpened: "2026-10-03"
tags: []
---

# Drain JIT numbering skips hash cards that an open PR edits

On 2026-10-03 the drain's bulk JIT-number commit 952011907 renamed ~289 hash cards at once (e.g. 4862 to 4862). Open PR #3771 edits backlog/4862-*.md, so it went into a rename/modify conflict and stalled again after its last repair. Every open PR editing a stranded hash card hits the same conflict. Fix: before renaming a stranded hash card in we:scripts/lane-drain.mjs, check open PRs' touch-sets and defer any card an open PR modifies; that card gets its number when the PR itself lands (JIT at land already does this). Prove it on the live case: a PR editing a hash card stays mergeable across a bulk numbering pass.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
