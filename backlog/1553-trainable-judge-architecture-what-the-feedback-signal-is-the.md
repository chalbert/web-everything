---
kind: decision
parent: "1552"
status: open
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
preparedDate: "2026-06-22"
relatedReport: reports/2026-06-22-trainable-judge-architecture.md
blockedBy: ["1565"]
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
  Plateau service, and the zero-impl rule (#1282) keeps WE to contracts only. So the real shape is a
  three-way split (Plateau impl / WE contract / explorer-tool produces-the-signal), not a two-way
  Plateau-vs-FUI — and that explorer-tool home is itself contested by [#1565](/backlog/1565/)
  (devtools→Plateau). *Fork 3.*

## Recommended path at a glance

| Fork | Recommended default | Main alternative (excluded) | Confidence |
|---|---|---|---|
| 1 · Label anchor | **Frozen-frame corpus keyed on `stateId` for eval/training; composite spatial anchor (bbox primary → role/text tiebreak → DOM-path debug-only) for missed-issue authoring** | Selector-only anchor; live-re-run replay | Med-High |
| 2 · Learning mechanism | **k-NN over cached DaViT embeddings now → linear/logistic probe at ~tens of labels (eval-gated) → VLM fine-tune parked. Asset = the model-agnostic corpus; embeddings are a re-derivable cache; recipe is encoder-parameterized so it ports to any judge agent** | Classifier-first; fine-tune-first; agent-locked artifacts | High (start) / Med (escalation) |
| 3 · Constellation boundary | **Three-way split: Plateau owns the impl (model/store/training, extends #1073/#475/#490); WE owns only the contract (judgment schema / `JudgeModel` type — never any impl, per #1282); the explorer dev-tool (FUI repo) *produces the signal* (frames + labels) + hosts the seam — it is not the consumer (the human/agent loop is). v1 store may sit on disk next to FUI but is not a second provider** | FUI-local judgment provider; any WE-owned impl | High |

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
    prompt-exemplars fed to Florence-2 — the fixed-task-token model can't consume those. The DaViT
    embeddings are a **derived cache keyed by `(encoder-id, frame)`, never the asset** — see the
    agent-portability constraint below.
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

**Agent-portability constraint (ratified amendment — extends the `JudgeModel` zero-lock-in seam from
[#1552](/backlog/1552/) from *inference* to *training*).** The platform's minimize-lock-in posture is
already categorical at the inference layer (the judge model is a swappable provider). It must hold for
the *training artifacts* too: we must not lock the labeled data or the recipe to one agent/VLM. So the
default (a) is constrained by a hard separation —
- **The asset is the model-agnostic corpus:** `{frozen-frame PNG, domSnapshot, stateId, verdict,
  spatial anchor, label vocabulary}`. Nothing model-specific is stored as the asset. This is the
  durable, never-lose artifact (and it *is* Fork 1's frozen-frame corpus + [#489](/backlog/489/)'s
  frame/verdict pairs).
- **Embeddings are a re-derivable cache** keyed by `(encoder-id, frame)`. DaViT-off-Florence-2 is the
  cheap path *now*, but swapping the judge agent ⇒ re-embed the same corpus with the new encoder ⇒
  retrain. Zero data loss.
- **The training recipe is encoder-parameterized** (embed → k-NN → eval-gated probe), authored as a
  model-agnostic pipeline that takes the encoder as an input, *not* hardcoded to DaViT. The probe
  weights are model-specific but **disposable by design** (seconds to retrain on CPU from the portable
  corpus). The parked fine-tune is the *only* truly agent-locked artifact — a second reason it stays
  parked.

This re-applicability to other agents is the load-bearing requirement, not a nice-to-have: the corpus +
recipe outlive any one judge model.

## Fork 3 — Where the trainable layer lives (constellation boundary)

> **⛔ Blocked by [#1565](/backlog/1565/) (dev-tool placement review).** A user ruling — *devtools belong
> in Plateau, not FUI* — contests the "FUI repo" premise running through this fork (the explorer at
> `frontierui/tools/explorer`). Every "FUI repo / FUI side" reference below is **provisional**: if #1565
> relocates the explorer to Plateau, the producer/transport role stays the same but moves repos, and the
> Plateau-owns-impl / WE-owns-contract split is *unaffected* (it never depended on the explorer's repo).
> **Do not ratify #1553 until #1565 resolves.**

**Fork-existence:** the `JudgeModel` seam is FUI-side and label *capture* happens in the FUI-side
`improve-explorer` loop, so a **FUI-local judgment provider** (store + retrieval + training all in FUI)
is a coherent, tempting alternative — and it is the branch the no-leakage rule
(`we:docs/agent/platform-decisions.md#no-leakage-client`, categorical: a tool containing a vision
capability cannot fold it into FUI) **excludes**. Two readings genuinely cannot both hold (the trained
judgment is either owned by the Plateau capability or grown a second time in FUI).

- **(a) Plateau-owned trainable layer behind the seam; WE holds only the contract; FUI consumes
  (default).** A *three-way* split, not "Plateau or FUI" — and crucially **WE owns no part of the
  implementation** (the foundational zero-impl rule, `project_we_zero_standard_implementation` / #1282:
  WE = contracts, definitions, validate scripts — never a model, store, or training loop):
  - **Plateau owns the implementation** — the model, embeddings, label store, training, and the #490
    distillation pipeline **extend the existing Plateau vision service** ([#1073](/backlog/1073/) /
    [#475](/backlog/475/) / [#490](/backlog/490/)). This is the no-leakage vision capability.
  - **WE owns only the *contract*** — the judgment output schema / the `JudgeModel` interface as a
    codified type (a type-only `@webeverything/contracts` artifact *iff* a WE consumer needs it). Even
    the #1034 rubric is the *service's* output contract, not a published WE artifact — so WE's surface
    here may be nothing more than the interface type.
  - **The explorer dev-tool (FUI repo) produces the signal + hosts the seam — it is *not* the
    "consumer."** Two things to keep straight: (i) FUI-the-implementation-layer (the components) is *not
    a party* here at all — only the explorer dev-tool that happens to live in the FUI repo touches this;
    (ii) even that tool only **produces the training signal** (captures state frames + human labels in
    the `improve-explorer` loop, ships them to the Plateau corpus) and **hosts the seam / transports
    outputs** (calls `JudgeModel.judge()` (`fui:advisoryJudge.ts:53-55`), pipes the returned
    `AdvisoryCandidate[]` into its report). The **actual consumer** of the judgment is the **human +
    `improve-explorer` agent loop** reviewing that report and authoring the next labels. *Only outputs
    cross the seam* (no-leakage); the model/embeddings/store never leave Plateau. This is *zero new
    plumbing* on the explorer side. **Corollary:** because the FUI side is signal-producer + transport
    (never judgment-production), the rejected "FUI-local provider" branch has nothing it *should* grow
    from — which only hardens the default.

  No Plateau service is required to *exist* first: #475 already ships the **stand-in → repoint** pattern
  (a thin client that calls a model directly today, repointed when the service lands), and the product
  consumer [#086](/backlog/086/) is **resolved** — the "Plateau isn't built" objection rests on a stale
  fact. **Locality ≠ ownership:** v1 may co-locate the `{embedding, label}` store on disk next to the FUI
  tool for operational simplicity, but it stays *owned by* and *exposed through* the Plateau-side
  capability and is repointable — exactly as #475's corpus is pipeline-owned even though FUI reads it.
  (None of this disk-locality ever lands the implementation in WE.)
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

Forks 1 and 2 share one substrate: **the model-agnostic frozen-frame `{frame, domSnapshot, stateId,
verdict, anchor, label-vocab}` corpus** (with the DaViT embeddings as a *derived, re-derivable cache*,
never the asset — per Fork 2's agent-portability constraint). Committing to that single substrate makes
both forks simpler (eval needs no spatial replay; the learning sequence needs no separate feature
pipeline), keeps the asset portable across judge agents, and ties the build directly to
[#489](/backlog/489/)'s frame/verdict pairs. State it before ratifying.

## Two learning channels — and the design-knowledge program

The judge learns from **two composable channels**, not one. Naming both keeps the architecture honest:

- **Bottom-up (Forks 1–2) — per-run feedback.** Human triage on real runs → labeled corpus → trained
  Tier-1 classifier. Learns *this app's / this run's* specific defects. App-specific, sparse, fast-moving.
- **Top-down — ingested general design knowledge.** A continuous intake of design best-practices,
  usability research, design-system blogs, and trends, **distilled into the codified design-knowledge
  base** (the [#1034](/backlog/1034/) design-critique rubric — already the vision service's *codified
  output contract* per [vision-tiers](/docs/agent/platform-decisions/#vision-tiers)). Gives the judge its
  general "what good looks like" priors, independent of any one app's feedback.

The two compose: top-down supplies the priors, bottom-up specializes them. Two rulings belong here:

1. **AI over a contract, not raw text into weights** (`feedback_ai_over_contract_not_as_artifact`). The
   ingested knowledge is **distilled into codified heuristics** (rubric entries carrying provenance back
   to the source) — this *is* [#490](/backlog/490/)'s "codified distillation pipeline" — never dumped as
   opaque text fed to a model. This is also what makes the design knowledge **portable across judge
   agents**: the codified rubric outlives any VLM, where fine-tuned-in knowledge would lock to one agent.
2. **The intake is a standing program with *two* ongoing research tracks, not a one-shot.** Best-practice
   and usability research arrive continuously, so a periodic watch refreshes the codified base (the
   `review-program` pattern). The program owns two never-finished questions:
   - **Source discovery & curation (the meta-question).** *Where* authoritative design knowledge comes
     from is itself open research — which venues (peer-reviewed usability labs, design-system docs,
     conference proceedings, practitioner blogs, trend reports) to ingest, and that set *evolves*:
     discover new sources, retire stale ones. Treat it as an **open set; standardize the admission +
     credibility criteria, not a frozen source list** (the `project_intents_open_design` posture). Each
     source carries a **credibility weight/provenance** — durable peer-reviewed usability research
     outranks a trend blog — and that weight flows through to the distilled heuristic. A passing *trend*
     is admissible as a *low-weight* signal; a trend masquerading as durable best-practice is exactly
     what the curation criteria must catch.
   - **Content distillation.** From the curated, weighted sources, distill heuristics into the
     [#1034](/backlog/1034/) rubric (track 1 feeds track 2).

   **This program is a separate sibling item to scaffold — out of scope for this decision.** #1553 only
   sets the *seam*: the judge reviews against the codified design-knowledge base, and the program feeds
   it. *(Open at ratification: does the program parent under [#1552](/backlog/1552/) or stand alone
   feeding both the judge and the design-review loop [#1033](/backlog/1033/)? Lean standalone — the
   knowledge serves more than the judge.)*

## Eval & regression benchmark (ratified build requirement — a first slice under [#1552](/backlog/1552/))

The judge is only trustworthy if every change is scored against a **curated held-out regression
benchmark** that is **strictly disjoint** from the training corpus (a leaked benchmark frame turns
"trained beats frozen on held-out" into a falsehood and lets regressions hide). This is a stronger,
deliberately-curated artifact than "whatever held-out labels accumulate":

- **A catalogue of bad patterns, many variants each.** Every defect class is represented by *multiple*
  renderings (responsive reflow, theme, density, locale, animation phase) so a judge cannot pass by
  memorizing one frame — variant coverage is the load-bearing property, not raw count.
- **Deliberate false-positive traps.** A large negative set of *plausible-but-correct* states the judge
  must **not** flag. False-positive rate is a first-class scored metric, not an afterthought — an
  advisory judge that cries wolf is worse than useless in the `improve-explorer` loop.
- **The model-agnostic yardstick that proves portability.** Because it scores *outputs* (verdict vs
  ground truth), not embeddings, the same benchmark validates *any* judge agent — re-running it after an
  agent/VLM swap is exactly how we demonstrate no regression. It is the portable counterpart to the
  portable training corpus.
- **CI-gated accuracy, even though the judge never gates a run.** The judge's *output* stays advisory
  and never blocks an explored app ([#1172](/backlog/1172/)); but the judge's *accuracy on this
  benchmark* is a CI gate against regression — the Tier-1 "benchmarkable/gateable" property
  ([vision-tiers](/docs/agent/platform-decisions/#vision-tiers)). Keep these two senses of "gate"
  distinct.

[#489](/backlog/489/)'s frame/verdict pairs may seed *both* corpora, but the **train/benchmark split is
applied at ingestion and never crossed**. Scaffold the benchmark as its own slice alongside the capture
format and the store.

## Decided

_**Blocked by [#1565](/backlog/1565/)** (dev-tool placement review — devtools→Plateau). Do not ratify
until it resolves; the Fork 3 references to the explorer's "FUI repo" home are provisional on that
outcome. Then ratify via `/next decision`. Record: the Fork 1 anchor + Fork 2 starting mechanism &
escalation trigger + Fork 3 boundary + the **agent-portability constraint** (model-agnostic corpus;
embeddings a re-derivable cache; encoder-parameterized recipe) + the **held-out regression benchmark**
(variant-rich bad-pattern catalogue + false-positive traps, train-disjoint, CI-gated). Then
`codifiedIn` a platform-decisions anchor (extending `#no-leakage-client` + `#vision-tiers`) and scaffold
the build slices under [#1552](/backlog/1552/): capture format · training corpus store · regression
benchmark · learning mechanism · trained-vs-frozen eval._
