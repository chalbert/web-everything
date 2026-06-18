# Design-reference vision pipeline — capture-time QC gate + codification
**Date**: 2026-06-13
**Point**: One shared, swappable vision provider serves the design-ref pipeline at two points — a *cheap* capture-time QC gate (#475: admit/remediate/quarantine a candidate surface) and a *rich* post-admission codification pass (#396: tag + harvest paradigms); prior art says the gate verdict is easy and reliable while full structure recovery is hard, which is why they are two call shapes on one provider, not two integrations.
**Research page**: `/research/design-ref-vision/`
---

## Question

The phase-1 capture pipeline (backlog #382, shipped) admits screenshots through a **deterministic,
hand-authored** inclusion gate (`we:scripts/design-refs.mjs:145` — a per-target `readySelector` +
optional `enterAction`). It doesn't generalise to new targets and can't tell a clean app surface
from a marketing splash, a modal-obstructed view, or a stale error panel (Photopea's splash and
Grafana's error panel both slipped through). Two open items want **vision** in this pipeline —
#475 (capture-time QC gate) and #396 (codification of the corpus into intents). The question this
survey grounds: *what is the right shape for the vision integration, and is it one capability or
two?*

## Recommendation

**One swappable vision provider, two call shapes.** Define a single `customVisionProvider`
registry (the #086 `customMockupAnalyzerRegistry` pattern), consumed at two pipeline points:

1. **#475 — capture QC gate (cheap):** `classifyCandidate(frame, context) → {verdict, reasons,
   remediation?}`, where `verdict ∈ {app, obstructed, marketing, error, blank, non-app}`. A
   VLM-as-judge call returning a **structured verdict against fixed criteria**. The prior art
   shows coarse screen classification is a solved-ish capability (ScreenAI, Ferret-UI), so this
   verdict is reliable and cheap.
2. **#396 — codification (rich):** a larger analysis over *already-admitted* shots —
   surface/register/layout tags + recurring-paradigm harvest. The prior art shows **full
   structure/code recovery is hard** (Design2Code SOTA: Claude-4-Sonnet 76.3, open VLMs <45), so
   this stays **human-in-the-loop** with the neutral structure as the review surface (mirrors
   #086's ruling), not an autonomous codegen.

The `obstructed` remediation (dismiss a modal/consent overlay and re-shoot) should **reuse an
existing rule library — DuckDuckGo's `autoconsent`, which runs in Playwright** — rather than
inventing overlay dismissal.

## Key Findings

| Source | What it is | What we borrow |
|---|---|---|
| **ScreenAI** (Google, arXiv 2402.04615) | VLM that identifies UI element *type + location*; auto-generates QA/navigation/summarization from screen annotation. | Coarse screen/surface classification is a mature VLM capability — the QC verdict is a *cheap* call, not research-grade. |
| **Ferret-UI** (Apple, arXiv 2404.05719) | MLLM for mobile UI: referring/grounding/reasoning, widget & icon classification; beats GPT-4V on elementary UI tasks. | Same — element/screen classification is reliable; supports a structured verdict over a screenshot. |
| **Design2Code** (Stanford, NAACL 2025) + **WebSight** (2M synthetic screenshot↔HTML pairs) | Real-world screenshot→code benchmark; SOTA Claude-4-Sonnet **76.3**, open VLMs **<45**; models struggle with visual-element recall and layout fidelity. | The *codification* half is hard → keep #396 human-in-the-loop (neutral structure as editable surface), do **not** trust autonomous screenshot→component output. The *gate* half (yes/no/remediate) is far easier → safe to automate. |
| **VLM-as-a-Judge** protocol; structured-output VLM eval at scale | Evaluation cast as conditional multimodal classification driven by *model output + user-specified criteria*; structured outputs make it scalable. | The QC gate is literally a VLM-as-judge: fixed criteria ("is this an unobstructed app surface?") → structured verdict. Cache verdicts by content hash (mirror the `we:ledger.json` sha256 skip) for idempotent re-runs. |
| **autoconsent** (DuckDuckGo, npm) + Consent-O-Matic rules | Rule library to navigate consent popups; **runs in a Playwright-orchestrated headless browser** without user input. | `obstructed` remediation reuses this — Playwright-native, no bespoke overlay dismissal. |
| **#086 mockup-to-code** (in-repo) | `customMockupAnalyzerRegistry`: vision is a swappable provider behind a stable contract; no provider name in core; neutral structure is the contract. | The architectural anchor — the design-ref vision provider is the **same pattern** applied to the corpus pipeline. One registry, swap any model. |

### Why one provider, not two

The two calls differ in *cost and richness*, not in *kind* — both are "a vision model looks at a
screenshot and returns structured judgement." Splitting them into two registries would force two
model integrations, two credential paths, two upgrade clocks for what is one swappable seam.
Honour the **separate-and-decouple** bias at the level that matters (provider vs. core, input vs.
output), but keep the *provider* singular: one registry, two methods (`classifyCandidate`,
`analyzeForCodification`). This is the #086 ruling (two registries for analyzer-vs-generator
because they move at different speeds) applied correctly — here both calls are *analysis*, so they
share the analyzer seam.

### Native-first / lock-in posture

Internal research-corpus tooling, **zero project-facing lock-in** (same posture as the
`design-ref-taxonomy` topic). The vision provider is dev/CI infrastructure with bring-your-own
model key; nothing about the corpus or its consumers depends on which model graded it. Deterministic
`readySelector` short-circuits stay as a free fast-path — vision is the *general* gate, not the
*only* gate.

## Files Created/Modified

| File | Action |
|---|---|
| `we:src/_data/researchTopics.json` | Added `design-ref-vision` topic entry |
| `we:src/_includes/research-descriptions/design-ref-vision.njk` | Wrote the research write-up |
| `backlog/475-…md` | Converted to `type: decision`, authored prepared-fork shape, `preparedDate` |
| `backlog/396-…md` | Converted to `type: decision`, authored prepared-fork shape, `preparedDate` |
| `we:reports/2026-06-13-design-ref-vision-pipeline.md` | This report |
