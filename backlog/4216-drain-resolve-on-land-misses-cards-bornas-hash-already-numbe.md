---
bornAs: xqpqyr2
kind: story
size: 5
parent: "4075"
status: resolved
scope: ["we:scripts/merge-ai-prs.mjs", "we:scripts/lib/open-pr-items.mjs", "we:scripts/__tests__/merge-ai-prs-ai-detection-and-drain-ordering.test.mjs", "we:scripts/lib/__tests__/open-pr-items.test.mjs"]
dateOpened: "2026-09-26"
dateResolved: "2026-09-26"
tags: []
---

# drain resolve-on-land misses cards: bornAs hash already numbered by merge time, and ride-along cards resolved in a sibling PR

Found via #2712 (stale-claim health sign): we:scripts/merge-ai-prs.mjs#landedIdsForCandidate reads only a merged PR's own ref+title, so it misses two real classes of already-landed cards: (1) a lane cut from a card's pre-numbering bornAs hash while the card was already numbered by merge time (we:scripts/lib/open-pr-items.mjs#deliveredHashFromPr requires the merged PR's own diff to re-file the we:backlog/<hash>-*.md scaffold, which it doesn't once the file was renamed independently) - fix by mapping bornAs->number via backlog frontmatter on main (reuse we:scripts/lane-drain.mjs#landedNumberFor). (2) ride-along cards declared/resolved inside a sibling's PR (e.g. #4121/#4134 alongside #4127 in PR #2668; #4172 alongside #4169 in PR #2689) are invisible because the extractor only ever attributes the PR's single ref-led id - fix by also reading the PR's declared resolved cards (explicit resolves/Resolves markers, structured bornAs-hash card markers cross-verified against we:scripts/lane-drain.mjs#landedNumberFor, and any we:backlog file the PR's own diff flips to status: resolved). Stay conservative: a bare mention in prose must never resolve a card.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
