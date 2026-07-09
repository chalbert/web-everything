---
kind: story
size: 5
parent: "2285"
status: resolved
blockedBy: ["2311"]
dateOpened: "2026-07-05"
dateStarted: "2026-07-09"
dateResolved: "2026-07-09"
graduatedTo: "we:scripts/lib/review-core.mjs (MANDATE_LENSES, MANDATORY_LENSES, ADVISORY_LENSES, PANEL_LENSES, buildPanelMandate, buildPanelFindings, derivePanelVerdict, renderPanelVerdictTable) + we:skills-src/drain/SKILL.md (the v3 multi-mandate panel ceremony)"
tags: [lane, drain, review, merge-queue, multi-agent, agent]
---

# v3: multi-mandate reviewer panel — unanimous accept lands, conflict to review:human

Third slice of #2285, blockedBy v2 (#2311). Extend v2's single reviewer into a panel of distinct mandated reviewers — correctness / security / simplicity / standards-conformance, the /code-review lenses — fanned out via the Workflow orchestrator. They must jointly agree: a unanimous accept lands the PR; any mandate conflict (e.g. security wants X, simplicity wants not-X) or non-convergence escalates to review:human, because a tradeoff between mandates is human judgment by definition. Preserves the #2285 invariant. Settle at spec: which lenses are mandatory vs. advisory; how a split verdict is surfaced to the operator.

**Surface:** builds on the v2 (#2311) negotiation loop, swapping its single reviewer for the panel; the
mandate lenses are `/code-review`'s dimensions.

**Resolved (2026-07-09):** settled both open specs. **Mandatory vs. advisory:** `correctness` and `security`
are `MANDATORY_LENSES` — genuine invariants with no other backstop, so they must unanimously accept to land.
`simplicity` and `standards-conformance` are `ADVISORY_LENSES` — `standards-conformance` already has a
deterministic backstop (`check:standards`, run as its own lane gate, #2199) so the panel's lens is a semantic
second opinion, not the only line of defense; `simplicity` is genuine stylistic judgment reasonable reviewers
can disagree on without the diff being unsafe. Advisory findings are always surfaced, never blocking on their
own. **Split-verdict surface:** `renderPanelVerdictTable()` renders a per-lens `lens | mandatory/advisory |
verdict` markdown table, posted alongside the round-by-round findings history on any `review:human` escalation,
so the operator sees at a glance which lens(es) disagreed and whether it was non-convergence (round cap) or a
genuine cross-mandate conflict. `we:scripts/lib/review-core.mjs` gained `MANDATE_LENSES` /
`MANDATORY_LENSES` / `ADVISORY_LENSES` / `PANEL_LENSES` (the lens taxonomy), `buildPanelMandate()` (seeds one
reviewer per lens, diff-only/no-checkout isolation same as v2), `buildPanelFindings()` (merges per-lens
findings into one lens-tagged list for the shared editor round), and `derivePanelVerdict()` (the pure
many-verdicts→one reduction that feeds straight into v2's unchanged `deriveNegotiationOutcome` round loop — a
genuine mandate `conflict` is a caller-supplied judgment flag, same pattern as `deriveVerdict`'s
`humanRequired`, per #51: detecting a real tradeoff from findings text is judgment, the round-cap/land/escalate
derivation stays mechanical). `we:skills-src/drain/SKILL.md`'s negotiation-loop section now documents the
panel fan-out end to end. Unit-tested in `we:scripts/lib/__tests__/review-core.test.mjs`.
