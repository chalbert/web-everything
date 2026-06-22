---
kind: epic
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

- **Backlog-as-single-source-of-truth** — one file per item, decisions and builds alike; the tracker *is* the durable memory across sessions.
- **Decisions are work items, not plan mode** — design forks are claimable, ratifiable units with bold-defaulted options and fork-readiness discipline.
- **Design-first materialization** — research → reports → registries → refine in place, before code.
- **Conformance-driven demos** — apps exist as forcing functions for the standard, not as products.
- **Mechanical CLIs + skills** — claim/resolve/scaffold/check:readiness make role-handoffs deterministic instead of prose-driven.
- **Plain-language + verify-claims + review-checklist discipline** — the human stays the director, reviewer, and merge authority.

The "product" (if it ever is one) is the **extraction and articulation** of this implicit playbook into something another team could adopt.

## The developer-role inversion (positioning)

The methodology's sharpest claim is what it does to the *developer role*. In a fully self-driven project (the framing ratified in [#665](/backlog/665-self-driven-project-ratify-the-framing-autonomy-taxonomy-mas/), the [monetization](docs/agent/platform-decisions.md#monetization) rule, epic [#666](/backlog/666-self-driven-project/)), **little or no application code is written by a human.** The machine drives the steps; the human's input concentrates at the two ends the machine can't own — **planning** (what to build and to what tolerance) and **validation** (is the proof good). The role doesn't disappear, it **moves up the abstraction ladder**:

- **Planner / intent-author** — sets the goal and the risk/tolerance envelope; authors intents and decisions, not implementations. (The "PO/BA" personas of the role-multiplex, [#564](/backlog/564-personas-as-a-first-class-agile-concept/).)
- **Validator** — reviews **proof, not diffs**. At L3 autonomy the system does the whole task and the human approves the *evidence* (a green gate, a reproduced behaviour, a verified finding) rather than reading every line. This is the QA persona, inverted: judging acceptance signals instead of hand-testing.
- **Fallback-ready L3 operator** — stays the system's fallback (per the SAE L2→L3 boundary: at L3 the human is the fallback, not part of the task). Ready to take the wheel on a tolerance breach, but not steering by default.
- **Gate / standard author** — the role where the work actually concentrates. (See the step-tree, [#671](/backlog/671-self-driven-project-step-tree-every-sdlc-step-automatable-da/).)

**The inversion, stated explicitly: as app-code authoring evaporates, value concentrates in gate authoring.** A step can be automated exactly as far as its acceptance signal is machine-checkable — so the way to make a project *more* self-driven is to keep converting the next human-judgment gate into a data-driven one. That conversion *is* the high-value human work: writing the standard, the conformance check, the measurable definition-of-done that lets the machine drive one more step unattended. The developer stops being the person who types the implementation and becomes the person who **authors the gates the implementation must pass** — design decisions and standards being the deliberate human floor (the genuine-fork call is kept human on purpose).

**Nuance — maintainability is a real, standing risk dimension.** This is not a free lunch. As the human writes less of the code, the binding constraint shifts to the **operator's ability to keep driving** — to understand, steer, and recover the system they no longer hand-author. Maintainability stays a first-class value/risk dimension (one of #665's five), and it is the dial that can force a human back down the ladder: a codebase the operator can no longer reason about caps the autonomy the project can safely run at, regardless of how green the gates are.

## Brainstorm — related & spin-off ideas

- **Role-multiplexing / one-operator-virtual-team** — a single person occupying PO → BA → dev → QA in sequence, with agents executing each role, plausibly the throughput of a ~20-person team. Worth naming and documenting as a *pattern* (the human as orchestrator/reviewer, agents as the team). This is the conceptual bridge to personas → see [#564](/backlog/564-personas-as-a-first-class-agile-concept/).
- **Personas as the role-switching primitive** — the agile roles the operator multiplexes through are themselves a persona/preset notion; unify with the governance personas of [#166](/backlog/166-governance-persona-roster-charter-schema/). Carved out as its own investigation in [#564](/backlog/564-personas-as-a-first-class-agile-concept/).
- **Possible shapes of the artifact** — a written playbook/essay; a starter template repo (the skills + backlog CLIs as an adoptable kit); a talk/article; an internal enablement guide. **This is a fork, tracked as its own decision card — [#569](/backlog/569-artifact-shape-for-the-ai-driven-agile-methodology-playbook-/)** (parked until the practice settles). It gates this epic's decomposition.
- **The repo as its own evidence** — git + backlog history is a measurable case study (throughput, decision cadence, rework rate). The methodology can cite *real* numbers instead of claims.
- **Relationship to #143** — #143 is the public *page* (deferred until release); this epic is the *substance* it would present. #143 becomes one surface for this; this is the source.
- **Enablement framing for day-jobs** — the same operating model, stripped of this project's specifics, as something teams stuck at "AI on the margins" could pick up.

## Out of scope / guardrails

- **Not a product.** Per request: this is knowledge/positioning value, not a thing to sell or productize. It may *feed* the monetization narrative ([#089](/backlog/089-monetization-product-ideas/)) as credibility/marketing, but it is not itself a paid offering.
- **Don't freeze a moving target early** — same caution as #143: the practice is still maturing; capture it honestly when it's settled, with real examples, rather than over-promising now.

## Status

- ⬜ Epic captured (2026-06-14). Brainstorm above; no build committed.
- ⬜ Artifact-shape fork carved to its own decision card [#569](/backlog/569-artifact-shape-for-the-ai-driven-agile-methodology-playbook-/) (parked; ratify near release, aligned with #143). Gates this epic's decomposition.
- ✅ Personas-as-concept resolved in [#564](/backlog/564-personas-as-a-first-class-agile-concept/) (2026-06-14, ratified). **Ruling for this playbook (Fork 2·A):** name "persona/preset" as this methodology's *explicit role-switching primitive* — "the operator switches persona (PO/BA/dev/QA)" — as a documented concept, not a built schema (CrewAI role-persona prior art). Authoring tracked in [#622](/backlog/622-document-the-persona-preset-primitive-as-a-named-platform-co/).
