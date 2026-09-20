---
kind: story
size: 3
parent: "3383"
status: open
scope: ["we:scripts/operations/open-pr.mjs"]
dateOpened: "2026-09-20"
tags: []
---

# open-pr operation reports complete but created no pull request

FOUND 2026-09-20. The open-pr operation (we:scripts/operations/run.mjs open-pr with ref, title and a body file) printed complete with 1 effect applied (mode park, park label review:pending, empty sha) but no PR existed: a list of PRs by head branch in every state returned nothing, and the PR had to be opened by hand with gh pr create. It happened on the first use in a throwaway clone with a pushed branch. FIX: the operation verifies the PR exists (read it back by number) before reporting complete, and fails loudly with the reason otherwise. DESIGN TO SETTLE: why the effect applied without a PR (an empty sha suggests a park path that assumes a queued commit), and whether a pre-existing branch push is a supported input. ACCEPTANCE: a fake gh that returns no PR makes the operation fail; a real PR is read back and its number is in the verdict.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
