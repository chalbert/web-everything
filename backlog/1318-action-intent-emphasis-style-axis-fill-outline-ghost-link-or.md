---
kind: decision
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#open-numbered-variants"
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

## Ruling (ratified 2026-06-20)

**Fork 1 → A.** The variant axis is a **`variant` dimension on Action Intent**
(`variant: fill | outline | ghost | link`), declared alongside `level` in
we:src/_data/intents/action.json. Not a separate cross-cutting Emphasis Intent — vocabularies diverge
per intent (input's `borderless` ≠ button's `ghost`/`link`), so a shared intent would flatten lossily;
mirrors the in-tree precedent `input.variant`. *(~80%; red-team of the shared-intent alternative
failed on the divergent-vocabulary evidence.)*

**Name → `variant`** (not `emphasis`): prominence is owned by `level`, so the orthogonal box-treatment
axis takes the presentational name `variant` (mirrors `input.variant`; `treatment` runner-up).

**Open-numbered contract (invariant, author guidance).** WE standardizes the **variant contract** — *a
value names a purely-presentational treatment that leaves the semantic `level` and behavior unchanged* —
plus a **recommended core set**; authors mint as many members as they want from that contract.
Membership is the semantic test (*differs only in presentation → member; differs in semantics →
different contract*). **Ceiling:** bounded to presentational treatment of one rendering — "same
semantics, different DOM" is block polymorphism / a structural axis, not a variant (see *Ceiling*
below). Generalizes to sectioning & layout.

**Fork 2 → A.** `link` is **in the recommended core set** (lowest-emphasis value) — it passes the
contract test (fires an action, not navigation), and every benchmark ships it. *(~70%.)*

**Surface (native-first).** Rendered as a plain attribute consumed by CSS (`button[variant="ghost"]`),
**no wrapper / no JS required** — licensed by the no-a11y-semantics finding. Whether FUI's block is a
bare `<button>` or a custom-element wrapper, and per-variant loading, is a **separate FUI packaging
decision** (filed as follow-up), not settled here.

**Follow-ups filed at close-out:** build (add the `variant` dimension to we:src/_data/intents/action.json), FUI packaging
decision (variant surface & per-variant loading), statute promotion of the open-numbered-variant rule +
ceiling, sectioning/layout generalization, and a thought item on `level`-as-outcome-role. See the
*Follow-ups* footer.

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

## Open-numbered: standardize the contract, not the enum

*(Added in discussion — author guidance, treated as a first-class invariant, not a fork.)* The
emphasis axis is an **open set**, like all intent vocabularies (Intents Open Design). WE standardizes
the **emphasis contract** — *"a value names a purely-presentational variant that leaves the semantic
`level` and the element's behavior unchanged"* — plus a **recommended core set**. Authors mint as many
members as they want **from that general contract**.

The contract gives a sharp **membership test** that replaces enum-gatekeeping:

- **Differs only in style/emphasis** (same semantic level, same behavior) → a valid emphasis member,
  author-extensible (`fill`, `outline`, `ghost`, `link`, `tonal`, `elevated`, `soft`… as many as wanted).
- **Differs in semantics** (changes role, behavior, or navigation affordance) → *not* an emphasis
  value; it is a **different contract** (a different intent/dimension), never folded in here.

This is the pattern, not a one-off: WE defines the **semantically distinct** contracts; where two
things differ *only* in presentation, the variation is an open-numbered axis derived from one general
contract. **The same applies to sectioning and layout** — define the semantic contract once, let
presentational variants be open-numbered rather than enumerating a closed list. Recorded as the
generalizable rule this decision establishes.

### Ceiling: variant vs block polymorphism (added in discussion)

The open-numbered rule is **bounded to presentational treatment of a single rendering** — it does not
swallow every visual difference. Three tiers, distinguished by *how far down* the difference reaches:

1. **Intent** — the semantic contract (e.g. "single-select from a mutually-exclusive set"). The
   invariant; everything below satisfies it.
2. **Variant** (this axis) — a value the **same block, same DOM** renders differently; CSS/token
   reachable (fill/outline/ghost/link on one `<button>`). *Open-numbered.*
3. **Block polymorphism** — when materially **different DOM/markup** is required (the same
   single-select intent as stacked radios *vs* a segmented control *vs* card-tiles *vs* swatches),
   you have left the variant axis: these are **interchangeable blocks under one intent** (WE's
   intent→block is one-to-many by design) or a *structural/layout* axis — **not** variant values.

**Diagnostic:** *"can I reach it with CSS/tokens on the same markup?"* — yes → variant; no → block /
structure layer. This stops the open-numbered rule from sprawling into "everything visual is a
variant," and it routes the structural cases to the sectioning/layout generalization rather than here.

## Recommended path at a glance

| Fork | Axis | Recommended default | Main alternative (excluded branch) | Confidence |
|---|---|---|---|---|
| 1 | Home of the variant axis | **`variant` dimension on Action Intent** (mirrors `input.variant`) | separate cross-cutting Emphasis Intent | ~80% |
| 2 | `link` in the recommended core set? | **include `link`** (passes the contract test) | leave to author extension | ~70% |
| Name | What to call the axis | **`variant`** (mirrors `input.variant`, dev-familiar) | `treatment` (Spectrum) — runner-up | ~65% |

**Naming note (decided in discussion):** the axis is **named `variant`**, *not* `emphasis`. "Emphasis"
implies prominence/attention — but prominence is owned by `level` (primary draws attention). The new
axis is the orthogonal *box treatment* (a `secondary`-level button rendered fill / outline / ghost /
link), so naming it `variant` (a) avoids overloading `level`'s prominence and (b) mirrors the in-tree
precedent `input.variant` (we:src/_data/intents/input.json:11-18). `treatment` (Adobe Spectrum, which
splits semantic `variant` from presentational `treatment` — the exact `level ⊕ this` split) is the
runner-up; `appearance` rejected (collides with CSS `appearance`). *"Emphasis" survives only as the
descriptive name of the concept in prose below.*

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

- **A — a new `variant` dimension on Action Intent** *(recommended, ~80%)*.
  `variant: fill | outline | ghost | link`, declared alongside `level` in
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

## Fork 2 — Is `link` in the recommended core set?

*Reframed in discussion.* With the axis open-numbered (see *Open-numbered* above), this is **no longer
"is `link` allowed"** — the membership test settles that mechanically. The only remaining question is
whether `link` belongs in the **recommended core set** WE ships, or is left to authors as an extension.
It turns on the contract test: does a link-styled action differ *only* in presentation, or does "link"
drag in navigation semantics?

- **A — include `link` in the core set as the lowest-emphasis value** *(recommended, ~70%)*. Material's
  `text`, shadcn/Ant's `link`, and a plain inline `<button class=link>` are the same "lowest-emphasis,
  inline" treatment; action semantics (fires an action, not navigation) are unchanged, so it **passes
  the contract test** — purely a visual emphasis tier. *Why:* every benchmark ships it, so omitting it
  from the core set just pushes authors to mint the same value non-standardly.
- **B — leave `link` out of the core set** (still mintable by authors if presentation-only); keep the
  shipped set to box treatments (fill/outline/ghost). *Why considered:* if "link" in practice implies
  navigation affordances (underline-on-hover, visited state, an anchor's role) it would *fail* the
  contract test and belong to a navigation contract, not emphasis. **The residual** that flips this:
  evidence that `link` overloads the action contract with navigation semantics. Low risk — as used by
  the benchmarks it is a visual tier on an action, not a behavior.

## Follow-ups (filed at close-out)

Captures the discussion threads as their own items so this decision stays scoped:

- **Build** — add the `variant` dimension (`fill | outline | ghost | link` + open vocabulary,
  recommended core set) to we:src/_data/intents/action.json. Direct successor; agent-ready.
- **Decision (FUI locus)** — variant component surface & per-variant loading: bare `<button variant>`
  + CSS (no wrapper) vs per-variant custom elements vs a wrapping element; wrapper-vs-bare layout
  tradeoffs; loading only the used variant's styles. ARIA-role-isn't-enough + "most devs won't
  re-implement button a11y" argue native-first; settle the packaging shape there.
- **Task** — promote the open-numbered-variant rule + the variant-vs-block-polymorphism ceiling to the
  statute layer (we:docs/agent/platform-decisions.md) as a cite-able rule.
- **Idea** — apply the open-numbered-variant pattern to sectioning & layout (define the semantic
  contract, open-numbered presentational variants). Blocked on the statute promotion.
- **Idea** — revisit whether Action `level` models *outcome-role* (continue / cancel / back), not just
  prominence; surfaced as a distinct concern from the variant axis.
