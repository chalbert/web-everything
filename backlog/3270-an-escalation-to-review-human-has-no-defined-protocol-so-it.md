---
bornAs: xh7zds7
kind: story
size: 3
status: open
dateOpened: "2026-08-24"
tags: []
---

# An escalation to review:human has no defined protocol, so it stalls

When the drain escalates a PR to review:human, nothing says what happens next. Observed on PR #1542: the label was applied and the PR simply sat, and the session reported it as blocked on the operator without having run the advisory review at all — asking the operator to clear it blind. The operator had to ask whether the review had been run. The gap is that review:human is treated as a terminus rather than as a HANDOFF with obligations on the escalating side. The protocol the operator stated: run the review, fix any issue it raises, and present a SUGGESTED verdict (accept or reject) with the findings. The human then ratifies or overrides a recommendation instead of adjudicating from scratch. Note deriveVerdict correctly refuses to reduce a clean juror result to accept on a gate-self label, so the operation is right; what is missing is the obligation on the session around it.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

## The protocol, as the operator stated it

> *"Each time a review escalates to human, we have to run the review, fix any issue, suggest a verdict (accept or reject)."*

Three obligations on the **escalating** side, in order. None of them is currently written down, and on PR #1542 none of them happened until the operator asked.

1. **Run the advisory review anyway.** `review:human` decides *who ratifies*, not *whether the work is checked*. Skipping it hands the operator an unexamined diff.
2. **Fix what it raises.** An escalation is not a licence to forward known problems upward. The human should be ratifying clean work, not triaging.
3. **Suggest a verdict — accept or reject — with the findings.** The human's job becomes ratify-or-override, which is fast and reviewable, instead of adjudicating from cold.

## What actually happened on #1542

The drain escalated it (blast-radius + statute, `we:docs/agent/platform-decisions.md`). The session reported it as *"needs you, and I can't clear it"* and moved on to other PRs. The advisory review had **not** been run. The operator asked: *"For the review human, did you run the advisory review?"* — and the answer was no.

Run afterwards, it returned **0 findings**, having cross-checked every load-bearing claim in the diff against source. That information existed for the cost of one juror and would have accompanied the escalation. Instead the operator was asked to clear a change blind.

## What is NOT broken — do not "fix" this in the operation

`deriveVerdict` is correct and must not be softened. On a `gate-self: review:human` label it returned `needs-human` **with zero findings**, refusing to reduce a clean juror result to `accept`. `review-pr`'s `record` step then refused outright:

> refusing to record `accepted` on chalbert/web-everything#1542 — gate-self: review:human is human-ceremony-only … this operation does not carry a route around it (INVARIANT 2, #2470/#2644)

That is the gate holding exactly as designed, and it held even on a run whose staged view had been framed by the session (`#3268`). **The missing piece is an obligation on the session, not a loosening of the rule.** A suggested verdict is advice attached to an escalation; it is not, and must not become, a second route to clearing the label.

## Where it belongs

The escalation is raised by the drain and consumed by whatever session next looks at the PR, so the protocol has to live where that session reads — not only in prose a fresh session may never open. Candidates, to be ruled during the build:

- `we:.claude/commands/review.md` and the `review` skill — the documented entry point for a parked PR.
- The **escalation comment the drain posts**, which currently states the reason and stops. It could state the obligation too, so the protocol arrives with the escalation instead of having to be remembered. This is the cheapest and most likely to be read.
- `we:docs/agent/backlog-workflow.md` for the durable statement.

## Done when

1. **Executable** — a test asserts the drain's escalation comment names the three obligations, so an escalated PR always arrives carrying its own protocol. It must RED today, where the comment states only the reason.
2. **Observable** — the `review` skill and `we:.claude/commands/review.md` state the protocol, including that a suggested verdict is **advice**, never a route around the `gate-self` refusal.
3. **Executable** — a test pins that `review-pr` still refuses to record `accepted` on a `gate-self` label after this change. The protocol must not become a bypass; this is the regression guard on the thing that currently works.
