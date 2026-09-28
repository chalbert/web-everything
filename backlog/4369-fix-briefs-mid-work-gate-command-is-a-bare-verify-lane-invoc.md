---
bornAs: x89yzuj
kind: story
size: 2
status: open
scope: ["we:skills-src/conveyor/fix-agent-brief.md", "we:skills-src/conveyor/fix-agent-ci-brief.md", "we:scripts/guard-bash.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# Fix briefs' mid-work GATE_COMMAND is a bare verify-lane invocation, denied to a dispatched fix agent

we:skills-src/conveyor/fix-agent-brief.md's GATE_COMMAND resolves to a bare we:scripts/verify-lane.mjs run --repo=. invocation. we:scripts/guard-bash.mjs's dispatchedAgentVerificationReason denies any we:scripts/verify-lane.mjs invocation for a mechanically-dispatched agent except request/check/reset (#3105) — so a fix-kind dispatched agent following this brief literally would be denied by the guard when it reaches this step. Give GATE_COMMAND a guard-permitted shape (the request/check poll pattern, or the admitted we:scripts/readiness/heavy-admission.mjs wrapper — see #4294 Done-when 1 for the pattern this item should mirror), and confirm with a real dispatched-agent invocation (or an equivalent we:scripts/guard-bash.mjs unit test) that the new shape is not denied. Check we:skills-src/conveyor/fix-agent-ci-brief.md for the same GATE_COMMAND pattern and fix it too if present. Discovered 2026-09-28 while building #4294 (out of that item's own Done-when scope, so filed separately rather than folded in).

## Done when

1. **Executable** — `we:skills-src/conveyor/fix-agent-brief.md`'s `{{GATE_COMMAND}}` no longer resolves to a
   bare `we:scripts/verify-lane.mjs run` (or any other shape `we:scripts/guard-bash.mjs`'s
   `dispatchedAgentVerificationReason` denies for a `fix`-dispatched agent) — a new/updated
   `we:scripts/__tests__/guard-bash.test.mjs` test asserts the exact resolved command shape is not denied for
   `dispatchedAgentVerificationReason(cmd, 'fix')`, mirroring the sibling proof #4294 added for the generic
   delivery brief's own mid-work step.
2. **Executable** — `we:skills-src/conveyor/fix-agent-ci-brief.md` is checked for the same `{{GATE_COMMAND}}`
   pattern; if present, it gets the identical fix in the same PR (not deferred to yet another item).
3. **Edge case named** — cover the case where the resolved command must still surface a genuinely RED gate to
   the fix agent (this brief's whole job is repairing a red PR) — the new shape must not silently swallow a red
   result the way a mid-work-only targeted check is allowed to; state explicitly whether the fix brief's
   terminal gate step needs the same request/check split the generic brief's step 5 already uses, or a
   different treatment, and why.
