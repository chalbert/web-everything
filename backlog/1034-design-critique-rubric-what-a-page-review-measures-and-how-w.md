---
type: decision
workItem: story
size: 5
parent: "1033"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: docs/agent/vision-tiers.md
codifiedIn: "docs/agent/vision-tiers.md#design-critique-rubric-ratified-1034"
preparedDate: "2026-06-19"
relatedReport: reports/2026-06-19-design-critique-rubric.md
tags: [design-reference, vision, design-critique, rubric, plateau]
---

# Design-critique rubric — what a page review measures (and how WE-grounded)

## Digest

The vision pipeline already ships two closed vocabularies and **neither evaluates design quality**: the
QC verdict taxonomy (`we:scripts/design-refs/vision.mjs:18`, #475) is an *admission* gate, and the
codification facets (`we:scripts/design-refs/vision.mjs:55`, #396) are descriptive *tagging*. This story
defines the **third** rubric — *design critique* (hierarchy / spacing / contrast / typography /
consistency / alignment) — that #1033's review loop shows, #1035's `/review-design` skill emits, and
#1036's correction surface labels.

**Prepared**: three forks grounded in the [`design-critique-rubric`](/research/design-critique-rubric/)
topic (survey of Nielsen + CRAP + Gestalt + Material/HIG/Fluent + AIM + Rico + UICrit + Lighthouse/axe +
WCAG), each with a **bold** default. The load-bearing survey finding: **the deterministic-vs-perceptual
split is three tiers, not two** — Tier A (deterministic from DOM/CSS: WCAG contrast, grid spacing, type
scale, token usage), Tier B (algorithmic-perceptual from pixels: the AIM clutter/colour/balance metrics),
Tier C (genuine VLM/human judgment: hierarchy, polish). A rubric whose axes are *tier-tagged* routes
cheaply. The other load-bearing finding (UICrit, UIST'24): **raw zero-shot VLM critique is poor (~13%
valid); a rubric + few-shot grounding is what makes it usable** — so the rubric is not optional scaffolding
and the #1036 human loop is load-bearing.

## Governing invariant inherited — vision is a service, the rubric is its output contract

Per #475 (*vision is never a standard*), the critique capability is a **Plateau vision service**; this
rubric is that service's **output contract / vocabulary**, living beside its siblings in the corpus/vision
tooling (`we:scripts/design-refs/vision.mjs` today, repointing to the Plateau service when it lands) and
riding the **one** `registerVisionProvider` seam (`we:scripts/design-refs/vision.mjs:143`). It is **not** a
published `@webeverything` artifact. It *reads* WE standards (`we:src/_data/intents.json`, design tokens
#364) as **inputs** — reading the standard is not leakage; leakage is the standard *depending on* vision,
which this never does.

## The axis being decided

- **How generic vs WE-grounded** the rubric is — does it ignore WE's machine-readable standards, ground in
  them, or measure *only* conformance? *Fork 1.*
- **Whether the rubric owns or composes the deterministic checks** — does the critique re-derive
  contrast/spacing from the screenshot, or delegate Tier-A to the existing a11y gate (#763/#770) /
  token-lint and own only Tier-C + the synthesis? *Fork 2.*
- **The output shape** — single score vs per-dimension scores vs localized findings, and whether the axis
  set is closed or open-growing. *Fork 3.*

## Recommended path at a glance

| Fork | Recommended default | Main (excluded) alternative | Confidence |
|---|---|---|---|
| 1 · Grounding model | **WE-grounded-layered** — generic perceptual axes, each grounded in the page's *declared* WE standard where one exists, generic fallback where none does | generic-only (discards WE's machine-readable moat) · conformance-only (conformance ≠ good design) | ~80% |
| 2 · Own vs compose deterministic checks | **Compose the existing gates** — name all axes + tier-tag them, but delegate Tier-A to the a11y gate / token-lint and own only Tier-C judgment + the synthesis | one monolithic critique that re-derives contrast/spacing from the screenshot (duplicates #763/#770, lower fidelity, drift) | ~80% |
| 3 · Output shape | **Closed scored axes (1–5) + open localized findings (element + severity 0–4); versioned axis set** | single rolled-up score (loses the "what/where" #1036 needs) · open-growing axis set (drift kills score comparability for #489/#490) | ~75% |

## Fork 1 — Grounding model

**Fork-existence justification:** both extremes are flawed end-states. *Generic-only* throws away WE's
entire differentiator — its design standards are machine-readable, so the Tier-A checks can be *exact*
against what the page declares rather than generic guesses; a generic critic reduces to a commodity
design-review tool and works against the dogfooding logic (#475). *Conformance-only* is flawed the other
way — a page can use every token correctly and still have broken hierarchy and no polish (it loses Tier C
entirely). The genuine best end-state is the layered middle, so this is a real three-way fork with two
excluded branches.

- **A — WE-grounded-layered (recommended).** Generic perceptual dimensions, each grounded *per-dimension
  and best-effort* in the page's declared WE standard where one exists, generic perceptual fallback where
  none does. The semantic intents map almost 1:1 onto axes: `typography`
  (`we:src/_data/intents.json`, "abstracting visual hierarchy from semantic HTML") grounds type-scale +
  hierarchy; `density` ("spatial relationships, touch targets") grounds spacing; `layout` ("shell
  structure and regions") grounds alignment; `surface` ("Z-axis depth, material") grounds figure-ground;
  design tokens (#364) ground consistency/token-use. Most-permissive default: an ungrounded page still
  gets a generic critique.
- **B — Generic-only.** *Rejected:* discards the unique deterministic signal; no moat; against #475
  dogfooding.
- **C — Conformance-only.** *Rejected:* conformance ≠ good design; loses the Tier-C perceptual axes that
  are the point of a *critique*.

**Recommended: A** (~80%; residual: the exact set of intents that cleanly ground a dimension is a
build-time mapping detail, tunable per the table in the report).

## Fork 2 — Own vs compose the deterministic (Tier-A) checks

**Fork-existence justification:** a genuine either/or in *where the Tier-A computation runs*. A monolithic
rubric that asks the VLM to judge contrast/spacing *from the screenshot* re-implements what the rendered-
site a11y gate (#763/#770, axe lane) already computes exactly from the DOM — duplicate machinery, lower
fidelity (a screenshot can't measure contrast as exactly as the DOM), and drift risk between two
contrast implementations. That branch is excluded on the bias-toward-separation principle; the two cannot
both be the home of the contrast check.

- **A — Compose the existing gates (recommended).** The rubric is the unifying *vocabulary*: all ~8
  dimensions named, each tier-tagged (A/B/C) and grounding-mapped. Tier-A dimensions are **delegated** to
  the existing deterministic gates (a11y gate #763/#770 for contrast/targets; a token-lint for token
  usage) and the critique *consumes* their results; the vision service owns only the **Tier-C** perceptual
  judgment + the **synthesis** of all tiers into one report.
- **B — One monolithic critique that re-derives everything from the screenshot.** *Rejected:* duplicates
  #763/#770, lower fidelity, drift between two contrast checks, against the separation bias.

**Recommended: A** (~80%; residual: Tier-B (AIM-style pixel metrics) has no existing home — it's a
genuinely new optional layer the build may add between the gates and the VLM, or defer; that's a build
sequencing call, not a fork here).

## Fork 3 — Output shape (scored axes + findings; closed vs open vocabulary)

**Fork-existence justification:** the *single rolled-up score* branch is flawed for this consumer —
#1036's human-correction loop and #490's distillation corpus need *where* and *why* (the localized
finding), not a number. And on the sub-call, *open-growing axis set* is the excluded branch: it would let
the scored dimensions drift, which destroys cross-page score comparability — and comparable
`{frame, critique}` training pairs are exactly what #489/#490 depend on. So both a too-thin output and a
too-loose axis set are excluded.

- **A — Closed scored axes (1–5) + open localized findings, versioned axis set (recommended).** Per shot:
  a fixed, small, **closed** set of scored dimensions (the 8 below), each 1–5; **plus** an open-text list
  of localized findings `{dimension, element-ref, problem, severity 0–4}` (Nielsen's 0–4 severity:
  cosmetic → catastrophe). This is UICrit's validated structure (closed scored dims + open bbox'd
  critiques) and reuses the #489 `{frame, verdict}` storage shape cleanly. Extensibility lives in the open
  findings; a deliberate **version bump** is the escape hatch for the axis set. Diverges from the house
  grow-the-registry default (#394) *on purpose* — score comparability requires axis stability, the same
  reason #475's *verdict* enum is more closed than its tag vocabulary.
- **B — Single rolled-up score.** *Rejected:* loses the actionable "what/where" the correction loop and
  the training corpus both need.
- **C — Open-growing axis set (the #394 default).** *Rejected here:* axis drift kills the cross-page score
  comparability #489/#490 require; keep the axes closed, grow the findings.

**Proposed default axis vocabulary** (8 closed axes, each tier-tagged + grounding-mapped):

1. **Contrast & legibility** — Tier A — colour tokens + a11y gate (#763/#770)
2. **Spacing & rhythm** — Tier A→B — `density` intent + spacing tokens
3. **Alignment & structure** — Tier A→B — `layout` intent
4. **Typographic scale** — Tier A — `typography` intent + type tokens
5. **Consistency / token use** — Tier A — design tokens (#364)
6. **Grouping & proximity** — Tier B→C — `hierarchy` intent (Gestalt)
7. **Visual hierarchy & emphasis** — Tier C (B-assisted) — `typography` / `surface` intents
8. **Aesthetic polish / craft** — Tier C — generic (HIG "clarity"; no single WE standard)

**Recommended: A** (~75%; residual: the exact axis list and 1–5 vs pass/fail per axis is the most
build-tunable part — keep it config, version it, don't freeze it as constants).

## Ratified — 2026-06-19 (A / A / A)

All three forks ratified as the recommended defaults after an inline red-team of each:

- **Fork 1 → A (WE-grounded-layered)**, ~80%. Generic-only loses the machine-readable moat + #475
  dogfooding; the no-leakage worry doesn't bite because reading `we:src/_data/intents.json` as *input* is not the
  standard depending on vision. Residual: the exact intent→axis mapping is a build-tuning detail.
- **Fork 2 → A (compose the existing gates)**, ~80%. Monolithic re-derive-from-screenshot duplicates
  the #763/#770 a11y gate's DOM-exact contrast with lower fidelity and a second drifting impl — the
  bias-toward-separation principle points at compose. Residual: Tier-B (AIM pixel metrics) has no
  existing home; that's a build-sequencing call, not a fork.
- **Fork 3 → A (closed scored axes 1–5 + open localized findings, versioned axis set)**, ~75% — the
  only fork with real tension, because A diverges from the house grow-the-registry / most-flexible
  default (#394). Held on precedent, not exception: it mirrors the closed/open split the sibling
  rubrics already encode — #475 `VERDICTS` and #396 `CODIFICATION_FACETS` are both `Object.freeze`'d
  while their tag vocabularies grow. Rule: **close what a downstream consumer compares across (the
  scored axes → #489/#490 training-pair comparability), keep open what only describes (the localized
  findings).** Version-bump is the escape hatch; reversible if the axis set proves too rigid.

Stable parts promoted to [`we:docs/agent/vision-tiers.md`](../docs/agent/vision-tiers.md) §Design-critique
rubric; onward to the statute layer once epic #1033 ratifies.

## What this unblocks

All three forks ruled → unblocks **#1035** (the `/review-design` skill applies the rubric to a
Playwright screenshot) and **#1036** (the plateau correction surface persists rubric-scored critiques as
labeled pairs, the corpus accumulator that un-parks #513). Promote the stable parts into
[`we:docs/agent/vision-tiers.md`](../docs/agent/vision-tiers.md) (which lists this rubric as its open
question) and onward to the statute layer once epic #1033 ratifies.

## Relationships

- **parent #1033** — the interactive design-review loop; this rubric is what the loop measures.
- **#1035 / #1036** — both `blockedBy: [1034]`; the skill and the correction surface consume this rubric.
- **#475 / #396** — the two sibling vision rubrics (QC verdict, codification facets); this is the third,
  evaluative one, on the same `registerVisionProvider` seam and under the same no-leakage invariant.
- **#489 / #490 / #513** — the distillation corpus; closed scored axes (Fork 3) keep its training pairs
  comparable.
- **#763 / #770** — the rendered-site a11y gate the rubric *composes* (Fork 2) for Tier-A contrast.
- **#364 / #010** — the design-token system the WE-grounded axes read.
