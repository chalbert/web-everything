---
kind: story
size: 3
status: open
relatedTo: ["2412", "2896"]
scope: ["we:scripts/lib/review-escalation.mjs", "we:scripts/merge-ai-prs.mjs", "we:scripts/review-set-label.mjs"]
dateOpened: "2026-09-04"
tags: [gate, review]
---

# Close the two residual engine-tier redteam:accepted gaps left by #2412 (bare merge sweep; no-bounce staleness)

Two residuals #2412's adversarial review surfaced and documented rather than fixed in-place, because closing them properly needs infrastructure this item's own scope did not already pay for. (1) The bare /merge orphan-sweep path (no --label) never calls decideReviewGate at all -- eligibility there is decided by hasUnclearedReviewLabel, a label-only predicate with no file-diff access, so it cannot apply the engine-tier auto-land-requires-redteam-accepted requirement; an engine-tier PR with only an ordinary review:accepted still clears on that path. Closing it needs a per-candidate file-diff fetch (mirroring the label-scoped drain's basisFiles) added to that secondary sweep path, scoped carefully so it does not regress cross-repo candidates whose diff cannot be read locally. (2) redteam:accepted carries no SHA/fingerprint of its own, unlike review:accepted's acceptanceCoversHead apparatus, so a stale redteam:accepted from an earlier head can still satisfy the engine-tier requirement for a later, different head once a fresh review:accepted is re-applied -- #2412 mitigated the bounce-shaped case (review:changes and rearm now also strip redteamAccepted) but a silent new-commit-then-reaccept path with no explicit bounce is not covered. #2412's round-2 review named a concrete, ROUTINE instance of this same gap: clear-human (the sanctioned recovery step after a re-park, used routinely per its own code comments -- "seven clearances... on byte-identical content") also freshly adds review:accepted without stripping a stale redteamAccepted, so a PR touching both an engine-tier file and a declarative-leash file can carry a redteam sign-off from one head through a clear-human re-clearance at a later head. Properly closing this (both the plain re-accept and the clear-human variant) needs redteam:accepted to get its own SHA-marker producer, which is #2896's still-open scope (giving redteam:accepted a real CLI target instead of a raw gh pr edit) -- this item is the natural follow-on once #2896 lands.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
