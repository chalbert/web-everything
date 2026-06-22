---
kind: decision
parent: "1552"
status: open
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
preparedDate: "2026-06-22"
relatedReport: reports/2026-06-22-trainable-judge-architecture.md
tags: [judge, trainable, explorer]
---

# Trainable judge architecture — what the feedback signal is + the learning mechanism

## Digest

The trainable-judge epic ([#1552](/backlog/1552/)) needs its shape settled before any build: **what
does a human's feedback on a real run become, and how does the judge learn from it?** Today the judge
is frozen + describe-only — `fui:tools/explorer/oracles/advisoryJudge.ts:53-62` defines the
`JudgeModel` seam (with the inert `NullJudgeModel`), and `fui:tools/explorer/oracles/tier2VlmJudgeModel.ts:61`
notes Florence-2 "*DESCRIBES / TAGS / DETECTS — it does not emit explicit defects*". The judge is
advisory and **never gates** ([#1172](/backlog/1172/)).

**Prepared** against the [`trainable-judge-architecture`](/research/trainable-judge-architecture/)
topic (survey of WebVoyager VLM-as-judge, the LLM-judge calibration/bias literature, ICL-vs-fine-tune,
linear/logistic probes on (V)LM embeddings, human-in-the-loop active defect discovery,
Ferret-UI/ScreenAI/Rico UI grounding, self-healing locators, Transformers.js WebGPU limits). The
survey **reshaped the item's original "two coupled forks" into three** (the expected outcome of a real
survey): the signal-type question dissolved to a support-both default, the **anchor** was promoted from
a residual to Fork 1, and the **constellation boundary** was promoted to Fork 3. Each default has been
run through a hostile skeptic; two were amended, one survived. Defaults below are the prepared lean, not
a ruling — `/next decision` makes the call.

## Supported by default (not a fork — pass-0)

**The feedback signal type is not a fork — capture both.** A *verdict on a candidate* (real /
false-positive / wrong-severity, against a finding the judge already emitted) trains only *precision
and severity*. A *missed-issue capture* (the human authors a finding the judge never flagged) is the
*only* channel that trains *recall* — every human-in-the-loop recall result in the survey is categorical
on this (active defect discovery, the missing-annotation loop). Verdict-only is therefore a strict
subset that silently caps the perceptual ceiling the epic exists to raise — it is *broken for the goal*,
not a coherent competing end-state, and the two signals are composable into one store. So **support
both** is ratified by default, and the real open work is *how a label is anchored* (Fork 1).

## The axis being decided

Three orthogonal axes, each pinned to the real explorer tree:

- **How a label is *anchored*** so it survives to be scored. The judge consumes a `screenshot` +
  `domSnapshot` per state (`fui:advisoryJudge.ts:30-39`); a candidate carries only a `stateId` +
  free-text `detail` (`fui:advisoryJudge.ts:18-27`) — no spatial locator. The Tier-2 model already emits
  `VisionRegion` boxes (`fui:tier2VlmJudgeModel.ts:21-24`). A *missed-issue* label references a region
  the judge never emitted, so it needs its own anchor. *Fork 1.*
- **The learning *mechanism*** — the `JudgeModel.judge()` seam (`fui:advisoryJudge.ts:53-55`) is the swap
  point; today only `NullJudgeModel` + the descriptive `Tier2VlmJudgeModel` exist. What replaces/augments
  them, and in what order. *Fork 2.*
- **Where the trainable layer *lives*** in the constellation — the seam is FUI-side; the no-leakage rule
  (`we:docs/agent/platform-decisions.md#no-leakage-client`) is categorical that vision *judgment* is a
  Plateau service. *Fork 3.*

## Recommended path at a glance

| Fork | Recommended default | Main alternative (excluded) | Confidence |
|---|---|---|---|
| 1 · Label anchor | **Frozen-frame corpus keyed on `stateId` for eval/training; composite spatial anchor (bbox primary → role/text tiebreak → DOM-path debug-only) for missed-issue authoring** | Selector-only anchor; live-re-run replay | Med-High |
| 2 · Learning mechanism | **k-NN over cached DaViT vision-encoder embeddings now → linear/logistic probe on the same cache at ~tens of labels (eval-gated) → VLM fine-tune parked past ~1k labels** | Classifier-first; fine-tune-first | High (start) / Med (escalation) |
| 3 · Constellation boundary | **Trainable layer owned by + exposed through the Plateau-side `JudgeModel` seam (extends #1073/#475); FUI captures labels + consumes candidates; v1 store may sit on disk next to FUI but is not a second provider** | FUI-local judgment provider | High |

## Fork 1 — How a label is anchored

**Fork-existence:** the epic's success metric — "a trained judge beats the frozen one on *held-out*
feedback" — is unscoreable without a stable join between a label and the state it scores, so *some*
anchor is forced. The fork is *which*: a **selector-only** anchor is the broken branch (~73% of
Selenium locator failures are drift — a CSS/XPath key silently detaches across re-renders), and a
**live-re-run replay** premise is also broken (non-deterministic exploration can't guarantee the
labeled state is even revisited).

- **(a) Frozen-frame eval corpus + composite spatial anchor (default).** Two substrates for two jobs:
  - *Eval/training* re-runs the **model** over a **byte-identical frozen frame** — store the exact
    `{pngBase64, domSnapshot, stateId, verdict}` tuple (this *is* [#489](/backlog/489/)'s persisted
    frame/verdict pairs); the `stateId` (#1168 DOM signature) is the join key, so **no spatial replay
    is needed**.
  - *Missed-issue authoring + the live "a human flagged here last time" hint* use a **composite spatial
    anchor with explicit precedence**: the `stateId` gates *whether* to attempt a match; within a matched
    state the unit-normalized **bbox is primary**; **a11y-role/text is the tiebreaker**; **DOM-path is a
    debug breadcrumb only, never a re-match signal** (it is the highest-drift signal and otherwise creates
    an unresolved bbox-says-A / path-says-B conflict).
- **(b) Pure bbox anchor.** *Rejected:* drifts under responsive reflow with no structural fallback.
- **(c) Selector-only / stateId-only.** *Rejected:* selector-only drifts (~73%); stateId-only can't
  localize a missed element, so it can't score per-element recall.

**Default: (a).** `Skeptic: SURVIVES-WITH-AMENDMENT` — the attack ("is replaying labels against live
re-runs even solvable?") was correct and is folded in by **splitting eval (frozen-frame corpus, no
spatial replay) from spatial labels**, and by adding the **precedence rule** (bbox primary, role/text
tiebreak, DOM-path demoted to debug-only) that resolves the redundant-signal conflict the original
"redundant secondary signals" framing left under-specified.

## Fork 2 — The learning mechanism

**Fork-existence:** **fine-tune-first is broken** (no labeled dataset exists at v1; full fine-tune only
pays off past ~1k labels per the survey; ~2 GB Florence-2 breaks the on-device budget and is un-CI-able).
**classifier-first vs exemplar-first genuinely cannot both be v1** — you build one first, and the v1
capture format must be designed as the other's seed dataset — so this is a real either/or.

- **(a) k-NN over cached embeddings → linear probe → fine-tune (default sequence).**
  - *Now:* **k-NN retrieval over cached DaViT vision-encoder embeddings.** Florence-2's DaViT encoder
    is usable as a frozen feature extractor, so embeddings come *free off the model already loaded* — no
    new model. Embed each state, retrieve the nearest labeled states, vote. Zero training, on-device,
    works from the *first* label (cold-start), and the labels *are* the seed dataset. **Not** in-context
    prompt-exemplars fed to Florence-2 — the fixed-task-token model can't consume those.
  - *At ~tens of labels (eval-gated):* swap the k-NN head for a **linear/logistic probe on the same
    embedding cache** (the survey's load-bearing finding: a linear probe beats few-shot at the
    tens-of-examples scale, trains in seconds on CPU, stays on-device). k-NN→logistic **share the entire
    embedding pipeline**, so the v1 is *not* throwaway scaffolding.
  - *Parked, past ~1k labels:* full VLM fine-tune — server-side, off the on-device path.
- **(b) Classifier-first (skip k-NN, train the probe immediately).** *Rejected:* a logistic probe is
  undefined at zero/one label; k-NN degrades gracefully from the first example and shares the cache.
- **(c) Fine-tune-first.** *Rejected (broken):* see fork-existence.

**Default: (a).** `Skeptic: SURVIVES-WITH-AMENDMENT` — the attack exposed two errors in the original
"exemplar/few-shot memory" wording: in-context exemplars are **incompatible with Florence-2** (it only
describes), and the default never said where embeddings come from. Both are folded in by **restating v1
as k-NN over cached DaViT vision-encoder embeddings** — embeddings exist for free off the frozen
encoder, and k-NN→logistic sharing the cache is what makes exemplar-first provably non-throwaway. The
escalation trigger moves *earlier* than the item first implied (tens, not thousands).

## Fork 3 — Where the trainable layer lives (constellation boundary)

**Fork-existence:** the `JudgeModel` seam is FUI-side and label *capture* happens in the FUI-side
`improve-explorer` loop, so a **FUI-local judgment provider** (store + retrieval + training all in FUI)
is a coherent, tempting alternative — and it is the branch the no-leakage rule
(`we:docs/agent/platform-decisions.md#no-leakage-client`, categorical: a tool containing a vision
capability cannot fold it into FUI) **excludes**. Two readings genuinely cannot both hold (the trained
judgment is either owned by the Plateau capability or grown a second time in FUI).

- **(a) Plateau/WE-owned trainable layer, consumed through the seam (default).** The label store +
  retrieval + training **extend the existing Plateau/WE vision service** ([#1073](/backlog/1073/) /
  [#475](/backlog/475/)); FUI's `improve-explorer` loop **captures** labels (where the human is) and
  **consumes** the resulting candidates through the already-built `JudgeModel` seam — *zero new
  plumbing*. No Plateau service is required to *exist* first: #475 already ships the **stand-in →
  repoint** pattern (a thin client that calls a model directly today, repointed when the service lands),
  and the product consumer [#086](/backlog/086/) is **resolved** — the "Plateau isn't built" objection
  rests on a stale fact. **Locality ≠ ownership:** v1 may co-locate the `{embedding, label}` store on
  disk next to the FUI tool for operational simplicity, but it stays *owned by* and *exposed through* the
  Plateau-side seam and is repointable — exactly as #475's corpus is pipeline-owned even though FUI reads
  it.
- **(b) FUI-local exemplar store + retrieval (only an eventual classifier goes Plateau-side).**
  *Rejected:* a retrieval/k-NN layer that emits "broken" *is* judgment-production, and no-leakage is an
  **anti-fragmentation** rule ("one vision capability, N consumers, never N providers"), not merely an
  anti-bundling rule about the published `@webeverything` package. A FUI-local provider is the exact
  fragmentation #475 forbids.

**Default: (a).** `Skeptic: SURVIVES` — the attack's strongest reading ("no-leakage only bars bundling a
model inside `@webeverything`, and FUI is exempt") was beaten: #475's categorical is anti-fragmentation,
the trained label-store *is* judgment-production, and the interim stand-in→repoint pattern is already
ratified and shipped. The one clarification folded in: **v1 store-on-disk-next-to-FUI is permitted as
deployment locality, not a second provider** — owned by + behind the `JudgeModel` seam.

## Cross-cutting note

Forks 1 and 2 share one substrate: **the frozen-frame `{frame, domSnapshot, stateId, verdict}` corpus +
the cached DaViT embeddings.** Committing to that single substrate makes both forks simpler (eval needs
no spatial replay; the learning sequence needs no separate feature pipeline) and ties the build directly
to [#489](/backlog/489/)'s frame/verdict pairs. State it before ratifying.

## Decided

_Pending — ratify via `/next decision`. Record the Fork 1 anchor + Fork 2 starting mechanism &
escalation trigger + Fork 3 boundary; then `codifiedIn` a platform-decisions anchor (extending
`#no-leakage-client`) and scaffold the build slices under [#1552](/backlog/1552/)._
