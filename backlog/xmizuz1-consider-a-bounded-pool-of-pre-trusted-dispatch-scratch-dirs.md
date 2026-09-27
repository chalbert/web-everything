---
kind: task
parent: "4075"
status: open
scope: ["we:scripts/operations/dispatch-lane-io.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# Consider a bounded pool of pre-trusted dispatch scratch dirs instead of one fresh dir per dispatch

#4174 follow-up (fixed via we:scripts/operations/dispatch-lane-io.mjs's defaultSpawnAgent verify/re-grant/retry-once + isTrustRefusal reclassification + the new dispatch-trust-refused health smell) closed the lost-update race for the common case, but the root architectural cause remains: every dispatch mints a brand-new, never-reused scratch cwd (we:scripts/operations/dispatch-lane-io.mjs#dispatchSessionCwd), so trust can never be granted once ahead of time the way the lane pool is (we:scripts/bootstrap-session.mjs pre-trusts the lane pool once at bootstrap). If the dispatch-trust-refused health smell ever fires again after this fix lands, consider dispatching under a small, bounded, REUSED pool of pre-trusted scratch dirs instead of a fresh directory every time.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
