---
bornAs: x950qv1
kind: story
size: 1
status: open
scope: ["we:scripts/lib/approval-prevention-notice.mjs", "we:scripts/operations/land-prevention-card.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# Prevention-card writer escapes wiki-link syntax quoted from reviewer prose

Live 2026-09-29: orphan card x3hxr6i (from PR #2872) quoted reviewer prose that describes double-square-bracket wiki-link syntax, so the card literally contained it and failed check-standards' wiki-link rule; the sweep (PR #2901) had to drop it. MVP: the approval-time prevention-card body builder (we:scripts/lib/approval-prevention-notice.mjs / we:scripts/operations/land-prevention-card.mjs) escapes or code-spans double-bracket sequences in quoted reviewer text; then re-run the sweep so x3hxr6i lands. Must: unit test with a bracket-containing finding; live proof: x3hxr6i lands via the sweep.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
