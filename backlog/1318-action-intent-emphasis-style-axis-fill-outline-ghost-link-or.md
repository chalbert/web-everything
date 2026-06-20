---
kind: decision
status: open
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
preparedDate: "2026-06-20"
tags: [reproduction, gap-sweep, shadcn]
relatedProject: webintents
relatedReport: reports/2026-06-20-action-emphasis-axis.md
---

# Action Intent: emphasis-style axis (fill | outline | ghost | link) orthogonal to priority level

Reproduction-conformance gap #3 from shadcn (#1243, we:reports/2026-06-20-1243-shadcn-first-gap-delta.md:44).
Action Intent (we:src/_data/intents/action.json) expresses semantic priority **levels**
(`primary | secondary | tertiary | destructive`), but shadcn buttons also vary on an orthogonal emphasis
**style** — filled / outline / ghost / link — *at the same priority level*, which a level cannot express.
Decide where the emphasis-style axis lives. Surfaced by reproduction #1243, feeds gap-sweep #315.

## Grounding digest

Full survey: **we:reports/2026-06-20-action-emphasis-axis.md** · research topic
`/research/action-emphasis-axis/`.

- **No native vocabulary.** `<button>` has no `variant`/`appearance` attribute; CSS `appearance` only
  toggles native rendering; ARIA has no emphasis state (ghost and filled buttons share one role — emphasis
  is presentational, no a11y semantics). So the axis is a design-system convention, not a platform term to
  borrow.
- **The axis is real and converges** on `{ filled, outlined, ghost/subtle/text, link }` (Material 3,
  Fluent 2, Apple HIG, Bootstrap, shadcn, Ant, Carbon) — but **most systems conflate priority and style
  into one prop** (shadcn `variant`, Ant `type`, Carbon `kind`), so they cannot express "secondary-level
  rendered filled." WE's Action Intent already separates `level`, so a *second orthogonal* dimension
  avoids the conflation; folding into `level` reproduces it.
- **WE already keeps this axis local on the owning intent**: Input Intent declares
  `variant: outlined | filled | borderless` (we:src/_data/intents/input.json:11-18), and that vocabulary
  *diverges* from a button's (`ghost`/`link` vs `borderless`). Axes rhyme, value sets are intent-specific.
- **Action Intent is already multi-axis** — `level · busy · groupOrdering · groupSizing`
  (we:src/_data/intents/action.json:9-41) — so a fifth `emphasis` dimension is the established shape, not
  a new pattern.

## Axis-framing

The single design axis is **the home of the emphasis-style dimension**. It is orthogonal to `level`
(we:src/_data/intents/action.json:10-18) — shadcn proves a `secondary`-level button can render `filled`
*or* `outline` *or* `ghost`, so the two are independent knobs. The dimension is an *intent* concern (a
UX selector of visual prominence, UX-only per we:docs/agent/platform-decisions.md#intents-ux-only), not a
theme token: the dimension *names the choice*, the theme/block *renders* the treatment — the exact split
Input Intent's `variant` already embodies (we:src/_data/intents/input.json:11-18). Per #030
(we:reports/2026-06-02-intent-vs-trait-change-plan.md) emphasis is structural/presentational, so it
resolves `explicit (per-element) ⊕ ambient project default ⊕ default`, with a most-permissive
*unspecified* default (when absent the block renders the conventional treatment for the `level`).

## Recommended path at a glance

| Fork | Axis | Recommended default | Main alternative (excluded branch) | Confidence |
|---|---|---|---|---|
| 1 | Home of the emphasis axis | **`emphasis` dimension on Action Intent** (mirrors `input.variant`) | separate cross-cutting Emphasis Intent | ~80% |
| 2 | Scope of the `link` value | **include `link` as the lowest-emphasis value** | exclude as element-semantics | ~70% |

**Supported by default (not forks):** emphasis is an intent dimension, not a theme token (input
precedent); optional, most-permissive *unspecified* default (the `level` implies the treatment); resolves
`explicit ⊕ ambient ⊕ default`; open vocabulary — standardize the `emphasis` dimension + a recommended
core set, authors may extend (Intents Open Design). *Broken branches (named, so not forks):* fold emphasis
into `level` (shadcn proves orthogonal — can't); make it a `trait` (traits are structural composition per
#030 — emphasis composes nothing, it selects a treatment).

## Fork 1 — Home of the emphasis-style axis

*Fork exists because* the axis has exactly one home and the two coherent candidates cannot coexist: a
dimension can't be both an action-local dimension *and* a standalone cross-cutting intent. Both are
coherent designs (a shared Emphasis Intent composing across action/input/badge is a real pattern), so this
is a genuine either/or, not a forced invariant.

- **A — a new `emphasis` dimension on Action Intent** *(recommended, ~80%)*.
  `emphasis: fill | outline | ghost | link`, declared alongside `level` in
  we:src/_data/intents/action.json:9-41. Mirrors the in-tree precedent
  (we:src/_data/intents/input.json:11-18) where the owning intent holds its own emphasis vocabulary.
  *Why:* the value sets are intent-specific (button `ghost`/`link` ≠ input `borderless` ≠ badge
  `soft`/`solid`), so co-homing keeps each vocabulary precise; Action Intent is already multi-axis so this
  is zero new machinery; and it keeps `level` and emphasis orthogonal, the property that lets WE express
  what the conflating systems (shadcn/Ant/Carbon) cannot.
- **B — a separate cross-cutting "Emphasis Intent"** that composes onto action/input/badge/etc. *Why
  considered:* the bias-toward-separation default and the surface rhyme across intents (everyone has a
  fill/outline-ish axis). *Why not the default:* the vocabularies diverge per intent
  (we:src/_data/intents/input.json:11-18 already proves it), so a shared intent must either flatten them
  lossily or be an empty meta-pattern; and it duplicates the home Input already established, contradicting
  the in-tree precedent. **The residual** that would flip this: if a future survey shows ≥3 intents want
  an *identical* emphasis vocabulary with identical semantics, a shared intent would cut real duplication
  — current evidence (input's divergent set) says no.

## Fork 2 — Does `link` belong to the emphasis axis?

*Fork exists because* the value set must be unambiguous and `link` is genuinely two-faced: a
link-*styled* button (action semantics, looks like an anchor) vs a link as element-semantics that belongs
to navigation, not emphasis. Both readings are coherent and the value is either in the set or not — a real
either/or.

- **A — include `link` as the lowest-emphasis value** *(recommended, ~70%)*. Material's `text`,
  shadcn/Ant's `link`, and a plain inline `<button class=link>` are the same "lowest-emphasis, inline"
  treatment; action semantics (fires an action, not navigation) are unchanged, so it is purely a visual
  emphasis tier. *Why:* excluding it just pushes authors to a non-standard value for a treatment every
  benchmark ships.
- **B — exclude `link`**; treat a link-styled action as element-semantics handled elsewhere (an anchor, or
  a navigation concern). *Why considered:* keeps the emphasis axis strictly about surface treatment
  (fill/outline/ghost are all box treatments; `link` removes the box entirely). **The residual** that
  would flip this: if "link" turns out to imply navigation affordances (underline-on-hover, visited
  state) that overload the action contract, exclude it. Low risk — it is a visual tier, not a behavior.
