---
kind: decision
status: resolved
dateOpened: "2026-06-27"
dateStarted: "2026-06-28"
dateResolved: "2026-06-28"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#presentation-axis-is-intent-owned"
preparedDate: "2026-06-27"
relatedReport: reports/2026-06-27-presentation-trait-style-vocabulary.md
relatedProject: webtheme
tags: [style-traits, presentation-axis, design-tokens, intents-parallel, assembler, dogfooding, validation-gate]
---

# Presentation-trait style vocabulary (intents-parallel style axis) — mint a parallel home, or intent-owns-the-axis?

## Digest

**Ruling: NO to a parallel presentation-trait vocabulary — the presentation axis is intent-owned (confidence:
med-high).** This is a **merit fork**, decided now, not a "not-yet" deferral. The candidate — a cross-cutting
`finishes` vocabulary that re-homes `texture`/`elevation`/`interaction` — is **broken on merit**: it stands up a
*second home* over an axis a **ratified statute already assigns to its intent** — *realize a declared axis; never
stand up a second home* (`we:docs/agent/platform-decisions.md:1128`). The rival branch — **intent-owns-the-axis**
(`we:src/_data/intents/surface.json` already declares `texture`/`interaction`, and `elevation`/`variant` in its
protocol) — wins on merit, today. The card "raw-CSS leak" that motivated the mint is an **unrealized declared
intent**, not a missing standard. **Correct end-state:** realize `surface` and extend the owning intent for the
genuine residuals (`rounded`/`bordered`, and the un-realized `elevation`/`variant`). The *timing* of that build is
ordinary burndown prioritization (separately-filed items, priority is the open knob), **not** part of this ruling
— per *fork-is-not-a-prioritization-tool*. A future *real* multi-intent consumer that intent-owns-the-axis
provably cannot carry re-opens the mint under ordinary reversibility — but that is a residual escape hatch, not a
deferral of today's call.

## What you're deciding

Whether to **mint a new top-level, cross-cutting style vocabulary** — entries like `rounded=md`,
`shadowed=heavy`, `bordered`, `hover=shine`, each resolving to one CSS property or a multi-prop recipe, with a
standardized meta-schema and declared inter-trait interaction logic, applied across *any* surface (the style
sibling to intents, which stay UX-only). The candidate proposes WE owns the vocabulary + resolution contract,
FUI the recipe engine, product/flavor the values, the Plateau assembler composing them — harvested from the
card-surface dogfood (#1871/#1608), where the assembler today emits raw CSS blobs.

## Why this IS a merit fork (correcting the prep's framing)

The prep originally called this "not a classic fork — no excluded rival branch" and recommended **NOT-YET**.
That was prioritization wearing a decision's clothing: "hold the mint, realize `surface` first, re-open later"
answers *when*, not *which is correct*. The fork-existence test (`#069`) was applied to the wrong branch.

The fork **is** real, because the **candidate** branch is broken — not because the alternative is:

- **Branch A — mint a parallel cross-cutting vocabulary** (the candidate): **broken on merit.** It stands up a
  *second home* for `texture`/`elevation`/`interaction`, an axis a ratified statute already homes in its intent
  (`:1128`). Two competing homes for one axis ⇒ drift, ambiguous source-of-truth — the exact anti-pattern the
  statute forbids.
- **Branch B — intent-owns-the-axis** (realize/extend the owning intent): statute-aligned, single home, no
  duplication. **Wins on merit.**

So this is a genuine on-merit ruling, decidable now: **B over A.** Effort/sequencing of B's build is **not** a
branch of this fork — it is backlog prioritization applied separately (`fork-is-not-a-prioritization-tool`).

## Context & prior-art delta

The `/research/presentation-trait-style-vocabulary` survey stands as prior art; what it under-weighted is the
*internal* collision (the rows below the rule). External incumbents establish the paradigm; the internal tree
shows WE already has the home.

| Source | What it offers | WE semantic delta |
| --- | --- | --- |
| Tailwind utilities; Open Props | atomic prop→token; primitive value layer | WE already ships primitive + DTCG composite **theme tokens** (JS-first injector SoT) |
| Chakra style-props | prop→CSS-property map, pseudo-state props | WE expresses presentational dimensions as **intent dimensions**, not free props |
| Panda / vanilla-extract / Stitches **recipes & variants** | `{base, variants, compoundVariants}` interaction engine | a **build-time** CSS-in-JS emit shape; WE resolves at **runtime** over injected tokens — fit is unproven |
| DTCG composite tokens | multi-prop grouping (shadow/border/typography) | already WE's token layer; subsumes most "trait interactions" |
| **`we:src/_data/intents/surface.json`** | **`dimensions` block declares `texture`(solid/glass/transparent) + `interaction`(static/lift/scale); `elevation`(0–5) + `variant` are declared in its protocol/description but NOT yet realized as `dimensions`** | **already owns gloss/glass + hover-feedback as machine-readable dimensions; elevation/variant are declared-but-unrealized** — the bulk of the proposed axis is its home |
| **`we:docs/agent/platform-decisions.md:1128`** (ratified) | *realize a declared axis; never stand up a second home* | minting a parallel `finishes` vocabulary over `surface`'s axis is the **anti-pattern** this forbids |
| **`we:docs/agent/platform-decisions.md:773`** (ratified) | *don't mint an orchestrator over already-homed axes until a real cross-cutting consumer appears* | the only consumer (card #1871) is single + non-blocking ⇒ premature |

**The motivating "leak" is an unrealized intent, not a gap.** `we:src/_data/assemblerPresets/hovercard.json`
declares `composesIntents: [..., "surface"]` (line 16) yet **emits raw CSS** for the surface properties —
`.hovercard-card { border-radius; box-shadow; border; … }` (line 70). The fix the statute prescribes is
*realize* the declared `surface` intent (resolve its tokens to CSS), **not** stand up a new vocabulary.

**Genuine residual (the real gaps):** `rounded` (corner radius) and `bordered` (border presence/weight) are
**not** in `we:src/_data/intents/surface.json`'s `dimensions` — and neither are `elevation`/`variant`, which the
intent's protocol/description declare but its `dimensions` block does not yet realize. But every one of these is
a case for **extending / realizing the owning intent** (add `radius` / `border`, realize `elevation` / `variant`),
**not** for a cross-cutting vocabulary — unless a real multi-intent consumer later proves intent-owns-the-axis
cannot carry it.

## Recommendation

**Rule B over A on merit: NO to a parallel presentation-trait vocabulary — the presentation axis is
intent-owned.** The candidate (Branch A) is rejected because it violates *realize-a-declared-axis; never a second
home* (`:1128`). The correct end-state (Branch B) is to realize and extend the owning intent. That end-state is
ruled **now**; the *build* of it is filed as separately-prioritized backlog items (priority is the open knob,
existence is not — `fork-is-not-a-prioritization-tool`):

1. **Realize the `surface` intent** (build item). Resolve its declared `texture`/`interaction` (and realize
   `elevation`/`variant`) to CSS and **eliminate the hovercard raw-CSS blob**
   (`we:src/_data/assemblerPresets/hovercard.json:70`) by composing it from the declared `surface` intent — the
   already-ratified *realize-a-declared-axis* path, and the actual fix for the dogfood that spawned this item.
2. **Extend the owning intent for the residual** (build item). Where `rounded`/`bordered` genuinely belong, add a
   `radius` / `border` dimension to `surface` (or the appropriate owning intent) — not a parallel home.

**Reversibility, not deferral:** if, *after* a real consumer appears, one vocabulary spanning **multiple** intents
is provably needed and intent-owns-the-axis **cannot carry it**, re-open as a fresh merit fork with a
fork-existence proof against intent-owns-the-axis (per `:1128`/`:773`). A single card consumer shipping on plain
tokens does not meet that bar. This is the ordinary reversibility every ruling carries (`#036`), **not** a
"not-yet" hold on this decision.

## Single-model end-state (why Branch B is the *elegant* call, not just the statute-aligned one)

The positive case for Branch B: **one open intent model owns all UI/UX configuration** — the presentation axis
is intents-shaped, declared semantically and resolved to traits, with no parallel home. This is exactly what
[intents-ux-only](../docs/agent/platform-decisions.md) (`:378`) already commits to: *"Intents are an open,
never-finished system: custom non-standard intents must coexist conflict-free — standardize the meta-schema, not
the list."* So two things the candidate treated as new scope are in fact **declared-but-unrealized promises** of
the model we already have:

1. **Broader coverage** — more of the presentation axis expressed as intents/dimensions (realize `surface`;
   extend for `rounded`/`bordered`; realize `elevation`/`variant`).
2. **App-authored custom intents** — the meta-schema + registry that lets a product mint and use its **own**
   intent conflict-free. Not a new decision; the statute already promised it. Realizing it is what makes the
   single model genuinely cover *all* UI/UX config rather than only WE-shipped intents.

**The one honest edge:** *"UX-only" means semantic/declarative (what/why, no impl refs — the #030 intent/trait
split), NOT "non-presentational."* `texture=glass` / `elevation=3` are already presentational intents because
each carries a semantic story. The strain is only at the **pure-decoration edge** — `rounded=md`, `bordered` —
whose "what/why" is thin. Single-model says express them as intent dimensions (standardize the meta-schema); the
honest alternative is they remain **raw theme tokens** with no intent. Resolve toward intents for consistency,
but not every CSS knob earns one — a few genuinely-decorative values may stay token-only. This edge is captured,
not buried.

## Follow-ons filed at resolve (separately prioritized — `fork-is-not-a-prioritization-tool`)

- **#1911 — Realize the `surface` intent** → resolve `texture`/`interaction` (+ realize `elevation`/`variant`)
  to CSS; eliminate the hovercard raw-CSS blob (`we:src/_data/assemblerPresets/hovercard.json:70`) by composing
  it from the declared intent.
- **#1912 — Extend the owning intent for the residual** → add a `radius` / `border` dimension where
  `rounded`/`bordered` genuinely belong (per the pure-decoration-edge test above).
- **#1913 — Realize app-authored custom intents** (decision) → the meta-schema + registry for product-minted
  intents (the open/never-finished promise of `:378`); decides the runtime app-intent registry/authoring shape.

*Skeptic (two passes): (1) the prep skeptic refuted the "no style-axis standard exists" premise by citing the
ratified *realize-declared-axis* statute (`we:docs/agent/platform-decisions.md:1128`) + the existing
`texture`/`interaction` dimensions on `we:src/_data/intents/surface.json` + the `composesIntents:[surface]`-but-
raw-CSS hovercard leak (`we:src/_data/assemblerPresets/hovercard.json:16,70`), landing a NOT-YET. (2) The
**decision-turn skeptic corrected the prep's framing**: NOT-YET was prioritization wearing a decision's clothing.
Re-running the fork-existence test against the *candidate* branch (not the alternative) shows the candidate is
**broken on merit** — a second home over an intent-owned axis violates `:1128` — so this is a genuine merit fork
ruling **B over A now**, with B's build a separately-prioritized item (`fork-is-not-a-prioritization-tool`) and
the "real cross-cutting consumer" clause demoted to ordinary reversibility (`#036`), not a hold. The
counter-attack — "`surface` is `status:draft` and its `dimensions` lack `rounded`/`bordered`/`elevation`/
`variant`, so there IS a residual a new axis must carry" — was considered and folded into Branch B's build
(realize/extend the owning intent); that residual does not justify a parallel cross-cutting home absent a real
multi-intent consumer. Net: the conclusion (don't mint) survives on **merit** grounds; the research's prior-art
survey stands, its greenfield + not-yet framings are corrected. (3) **Ratification red-team** — strongest case
for Branch A: "presentation traits (radius/border/shadow/hover) span MANY surfaces and belong to no single
intent, so intent-owns-the-axis fragments one coherent vocabulary across silos." Rebutted: the cross-surface
concern is already served two ways without a parallel home — **pure decoration → theme tokens** (a button's
radius is `--radius-*`, no intent), **semantic presentation → per-intent dimensions** (a surface's elevation).
"Belongs to no intent" argues *token*, not *new intent-sibling vocabulary*. And `:1128` is dispositive: a
cross-cutting need must first be **proven** uncarryable by intent-owns-the-axis before a parallel home reopens —
the red-team names a hypothesis, not a proof. Attack fails → ratified.*

## Dependencies & lineage

Surfaced while deciding the `we-card` docs migration (#1871). **Does NOT block** the card/#1871/#1608 — they
ship on **plain tokens now** and retrofit later (the card decision #1886 carries the same non-blocking note).
Reconcile the "flavor"/recipe vocabulary with #1886's base/flavor layering when either codifies. Prepared
2026-06-27: prior-art survey + internal-statute grounding, published as research topic
`presentation-trait-style-vocabulary` and report
[we:reports/2026-06-27-presentation-trait-style-vocabulary.md](reports/2026-06-27-presentation-trait-style-vocabulary.md).
Governing statutes: `we:docs/agent/platform-decisions.md:1128` (realize-declared-axis), `:773`
(no-orchestrator-until-real-consumer), Intent-UX-Only.
