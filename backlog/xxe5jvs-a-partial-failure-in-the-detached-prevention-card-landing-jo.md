---
kind: story
size: 3
parent: "4075"
status: open
blockedBy: ["4317"]
scope: ["we:scripts/review-set-label.mjs", "we:scripts/operations/land-prevention-card.mjs", "we:scripts/lib/approval-prevention-notice.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# A partial failure in the detached prevention-card landing job permanently suppresses retry (marker posted before landing succeeds)

#4317 fixed the untracked-card bug by moving the approval-time prevention filer (we:scripts/review-set-label.mjs#fileApprovalPreventionCard) onto a DETACHED landing job (we:scripts/operations/land-prevention-card.mjs) that acquires a lane and runs file-item/verify/open-pr for real. That job's own PR review (codex, 2026-09-28) surfaced a residual gap #4317 deliberately did not solve: runApprovalPreventionFiling posts the head-keyed idempotency marker (buildApprovalPreventionMarker) as soon as the detached job is successfully SPAWNED (a pid exists), not once it actually lands a PR. If the job later fails partway (lane-pool exhausted, a red gate, a refused PR), nothing clears or complements that marker, so hasApprovalPreventionMarkerForHead permanently suppresses every future filing attempt for that exact PR head — the prevention guard is silently lost forever, with no retry path and no health-smell coverage (we:scripts/conveyor/health-smells/untracked-backlog-card.mjs only watches daemon-clone working trees; a failed lane's own commit is simply discarded when the lane recycles).

Fixing this needs we:scripts/operations/land-prevention-card.mjs (or a caller) to be able to report failure back onto the PR (or some other durable, checkable record) so a later approval on the same head can retry - which needs repo/pr/headSha threaded into the landing job's own input (today it only carries title/kind/size/digest/scope/parent/queue) plus a way for the detached job to post a gh comment (or clear/complement its own marker) on failure.

The SAME gap has a second failure shape (found by #4317's own red-team pass, 2026-09-28): the CARD-side idempotency lookup (we:scripts/review-set-label.mjs#findApprovalPreventionCardOnDisk) used to catch a retry too, by finding the card the FIRST attempt already wrote into the same checkout. Once filing moved into a lane, that lookup can no longer see a card that is still landing (or that failed to land) - only the marker comment dedupes now. So a marker-post failure racing a second approval on the same head can spawn a SECOND landing job for the SAME guard, opening a duplicate card/PR, with no on-disk record to catch it. Any fix here should close both shapes (lost guard, and duplicate filing) with the same mechanism if possible, since they share the one root cause: the marker is posted on a successful SPAWN, never on a successful LAND.

## Done when

1. **Executable** — a regression that spawns we:scripts/operations/land-prevention-card.mjs against a fixture that fails partway (e.g. a refused open-pr), then re-runs runApprovalPreventionFiling for the SAME PR head, and asserts the guard is either retried (a second, real attempt reaches a PR) or is at minimum visibly recorded as failed somewhere a human/smell can find it - never silently and permanently dropped. Red before this lands (today's marker suppresses the retry with no visible trace), green after.
