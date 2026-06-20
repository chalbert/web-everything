---
type: decision
workItem: story
size: 2
parent: "099"
status: parked
dateOpened: "2026-06-16"
tags: [requirement-as-code, code-generation, ai, evergreen, vision]
crossRef: { url: /backlog/100-requirement-as-code/, label: "Requirement-as-code (#100)" }
relatedProject: webcases
---

# Code-from-requirement source-of-truth — requirement-only (codegen) vs AI-proposes/dev-validates

Capability 3 of requirement-as-code (#100), de-buried from its body: should code-from-requirement treat the requirement as the ONLY source of truth (code generated at build/run, needs very high confidence) — option (a) — or have the AI PROPOSE a code change a developer validates/edits — option (b)? Parked: far-future vision-tier (the #099 evergreen app), gated on the Plateau-served codegen capability existing. Placement is settled (Plateau-served, no-leakage #475); only the source-of-truth shape is the open call. Un-parks when the codegen capability is real.

## Why this is a parked decision card

When [#100](/backlog/100-requirement-as-code/) was split (`/split 100`, 2026-06-16) into slice A
(meta-schema + validator, #100 re-scoped) and slice B (requirement→webcase compiler,
[#797](/backlog/797-requirement-to-webcase-compiler-deterministic-1-n-projection/)), its third capability
— **code-from-requirement** — could not become a clean build slice: it has no WE-resident deterministic
artifact (it is pure Plateau-served AI codegen) **and** it buries this source-of-truth fork. Filed here as
its own `type:decision` card so the fork is tracked rather than carried inline in #100's body (a design
fork is a backlog decision item, never a buried checkbox).

**Parked, not open:** code-from-requirement is the furthest, hardest capability of the evergreen-app
vision ([#099](/backlog/099-evergreen-app-vision/)). Deferral governs *when* we ratify, not *whether* the
fork is tracked. The card un-parks when the Plateau-served codegen capability is real and slice C
(code-from-requirement) is picked up.

## Fork — source of truth for generated code

| Option | Shape | Notes |
|---|---|---|
| **(a) Requirement-only** | The requirement is the *single* source of truth; code is generated at build/run time from it. | Needs very high confidence in the generator — a wrong generation ships silently. Strongest form of the evergreen vision (no hand-written code to drift). |
| **(b) AI-proposes / dev-validates** | The AI *proposes* a code change from a requirement; a developer validates/edits before it lands. | Lower-risk, incremental — the patternable subset grows as the Platform AI learns. #100's body flagged this as the *more likely* near-term shape. |

**Placement is not part of this fork** — settled by [#475](/backlog/475-design-ref-vision-gated-capture-qc-candidate-surface-quality/)
(no-leakage): the AI code-proposer is a Plateau-served swappable provider the tool consumes as a
no-leakage client; only the requirement meta-schema (#100 slice A) and the webcases it compiles to (#797)
are WE-resident. The open call here is **only** which source-of-truth model the capability targets.
