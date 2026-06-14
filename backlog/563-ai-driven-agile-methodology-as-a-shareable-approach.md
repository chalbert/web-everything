---
type: idea
workItem: epic
status: open
dateOpened: "2026-06-14"
tags: [methodology, agile, ai, ways-of-working, enablement, personas, plateau, positioning]
crossRef: { url: /backlog/143-ai-approach-page/, label: "Public approach page (#143)" }
---

# AI-driven agile methodology as a shareable approach

The way of working we've refined building this constellation — one human running a full agile team (PO/BA/dev/QA) via a virtual agent team, backlog-as-tracker, decisions-as-work-items, design-first materialization, conformance-driven demos — is itself a coherent AI-native agile methodology. Capture it as a value artifact (playbook / template / write-up), NOT a product: useful to teams who want to adopt a similar approach but find AI-for-core-workload non-obvious. Sibling to the public approach page ([#143](/backlog/143-ai-approach-page/)) and positioning narrative ([#089](/backlog/089-monetization-product-ideas/)).

## Why this has value (the adoption gap)

The observation that seeded this: most teams — including ones with no relation to this project — **fail to use AI for the significant part of their workload**. They reach for it on the margins (autocomplete, a quick draft) but not for the core of how work is planned, decided, and executed. It is *not intuitive for everyone* how to restructure real delivery around agents. So the value here is not a tool — it's a **concrete operating model** that lowers that barrier: "here is how one operator actually runs a full delivery pipeline with agents," grounded in a repo whose own history is the case study.

## What the methodology already is (encoded in this repo)

It's not aspirational — it's the practice we run daily, already materialized as artifacts:

- **Backlog-as-single-source-of-truth** — one file per item, decisions and builds alike; the tracker *is* the durable memory across sessions ([[feedback_backlog_is_tracker]]).
- **Decisions are work items, not plan mode** — design forks are claimable, ratifiable units with bold-defaulted options and fork-readiness discipline ([[feedback_decisions_are_workitems_not_plan_mode]]).
- **Design-first materialization** — research → reports → registries → refine in place, before code.
- **Conformance-driven demos** — apps exist as forcing functions for the standard, not as products ([[project_exercise_app_conformance_loop]]).
- **Mechanical CLIs + skills** — claim/resolve/scaffold/check:readiness make role-handoffs deterministic instead of prose-driven ([[project_backlog_workflow_clis]]).
- **Plain-language + verify-claims + review-checklist discipline** — the human stays the director, reviewer, and merge authority.

The "product" (if it ever is one) is the **extraction and articulation** of this implicit playbook into something another team could adopt.

## Brainstorm — related & spin-off ideas

- **Role-multiplexing / one-operator-virtual-team** — a single person occupying PO → BA → dev → QA in sequence, with agents executing each role, plausibly the throughput of a ~20-person team. Worth naming and documenting as a *pattern* (the human as orchestrator/reviewer, agents as the team). This is the conceptual bridge to personas → see [#564](/backlog/564-personas-as-a-first-class-agile-concept/).
- **Personas as the role-switching primitive** — the agile roles the operator multiplexes through are themselves a persona/preset notion; unify with the governance personas of [#166](/backlog/166-governance-persona-roster-charter-schema/). Carved out as its own investigation in [#564](/backlog/564-personas-as-a-first-class-agile-concept/).
- **Possible shapes of the artifact** — a written playbook/essay; a starter template repo (the skills + backlog CLIs as an adoptable kit); a talk/article; an internal enablement guide. The shape is open.
- **The repo as its own evidence** — git + backlog history is a measurable case study (throughput, decision cadence, rework rate). The methodology can cite *real* numbers instead of claims.
- **Relationship to #143** — #143 is the public *page* (deferred until release); this epic is the *substance* it would present. #143 becomes one surface for this; this is the source.
- **Enablement framing for day-jobs** — the same operating model, stripped of this project's specifics, as something teams stuck at "AI on the margins" could pick up.

## Out of scope / guardrails

- **Not a product.** Per request: this is knowledge/positioning value, not a thing to sell or productize. It may *feed* the monetization narrative ([#089](/backlog/089-monetization-product-ideas/)) as credibility/marketing, but it is not itself a paid offering.
- **Don't freeze a moving target early** — same caution as #143: the practice is still maturing; capture it honestly when it's settled, with real examples, rather than over-promising now.

## Status

- ⬜ Epic captured (2026-06-14). Brainstorm above; no build committed.
- ⬜ Decide the artifact shape (playbook / template / write-up) when the practice has settled — likely near release, aligned with #143.
- ⬜ Personas-as-concept carved to [#564](/backlog/564-personas-as-a-first-class-agile-concept/).
