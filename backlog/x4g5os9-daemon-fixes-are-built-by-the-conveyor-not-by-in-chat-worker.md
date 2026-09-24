---
kind: decision
parent: "xqmw8g9"
status: open
dateOpened: "2026-09-24"
tags: []
---

# Daemon fixes are built by the conveyor, not by in-chat workers

2026-09-24: almost every daemon fix of the day was built by an in-chat worker and hand-loaded as an overlay into daemon clones, because the conveyor does not dispatch work on its own daemon code (research topic self-modifying-run-tooling-exclusion) and the review daemon may not approve its own code (we:docs/agent/platform-decisions.md#drain-daemon-self-hosting-boundary clause 3, open sub-question 4043 / xcw0nxo). Decide the path by which a daemon-code card is built, reviewed and adopted by the conveyor itself, with the independent-review invariant intact.

## Done when

1. **Executable** — the decision is prepared (`/prepare`), ruled, and `codifiedIn:` set; it composes with
   #4043 (xcw0nxo), which rules the review-independence half.
