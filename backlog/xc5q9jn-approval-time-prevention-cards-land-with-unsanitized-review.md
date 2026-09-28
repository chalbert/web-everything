---
kind: story
size: 3
parent: "4075"
status: open
blockedBy: ["4317"]
scope: ["we:scripts/lib/approval-prevention-notice.mjs", "we:scripts/operations/land-prevention-card.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# Approval-time prevention cards land with unsanitized review-finding text and no human gate (label-on-green)

#4317 moved the approval-time prevention filer (we:scripts/review-set-label.mjs#fileApprovalPreventionCard) from writing an inert untracked file onto a real landing path: a detached job (we:scripts/operations/land-prevention-card.mjs) now acquires a lane, files the card, and opens a PR that self-labels ready-to-merge once the gate is green (--mode=label-on-green), so the drain lands it with no human in the loop. #4317's own converge review (2026-09-28, security lens, both the panel and the red-team pass) flagged that the card's content (title/digest/scope) is built from review-finding text that ultimately traces back to a reviewed PR's own diff and a reviewer's prose (we:scripts/lib/approval-prevention-notice.mjs#buildApprovalPreventionFilingInput) - and none of it is sanitized, length-capped, or otherwise bounded before it becomes a committed backlog card and a PR body that auto-lands.

Before #4317, this same unsanitized text only ever reached an inert untracked file nobody read automatically. After #4317, it reaches `main` and is later read by delivery agents that act on backlog cards. The juror judged this a low-likelihood carve-out (mechanical filing already intends most of this content to reach main; the argv is passed with no shell, so there is no command-injection path) rather than a blocker, but named a real, worth-tracking gap: nothing validates or bounds the digest/title/scope text before it lands with no human review.

## Risks

- Any fix here must not touch we:scripts/lib/approval-prevention-notice.mjs's `buildApprovalPreventionFilingInput` casually - that file's own header already warns it is a moving target (chalbert/web-everything#2766 was reshaping it as of 2026-09-27) and is deliberately self-contained to avoid a real merge conflict with that work.

## Done when

1. **Executable** - a regression that feeds a crafted/hostile prevention finding (e.g. very long text, or text shaped like an instruction to an agent) through the real filing input builder and the landing job, and asserts the resulting card/PR body is bounded (length-capped and/or escaped) rather than landing verbatim.
