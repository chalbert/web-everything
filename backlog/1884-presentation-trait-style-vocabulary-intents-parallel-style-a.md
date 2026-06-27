---
kind: decision
status: open
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
preparedDate: "2026-06-27"
relatedReport: reports/2026-06-27-presentation-trait-style-vocabulary.md
relatedProject: webtheme
tags: [style-traits, presentation-axis, design-tokens, intents-parallel, assembler, dogfooding, validation-gate]
---

# Presentation-trait style vocabulary (intents-parallel style axis) — go/no/not-yet on minting

## Digest

**Verdict: NOT-YET (confidence: med-high).** Mint *no* new cross-cutting `finishes`/presentation-trait
vocabulary now. Prep surfaced a load-bearing collision the original "no standard exists for the style axis"
premise missed: a **ratified statute already governs this axis** — *realize a declared axis; never stand up a
second home* (`we:docs/agent/platform-decisions.md:1128`) — and the **`surface` intent already owns most of the
proposed scope** (`we:src/_data/intents/surface.json`: `texture` = gloss/glass, `elevation` = shadow,
`interaction` = hover-feedback). The card "raw-CSS leak" that motivated this is an **unrealized declared
intent**, not a missing standard. With one speculative consumer (the card, on plain tokens, non-blocking), the
*no-orchestrator-until-a-real-cross-cutting-consumer* rule (`:773`) says hold. So this is a **validation gate**,
not a merit fork: realize `surface` first; re-open the mint only if a real cross-cutting residual survives.

## What you're deciding

Whether to **mint a new top-level, cross-cutting style vocabulary** — entries like `rounded=md`,
`shadowed=heavy`, `bordered`, `hover=shine`, each resolving to one CSS property or a multi-prop recipe, with a
standardized meta-schema and declared inter-trait interaction logic, applied across *any* surface (the style
sibling to intents, which stay UX-only). The candidate proposes WE owns the vocabulary + resolution contract,
FUI the recipe engine, product/flavor the values, the Plateau assembler composing them — harvested from the
card-surface dogfood (#1871/#1608), where the assembler today emits raw CSS blobs.

## Why this isn't a classic fork (and is still a decision)

There is **no excluded rival branch** to weigh. The alternative — *extend the owning intent's dimensions* (add
`radius`/`border` to `surface` where they're missing; realize the dimensions it already declares) — is **not
shown to be broken**; by support-all-coherent it is in fact the *cheaper, statute-aligned* path. So the
fork-existence test fails: this is a **one-sided go/no-go on a candidate** (mint a cross-cutting vocabulary),
exactly the validation-gate archetype. The human still decides what earns a place on the roadmap; prep's job is
to supply the prior-art delta + a recommended verdict + a concrete un-gate trigger — below.

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
| **`we:src/_data/intents/surface.json`** | **declares `texture`(solid/glass/transparent), `elevation`(0–5), `interaction`(static/lift/scale), `variant`** | **already owns gloss/glass + shadow + hover-feedback** — the bulk of the proposed axis |
| **`we:docs/agent/platform-decisions.md:1128`** (ratified) | *realize a declared axis; never stand up a second home* | minting a parallel `finishes` vocabulary over `surface`'s axis is the **anti-pattern** this forbids |
| **`we:docs/agent/platform-decisions.md:773`** (ratified) | *don't mint an orchestrator over already-homed axes until a real cross-cutting consumer appears* | the only consumer (card #1871) is single + non-blocking ⇒ premature |

**The motivating "leak" is an unrealized intent, not a gap.** `we:src/_data/assemblerPresets/hovercard.json`
declares `composesIntents: [..., "surface"]` (line 16) yet **emits raw CSS** for the surface properties —
`.hovercard-card { border-radius; box-shadow; border; … }` (line 70). The fix the statute prescribes is
*realize* the declared `surface` intent (resolve its tokens to CSS), **not** stand up a new vocabulary.

**Genuine residual (the one real gap):** `rounded` (corner radius) and `bordered` (border presence/weight) are
**not** in `we:src/_data/intents/surface.json`'s dimensions. But that is a case for **extending the owning
intent** (add a `radius` / `border` dimension), not for a cross-cutting vocabulary — unless a real multi-intent
consumer later proves otherwise.

## Recommendation

**NOT-YET — hold the mint; realize the declared axis first.** Concrete un-gate trigger (all three, in order):

1. **Realize the `surface` intent.** Resolve its declared `texture`/`elevation`/`interaction` to CSS and
   **eliminate the hovercard raw-CSS blob** (`we:src/_data/assemblerPresets/hovercard.json:70`) by composing it
   from the declared `surface` intent. (This is the already-ratified *realize-a-declared-axis* path and the
   actual fix for the dogfood that spawned this item.)
2. **Extend the owning intent for the residual.** Where `rounded`/`bordered` genuinely belong, add a `radius` /
   `border` dimension to `surface` (or the appropriate owning intent) — not a parallel home.
3. **Re-open the mint only on a real cross-cutting consumer.** If, after (1)+(2), a *real* consumer needs **one
   vocabulary spanning multiple intents** that the intent-owns-the-axis model **provably cannot carry**,
   re-open as a merit fork — and only then with a **fork-existence proof against** *intent-owns-the-axis*
   (per `:1128`/`:773`). A single card consumer shipping on plain tokens does not meet this bar.

*Skeptic: the verdict was REFRAMED by the prep skeptic (mint-now → not-yet) and the reframe was verified against
the tree, not asserted. The skeptic refuted the "no style-axis standard exists" premise by citing the ratified
*realize-declared-axis* statute (`we:docs/agent/platform-decisions.md:1128`) + the existing
`texture`/`elevation`/`interaction` dimensions on `we:src/_data/intents/surface.json` + the
`composesIntents:[surface]`-but-raw-CSS hovercard leak (`we:src/_data/assemblerPresets/hovercard.json:16,70`).
The counter-attack on *not-yet* — "`surface` is `status:draft` and lacks `rounded`/`bordered`, so there IS a
residual a new axis must carry" — was considered and **folded into the trigger** (extend the owning intent's
dimensions; that residual does not justify a parallel cross-cutting home absent a real multi-intent consumer).
Net: not-yet survives; the research's prior-art survey stands, its greenfield premise is corrected.*

## Dependencies & lineage

Surfaced while deciding the `we-card` docs migration (#1871). **Does NOT block** the card/#1871/#1608 — they
ship on **plain tokens now** and retrofit later (the card decision #1886 carries the same non-blocking note).
Reconcile the "flavor"/recipe vocabulary with #1886's base/flavor layering when either codifies. Prepared
2026-06-27: prior-art survey + internal-statute grounding, published as research topic
`presentation-trait-style-vocabulary` and report
[we:reports/2026-06-27-presentation-trait-style-vocabulary.md](reports/2026-06-27-presentation-trait-style-vocabulary.md).
Governing statutes: `we:docs/agent/platform-decisions.md:1128` (realize-declared-axis), `:773`
(no-orchestrator-until-real-consumer), Intent-UX-Only.
