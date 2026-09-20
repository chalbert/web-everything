---
kind: story
size: 5
parent: "3383"
status: open
scope: ["we:scripts/operations/land-advance-io.mjs", "we:scripts/operations/land-advance-repair.mjs"]
dateOpened: "2026-09-20"
tags: []
---

# land-advance follow-ups from the handlers work: finished sessions counted as live, ledger cap never decays, first live apply untried

FROM the handlers-1 result (2026-09-20). (1) The dispatch-fix and dispatch-review rows still treat a finished-but-unreaped session as a live worker (only the new ci-heal and conflict-fix rows use the slot-holding test). (2) The follow-up ledger cap never expires: a PR healed three times over its life escalates on the next red; decide decay. (3) The first live apply of dispatch-ci-heal and dispatch-conflict-fix is untried: run plan mode against live PRs, then apply under watch. (4) A conflict fix on a review-accepted PR changes its head sha after acceptance, which the drain reviewed-sha check may treat as needing a fresh review. (5) pr-queue-first as a general hold (blocking new picks such as graduation-owed) belongs to the conveyor service worker. ACCEPTANCE: each of the five has a decision recorded and a test or a documented live run.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
