---
kind: story
size: 2
parent: "3383"
status: open
scope: ["we:scripts/conveyor/parked-pr-conflict-watch.mjs"]
dateOpened: "2026-09-06"
tags: []
---

# parked-pr-conflict-watch: verify gh pr list --json files is complete for a large PR

PR #1966's independent review (security finding, xu2krte): isStatuteTierConflict only inspects pr.files from one gh pr list --json ...,files call. If that field is capped/paginated by the GitHub API for a PR touching very many files, a statute-tier file present in the diff but past the returned page would not appear, so the Fork-2 safety carve-out could wrongly route a genuinely statute-tier conflict to auto-dispatch instead of a human stand-down. Add an explicit test/assertion (or documented, verified guarantee) that this files field is complete regardless of PR size, or an explicit fallback (gh pr diff --name-only / paginated gh api) if gh pr list truncates it.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
