---
bornAs: xncv427
kind: task
parent: "3383"
status: resolved
scope: ["we:scripts/merge-ai-prs.mjs"]
dateOpened: "2026-09-23"
dateStarted: "2026-09-23"
dateResolved: "2026-09-23"
tags: []
---

# drain: a gh listing failure exits 3 and is misread as a duplicate NNN

On 2026-09-23 every exit-3 pass from we:scripts/merge-ai-prs.mjs was really a transient/rate-limited gh pr list failure inside the all-constellation REPOS listing, but the resident drain daemon treats every exit 3 as the #2318 duplicate-NNN-on-main tripwire and backs off 15 minutes. Give the gh-listing failure its own exit code (4) with the same we:scripts/merge-ai-prs.mjs {ok:false, reason:'gh-error', detail} payload, leaving the real duplicate tripwire on exit 3 unchanged, and document the codes in we:scripts/merge-ai-prs.mjs's header.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
