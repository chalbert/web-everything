---
name: feedback_discovery_output_is_cards_only
description: latent-standard discovery & process ideas must materialize ONLY as backlog workitem cards — never build tooling/harness/dashboard; unsure candidate → decision card (costs nothing)
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ce78f806-ca21-484b-b08d-9a0d065212cd
---

When identifying latent standards (or proposing any process/discovery work), the **only artifact to
create is a backlog workitem card.** Do NOT build tooling, harnesses, coverage-matrix scripts, or
dashboards to "systematize" discovery — the user explicitly rejected that. A discovery "lens" is just a
*pass that emits cards*, expressed as a card itself; a "program" is an epic card with lens child cards,
not built infrastructure.

**Why:** cards are cheap, reviewable, and revisable; tooling is premature scaffolding the solo founder
doesn't want to maintain.

**How to apply:** when unsure whether a candidate is a real standard or where it's placed, file it as a
`type:decision` card — "if unsure it becomes a decision, we lose nothing" (a trivial decision closes fast).
Funnel all lenses to one triage via the `book-candidate` tag. Codified 2026-06-21 as the
latent-standard discovery program [[project_platform_decisions_statute_layer]]: epic #1399 + lens children
(#1390 verb, #1400 APG, #1401 OpenUI, #1402 app-infra, #1403 data-lifecycle, #1404 teardown, #1405
divergence) + first harvest of candidate decision cards #1384/#1393-1398. Relates to
[[feedback_decisions_are_workitems_not_plan_mode]] and [[feedback_materialization_pattern_codified]].
