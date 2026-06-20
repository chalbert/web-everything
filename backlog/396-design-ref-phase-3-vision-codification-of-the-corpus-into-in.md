---
kind: decision
size: 8
parent: "382"
status: resolved
codifiedIn: docs/agent/platform-decisions.md#no-leakage-client
dateOpened: "2026-06-12"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: none
preparedDate: "2026-06-13"
relatedReport: reports/2026-06-13-design-ref-vision-pipeline.md
tags: [design-reference, corpus, vision, codification, paradigm-harvest, swappable-provider]
---

# Design-ref phase 3: vision codification of the corpus into intents

## Digest

The codification phase: a vision pass over the *admitted* corpus that fills the per-screenshot tags
#382 deferred (surface, register, layout) and harvests recurring UI paradigms into candidate
intents/blocks — *where the collection pays off*. The load-bearing finding: *coarse classification
is reliable, but full screenshot→structure recovery is hard* (Design2Code SOTA 76.3, open VLMs <45)
— so codification stays **human-in-the-loop**.

> **Decision status: RESOLVED — ratified in full (2026-06-13).** F1 (output contract): per shot emit
> only the *reliable* taxonomy facets + **loose, lossy-OK pattern observations** — no formal per-shot
> neutral structure; the standard-vocabulary / #086-neutral-structure expression appears **only at
> human-ratified promotion** (F3). F2 (provider): second no-leakage client of the shared Plateau
> vision service (settled by #475). F3 (paradigm→candidate): vision *proposes* candidates as a report
> + scaffolded `type:idea` items; human ratifies via the new-standard flow. Build → **#481** (blocked
> on #480 — wants the gated corpus + the shared vision client).

## The axis being decided

- **What the pass *emits* per shot** (the output contract) — the corpus already carries deferred
  fields (`surface`, refined `designRegister`) per #382 Fork 2, read fresh from the `we:meta.json`
  sidecars by `we:src/_data/designRefs.js`; codification fills them plus a structural description.
  *Fork 1.*
- **Which vision capability it *uses*** — **settled by #475 Fork 1 (ruled):** the shared **Plateau
  vision service**; this pass is its second, richer client (no-leakage). *Fork 2.*
- **How a harvested paradigm becomes a WE *candidate*** — the corpus is research input, and the
  standing rule is to extract reusable paradigms as candidate composable intents, not just specs.
  *Fork 3.*

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| 1 · Output contract | **✅ RULED: per shot = reliable taxonomy facets + loose pattern observations; NO formal per-shot neutral structure (formal vocabulary deferred to F3 promotion)** | Formal neutral structure per shot (couples to unbuilt #086, bakes low-fidelity structure into the corpus) | High |
| 2 · Provider relationship | **✅ SETTLED (via #475 Fork 1): second no-leakage client of the shared Plateau vision service** | Separate codifier registry | High |
| 3 · Paradigm → candidate | **✅ RULED: vision proposes candidates (report + scaffolded `type:idea` items); human ratifies via the new-standard flow; standard-vocabulary expression lives at this reviewed boundary** | Auto-generate intents from the corpus | High |

## Fork 1 — Codification output contract

**Crux.** What does the vision pass write per shot — and in whose vocabulary?

- **A (ruled, reframed 2026-06-13) — per shot: reliable facets + loose pattern observations; NO
  formal per-shot neutral structure.** Fill the deferred taxonomy facets (`surface`, refined
  `productRegister`/`visualStyle` per the split in the
  [design-ref-taxonomy](/research/design-ref-taxonomy/) topic, `theme`, `layout`) — the *reliable*
  part — **plus loose, lossy-OK pattern observations** (free tags / notes). The formal
  standard-vocabulary / #086-neutral-structure expression is **deferred to F3's human-ratified
  promotion**, not emitted per shot.
- **B (prepared default, superseded) — emit a formal neutral structure per shot, reusing #086.**
  *Rejected on review:* (1) couples every shot to #086's neutral structure, which is itself unbuilt
  open design work; (2) Design2Code shows structure recovery is low-fidelity (<76), so auto-emitting
  formal structure **bakes that error into committed corpus data**. Move the formal vocabulary to the
  one place it's human-checked (F3).
- **C — A bespoke codification IR.** *Rejected:* invents a second structural vocabulary; two IRs to
  maintain.

**Ruling: A (reframed).** Per-shot stays lightweight and uncoupled; cross-shot harvest works on
observations (clustering is fuzzy anyway), and the standard-vocabulary structure appears only at the
reviewed promotion boundary.

## Fork 2 — Provider relationship → settled by [#475](475-design-ref-vision-gated-capture-qc-candidate-surface-quality/) Fork 1 ✅ *(ruled 2026-06-13)*

**Crux.** Does codification get its own model integration or reuse the gate's?

**#475 Fork 1 is now ruled, which settles this:** vision is a **Plateau service** the corpus pipeline
consumes as a **no-leakage client** (only outputs reach the standard). Codification is the *second
client* of that one service — it adds the richer `analyzeForCodification` call, **not** a second
integration or a WE-local registry. #086's product is a third client of the same Plateau capability.
The governing **no-leakage invariant** (see #475) applies unchanged: nothing about how the corpus was
tagged leaks into any `@webeverything` published artifact. *(A separate codifier registry is rejected
for the same reason #475 rejected it — over-separation of one swappable seam.)*

**Settled: codification is a no-leakage client of the shared Plateau vision service.**

## Fork 3 — Paradigm → candidate-intent promotion path ✅ *ruled 2026-06-13*

**Crux.** A recurring layout/interaction seen across the corpus is a *candidate* for a WE intent or
block. Who turns the observation into a standard?

- **A — Vision proposes, human ratifies (ruling).** The pass clusters recurring paradigms and
  **proposes candidate composable intents/blocks as research output — a session report + scaffolded
  `type:idea` candidate items** — that a human ratifies through the normal new-standard flow. **This
  is where the formal standard-vocabulary / #086-neutral-structure expression lives** (per the F1
  reframe): at the reviewed promotion boundary, a person corrects the candidate's structure once.
  Grounded in both the survey (full structure recovery is unreliable → don't auto-author standards)
  and the standing *harvest-cross-cutting-paradigms* rule (extract candidates, not finished specs).
- **B — Auto-generate intents from the corpus.** *Rejected:* Design2Code shows even SOTA VLMs miss
  layout fidelity and visual-element recall; auto-authored standards would encode that error into
  the catalog. Codification surfaces *candidates*; ratification stays human.

**Ruling: A.**

## Dependencies / sequencing

Decision resolved 2026-06-13; the **build is #481**, `blockedBy: [480]` — it wants the gated corpus
and the shared vision-client seam that #480 establishes. The formal-promotion half (F3) softly leans
on #086's neutral structure existing; until then promotion proposes in loose form for a human to
formalise.

## Relationships

- **parent #382** — the codification phase of the corpus epic; consumes the deferred tags.
- **#475** — supplies the shared vision provider (Fork 2 delegates here) and the upstream quality gate.
- **#086** — the neutral-structure contract (Fork 1) and the human-in-the-loop review-surface ruling.
- **#394 / [design-ref-taxonomy](/research/design-ref-taxonomy/)** — the facet vocabulary this pass fills.
