---
kind: story
size: 5
parent: "666"
status: resolved
dateOpened: "2026-06-15"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: src/_includes/research-descriptions/agentic-sdlc-opinionated-practices.njk + agentic-sdlc-opinionated-practices research topic
tags: [self-driven-project, research, configurable-dimensions, most-flexible-default, recipes, odd]
---

# Survey agentic-SDLC approaches and expose every opinionated practice as a configurable dimension (default, never a mandate)

Thorough competitive review of how the field runs agentic/autonomous software delivery — then **extract every
opinionated practice and classify each as a configurable dimension carrying a default, not a forced
mechanic.** Grounds the methodology's **composable/configurable** thesis (per [#690](/backlog/690-is-the-self-driven-project-methodology-a-first-class-constel/)):
WE mandates nothing where both branches are coherent (support-all-coherent + most-flexible-default +
intents-open-design); the restriction is the *author's opt-in*, expressed in a recipe.

**Motivating example.** [ASDLC.io](https://asdlc.io) prescribes **micro-commits**. It's a good practice —
but it's a *preference*, not something the standard should *force*. So it becomes a **configurable dimension**
(commit granularity) with a sensible **default** in the reference recipe, that a project can override —
never a hard-coded mechanic.

## Goal & output

- **Survey** the leading agentic-SDLC frameworks/tools and their opinionated practices: ASDLC.io, Tessl,
  Dash0, Swarmia, CodeRabbit, Augment, the autonomous-software-factory writeups (Forrester / HCLTech / PwC),
  and the academic framings (arXiv 2509.06216, 2510.19692). Also the everything-as-code governance prior art
  (GitOps / OpenGitOps, OSCAL, SPDX).
- **Catalog** every opinionated practice each one bakes in.
- **Classify** each practice (see rule below) → a candidate **dimension registry** + the **default recipe**
  knob values. Publish a `/research/` topic; the catalog feeds the **ODD / value-risk dimension registry**
  and the **default recipe** in [#672](/backlog/672-self-driven-project-tool-agnostic-artefact-contract-everythi/) Layer 1.

## The classification rule (per practice)

Apply the WE fork-existence + dimension-vs-fixed-mechanic tests:

1. **Both states legitimate end-states** → expose as a **configurable dimension**, default = **most
   permissive / most-flexible** value; the restriction is the project's opt-in.
2. **Exactly one correct branch (the other is flawed/won't-work)** → **bake it as a fixed invariant** (don't
   expose a fake knob).
3. **Legit but a matter of house style** → a **recipe-level preference** (a knob with a default in the
   reference recipe), not a meta-schema dimension.

## Seed catalog (to verify + extend during the survey)

| Practice (source) | Likely classification | Default lean |
|---|---|---|
| Micro-commits (ASDLC.io) | dimension — commit granularity | off/loose (project opts into strict) |
| Trunk-based vs. branch-per-task | dimension — branching model | most-flexible (allow both) |
| PR required vs. direct-to-main | recipe knob (couples to autonomy level) | per-recipe; ours allows direct-to-main (solo) |
| Test-first / TDD | dimension — test timing | not forced (gate checks *outcome*, not authoring order) |
| Conventional commits / commit-msg format | recipe knob | a default convention, project-overridable |
| Squash vs. merge commits | dimension | most-flexible |
| Mandatory human review | dimension — coupled to the autonomy-level ladder (#141/#690) | per autonomy ceiling |
| Coverage / quality thresholds | dimension — a value/risk-ODD tolerance | default flavor (ISO 25010-anchored, per #665) |

> Note: several "practices" the field *mandates* are, in WE's model, just **autonomy-level rungs** or
> **ODD tolerances** already — so the survey also maps each onto the existing axes (#690's two layers) rather
> than inventing parallel dimensions.

## Why this matters

This is the work that makes "composable, configurable methodology on a strong standard" real (per #690): the
**meta-schemas stay open** (Web Intents lesson — standardize the shape, not the list), the **default recipe**
is honestly grounded in surveyed practice, and **nothing coherent is mandated** — every opinionated rival
practice shows up as a knob a project can dial, which is itself the differentiated, no-lock-in positioning.

## Progress

- **Resolved 2026-06-15 (batch-2026-06-15).** Published `/research/agentic-sdlc-opinionated-practices/`
  (registry entry in `we:researchTopics.json` + write-up partial + report). Surveyed the field
  (web-verified: ASDLC.io, Tessl, CodeRabbit, Swarmia, arXiv 2509.06216; candidate-only: GitOps/OSCAL/SPDX,
  arXiv 2510.19692, Forrester/HCLTech/PwC, Dash0/Augment — flagged in the topic, no over-claiming) and
  classified every opinionated practice per the WE fork-existence + dimension-vs-fixed-mechanic tests.
- **Finding (feeds #672/#690):** almost nothing is a true invariant (only the everything-as-code
  foundation + gate-checks-outcome); **most field "mandates" map onto WE's two existing axes** — the
  autonomy-level ladder (#141/#690) or a value/risk-ODD tolerance — confirming #690's two-layer framing.
  The few genuinely-new dimensions are small (commit-granularity, branching-model, test-timing,
  squash/merge), each defaulting most-flexible. No classification is a blocking fork; all are defaults to
  ratify when #672 builds the registries.
- **Verified:** 11ty real build wrote the page (37KB, title renders); research-topic count 89→90;
  `check:standards` green (we:AGENTS.md inventory regenerated).
