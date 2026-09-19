---
name: main-session-delegates-investigation-too
description: "Standing instruction — the main/orchestrating session must delegate READ-ONLY investigation and status checks to a subagent too, not just edits; operator: 'ask subagent, never you.'"
metadata:
  type: feedback
---

**Operator (2026-09-12): "ask subagent, never you."** Said immediately after the main session ran
`node skills-src/inspect-agent-health/agent-health.mjs <id>` directly via Bash to check whether a
running background subagent was safe to proceed past, before deciding whether to launch a second
one. The same session had also been running its own `gh pr list` / `gh pr view --json files` /
`grep` research directly earlier, unremarked at the time — this correction generalizes past that
specific moment.

**This extends [[feedback-main-session-no-direct-edits]]**, which only covered mutating actions
(Edit/Write/git commit). The operator's wording ("never you") is broader: the main session should
not run investigation, verification, or status-check commands itself either — grep/read for
research, checking a subagent's health or transcript, `gh pr` lookups for reconnaissance, and
similar — even when the action is read-only, fast, and low-risk. The main session's role is
orchestration end to end, not just mutation-avoidance.

**How to apply:** When the main session needs to check whether a background subagent is done, safe
to proceed past, or has hit a problem — spawn a subagent (or message the existing one) to do that
check and report back, rather than running `inspect-agent-health` / reading its transcript / `ps`
directly. Same for research: route a code search, a `gh pr` lookup, or a "let me just check X"
verification through a subagent rather than doing it inline. This may cost a small amount of extra
latency/overhead for trivial checks — apply it anyway; the operator's instruction was explicit and
unqualified, not scoped to "only when it's expensive."
