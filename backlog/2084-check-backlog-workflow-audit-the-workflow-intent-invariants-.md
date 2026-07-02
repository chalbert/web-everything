---
kind: story
size: 3
status: resolved
dateOpened: "2026-07-02"
dateStarted: "2026-07-02"
dateResolved: "2026-07-02"
tags: []
---

# check:backlog-workflow — audit the workflow-intent invariants the schema validator cannot see

we:docs/agent/backlog-workflow.md defines invariants (sliced epics carry no size, unstoried epics do, born-active settlement, blockedBy targets not parked, Fibonacci sizes, tasks sizeless) that are enforced only by convention; under 15-plus concurrent lanes a race can leave an epic in an invalid state caught only in review. Add a deterministic validator for these workflow-intent rules alongside the existing schema checks.

## Progress

- Grounded the premise against the code: most listed invariants were ALREADY gated — Fibonacci/story-sized/task-sizeless in `validateBacklogItem` (we:scripts/check-standards-rules.mjs), sliced-epic-carries-no-size inline in we:scripts/check-standards.mjs. Two paraphrases are NOT safely enforceable and were verified against real data: "unstoried epics must be sized" false-positives on legit unsliced-awaiting-slice epics (#2021/#2025 show the `slice` CTA, per we:docs/agent/backlog-workflow.md); "blockedBy target not parked" is legitimate for a `platform-gated` block. Documented both non-enforcements in the module header.
- Built the named validator the item asks for: pure `validateWorkflowInvariants(items, {today})` in we:scripts/lib/workflow-invariants.cjs — the single tested home for the CROSS-ITEM / clock-needing rules the per-item schema validator structurally can't see. Covers (1) sliced-epic sizing (moved from the inline check-standards block — single source now) and (2) born-active settlement TTL (#670), promoted from a convention-only `check:health` O1 candidate into the deterministic gate (warning, matching O1's advisory nature).
- Wired: `npm run check:backlog-workflow` (new we:scripts/check-backlog-workflow.mjs CLI) + folded into the everyday gate (we:scripts/check-standards.mjs, replacing the inline sliced-epic block with a call). 13 fixture tests in we:scripts/__tests__/workflow-invariants.test.mjs (green). Full gate stays green — the refactor is behavior-preserving on real data.
