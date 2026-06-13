---
type: decision
workItem: story
size: 8
parent: "382"
status: open
dateOpened: "2026-06-12"
dateStarted: "2026-06-13"
preparedDate: "2026-06-13"
relatedReport: reports/2026-06-13-design-ref-vision-pipeline.md
tags: [design-reference, corpus, vision, codification, paradigm-harvest, swappable-provider]
---

# Design-ref phase 3: vision codification of the corpus into intents

## Digest

The codification phase: a vision pass over the *admitted* corpus that fills the per-screenshot tags
#382 deferred (surface, register, layout) and harvests recurring UI paradigms into candidate
intents/blocks — *where the collection pays off*. **Prepared**: three forks grounded in the
published [`design-ref-vision`](/research/design-ref-vision/) topic, each with a **bold** default.
The load-bearing finding: *coarse classification is reliable, but full screenshot→structure
recovery is hard* (Design2Code SOTA 76.3, open VLMs <45) — so codification stays
**human-in-the-loop with the neutral structure as the editable review surface**, not autonomous
codegen (the #086 ruling).

## The axis being decided

- **What the pass *emits* per shot** (the output contract) — the corpus already carries deferred
  fields (`surface`, refined `designRegister`) per #382 Fork 2, read fresh from the `meta.json`
  sidecars by `src/_data/designRefs.js`; codification fills them plus a structural description.
  *Fork 1.*
- **Which vision capability it *uses*** — #475 introduces one swappable `customVisionProvider`; this
  pass is its second, richer consumer. *Fork 2 — aligns with #475 Fork 1.*
- **How a harvested paradigm becomes a WE *candidate*** — the corpus is research input, and the
  standing rule is to extract reusable paradigms as candidate composable intents, not just specs.
  *Fork 3.*

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| 1 · Output contract | **Standard's own vocabulary (intents/regions/roles/states + taxonomy.json facets) — reuse #086's neutral structure, no bespoke IR** | Bespoke codification IR | High |
| 2 · Provider relationship | **Widen #475's one provider with `analyzeForCodification` → delegated to [#475](475-design-ref-vision-gated-capture-qc-candidate-surface-quality/) Fork 1** | Separate codifier registry | High |
| 3 · Paradigm → candidate | **Vision proposes candidate intents/blocks as research output; human ratifies via the new-standard flow (neutral structure as review surface)** | Auto-generate intents from the corpus | High |

## Fork 1 — Codification output contract

**Crux.** What does the vision pass write per shot — and in whose vocabulary?

- **A — The standard's own vocabulary, reusing #086's neutral structure (recommended).** Fill the
  deferred taxonomy facets (`surface`, refined `designRegister`/`visualStyle` per the split in the
  [design-ref-taxonomy](/research/design-ref-taxonomy/) topic) **plus** a structural description
  expressed in intents / regions / roles / states — *the same neutral structure #086 defines*, not a
  parallel schema. Borrowed platform/standard terms (ARIA roles, intent names) keep the output
  reviewable and make later promotion a lookup, not a translation guess.
- **B — A bespoke codification IR.** *Rejected:* invents a second structural vocabulary alongside
  #086's neutral structure; two IRs to maintain, and the harvest→candidate step becomes a
  translation. Reuse the contract #086 already justifies.

**Default: A.**

## Fork 2 — Provider relationship → delegated to [#475](475-design-ref-vision-gated-capture-qc-candidate-surface-quality/) Fork 1

**Crux.** Does codification get its own model integration or reuse the gate's?

- **A — Widen the one `customVisionProvider` with an `analyzeForCodification` method (recommended).**
  Both the gate and this pass are vision→structured-judgement; per #475 Fork 1 they share one
  registry with two methods. Codification adds the richer call, not a second integration. **This
  fork is decided wherever #475 Fork 1 is decided** — they are the same architectural choice; if
  #475 lands the single-registry default, this is automatically A.
- **B — A separate codifier registry.** *Rejected:* same over-separation #475 Fork 1 rejects (two
  integrations for one swappable seam).

**Default: A (delegated — ratifying #475 Fork 1 settles this).**

## Fork 3 — Paradigm → candidate-intent promotion path

**Crux.** A recurring layout/interaction seen across the corpus is a *candidate* for a WE intent or
block. Who turns the observation into a standard?

- **A — Vision proposes, human ratifies (recommended).** The pass clusters recurring paradigms and
  **proposes candidate composable intents/blocks as research output** — a session report + a
  `/research/` topic / backlog candidates — that a human ratifies through the normal
  [new-standard](/.../) flow. The neutral structure is the *editable review surface*: a person
  corrects it once, downstream regenerates. Grounded in both the survey (full structure recovery is
  unreliable → don't auto-author standards) and the standing *harvest-cross-cutting-paradigms* rule
  (extract candidates, not finished specs).
- **B — Auto-generate intents from the corpus.** *Rejected:* Design2Code shows even SOTA VLMs miss
  layout fidelity and visual-element recall; auto-authored standards would encode that error into
  the catalog. Codification surfaces *candidates*; ratification stays human.

**Default: A.**

## Dependencies / sequencing

No hard `blockedBy` — runs against the shipped phase-1 pipeline. Natural order: ratify #475 (which
defines the shared provider, Fork 1, and yields a clean corpus), then this pass widens the same
provider. Picking either first forces the provider seam to exist; doing #475 first means this pass
starts from a gated corpus. Make the call via `/next decision`.

## Relationships

- **parent #382** — the codification phase of the corpus epic; consumes the deferred tags.
- **#475** — supplies the shared vision provider (Fork 2 delegates here) and the upstream quality gate.
- **#086** — the neutral-structure contract (Fork 1) and the human-in-the-loop review-surface ruling.
- **#394 / [design-ref-taxonomy](/research/design-ref-taxonomy/)** — the facet vocabulary this pass fills.
