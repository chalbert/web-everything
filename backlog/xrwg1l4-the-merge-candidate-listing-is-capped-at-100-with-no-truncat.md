---
kind: task
status: open
dateOpened: "2026-09-06"
tags: []
---

# The merge-candidate listing is capped at 100 with no truncation detector

we:scripts/merge-ai-prs.mjs hardcodes --limit 100 on the merge-candidate gh pr list, while the ordering-context listing in the same file uses OPEN_PR_LIST_LIMIT (500) and routes its result through isDegradedOpenPrListing, which flags a full page as possibly truncated. The candidate listing has neither. Past 100 open ready PRs in one repo the oldest queued ones become invisible to every pass, with no warning - the exact silent-starvation shape the 500 + detector pairing elsewhere exists to prevent.

## Done when

1. **Executable** — a test asserting the merge-candidate listing requests `OPEN_PR_LIST_LIMIT` and routes its
   result through `isDegradedOpenPrListing`, warning on a full page exactly as the ordering context does.
2. No hardcoded numeric limit remains at that call site.
