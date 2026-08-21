---
kind: story
size: 2
parent: "3029"
status: open
dateOpened: "2026-08-21"
tags: []
---

# open-pr requires a title the home treats as optional, so no skill call site can name it

`open-pr` refuses a plan with no `title`, while `we:scripts/pr-land.mjs` treats the flag as optional and lets `gh` derive the title from the commit subject. All six skill instructions of the home omit it, so even after #3242 built the `sha`, `requireVerified` and `dryRun` inputs, not one of those sites can be rewired to the operation without also inventing a title that duplicates the commit subject. This is the last gap keeping an `open-pr` entry out of the #3224 map. Either make `title` optional and pass it through only when given — matching the home, one answer per question — or decide the stricter rule is right and change the six call sites deliberately.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
