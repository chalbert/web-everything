---
bornAs: xjo9qj7
kind: task
status: open
blockedBy: ["3174"]
scope: ["we:scripts/merge-ai-prs.mjs", "we:scripts/lib/review-label-provider.mjs"]
dateOpened: "2026-09-07"
tags: []
---

# Fix we:scripts/merge-ai-prs.mjs's review-label drift — route through review-label-provider's port, not raw gh calls

Live defect independent of #3174's fork rulings (both branches agree it is wrong): `we:scripts/merge-ai-prs.mjs:3822-3826` mints REVIEW_LABEL_META labels (review:pending/human/accepted/changes) via a raw `gh label create` with NO `--force`, unlike the port's `GH_ARGV.ensureLabel` (`we:scripts/lib/review-label-provider.mjs:78`), which deliberately passes `--force` so the call is create-or-update, not create-only. Separately, `we:scripts/merge-ai-prs.mjs:3948`, `:3999` and `:4164` edit review:* labels via raw `gh pr edit --add-label` instead of the port's `setLabels`/`GH_ARGV` — two spellings of one operation with different semantics, in one repo, today. Fix: import `createGhProvider`/`GH_ARGV` from `we:scripts/lib/review-label-provider.mjs` (the existing tested port — #3189) and route these four call sites through it, per #3174 Fork 1=(c) (a mutation stays inside `we:scripts/merge-ai-prs.mjs`'s own home, never a second route) and Fork 2=(b) (extend the existing per-arc port rather than mint a new one, since these are already the label arc it covers). Done-when: every one of the four sites sits behind the port; the port's argv is asserted byte-identical to what each site executed before, per the discipline `we:scripts/lib/__tests__/review-label-provider.test.mjs:19` already applies; `we:scripts/merge-ai-prs.mjs`'s existing tests pass unmodified in behavior. No second provider is stood up.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
