# Design-critique correction surface — prep research for #1036

> Prior-art grounding for backlog **#1036** (the plateau-app design-review correction surface), under epic
> **#1033** (the interactive design-review loop). #1036 shows a page's auto-generated design critique
> (the #1034 rubric output), lets a human comment + correct the axis scores and localized findings, and
> persists the result as a labeled `{frame, critique}` training pair — the corpus accumulator that
> un-parks the on-device model (#513). Published as the `/research/` topic
> [`design-critique-correction-surface`](/research/design-critique-correction-surface/).

## The starting position — this surface is not greenfield

Two pieces already exist in-tree and dictate most of the shape:

1. **The output contract being corrected is already ratified** — #1034's design-critique rubric:
   a **closed** set of 8 scored axes (1–5) + an **open** list of localized findings
   `{dimension, element-ref, problem, severity 0–4}`, versioned axis set
   (`we:docs/agent/vision-tiers.md` §Design-critique rubric). The surface corrects *values within this
   contract*; it never edits the contract itself.
2. **A structural twin already ships in plateau-app** — `plateau:src/vision-review/` (#1084, epic #1073).
   Its own README calls it *"the Tier-2 analogue of the design-critique review surface (#1036)."* It is a
   per-screenshot review/tag/train surface: queue → show the model's proposed `RichOutput`
   (`{description, tags, regions}`) over the screenshot → human corrects (incl. drag-to-draw a region) →
   save as a labeled pair to `localStorage`. The data layer
   (`plateau:src/vision-review/data.ts`) is pure/framework-free and mirrors the WE Tier-2 rich-output
   contract; persistence is `localStorage` under `plateau.vision-review.v1`, with the real
   `design-refs/` corpus source + write-back deferred to the Phase-2 backend.

So #1036 is **the same review/correct/persist loop as `vision-review/`, for a different output contract**
(critique axes + findings instead of description + tags + regions). The prep is therefore mostly about
*reuse boundary* and *correction-record provenance*, not about inventing a UI from scratch.

## Survey — HITL annotation / correction tools and provenance practice

Sources: Label Studio / HumanSignal, Prodigy (explosion.ai), CVAT, Labelbox, SageMaker Ground Truth +
Augmented AI (A2I), Supervisely, LangSmith annotation queues; the active-learning / knowledge-distillation
literature.

### Q1 — HITL correction UX patterns

- **Model-proposes / human-corrects is the dominant paradigm**, explicitly framed as *correction*, not
  authoring. Labelbox MAL loads model predictions as **editable** annotations "focused on review and
  correction of AI model output rather than creating labels from scratch" (50–70% time reduction). Label
  Studio routes ML-backend `predictions` to annotators who "review and correct… if necessary."
- **The "one item at a time, accept / correct / skip" review queue is a named, cross-tool convention.**
  Label Studio Enterprise: **"Fix & Accept"** vs **"Reject"** over a *task queue / Label Stream*
  (Skip / Submit). LangSmith: **annotation queue**. Supervisely: **labeling queue** ("Confirm and pull
  next"). Prodigy: the binary stream (`accept` / `reject` / `ignore`), model re-ranks the stream live.
- **Region/bbox correction convention**: predictions land as **draggable/resizable editable boxes** the
  human adjusts + relabels; add a missed box, delete a hallucinated one (CVAT, Labelbox, V7). Interactive
  assists (SAM) are optional sugar, not required.
- **Confidence-gated routing** (SageMaker A2I / Ground Truth): high-confidence predictions auto-accept,
  low-confidence route to a human "verify or adjust" step; jobs chain. The same accept/correct loop with
  model confidence as the router.
- **Fit to #1036's hybrid output**: the scored axes map onto a *rating rubric the reviewer nudges*
  (Prodigy/LangSmith style); each localized finding maps onto a *pre-drawn editable box with per-region
  attributes* (CVAT/Labelbox style). Pure binary is too thin for boxed multi-attribute findings →
  **rich-edit-in-place** is the default, with a binary fast-path only for the whole-critique
  accept gate.

**Synthesis:** pre-fill the human's canvas with the model's proposal as editable objects; frame the task as
*correction inside a one-item review queue* with explicit **Accept / Fix-&-Accept / Reject(Skip)** verbs
(borrow Label Studio's naming). `vision-review/` already implements exactly this skeleton (queue, proposed
output over the screenshot, drag-to-draw region edit, save) — the convention and the in-tree twin agree.

### Q2 — Provenance: overwrite vs preserve-both

- **Mature systems preserve both — unanimously.** Label Studio is explicit: **"Predictions cannot be
  modified and are always read-only"**; a correction creates a *new annotation* that coexists with the
  prediction (dual-track `predictions` vs `annotations`). SageMaker A2I stores the original inference
  **plus** the human-validated output, with the triggering confidence.
- **Stored prediction metadata converges on**: model version + per-element confidence + the full region
  payload; plus, on the correction, annotator id, timestamp, and lead/handling time.
- **Disagreement is signal, not waste.** Active learning selects the next examples to label by
  *disagreement* (Query-by-Committee; **BALD** = Bayesian Active Learning by Disagreement). You can only
  compute model-vs-human disagreement after the fact if you *kept the model's prediction*.
- **Edit-distance-from-proposal is an established difficulty/effort signal** (genome AED; compression-based
  edit distance is the top predictor of human edit time; interactive-segmentation "clicks-to-correct").
  It exists only if the proposal is retained — and it doubles as a quality filter (a reviewer who changed
  nothing may not have looked) and an ambiguous-axis detector.
- **For distillation specifically** (#513's <=10 MB student learning from the hosted teacher's labels):
  the KD literature warns teacher predictions are noisy and "inaccurate teacher predictions… could harm
  the student"; noise-corrected KD uses human-corrected labels to fix teacher errors *before* training.
  Retaining teacher prediction + human gold is exactly that noise-correction signal — and it keeps open
  the later (real, separate) KD fork of whether to feed the student teacher *soft*-labels too, which is
  impossible to attempt unless both are preserved now.

**Synthesis:** **preserve both** is a settled convention, not a divided one. Persist each pair as
`{ proposed (read-only: axes + findings + per-element confidence + provider/model version),
corrected (the human gold), comment, annotator/timestamp/time-spent, per-element verdict
(accept|fix|reject) }`, and derive an edit-distance/disagreement measure from the pair. Note the
**divergence from the in-tree twin**: `vision-review/`'s `ReviewRecord extends RichOutput`
(`plateau:src/vision-review/data.ts`) is an *overwrite* record — it does not retain the model's proposal.
Adopting preserve-both for #1036 either diverges from the sibling or argues for retrofitting it; that
coupling is called out in the decision.

## How this maps to #1036's forks

| Fork | Call | Default | Confidence |
|---|---|---|---|
| 1 · Reuse boundary | shared review harness vs independent siblings (vs fold into `vision-review/`) | **shared harness** (queue/screenshot-canvas/persist/no-leakage extracted; critique editor composes it) | ~75% |
| 2 · Correction-record provenance | overwrite (the `vision-review/` precedent) vs preserve-both | **preserve-both** (proposed read-only + corrected gold + provenance) | ~85% |

**Forced invariants / supported-by-default (not forks):** correct *values not vocabulary* (the 8 closed
axis scores + finding CRUD; the axis set is versioned config, never per-pair editable — #1034 Fork 3's
comparability invariant); Phase-1 `localStorage` now (key `plateau.design-review.v1`), corpus write-back
parked to Phase-2 #554, mirroring `vision-review/`; seed queue now, real `design-refs/` corpus via a read
endpoint later; no-leakage (screenshots in, labels out, never the model — #475); critique-only scope (a
unified "correct any vision output" surface across #475/#396/#1034 is a separate epic-level call, excluded
here on the separation bias).

## Sources

- Label Studio / HumanSignal — ML backend & predictions (read-only), review workflow, quality/lead-time.
- Labelbox — model-assisted labeling (editable predictions); SAM-assisted boxes.
- Prodigy (explosion.ai) — active-learning binary stream (accept/reject/ignore).
- CVAT — serverless auto-annotation, editable boxes, AI tools, annotation-quality.
- SageMaker Ground Truth + A2I — confidence-gated auto/human routing; stores inference + human output.
- Supervisely labeling queues; LangSmith annotation queues.
- Active learning: Query-by-Committee, BALD; survey arXiv 2210.10109.
- Edit-effort: AED; compression-based edit distance arXiv 2412.17321.
- Distillation noise-correction: ACM 2025 (Robust KD via Noise Correction); arXiv 1811.03331 (label correction).
