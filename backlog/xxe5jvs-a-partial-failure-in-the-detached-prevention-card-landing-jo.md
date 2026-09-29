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

# A marker-post failure racing a second approval can spawn a duplicate prevention-card landing job

#4317 moved the approval-time prevention filer (we:scripts/review-set-label.mjs#fileApprovalPreventionCard) onto a DETACHED landing job (we:scripts/operations/land-prevention-card.mjs) that acquires a lane and runs file-item/verify/open-pr for real. runApprovalPreventionFiling posts the head-keyed idempotency marker (buildApprovalPreventionMarker) when that job is SPAWNED, not when it lands.

#4317 itself closed the "lost guard" shape of this: a job that fails partway now posts a retraction of its own marker (keyed by head + job session), so the next approval on that head files again (we:scripts/operations/land-prevention-card.mjs#postLandingRetraction).

What remains is the "duplicate filing" shape (found by #4317's own red-team pass, 2026-09-28): the CARD-side idempotency lookup (we:scripts/review-set-label.mjs#findApprovalPreventionCardOnDisk) used to catch a retry by finding the card the FIRST attempt already wrote into the same checkout. Once filing moved into a lane, that lookup can no longer see a card that is still landing. So if the marker comment fails to post and a second approval on the same head runs before the first job lands, a SECOND landing job is spawned for the SAME guard, opening a duplicate card/PR, with no on-disk record to catch it.

A related ambiguous case: when open-pr fails but still names a PR (or is killed mid-run and may or may not have opened one), the job deliberately does NOT retract, so a duplicate is never filed — but if no PR actually landed, that guard is lost again. Resolving it needs the job to check whether its PR exists before choosing to retract.

## Done when

1. **Executable** — a regression that makes the marker post fail on the first approval, runs a second approval on the SAME head while the first landing job is still in flight, and asserts only one landing job (or one card/PR) results. Red before the fix, green after.
