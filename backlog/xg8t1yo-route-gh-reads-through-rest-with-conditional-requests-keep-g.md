---
kind: story
size: 5
status: open
scope: ["we:scripts/lib/gh-throttle.mjs", "we:scripts/lib/"]
dateOpened: "2026-09-28"
tags: []
---

# Route gh reads through REST with conditional requests; keep GraphQL only for GraphQL-only mutations

The App installation GraphQL bucket (5000 points/hr) runs out under daemon polling and halts the drain for up to an hour (live 2026-09-28 9:11 PM ET: drain pass exit 4 gh-error rate-limited while the REST core bucket sat at 6100/6100). Almost every daemon call is a read (pr list/view, labels, checks, files, comments) with a REST equivalent. MVP: in we:scripts/lib/gh-throttle.mjs, the shared throttled gh wrapper, translate the common read shapes (gh pr list/view with the JSON fields daemons request) to REST calls, with ETag conditional requests cached on disk so an unchanged answer returns 304 and costs no rate limit. Keep GraphQL only for GraphQL-only mutations (markPullRequestReadyForReview for draft promote, enablePullRequestAutoMerge). Must: field parity for the translated shapes (number, isDraft, labels, headRefOid, mergeable/mergeStateStatus, statusCheckRollup, files, updatedAt) proven by a test comparing both paths on a fixture; per-call fallback to GraphQL when a shape is untranslated; live proof: one drain pass and one review-daemon tick with GraphQL spend near zero and REST 304 hits logged. Complements xhcgdce (PR 2885, read split to the personal identity). Follow-up (not MVP): webhook-driven invalidation of the ETag cache.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
