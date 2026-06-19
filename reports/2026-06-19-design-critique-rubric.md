# Design-critique rubric — what a page review measures, and how WE-grounded

> Prior-art survey + prepared forks for backlog **#1034** (parent epic **#1033**, the interactive
> design-review loop). Sibling of the corpus pipeline rubrics already shipped: the QC verdict taxonomy
> (#475, `we:scripts/design-refs/vision.mjs:18`) and the codification facets (#396,
> `we:scripts/design-refs/vision.mjs:55`). This report grounds the **third** rubric — *design critique* —
> which neither of those is.

## The gap this fills

The vision pipeline already has two closed vocabularies, and **neither measures design quality**:

- **QC verdict** (`VERDICTS = [app, obstructed, marketing, error, blank, non-app]`, #475) — an
  *admission* gate: is this even a real app surface worth keeping? It never asks whether the app is
  *good*.
- **Codification facets** (`[surface, productRegister, visualStyle, theme, layout]`, #396) — *tagging*:
  what kind of surface is this, in which register/style? Descriptive, not evaluative.

A *design critique* is the missing evaluative axis: **is this page well-designed — hierarchy, spacing,
contrast, typography, consistency, alignment — and does it conform to the WE standards it declares?**
That output is what #1033's review loop shows, #1035's `/review-design` skill emits, and #1036's
human-correction surface labels.

## Prior-art survey (the load-bearing findings)

Full citations in the published topic [`/research/design-critique-rubric/`](/research/design-critique-rubric/).
Three findings drive the forks:

1. **The deterministic-vs-perceptual split is actually three tiers, not two.** Mature evaluation tools
   partition cleanly:
   - **Tier A — deterministic from DOM/CSS** (no vision): WCAG contrast ratios, spacing-on-a-grid (8pt),
     type-scale ratios, touch-target sizes, design-token usage vs hard-coded values. This is the
     Lighthouse/axe surface — `axe-core` catches ~57% of WCAG issues at 100% precision and explicitly
     marks the rest "incomplete" (needs a human).
   - **Tier B — algorithmic-perceptual from pixels** (vision *algorithms*, still deterministic, no LLM):
     the Aalto Interface Metrics (AIM, UIST'18) surface — visual clutter (feature congestion / subband
     entropy), colourfulness, symmetry, balance, grid-quality, figure-ground contrast, saliency.
   - **Tier C — genuine perceptual judgment** (needs a VLM or human): "hierarchy feels off", emphasis
     landing on the wrong element, overall polish/craft, crowding-in-context.
2. **The output shape mature tools converge on: a small *closed* set of scored dimensions + open-text
   *localized* findings tagged to a dimension, each with a severity.** UICrit (UIST'24) — the most
   directly relevant work — is exactly this: 3 scored dimensions (aesthetics / usability / overall,
   10-pt), and 3,059 free-text critiques each carrying a **bounding box + target scope** (element / group
   / whole-screen / *missing*-element), post-hoc bucketed into ~5 categories (layout / colour-contrast /
   button-usability / learnability / text-readability). Nielsen's **0–4 severity** scale (cosmetic →
   catastrophe, = frequency × impact × persistence) is the standard severity vocabulary.
3. **Raw zero-shot VLM critique is poor; a rubric + few-shot grounding is what makes it usable.** UICrit:
   zero-shot Gemini comments were only ~13% valid; few-shot from the dataset improved that ~55%; **humans
   still beat every automated method.** Implication: the rubric isn't optional scaffolding — it's the
   thing that makes the Tier-C call trustworthy, and the human-correction loop (#1036) is load-bearing,
   not a nicety.

A fourth finding settles a fork against the house default: **scoring systems keep their axis set CLOSED
and small** (AIM 4 categories, Lighthouse 5, Nielsen 10) precisely so scores stay comparable across pages
and over time — and push all extensibility into the *open-text findings* underneath. That is the
controlled-vocabulary/folksonomy split resolved the *opposite* way from #394's grow-the-registry ruling,
for a concrete reason: the corpus wants comparable training pairs (#489/#490), which axis drift would
destroy.

## How "WE-grounded" actually works

WE's differentiator is that its design standards are **machine-readable**, so the Tier-A checks aren't
generic guesses — they're exact against what the page *declares*. The semantic-tier intents
(`we:src/_data/intents.json`) map almost one-to-one onto critique dimensions:

| Critique dimension | WE standard that grounds it | What grounding adds |
|---|---|---|
| Typographic scale / hierarchy | `typography` intent ("abstracting visual hierarchy from semantic HTML") + type tokens (#364) | check the rendered type ladder against the *declared* scale, not a generic ratio |
| Spacing & rhythm / touch targets | `density` intent ("spatial relationships, touch targets") + spacing tokens | check gaps against the *declared* spacing scale, not a blanket 8pt assumption |
| Contrast & legibility | colour tokens (#364/#010) + the rendered-site a11y gate (#763/#770, axe lane) | the a11y gate already computes WCAG contrast deterministically — reference it, don't re-derive |
| Alignment & structure | `layout` intent ("shell structure and regions") | grade alignment against the declared region grid |
| Elevation / figure-ground | `surface` intent ("Z-axis depth, material") | grade depth cues against the declared surface system |
| Consistency / token use | design tokens (#364) — variable use vs hard-coded values | a pure Tier-A check: are colours/spacing/type coming from tokens? |

Grounding is *per-dimension and best-effort*: where the page declares a WE standard, the dimension is
checked against it (and becomes near-deterministic); where it doesn't, the dimension falls back to the
generic perceptual heuristic. Reading the standard as *input* is not leakage — leakage (the #475
invariant) is the standard *depending on* vision, which this never does.

## Layer classification (per-fork classification pass)

- **Which layer?** The rubric is **not** a published `@webeverything` artifact. Per the governing
  invariant (#475: *vision is never a standard*), the critique capability is a **Plateau vision service**;
  the rubric is that service's **output contract / vocabulary**, living beside its siblings in the
  corpus/vision tooling (`we:scripts/design-refs/vision.mjs` today, repointing to the Plateau service when
  it lands). It *reads* WE standards (`we:src/_data/intents.json`, tokens) as inputs — no-leakage preserved.
- **Protocol or intent dimension?** Neither — it's an evaluative vocabulary over the standards, not a new
  standard. It does not enter `we:src/_data/adapters.json` or mint an intent.
- **Fixed mechanic or dimension?** The *axis set* is a fixed, versioned mechanic (closed for
  comparability — see finding 4); the *findings* layer is the open, expressive dimension.
- **DI-injectable?** The rubric rides the **one existing provider seam** (`registerVisionProvider`,
  `we:scripts/design-refs/vision.mjs:143`) — no new plumbing; a critique is a third provider method
  alongside `classifyCandidate` / `analyzeForCodification`.
- **Most-permissive default?** Grounding is best-effort/opt-in per dimension; an ungrounded page still
  gets a generic critique.
- **Seam between concerns?** The deterministic gates (a11y #763/#770, token-lint) stay separate and are
  *composed*, not re-implemented (bias-toward-separation) — Fork 2.

## Recommended path at a glance

| Fork | Recommended default | Main (flawed) alternative | Confidence |
|---|---|---|---|
| 1 · Grounding model | **WE-grounded-layered** — generic perceptual dimensions, each grounded in the page's *declared* WE standard where one exists, generic fallback where none does | generic-only (throws away WE's machine-readable moat) · conformance-only (conformance ≠ good design) | ~80% |
| 2 · Deterministic checks: own or compose? | **Compose existing gates** — the rubric *names* all dimensions but delegates Tier-A to the a11y gate / token-lint and owns Tier-C judgment + the synthesis | one monolithic critique that re-derives contrast/spacing from the screenshot (duplicates #763/#770, less exact, drift) | ~80% |
| 3 · Output shape | **Closed scored axes (1–5) + open localized findings (element + severity 0–4), versioned axis set** | single rolled-up score (loses the actionable "what/where" #1036 needs) · open-growing axis set (axis drift kills score comparability for #489/#490) | ~75% |

## The forks in brief

**Fork 1 — grounding model.** Generic-only is flawed (discards WE's unique deterministic signal,
reduces to a commodity design-review tool, and works against the dogfooding logic of #475). Conformance-
only is flawed (a page can use every token and still have broken hierarchy — it loses Tier-C entirely).
The genuine best end-state is the layered middle: generic where it must be, grounded where it can be.

**Fork 2 — own vs compose the deterministic checks.** A monolithic rubric that asks the VLM to judge
contrast from a screenshot re-implements what the a11y gate (#763/#770) already computes exactly from the
DOM — duplicate machinery, lower fidelity, drift risk, against the separation bias. The composing
alternative: the rubric is the unifying *vocabulary* (all ~8 dimensions named + tier-tagged + grounding
source), but Tier-A dimensions are delegated to the existing deterministic gates and the critique
*consumes* their results; the service owns only Tier-C judgment and the synthesis into one report.

**Fork 3 — output shape.** A single score is flawed for this consumer: #1036's human-correction loop and
#490's distillation corpus need *where* and *why*, not a number. The composite shape (closed scored axes
+ open localized findings with Nielsen-0–4 severity) is what UICrit validated and what reuses the #489
`{frame, verdict}` storage shape cleanly. The sub-call — closed vs open axis vocabulary — breaks *against*
the house grow-the-registry default (#394) because comparable training pairs require axis stability;
extensibility lives in the open findings, and a deliberate version bump is the escape hatch.

## Proposed rubric vocabulary (the prepared default for the build)

Eight closed scored axes (1–5), each tier-tagged and grounding-mapped; open findings underneath
(`{dimension, element-ref, problem, severity 0–4}`):

1. **Contrast & legibility** — Tier A — colour tokens + a11y gate
2. **Spacing & rhythm** — Tier A→B — `density` intent + spacing tokens
3. **Alignment & structure** — Tier A→B — `layout` intent
4. **Typographic scale** — Tier A — `typography` intent + type tokens
5. **Consistency / token use** — Tier A — design tokens
6. **Grouping & proximity** — Tier B→C — `hierarchy` intent (Gestalt)
7. **Visual hierarchy & emphasis** — Tier C (B-assisted) — `typography`/`surface` intents
8. **Aesthetic polish / craft** — Tier C — (HIG "clarity"; no single WE standard — generic)

Axes 1–5 are largely deterministic (the cheap, gateable tier); 6 is borderline; 7–8 are the genuine
VLM/perceptual tier that needs the rubric + few-shot examples to be trustworthy.

## What this unblocks

#1034 ratified → unblocks **#1035** (`/review-design` skill applies the rubric) and **#1036** (the
plateau correction surface persists rubric-scored critiques as labeled pairs). Promote the stable parts
into [`we:docs/agent/vision-tiers.md`](../docs/agent/vision-tiers.md) (the rubric's open question is
listed there) and onward to the statute layer once #1033 ratifies.
