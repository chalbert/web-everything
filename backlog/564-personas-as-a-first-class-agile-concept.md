---
type: idea
workItem: story
size: 3
status: open
dateOpened: "2026-06-14"
locus: plateau-app
tags: [personas, agile, methodology, governance, profiles, presets, dev-browser, plateau]
crossRef: { url: /backlog/166-governance-persona-roster-charter-schema/, label: "Governance-persona roster (#166)" }
---

# Personas as a first-class agile concept

Personas are an agile notion (roles/modes), not closed groups — a persona is a **preset** over broader composable concepts (preferences + which surfaces it lights up). Investigate personas as a concept in their own right across the platform: the governance roster ([#166](/backlog/166-governance-persona-roster-charter-schema/)) is one lens; the agile operating model (one operator multiplexing PO/BA/dev roles via agents — [#563](/backlog/563-ai-driven-agile-methodology-as-a-shareable-approach/)) is another. Unify the underlying preset/role primitive so governance personas and agile-role personas are projections of one model.

## The reframe — persona = preset, not group

A persona is **not a closed set of members** (RBAC group). It is a **front-facing label over broader composable concepts** — a named *preset* that bundles:

- **preferences** — defaults and emphasis for a way of working;
- **surfaces lit up** — which areas/views a role cares about (the dev-browser toggle-map lens, [#141](/backlog/141-dev-browser-vision/)).

Because it's a preset, **new personas are just new presets** — clone a built-in, override, done (the clone-to-derive model ratified in #166·Fork 1). The seven shipped personas are simply the presets we ship, not an enumeration of allowed roles.

> Note: this is the **lens / decision-rights** sense of a persona (what you see and care about, who reviews) — *not* authorization (what you are permitted to do). Whether a persona should ever carry real permissions is an open question this card can examine; #166 deliberately kept the two separate (RACI, not RBAC).

## Two lenses on one primitive

| Lens | Where | What the preset selects |
|---|---|---|
| **Governance personas** | plateau-app `/profiles` + dev-browser toggle-map ([#166](/backlog/166-governance-persona-roster-charter-schema/)) | what a role reviews/approves; which platform surfaces light up |
| **Agile-role personas** | the operating model ([#563](/backlog/563-ai-driven-agile-methodology-as-a-shareable-approach/)) | the mode the operator/agent occupies — PO, BA, dev, QA — when running the delivery loop |

The hypothesis: these are **projections of one preset/role primitive**. A persona is the unit you *switch into* — whether to govern a release or to do BA work this turn.

## What to investigate

- Is there a single underlying schema both lenses project from (preferences + surfaces + role-mode), with governance and agile-role as views over it?
- Does the agile operating model actually benefit from being modeled as switchable personas (does it make agent role-handoff cleaner), or is the kinship only conceptual?
- The permission question: lens-only forever, or does a persona ever gate real access? (Re-opens the RACI-vs-RBAC line #166 drew — decide deliberately.)
- Relationship to the methodology epic ([#563](/backlog/563-ai-driven-agile-methodology-as-a-shareable-approach/)): if personas are the role-switching primitive of the methodology, that's a load-bearing concept to name explicitly.

## Relationship to #166

#166 settles the *governance* roster (model, home, gate enum) and is mid-ratification on tiering. This card is **broader**: it asks whether the persona notion itself is a first-class platform concept that #166's governance roster is just one instance of. It does not block #166; it may later inform a shared primitive both lenses sit on.
