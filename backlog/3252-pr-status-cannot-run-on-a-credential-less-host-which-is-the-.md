---
bornAs: x729f3a
kind: story
size: 5
parent: "3029"
status: open
dateOpened: "2026-08-21"
tags: []
---

# pr-status cannot run on a credential-less host, which is the host that needed it

Found on first real use, one commit after landing. `we:scripts/operations/pr-status-io.mjs` shells `gh`, and a cloud VM has no valid token — `gh auth status` reports GH_TOKEN invalid, `gh pr list` is refused as a blocked GraphQL query and `gh api repos/.../pulls` and `.../check-runs` are both refused as 403. So the operation built because a stalled PR went unnoticed for twelve hours ON THIS CLASS OF HOST cannot run there. The pure core is correct and tested and works wherever `gh` is credentialed. The established fix is the one `we:scripts/operations/stage-pr-view.mjs` already makes for `review-pr`: a file transport, staged from the channel that does have reach, with the same refuse-an-incomplete-view discipline. It refused loudly rather than reporting zero open PRs, which is the fail-closed design working.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
