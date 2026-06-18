# Agentic-SDLC opinionated practices — survey and dimension classification

**Date**: 2026-06-15
**Point**: Surveyed how the field runs agentic/autonomous software delivery and classified every opinionated practice as a configurable dimension (default = most-flexible), a fixed invariant, or a recipe-level house-style knob — confirming #690's two-layer framing (the autonomy ladder + value/risk-ODD tolerances already absorb most "mandates").
**Backlog item**: #703 (parent #666; feeds #672 Layer 1 / #690)
**Research page**: `/research/agentic-sdlc-opinionated-practices/`
---

## Question

How does the field run agentic / autonomous software delivery, and which of its opinionated practices should the self-driven-project methodology expose as configurable **dimensions** (with a default) versus bake as **invariants** versus leave as recipe-level **house-style knobs** — so WE mandates nothing where both branches are coherent?

## Recommendation

Adopt the per-practice classification in the research topic. The defaults to ratify in #672:
- **Dimensions (default most-flexible):** commit-granularity (loose), branching-model (any), test-timing (not forced), squash/merge (any), AI-review-gate (optional), mandatory-human-review (per autonomy ceiling), coverage/quality thresholds (ODD tolerance, default flavor).
- **Recipe knobs (house style):** commit-msg format / conventional commits, PR-vs-direct-to-main (WE's own recipe: direct-to-main, solo), spec-before-code timing.
- **Invariants (the only two):** everything-as-code foundation (artefacts declarative + version-controlled — the OpenGitOps floor); gate checks the *outcome*, not the authoring order.

## Key Findings

1. **The thesis holds.** Almost nothing the rivals *mandate* is a true invariant in WE's model — it's a dial. Only the everything-as-code foundation and gate-checks-outcome resist a knob.
2. **The axes are already drawn (#690 confirmed).** Most field practices are not new dimensions: merge-to-main boundaries, mandatory review, consultation packs, PR-vs-direct map onto the **autonomy-level ladder** (#141/#690); coverage/quality/metrics thresholds map onto **value/risk-ODD tolerances**. The survey did not need parallel dimensions for them.
3. **Few genuinely-new dimensions, all small:** commit-granularity, branching-model, test-timing, squash/merge.
4. **Convergent artefact-contract prior art:** Tessl's Spec Registry, GitOps's declarative store, OSCAL control-as-code, SPDX provenance, and SE 3.0's Merge-Readiness/Consultation Packs are all "methodology + evidence as versioned machine-readable artefacts" — the white space WE occupies is the open, no-lock-in, *composable* contract over them, not a new silo.

## Provenance (no over-claiming)

Web-verified this pass: ASDLC.io (micro-commits, merge-to-main governance boundary), Tessl (spec-centric framework + Spec Registry), CodeRabbit (AI-review-in-loop, YAML custom rules), Swarmia (DORA/SPACE + working agreements), arXiv 2509.06216 (Hassan et al., SE 3.0). Candidate (prior knowledge + spot-check, deep-fetch on refresh): GitOps/OpenGitOps, OSCAL, SPDX, arXiv 2510.19692, the Forrester/HCLTech/PwC software-factory writeups, Dash0, Augment. No classification is a blocking fork — all are defaults to ratify in #672.

## Files Created/Modified

| File | Action |
|---|---|
| `we:src/_data/researchTopics.json` | Added `agentic-sdlc-opinionated-practices` registry entry |
| `we:src/_includes/research-descriptions/agentic-sdlc-opinionated-practices.njk` | Created the write-up (survey + classification catalog + findings) |
| `we:reports/2026-06-15-agentic-sdlc-opinionated-practices.md` | This report |
| `backlog/703-…md` | Resolved (graduatedTo the research topic) |
