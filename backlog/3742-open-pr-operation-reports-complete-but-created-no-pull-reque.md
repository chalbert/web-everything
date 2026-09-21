---
bornAs: x22o02g
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

ADDED 2026-09-20 (second sighting, cause found). The operation again printed complete with one effect applied and created no pull request, and this time the effect's own result says why: `outcome: refused`, `reason: verify-red`, `pr: null` (the verify marker for the head was red from the known environment-only `container-exec` failures). So the "complete" verdict does not read the effect's outcome. Second defect, same run: the plan's argv had no verify flag at all, because `planOpen` in we:scripts/operations/open-pr.mjs pushes `--require-verified` when `requireVerified` is true and pushes nothing when it is false (default). Since the #3321 inversion, pr-land demands a green marker by default, so the operation's default `requireVerified: false` does not mean "not required": it means the flag is omitted and the strict default applies. A caller that wants the documented opt-out (`--no-require-verified`, which makes a red marker advisory behind the required CI check) cannot express it through this operation. Landing had to go through we:scripts/pr-land.mjs directly with that flag. ACCEPTANCE addition: a fake pr-land result with `outcome: refused` makes the operation fail with the reason and no PR number; and the operation has a way to pass `--no-require-verified` (an explicit tri-state input), with a test on the argv.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
