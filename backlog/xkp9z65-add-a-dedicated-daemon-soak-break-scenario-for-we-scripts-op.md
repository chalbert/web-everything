---
kind: task
parent: "4075"
status: open
scope: ["we:scripts/conveyor/soak/breaks", "we:scripts/operations/review-loop-cli.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# Add a dedicated daemon-soak break scenario for we:scripts/operations/review-loop-cli.mjs's mechanized prevention filing

#4493 (soak-waiver on its own PR): the review-loop's mechanized prevention filing now routes through the same lane-landing seam #4317's own soak break (we:scripts/conveyor/soak/breaks/prevention-card-lands-in-daemon-clone.mjs) already covers for the approval-time caller — but that break probes fileApprovalPreventionCard by NAME, a function that existed with a stable name across the #4317 fix (only its body changed), which is what let one probe call reproduce both the pre-fix and post-fix behavior. we:scripts/operations/review-loop-cli.mjs#fileItemForPreventionViaLandingJob is a BRAND NEW export (#4493) with no pre-fix counterpart by that name — the pre-fix behavior lived in runReviewLoopOnce's DEFAULT fileItem parameter being fileItemForPrevention instead. A correct soak break for this caller must therefore drive runReviewLoopOnce itself (with a stub judge producing a prevention-outstanding verdict, e.g. mirroring we:scripts/operations/__tests__/review-loop-cli.test.mjs's own PREVENTION_ANSWER/registryFor fixtures) end to end with NO fileItem override, and observe whether the calling checkout's backlog directory gets a new untracked file — the SAME probe code correctly discriminates pre-fix (RED, in-process write) from post-fix (GREEN, detached spawn) because what changed is which function is wired as the default, not a function's own body. Add the break module plus fixtures, mirroring we:scripts/conveyor/soak/breaks/prevention-card-lands-in-daemon-clone.mjs's shape, and its own soak test file.

## Done when

1. **Executable** — reports RED against the pre-#4493 tree (`fixPresent` false) and GREEN against this tree:
   ```
   node scripts/conveyor/soak/red-green.mjs --break=review-loop-prevention-card-lands-in-daemon-clone
   ```
