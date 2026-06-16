# Workflow as a meta-intent — prepare #634

**Date**: 2026-06-14
**Point**: A workflow is the process-orchestration scope #616 deliberately excluded from `weblifecycle`; by the #409 placement test it decomposes Project + Protocol (orchestration machinery, SCXML/XState behind a `CustomWorkflowEngine`) + Intent (UX) + Block (wizard) — prepared #634 to ready-to-ratify with two forks.
**Research page**: `/research/workflow-meta-intent/`

---

## Question

Should Web Everything recognize a **workflow** — a "meta-intent": smaller UX intents arranged in directed progression toward one goal (`checkout = collect-address → pay → confirm`), with threaded state, a completion criterion, and a current position? If so, where does it live in the constellation, and how rich is its operator vocabulary?

## Recommendation

Two forks, both at Definition of Ready with a bold default:

- **Fork 1 — Placement:** Project + Protocol + Intent decomposition (machinery = Protocol owned by a process-orchestration project, UX = Intent, concrete wizard = Block). High confidence — direct #616/#409 precedent.
- **Fork 2 — Operator scope:** Tier-1 core mandatory + Tier-2 optional, defer Tier-3, keep the operator set an open meta-schema. Med-high.

The "several valid ways to do workflows" (wizard / single-page / conversational / board) are a configurable **register** dimension, not a fork (support-all). The coherence test (threaded state + directed progression + completion + current-position) is a fixed mechanic, not a fork.

## Key Findings

1. **Workflow is a missing third composition mode.** WE has block-owned *simultaneous* composition (`composesIntents`) and *cross-cutting* policy intents; it has no *directed/temporal* composition. The intent meta-schema has no field for it (composition lives on blocks).
2. **No native multi-step primitive.** `<form>` is single-step; the WAI-ARIA APG has no wizard pattern; only `aria-current="step"` is native step vocabulary. Flows are hand-assembled from Navigation API + View Transitions + form-associated CEs today.
3. **Statecharts (XState ↔ W3C SCXML) are the strongest meta-schema** — the same engine family #616 cited. Their 7-operator kernel maps one-to-one onto a workflow, and a serialized graph is a portable interchange (the transition-map-is-the-only-lock split that classifies the machinery as a Protocol).
4. **Workflow is #616's sibling, not its twin.** #616's own survey drew the boundary: "an FSM is in one state at a time, whereas BPMN allows a workflow to be in many … weblifecycle should not absorb a process-engine scope." Workflow *is* that excluded process-orchestration scope. Shared SCXML form, different subject/cardinality/event/persistence → siblings (bias-to-separation).
5. **Operators tier cleanly** across statecharts/BPMN/GitHub Actions/Temporal/UI steppers — Tier 1 core (sequence, branch, nest, context, completion, position), Tier 2 common (parallel, back/undo, gate), Tier 3 niche (fan-out, history, retry, compensation/saga, inclusive-OR).
6. **Register & status vocabulary** — adopt navigation's `structure:linear`/`guard`/`history`, `aria-current="step"`, and Ant's `wait`/`process`/`finish`/`error` status enum; avoid the name "stepper" (collides with the numeric NumberField).
7. **The research reshaped the forks.** The pre-prep framing (intent vs block vs new entity) was wrong: the #616/#409 precedent makes it a Project+Protocol+Intent decomposition, and surfaced the FSM-vs-process-orchestration boundary as the reason it is distinct from lifecycle.

## Files Created/Modified

| File | Action |
| --- | --- |
| `backlog/634-meta-intent-workflow-as-composable-intent.md` | Rewritten to prepared-fork shape; `preparedDate` + `relatedReport` set |
| `src/_data/researchTopics.json` | Added `workflow-meta-intent` registry entry |
| `src/_includes/research-descriptions/workflow-meta-intent.njk` | New research write-up |
| `reports/2026-06-14-workflow-meta-intent.md` | This report |
