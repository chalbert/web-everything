---
kind: task
status: open
dateOpened: "2026-08-17"
tags: []
---

# Replace the forgeable clear-human comment marker with a local ledger for the anti-test-gaming gate

Surfaced by an independent security-lens review of #3178/PR #1459 (2026-08-17), verdict CONFIRMED/prevention-outstanding. #1459 fixed a real infinite loop (we:scripts/merge-ai-prs.mjs's anti-test-gaming gate, #2440, re-parked review:human on every drain pass with no memory of a prior clear-human clearance) by teaching the gate to trust a PR comment marker (parseLatestHumanClearedSha, we:scripts/lib/review-escalation.mjs) -- but that marker's content is read from gh pr view --json comments with no authorship check, the same accepted residual the neighbouring #2409 freshness gate already carries. The difference: before #1459, #2440's park was unconditional on a tampering hit -- comment-immune, no comment content was ever consulted. #1459 removes that immunity: on a PR that already carries a real review:accepted label (comment-forgery alone cannot set that), an actor with mere comment-post access can post one comment carrying both markers for a NEW, tampering commit and suppress the park for it. Accepted for #1459 itself given the narrow precondition chain and this repo's actual threat model (a prompt-injected agent sharing the operator's single PAT, not an external attacker -- #2439), but the underlying forgeable-comment-marker mechanism itself should not be extended further, and #2440's comment-immunity is worth restoring properly. Proposed fix: a durable, LOCAL, non-PR-comment ledger recording which PR+SHA+tampering-reasons combination an operator explicitly cleared via we:scripts/review-set-label.mjs --to=clear-human's own execution -- mirroring we:scripts/lib/review-baseline-state.mjs's existing pattern (already used for the manifest-tamper gate a few lines above #2440 in the same file): written only by the CLI script itself (real local execution, not comment-post access), read by we:scripts/merge-ai-prs.mjs at the next drain pass instead of re-parsing PR comments. Should inherit and honestly document the SAME known residual we:review-baseline-state.mjs already carries (local/machine-scoped state, a cache-loss degrades to fail-open) rather than presenting itself as unconditionally stronger.

## Done when

1. **Executable** — `we:scripts/review-set-label.mjs --to=clear-human` writes a durable local ledger entry (PR
   number, cleared SHA, the exact tampering reasons cleared, timestamp) at the moment it runs, mirroring
   `we:scripts/lib/review-baseline-state.mjs`'s existing read/write shape; `shouldReparkForTestTampering`
   (we:scripts/lib/review-escalation.mjs) reads that ledger instead of `parseLatestHumanClearedSha`'s PR-comment
   parse — a test proves a PR comment ALONE (no ledger entry) no longer suppresses the re-park, closing the gap
   #1459's own review found.
2. A test proves the ledger path still correctly suppresses the re-park for a genuine clear-human ceremony at
   the matching SHA, and still re-parks for a genuinely new tampering instance past that SHA — the two
   behaviors #1459 already got right must not regress.
3. `parseLatestHumanClearedSha` and its PR-comment-based check are removed from the hot path once the ledger
   check is live (dead code, not a second parallel trust source) — or, if kept as a fallback for a ledger-miss
   case, the fallback is DENY (re-park), never a silent trust of the comment alone.
4. The item's own filing (this file) honestly documents the ledger's known residual — local/machine-scoped
   state, a cache-loss degrades to fail-open exactly as `we:scripts/lib/review-baseline-state.mjs`'s own header
   comment documents for its identical pattern — rather than presenting the ledger as unconditionally stronger
   than what it replaces.
5. `npm run check:standards` is 0 errors and the relevant new/updated test files are green.
