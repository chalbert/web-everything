# Vision capability tiers — when to use which

> **Purpose:** one place that says *which* vision capability to reach for, and where each runs.
> The recurring mistake is using a heavy model where a tiny one suffices, or a tiny one where you
> actually need "why/where". This doc draws those lines.
>
> **Status:** *working architecture* — the tier capabilities, limits, the cascade pattern, and the
> **critique rubric** (§Design-critique rubric, ratified #1034) below are settled; whether the richer
> tier is ever built on-device vs. stays hosted is a later call. The stable cascade is now **codified in
> the statute** at [platform-decisions.md#vision-tiers](platform-decisions.md#vision-tiers) (#1244) — cite
> that rule rather than re-deriving the tier picks; this doc remains the detailed reference behind it.
>
> **Lineage:** #475 / #488 (the on-device ruling) · #490 (the build epic) · #1033 (the interactive
> design-review loop) · report [`reports/2026-06-13-on-device-ui-vision-capability.md`](../../reports/2026-06-13-on-device-ui-vision-capability.md).

## The three tiers

| | **Tier 1 — verdict classifier** | **Tier 2 — small VLM** | **Hosted vision** |
|---|---|---|---|
| Job | screenshot → 1 of N fixed labels | tagging, region/element detection, freeform description | anything; richest |
| Model | ≤10 MB quantized MobileNet/ViT | SmolVLM / Moondream / Florence-2 (≲2B) | frontier hosted model |
| Download / runtime | ~10 MB / tens of MB | ~150 MB–1.3 GB / ~0.5–2 GB+ | n/a (server) |
| Runs where | **any device, incl. mobile, offline** | **capable devices only** (WebGPU ~2 GB+ at the top end) | server, needs a key + network |
| Cost | ~zero, at any volume | ~zero per call, but device-gated | **per call** (the cost that breaks flat-rate) |
| Build | distill from teacher labels (offline) | fine-tune/distill a VLM (heavier) | none — it's the teacher |
| Today | tooling built (#511/#512), training parked on corpus volume (#513) | epic #1073 (open, to slice) | the interim bridge ([`anthropic-vision.mjs`](../../scripts/design-refs/providers/anthropic-vision.mjs), #485) |

## Capabilities & limits

**Tier 1 — the classifier.** A whole-screen, closed-set label and nothing more.
- ✅ instant · free · runs everywhere · output is a known class, so it's **benchmarkable and gateable**
  (the 0.95 verdict-agreement / 0.98 quarantine-recall floors in [`distillation-recipe.json`](../../design-refs/distillation-recipe.json)).
- ❌ **closed label set** — can only emit a class it was trained on; no "why", no description.
- ❌ **whole-screen only** — one global label; no localization / element detection. Tells you *what
  kind of screen*, never *where* on it.
- ❌ can't read UI text, can't reason about content, can't judge design *quality* (hierarchy/spacing/
  contrast is not a fixed-class problem).
- ❌ adding a class or shifting the taxonomy = a full retrain; **ceiling = the teacher** (it's distilled,
  so it inherits the teacher's accuracy and errors).

**Tier 2 — the small VLM.** Flexible and descriptive, but heavy and harder to trust.
- ✅ open-ended — describe, localize, tag; can give the "what's wrong and where" a real review needs.
- ❌ **device-gated** — q4/q8 still needs ~2 GB+ GPU memory at the ~2B top end → flagship desktops /
  high-end phones. The small end (256M–500M, a few hundred MB) runs more widely.
- ❌ slower, bigger download; generative → **hallucination risk** and **no clean agreement metric**
  (you can't gate it deterministically the way you gate Tier 1).
- ❌ still doesn't reliably recover structure (Design2Code SOTA ≈76) or extract design *tokens* — why
  screenshot→theme (#890) is parked.

**Hosted.** Best quality, no device limits — but each call costs, which is exactly what the
linear-cost rule won't allow inside a flat-priced product. Fine as a dev tool, a BYO-key bridge, or a
**premium upgrade**; never the free default.

## The selection rule

> **Reach for Tier 1** when the work is **high-volume, must run everywhere/offline, must be
> instant/continuous, or needs a benchmarkable gate.**
> **Reach for Tier 2 / hosted the moment you need a description, a reason, or a location.**

## The cascade (how they compose)

They are not alternatives — they layer. Tier 1 is the **always-on, free triage/router**; it decides
*when it's even worth invoking* the expensive tier.

```
every frame ──▶ Tier 1 classifier (free, instant, on-device)
                  │  is this a real app surface? confident?
                  ├─ no / junk  ▶ drop or quarantine (no expensive call)
                  └─ yes / unsure ▶ escalate ▶ Tier 2 (opt-in) or hosted critique
```

This is what makes the heavy tier affordable: the 10 MB model filters out everything not worth a paid
call, so hosted/Tier 2 only ever sees the frames that matter.

## Concrete usage map

**Tier 1 (always-on triage):**
- Pre-filter/router that gates every hosted/Tier-2 call (the cascade above) — its highest-value role.
- Corpus admission QC at volume (#480/#490) — its built-in job; also bootstraps its own next training set.
- Deterministic render-health assertion in tests/CI ("still renders as `app`, not `error`/`blank`").
- Live per-page health indicator in the dev browser as you navigate (free, no network, every screen).
- External-reference link-rot detection (#583/#585) — high-volume screenshot sweep.
- Auto-bucket / auto-tag the review & bug queues (#1036) by screen-type.

**Tier 2 (opt-in deep dive — its home is the dev browser, #141):**
- Rich design critique with localized "what's wrong and where" (the #1033 review loop).
- Element/region tagging, structure-ish description on capable devices.

**Hosted (interim / premium):**
- The teacher that labels the Tier 1 corpus (#485 bridge).
- The interactive `/review-design` skill today (#1035), until/unless a Tier 2 critique model is built.

## Deployment homes

- **Tier 1** → bundled, on by default, runs in-browser via ONNX Runtime Web + WebGPU (#514). Free.
- **Tier 2** → an **opt-in download inside the dev browser** (#141) — capable device, developer's own
  machine, the heavier model earns its place there. Not a default, not on mobile.
- **Hosted** → BYO-key bridge / premium upgrade; never the free floor.

## Invariants every tier inherits

- **No-leakage** — vision is a Plateau service the WE standard consumes; only *outputs* cross the seam,
  never the capability. See [platform-decisions.md#no-leakage-client](platform-decisions.md#no-leakage-client) (#475).
- **Linear-cost** — fixed-cost (on-device) capability is the free floor; per-call (hosted) is a paid
  tier, never baked into flat pricing. See [platform-decisions.md#monetization](platform-decisions.md#monetization).
- **One provider seam** — every tier registers behind `registerVisionProvider`
  ([`scripts/design-refs/vision.mjs`](../../scripts/design-refs/vision.mjs)); swapping tiers is a
  provider swap, not new plumbing.

## Design-critique rubric (ratified #1034)

The **third** vision vocabulary, beside the QC verdict taxonomy (#475, admission gate) and the
codification facets (#396, descriptive tagging): this one **evaluates design quality**. It is the
Plateau vision service's *output contract* — not a published `@webeverything` artifact — and rides the
same `registerVisionProvider` seam. UICrit (UIST'24) is why it's not optional scaffolding: raw
zero-shot VLM critique is ~13% valid; a rubric + few-shot grounding is what makes it usable.

- **Grounding (#1034 Fork 1 → WE-grounded-layered).** Generic perceptual axes, each grounded
  *best-effort* in the page's *declared* WE standard where one exists, generic fallback where none does.
  Reading [`intents.json`](../../src/_data/intents.json) / design tokens (#364) as **input** is not
  leakage — the standard never depends on vision.
- **Compute split (#1034 Fork 2 → compose, don't own).** All axes are named + tier-tagged, but the
  service **delegates** Tier-A deterministic checks (contrast/targets → the #763/#770 a11y gate; token
  use → token-lint) and *consumes* their results; it owns only **Tier-C** perceptual judgment + the
  **synthesis**. Re-deriving contrast from a screenshot is excluded (duplicates the gate, lower
  fidelity, drift). Tier-B (AIM pixel metrics) is an optional later layer with no existing home.
- **Output shape (#1034 Fork 3 → closed scored axes + open findings, versioned).** Per shot: a fixed
  **closed** set of scored axes (1–5) **plus** an open-text list of localized findings
  `{dimension, element-ref, problem, severity 0–4}` (Nielsen 0–4: cosmetic → catastrophe). Closed axes
  keep #489/#490 training pairs comparable (same closed/open split as #475 `VERDICTS` / #396
  `CODIFICATION_FACETS`); extensibility lives in the open findings; a deliberate **version bump** is the
  escape hatch for the axis set.

**Rubric version: `v2`** (provenance added #1587, 2026-06-22; `v1` = the #1034-ratified 8-axis set). The
version-bump escape hatch (#1034 Fork 3) covers the axis set; `v2` is **additive** — same 8 axes, now each
carrying a **provenance** ref to the admitted authoritative source(s) it codifies (the design-knowledge
intake program #1585; source ids are the rows of [`designKnowledgeWatch.json`](../../src/_data/designKnowledgeWatch.json)).
This is AI over a *contract*: a codified heuristic carries its authoritative basis, never raw source text.

**Axis vocabulary** (8 closed axes; tier-tag → grounding; the list itself is config + versioned, not
frozen constants). **Grounded in** is the page's *declared WE standard* read as input (#1034 Fork 1);
**Provenance** is the external authoritative *design-knowledge* source the axis distils (admitted-source
id, #1586 ledger) — the two are orthogonal (WE-standard input vs codified design prior):

| # | Axis | Tier | Grounded in (WE standard) | Provenance (admitted source) |
|---|---|---|---|---|
| 1 | Contrast & legibility | A | colour tokens + a11y gate (#763/#770) | `w3c-apg` (WCAG contrast) |
| 2 | Spacing & rhythm | A→B | `density` intent + spacing tokens | `apple-hig` (layout) |
| 3 | Alignment & structure | A→B | `layout` intent | `apple-hig` (layout), `nielsen-heuristics` (#8 aesthetic & minimalist) |
| 4 | Typographic scale | A | `typography` intent + type tokens | `apple-hig` (typography) |
| 5 | Consistency / token use | A | design tokens (#364) | `nielsen-heuristics` (#4 consistency & standards) |
| 6 | Grouping & proximity | B→C | `hierarchy` intent (Gestalt) | `apple-hig` (Gestalt grouping), `uicrit-uist24` |
| 7 | Visual hierarchy & emphasis | C (B-assisted) | `typography` / `surface` intents | `uicrit-uist24`, `apple-hig` (clarity) |
| 8 | Aesthetic polish / craft | C | generic (HIG "clarity"; no single WE standard) | `apple-hig` (clarity), `uicrit-uist24` |

The **open-findings** contract carries provenance too: the severity scale `{severity 0–4}` is Nielsen's
(`nielsen-heuristics`, cosmetic → catastrophe), and the closed-axes-plus-localized-findings output shape
is UICrit's (`uicrit-uist24`). Provenance ids resolve against the #1586 ledger; an id with no ledger row
is a dangling ref the watch should admit or correct. (The provenance links alone are not "distilled" in
the #1586 metric sense — flipping a ledger row's `distilledInto` is #1589's job, once #1588 ratifies the
credibility weights; `v2` carries the *citation*, not the weighted distillation.)

The tier-tags route cheaply: Tier A (deterministic from DOM/CSS), Tier B (algorithmic-perceptual from
pixels), Tier C (genuine VLM/human judgment). #1035's `/review-design` skill applies this rubric;
#1036's correction surface persists rubric-scored critiques as labeled pairs.

## Vision correction-surface convention (ratified #1036)

Every human-in-the-loop surface that corrects a vision-provider output (the QC verdict #475, codification
#396, this design critique #1034, and the Tier-2 RichOutput review #1084) follows two rules:

- **Preserve-both records.** A saved correction keeps the model's proposal **read-only** alongside the human
  gold, never overwriting it: `{ proposed (the provider output + per-element confidence + provider/model
  version), corrected (human gold), comment, annotator / timestamp / time-spent, per-element verdict
  (accept|fix|reject) }`. The model↔human **disagreement** is the active-learning selector (#490/#1081) and
  the distillation noise-correction signal (#513) — overwriting discards exactly what the corpus exists to
  capture. This extends the #489 `{frame, verdict}` shape, never breaks it.
- **One shared review harness.** The contract-agnostic shell — review queue, screenshot canvas + region
  drag/edit, persistence, accept/fix/reject verbs, no-leakage boundary — is a single module each surface
  composes by supplying only its own output-contract editor. The shell never forks per vocabulary; the
  output-contract editor is the only per-surface part. (`plateau:src/vision-review/` is the first
  implementation; later surfaces migrate it onto the shared harness rather than duplicating the shell.)

## Open (still to discuss)

- Whether the richer critique runs **on-device (Tier 2)** or **stays hosted** — depends on whether the
  rubric must run free/everywhere (→ Tier-1-expressible) or can be device-gated/hosted (→ rich/generative).
