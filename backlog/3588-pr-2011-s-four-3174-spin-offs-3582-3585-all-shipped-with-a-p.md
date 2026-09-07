---
bornAs: xh4idf6
kind: task
parent: "3174"
status: open
scope: ["we:backlog/3582-route-we-scripts-merge-ai-prs-mjs-s-remaining-gh-calls-drain.md", "we:backlog/3583-fix-we-scripts-merge-ai-prs-mjs-s-review-label-drift-route-t.md", "we:backlog/3584-build-we-scripts-lib-forge-reader-mjs-and-migrate-the-read-o.md", "we:backlog/3585-route-we-scripts-pr-land-mjs-s-gh-calls-through-a-named-forg.md"]
dateOpened: "2026-09-07"
tags: []
---

# PR #2011's four #3174 spin-offs (#3582-#3585) all shipped with a placeholder Done-when, never filled in

Retroactive review of PR #2011 (ratify+codify+spin-off #3174) found all four spun-off items — #3582 (drain arc), #3583 (review-label drift fix), #3584 (forge-reader/read arc), #3585 (land arc) — carry we:scripts/backlog/scaffold.mjs's raw placeholder in their Done-when section: '1. **Executable** — TODO: a command that fails before this item lands and passes after.' with no items 2+ either. Contrast we:backlog/3568-*.md and we:backlog/3579-*.md (filed the same day), which both have real multi-step executable Done-when. Everything else in the four cards checks out: blockedBy: ["3174"] is correct on all four, scope/line-number claims in #3583 (we:scripts/merge-ai-prs.mjs:3826,3948,3999,4164) verified byte-exact against current source, and the arcs are non-overlapping. This item is ONLY about writing the missing Done-when for each of the four — a concrete command or test that fails today and passes once that card's arc is actually ported, per the discipline each card's own prose already promises (argv byte-identical assertions per we:scripts/lib/__tests__/review-label-provider.test.mjs:19, existing tests passing unmodified).

## Done when

1. **Executable** — `grep -l "TODO: a command that fails before this item lands and passes after" backlog/3582-*.md backlog/3583-*.md backlog/3584-*.md backlog/3585-*.md` currently matches all four files (fails/is non-empty before this item lands) and matches zero files after — the raw scaffold placeholder is gone from every one of the four cards' Done-when sections.
2. Each of the four cards' replacement Done-when names at least one check specific to that card's own arc (the port/module path and the call sites it covers), not a copy-paste of another card's text — spot-checked by reading all four side by side.
3. Where a card's arc already has an existing test file to extend (e.g. `we:scripts/lib/__tests__/review-label-provider.test.mjs` for #3583, mirroring the byte-identical-argv discipline the card's own prose already cites), the Done-when names that file explicitly rather than describing the check in the abstract.
