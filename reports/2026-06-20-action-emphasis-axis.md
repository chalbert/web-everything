# Action Intent — the emphasis-style axis (fill | outline | ghost | link) (#1318)

Prep research for decision **#1318**, gap #3 of the shadcn reproduction-conformance delta
(we:reports/2026-06-20-1243-shadcn-first-gap-delta.md, line 44). Action Intent
(we:src/_data/intents/action.json) expresses semantic priority **levels** (`primary | secondary |
tertiary | destructive`). shadcn buttons also vary on an orthogonal emphasis **style** — filled vs
outline vs ghost vs link — *at the same priority level*. That style is not expressible as a level, so the
question is **where the emphasis-style axis lives**: a second dimension on Action Intent, or a separate
intent/trait.

## 1. The platform has no native vocabulary for button emphasis

Unlike most intent axes — which borrow a platform term (`aria-sort`, `Intl.Collator`, `inert`) — there is
**no web-platform vocabulary** for button emphasis. `<button>` has no `variant`/`emphasis`/`appearance`
attribute; CSS `appearance` only toggles native-rendering on/off; ARIA has no emphasis state (emphasis is
purely presentational, carries no a11y semantics — a ghost button and a filled button are the same role).
So the axis is a **pure design-system convention** and the vocabulary must be borrowed from the benchmark
libraries (we:src/_data/references.json), not from a spec. This is a meaningful classification fact: the
axis is presentational, which is exactly why the *intent-vs-presentation* boundary needs settling (§4).

## 2. Design-system survey — the axis converges, but most systems conflate it with level

| System | Style axis (orthogonal-ish) | Conflated with level? |
|---|---|---|
| **Material 3** | elevated · **filled** · filled-tonal · **outlined** · **text** | No — variant separate from color role |
| **Fluent 2** | primary · secondary · **outline** · **subtle**(ghost) · **transparent** | partly (primary/secondary = level inside `appearance`) |
| **Apple HIG / SwiftUI** | borderedProminent · bordered · **borderless**(plain) · tinted | partly |
| **Bootstrap** | `btn-*` (filled) vs **`btn-outline-*`** | No — `-outline-` modifier orthogonal to `-primary/-secondary` |
| **shadcn/ui** | default · destructive · **outline** · secondary · **ghost** · **link** | **Yes** — one `variant` prop mixes level + style |
| **Ant Design** | primary · default · dashed · **text** · **link** (+ `ghost` prop) | **Yes** — one `type` prop |
| **Carbon** | primary · secondary · tertiary · **ghost** · danger | **Yes** — one `kind` prop |

Two findings:

- **The style axis is real and converges** on roughly **{ filled, outlined, ghost/subtle/text, link }**,
  with a long tail of system-specific extras (tonal, elevated, tinted, dashed, transparent). Names rhyme
  but diverge — "ghost" (shadcn/Carbon/Ant via prop), "subtle" (Fluent), "text" (Material), "plain"
  (Apple) are the same idea.
- **Most systems conflate priority and style into one prop** (shadcn `variant`, Ant `type`, Carbon
  `kind`). That conflation is the anti-pattern: you cannot ask for "a *secondary*-priority button rendered
  *filled*" because the single enum forces a pick. The systems that *keep them orthogonal* (Material's
  separate variant, Bootstrap's `-outline-` modifier) are the ones a designer can drive on two
  independent knobs. **WE's Action Intent already separates `level` — so introducing emphasis as a second
  orthogonal dimension is the move that *avoids* the conflation these systems suffer, and folding it into
  `level` would reproduce it.** This is the fork-existence proof for the axis: `level` + emphasis are
  provably orthogonal (same level, different style), so "fold into level" is the broken branch.

## 3. WE already keeps emphasis-style local on the owning intent (the input precedent)

The most decisive prior art is in-tree, not external. **Input Intent already carries this exact axis as a
local dimension**: we:src/_data/intents/input.json:11-18 declares `variant: outlined | filled |
borderless`. WE has therefore *already decided once* that an emphasis-style axis lives **as a dimension on
the intent that owns it**, not as a shared cross-cutting intent — and crucially the input vocabulary
(`outlined/filled/borderless`) **diverges** from a button's (`fill/outline/ghost/link`). The axes rhyme
but the value sets are intent-specific (a button has `ghost`/`link`; an input has `borderless`; a badge
would have `soft`/`solid`). A single shared "Emphasis Intent" would have to either flatten these into one
lossy vocabulary or become an empty meta-pattern. The precedent says: **co-home emphasis on the owning
intent.**

Action Intent is also *already multi-axis* — it carries four orthogonal dimensions today (`level`, `busy`,
`groupOrdering`, `groupSizing`, we:src/_data/intents/action.json:9-41), so adding a fifth (`emphasis`) is
the established shape, not a new pattern. Other multi-axis intents: Navigation (6 dims), Selection (4),
Collection-Operations (Sort/Filter/Group/Page).

## 4. Classification (the 7-question pass)

- **Which layer?** Intent layer (webintents). Not a block, not a protocol — it's a UX descriptor a project
  authors, and the implementing block + theme render it.
- **Protocol or intent dimension?** Intent **dimension**.
- **Expose the whole axis?** Yes — both fill and outline (and ghost, link) are legitimate end-states a
  designer chooses between; per *most-flexible default*, expose the axis and make it optional.
- **Fixed mechanic or dimension?** Dimension.
- **Intent-vs-presentation boundary** (intents are UX-only, no impl refs —
  we:docs/agent/platform-decisions.md#intents-ux-only). Emphasis-style is *presentational* (§1), which
  raises "is it even an intent or pure theme?". Resolved by the input precedent: a visual-prominence
  *selector* (which treatment) is a UX intent dimension; the *rendering* of that treatment (the actual
  border/bg tokens) is the theme/block. The dimension names the choice; it carries no impl ref. So it
  stays on the intent.
- **Channel (intent-vs-trait split #030 — we:docs/agent/platform-decisions.md#intents-ux-only,
  we:reports/2026-06-02-intent-vs-trait-change-plan.md).** Emphasis is **structural/presentational**, not
  behavioral, so it resolves **explicit (per-element attribute) ⊕ ambient project default ⊕ default** —
  the same `explicit ⊕ ambient ⊕ default` chain, where a project *may* set an ambient default emphasis
  (e.g. "ghost everywhere") just as it sets density/motion (the webintents project is literally described
  as ambient density/motion/interaction profiles). It is not a `trait` in the WE sense — traits are
  structural *composition* (component/behavior/provider, droplist model); emphasis composes nothing, it
  selects a treatment. So "make it a trait" is the second broken branch.
- **Most-permissive default?** Default = **unspecified** — emphasis is optional; when absent the block
  renders the conventional treatment for the `level` (primary→filled, tertiary→text). The author opts in
  to override. Most-permissive = no constraint by default.

## 5. The `link` nuance

shadcn's `link` is a button that *looks like* a hyperlink but keeps action (not navigation) semantics.
That makes `link` either (a) a legitimate low-emphasis style value, or (b) out of scope — a link-styled
*action* blurs into element-semantics that arguably belong elsewhere. Both readings are coherent; the
value set can't be left ambiguous. Recommendation leans **include** (a): Material's `text`, Ant/shadcn's
`link`, and a plain `<button class=link>` are all the same "lowest-emphasis, inline" treatment, and the
action semantics are unchanged — excluding it would just push authors to a non-standard value. See Fork 2.

## Forks (full shape in backlog/1318)

- **Fork 1 — Home of the emphasis axis.** *Default:* a new `emphasis` dimension on Action Intent (mirrors
  `input.variant`). *Alternative:* a separate cross-cutting Emphasis Intent. Broken branches (not forks):
  fold into `level` (§2), make it a trait (§4).
- **Fork 2 — Does `link` belong to the emphasis axis?** *Default:* include `link` as a lowest-emphasis
  value. *Alternative:* exclude it as element-semantics.

Supported by default (no fork): emphasis is an intent dimension not a theme token (input precedent);
optional, most-permissive unspecified default; resolves `explicit ⊕ ambient ⊕ default`; open vocabulary —
standardize the `emphasis` dimension + a recommended core set, authors may extend (Intents Open Design).

## Recommended end-state vocabulary

`emphasis: fill | outline | ghost | link` (+ open extension). Names chosen for convergence: **fill**
(Material "filled" / Fluent "primary-bg" / Bootstrap solid), **outline** (Material/shadcn/Fluent/Bootstrap
all agree), **ghost** (broadest adoption — shadcn/Carbon/Ant; Material's "text" and Fluent's "subtle" are
synonyms, noted in the dimension description), **link** (shadcn/Ant; Material "text" overlaps). Orthogonal
to `level`, so `{ level: secondary, emphasis: outline }` is expressible — the thing the conflating systems
cannot say.

## Sources

- [Material Design 3 — All buttons](https://m3.material.io/components/all-buttons)
- [Fluent 2 — React Button usage](https://fluent2.microsoft.design/components/web/react/core/button/usage)
- [Apple HIG / SwiftUI button styles](https://simaspavlos.medium.com/implementing-apples-human-interface-guidelines-hig-with-swiftui-64bdb8ceb2fc)
