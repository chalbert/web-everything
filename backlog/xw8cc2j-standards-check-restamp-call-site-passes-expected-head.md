---
kind: task
parent: "3054"
status: open
scope: ["we:scripts/check-standards-rules.mjs", "we:scripts/merge-ai-prs.mjs"]
dateOpened: "2026-09-21"
blockedBy: ["xm88lki"]
relatedTo: ["3735"]
tags: [review, restamp, check-standards, design-first]
---

# Standards check: every restamp or carry call site passes an expected head

Follow-up stated by #3735 (we:docs/agent/platform-decisions.md#merge-only-push-approval-carry, rule 8): a check-standards rule that flags any call site invoking we:scripts/review-set-label.mjs --to=restamp (or a future carry) without an expected head, so the head binding cannot silently regress. Waits on the --expect-head flag existing.

**Design-first and deliberately not cleared for the conveyor.** Settle the design section below on this card
first; only then clear it (the `add` command of we:scripts/conveyor/queue.mjs).

## FOUND (2026-09-21)

- #3735's prepared card states this as a follow-up, not built by the ruling: "a standards check that flags any
  `--to=restamp` (or future carry) call site that does not pass an expected head."
- Today the only in-repo spawner of `--to=restamp` outside tests is `restampAcceptance` in
  we:scripts/merge-ai-prs.mjs. The flag itself is filed as
  [xm88lki](/backlog/xm88lki-bind-restamp-to-the-proven-head-expect-head/); the runtime refusal there is the
  real guard, this rule only catches a call site written without it.
- Precedent for a call-site rule of this kind: #2990 (every `hasUnclearedReviewLabel` call site must pass
  explicit options).

## DESIGN TO SETTLE

1. **Is the rule still worth it once the flag is required?** A missing flag already fails at runtime; the rule
   moves that failure to the gate. Decide whether that earns a rule or the runtime refusal plus its test is
   enough.
2. **How to find call sites.** A text scan of `--to=restamp` / `'restamp'` argv literals in we:scripts/
   (excluding tests), or a single exported builder that every caller must use.

## Done when

1. **Executable** — a check-standards rule test asserts a fixture spawning `--to=restamp` without
   `--expect-head` is reported, and one with it is not.
2. **Executable** — `npm run check:standards` reports 0 errors on the tree.
