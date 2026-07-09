---
kind: story
size: 5
parent: "2285"
status: resolved
blockedBy: ["2286"]
dateOpened: "2026-07-05"
dateStarted: "2026-07-09"
dateResolved: "2026-07-09"
tags: [lane, drain, review, merge-queue, multi-agent, agent]
graduatedTo: "we:skills-src/drain/SKILL.md (the humanRequired:false ceremony) + we:scripts/lib/review-core.mjs (buildEditorMandate, NEGOTIATION_ROUND_CAP, deriveNegotiationOutcome)"
---

# v2: editor↔reviewer negotiation loop — drain auto-fixes to convergence

Second slice of #2285. Replace v1's author-bounce (a review:changes verdict routes the fix back to the author lane) with a bounded editor↔reviewer convergence cycle in the /drain auto-review ceremony: an editor agent proposes a fix, the reviewer agent critiques, iterate until the reviewer accepts or an N-round cap trips — non-convergence escalates to review:human. Composes on the Workflow orchestrator (deterministic loop-until-agreement). The final landed state is reviewer-approved, so the #2285 invariant (a landed diff signed off by a non-author) holds. Settle at spec: the round-cap N; where the editor writes (its own lane clone vs. a direct push).

**Surface:** modifies the v1 auto-review ceremony —
[we:skills-src/drain/SKILL.md:128-137](skills-src/drain/SKILL.md#L128-L137) (the `changes` verdict step
that today routes back to the author lane).

**Resolved (2026-07-09):** settled both open specs — round-cap N = 3 (`NEGOTIATION_ROUND_CAP`, a tuning knob,
not hardcoded per caller) and the editor writes in an **isolated throwaway clone of the PR branch**, pushing
back to that SAME branch (never the drain's shared checkout — the #2336 constraint extends to the editor).
`we:scripts/lib/review-core.mjs` gained `buildEditorMandate()` (seeds the editor round) and
`deriveNegotiationOutcome()` (the pure `continue`/`land`/`escalate` derivation from a round's verdict + the
round cap — the hookable half of the loop per #51; the judgment — proposing/critiquing a fix — stays with the
subagents). `we:skills-src/drain/SKILL.md`'s `humanRequired: false` branch now drives the bounded loop
in-session instead of the v1 one-shot review + author-bounce; non-convergence and conflict-of-interest both
escalate to the same `review:human` shape. Unit-tested in
`we:scripts/lib/__tests__/review-core.test.mjs`. v3 (#2310) is now unblocked.
