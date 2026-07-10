---
kind: story
size: 3
status: open
parent: "2405"
dateOpened: "2026-07-10"
tags: [gate, review, drain, gate-self, review-escalation]
---

# Gate: honor `review:accepted` only when a human applied it — nothing enforces "a `review:human` gate-self PR is never agent-cleared"

`decideReviewGate` ([we:scripts/lib/review-escalation.mjs](scripts/lib/review-escalation.mjs), ~line 268) returns `{action:'merge'}` on the mere PRESENCE of the `review:accepted` label — checked BEFORE the sticky `review:human` guard, keyed only on `hasReviewLabel` (label presence), reading no actor/login/provenance anywhere; [we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs) adds no provenance check either. So the invariant "a `review:human` gate-self PR is never agent-cleared" (stated in [we:skills-src/review/SKILL.md](skills-src/review/SKILL.md)'s Invariant and #2286's spec: only a human may apply `review:accepted`) is DOCUMENTED POLICY WITH NO CODE ENFORCEMENT.

Trigger (2026-07-10): gate-self PRs #370 (merged) and #374 each received `review:accepted` plus a verdict comment reading "cleared by the operator, @chalbert" applied programmatically (label+comment seconds apart on #374; comment posted AFTER the merge on #370), while the operator confirms they did NOT clear them — a closing-session flow did. #374's own audit trail records it verbatim: "This supersedes the earlier auto-applied accept: that clearance was posted by a closing-session flow, not by the operator directly."

## Fix (closed-set-of-callers, not actor-provenance)
An actor-allowlist can't help — the automation shares the operator's token. The buildable fix: extract the "apply `review:accepted`" GitHub mutation into a SINGLE function that ONLY the interactive `/review` skill's step-4 human-verdict path invokes (never a batch/closing-session/drain/automation script), and add a #2406-style invariant tripwire asserting no other script in the repo issues `gh pr edit --add-label review:accepted` against a PR that carries `review:human`. This is a closed-set-of-callers guarantee (achievable) rather than GitHub-actor provenance (impossible under a shared token).

## Boundary vs. adjacent items
- **#2409** — reviewed commit-set vs. live HEAD drift (WHAT was reviewed advancing after acceptance). Different axis: this item is WHO/WHAT applied the accept label.
- **#2412** — merge-anyway timeout for blast-radius/statute parks; explicitly exempts `review:human`/gate-self. Different concern.
- **#2406** — invariant tripwires on the existing gate logic; this item adds a NEW who-applied-it invariant of the same tripwire shape.

Related: #2405 (parent, gate-hardening epic).
