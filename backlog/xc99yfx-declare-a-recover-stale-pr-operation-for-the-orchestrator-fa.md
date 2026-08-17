---
kind: story
size: 3
status: open
dateOpened: "2026-08-17"
tags: []
---

# Declare a recover-stale-PR operation for the orchestrator-facing rebase+re-accept ceremony

Surfaced by tonight's (2026-08-17) operations audit. we:scripts/merge-ai-prs.mjs already auto-rebase-drops BEHIND PRs (per xj800x9's correction), and #2832 already auto-re-parks a PR whose head advances past its reviewed commit -- but neither closes the loop back to landable when the auto-pass can't finish (a we:AGENTS.md conflict, per xj800x9) or when a legitimate mechanical rebase re-parks a review that just needs re-confirming. Tonight this recovery -- fetch, checkout, merge/rebase origin/main, regenerate the inventory, commit, push, fresh-session-id review-accept -- was done by hand roughly 5 times across #1437/#1436/#1426/#1443/#1447, each time re-derived from scratch rather than run as one command. A declared operation (or at minimum a single CLI script wrapping the known-good sequence) that takes a PR number, detects which of {BEHIND, stale-review-park, both} applies, and performs the minimal safe recovery would remove this from the orchestrating session's own repeated manual work.

## Done when

1. **Executable** — a callable command (`node we:scripts/recover-stale-pr.mjs --pr=<n>` or a registered operation) takes a PR number, reads its `mergeStateStatus`/label state, and performs the correct minimal recovery: a we:AGENTS.md-only rebase conflict gets fetched/merged/regenerated/pushed, and a stale-reviewed (`#2832`-parked) PR gets a fresh-session-id `we:scripts/review-set-label.mjs --to=accepted` — a test with two fixture PR states (BEHIND-on-inventory-only, stale-review-parked) asserts each takes the correct branch and a PR that's neither is left untouched with a clear "nothing to recover" result.
2. The command is idempotent — running it twice on an already-recovered PR is a no-op, not a duplicate commit or duplicate re-accept.
3. `npm run check:standards` is 0 errors and the relevant new test file is green.
