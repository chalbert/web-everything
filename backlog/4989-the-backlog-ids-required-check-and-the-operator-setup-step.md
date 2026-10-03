---
bornAs: x61tff4
kind: story
size: 5
parent: "3383"
status: open
blockedBy: ["4985", "4986"]
scope: ["we:.github/workflows/ci.yml", "we:scripts/check-standards-rules.mjs", "we:scripts/__tests__/"]
dateOpened: "2026-10-03"
tags: []
---

# The backlog-ids required check and the operator setup step

Add the required diff-scoped backlog-ids check from #3732 (pull_request_target, no if and no path filter) that fails a PR whose merge ref adds or renames to a hash-named backlog path, and asserts the merge commit's second parent equals the head sha. It reads the how-far-reach-main-reaches setting and refuses full-history-squash as unbuilt. Changing main's required contexts is an operator-run setup step, never done from an agent lane. Activation waits for the legacy repair.

## Done when

1. **Executable** — a fixture PR that adds a hash-named backlog file is red on `backlog-ids` and cannot merge; the same PR numbered is green. Red before, green after.
2. **Executable** — a stale merge ref (second parent not equal to the head sha) fails the check.
3. The check is diff-scoped, so a hash that reached main by another route does not fail every PR.
4. Selecting the `full-history-squash` setting refuses and names the value as unbuilt.
5. Adding `backlog-ids` to main's required contexts is an operator-run `setup` step recorded on this card; no agent edits repo settings. Activation waits for the legacy repair card.
