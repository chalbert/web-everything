---
kind: decision
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#decompose-overloaded-vocabulary-by-semantic-source"
preparedDate: "2026-06-20"
tags: [reproduction, gap-sweep, shadcn, intent, candidate-standard]
relatedProject: webintents
relatedReport: reports/2026-06-20-decorative-label-tag-intent.md
researchTopic: decorative-label-tag-intent
---

# Decorative label/tag intent distinct from lifecycle Status Indicator

Reproduction-conformance gap **#6** from shadcn ([#1243](/backlog/1243-reproduction-parity-shadcn-foundational-harness-first-gap-de/),
origin we:reports/2026-06-20-1243-shadcn-first-gap-delta.md). shadcn's `badge` was mapped onto
**Status Indicator** (`badge→status-indicator`), but Status Indicator is lifecycle-state-driven and
shadcn's badge is a decorative standalone label — so the mapping over-constrains it. Decide whether to
**mint a distinct decorative label/tag intent** or **widen Status Indicator** to cover the decorative
case.

## Grounding digest

Prior-art survey: we:reports/2026-06-20-decorative-label-tag-intent.md · research topic
[decorative-label-tag-intent](/research/decorative-label-tag-intent/).

Every benchmarked system (shadcn, Ant, Carbon, Fluent 2, MUI, Atlassian, Primer, Bootstrap) splits the
overloaded "badge" word along a **semantic-source** axis into three families: **(1)** decorative/
categorical label (author-supplied tone, static, no provider — shadcn Badge, Ant Tag, Carbon Tag,
Atlassian Lozenge, Primer Label, Bootstrap Badge); **(2)** lifecycle/state status (an entity's state
machine — WE's Status Indicator); **(3)** count/dot notification marker (count overlaid on a host —
Ant/MUI/Fluent Badge). The word lands in a *different* family per system — shadcn's Badge is family 1,
Ant's Badge is family 3. **Decisive:** WE has already split this family once by the same axis —
**Notification Marker** (we:src/_data/intents/notification-marker.json, spun out of #009) carved family
3. Status Indicator owns family 2; **family 1 (decorative) is the unhomed remainder.** Widening Status
Indicator doesn't just over-constrain the badge — it *dilutes* Status Indicator (a decorative label has
no provider/transition/state, so its lifecycle contract would have to go optional and hollow).

## Axis framing

The concern decomposes into three orthogonal axes, each pinned to the real tree:

- **Home axis (Fork 1) — where the decorative case lives.** Status Indicator
  (we:src/_data/intents/status-indicator.json) is defined *by* lifecycle: summary `:5` "the visual
  member of the Web Lifecycle protocol", description `:35` "reads the same lifecycle provider",
  `affordance` `:27` surfaces "the available next **transitions** (from the provider)", `events` `:36`
  = `["transition"]`. A decorative label supplies none of that. Mint a new intent, or widen this one.
- **Interactivity axis (Fork 2) — own vs compose.** Clickable/closable/filter behavior is already
  homed: Action (we:src/_data/intents/action.json), Selection
  (we:src/_data/intents/selection.json). Reaction (we:src/_data/intents/reaction.json) composes
  Expressive Symbol (we:src/_data/intents/expressive-symbol.json) rather than baking interaction in —
  the standing precedent. Own a `closable`/`clickable` axis, or stay decorative-only and compose.
- **Naming axis (Fork 3).** `badge` is taken — it is the `shape` token on Status Indicator
  (we:src/_data/intents/status-indicator.json `:18`) and on the count-marker family. Pick a
  non-colliding name.

## Recommended path at a glance

| Fork | Recommended default | Main alternative (excluded) | Confidence |
|---|---|---|---|
| **1 — Home** | **Mint a distinct decorative label/tag intent** | Widen Status Indicator | med-high |
| **2 — Interactivity** | **Decorative-only; compose Action/Selection** | Own a closable/clickable axis | med-high |
| **3 — Name** | **`tag` ("Tag Intent")** | `badge` / `label` / `lozenge` | med |

### Supported by default (not forks)

- **Dimensions** (most-permissive defaults): `tone` — reuse the severity scale
  `neutral|info|positive|caution|critical` *and* add a categorical/brand tone (Ant Tag free color,
  Carbon category hues carry no severity); `emphasis` — `subtle|solid|outline`, default `subtle`
  (least visual weight); `shape` — `badge|pill|tag`, reusing Status Indicator's `shape` vocabulary.
- **a11y** — a decorative label is inert text; it earns an accessible-name when it conveys meaning
  beyond color, and it is *not* announced via Live Region Status (no state change to announce). These
  compose existing intents, so no exclusion → not a fork.

## Per-fork classification (the 7-question pass)

- **Layer?** Intent layer (semantic, UX-only) — a WE standard, not impl. **Protocol or intent?**
  Intent, *not* a protocol: a decorative label has no swappable runtime behavior and no provider — its
  tone/text is static author input (contrast Status Indicator, which is the visual member of a
  protocol). **Expose the whole axis?** Yes — tone/emphasis/shape are dimensions. **Fixed mechanic or
  dimension?** Interactivity is *neither baked nor a dimension here* — it is composed from Action/
  Selection (separation bias). **DI-injectable?** No registry/provider. **Most-permissive default?**
  tone `neutral`, emphasis `subtle`, static (non-interactive). **Seam between intents?** Composes
  Action (clickable), Selection (filter), accessible-name (label), surface/theme (tone→token);
  distinct from Status Indicator (lifecycle), Notification Marker (count/dot overlay), Expressive
  Symbol (glyph).

## Fork 1 — Home: mint a distinct decorative intent vs widen Status Indicator

*Fork exists:* two coherent homes that cannot coexist — the decorative badge maps to exactly one
intent. The excluded branch (widen) is **flawed**: it dilutes Status Indicator's defining identity —
its provider/transition/`transition`-event machinery would have to become optional and hollow to admit
a label that has no lifecycle, falsifying its own one-line summary ("the visual member of the Web
Lifecycle protocol").

- **A — Mint a distinct decorative label/tag intent. ✅ (default, med-high)** Separate-and-decouple
  bias + the in-repo precedent: Notification Marker already split family 3 off the overloaded "badge"
  by semantic source (#009). The decorative case is the unhomed remainder; it earns its own home.
  *Residual:* a thin intent could be seen as over-fragmentation — answered by the recurrence across 8
  systems and the existing 3-way split.
- **B — Widen Status Indicator to cover the decorative case.** One intent, fewer surfaces. *Excluded
  because* it forces lifecycle machinery optional, hollows the `affordance` axis, and breaks the
  protocol-member identity — the dilution the survey's Finding 3 traces.

## Fork 2 — Interactivity: decorative-only + compose vs own the axis

*Fork exists:* two coherent designs that cannot both hold — either the intent owns an interactive axis
or it doesn't. The excluded branch (own the axis) is **flawed**: clickable/closable/filter behavior is
*already* homed in Action and Selection, so baking it in **duplicates** existing intents and violates
the separate-and-decouple bias.

- **A — Decorative-only; compose Action (clickable) / Selection (filter chip) / a remove Action
  (closable). ✅ (default, med-high)** Mirrors Reaction→Expressive Symbol and Text-Formatting→button/
  droplist — WE's standing composition pattern. The intent stays a pure presentational label.
  *Residual:* authors of a closable tag must compose two intents — acceptable, matches every other
  composed surface.
- **B — Own a `closable`/`clickable`/`filter` axis on the intent.** One-stop component, matches
  Ant/MUI ergonomics. *Excluded because* it re-implements Action/Selection inside the intent.

## Fork 3 — Name

*Fork exists:* multiple coherent names; they are mutually exclusive (one id is minted). No branch is
*broken*, so this is the weakest fork — but per #009's naming precedent it still gets researched
options + a default rather than a bare "human call."

- **A — `tag` / "Tag Intent". ✅ (default, med)** Ant + Carbon use "Tag" for exactly this decorative/
  categorical label; non-colliding and widely understood. *Residual:* "tag" can read as
  *folksonomy/tagging-input* — disambiguated by the intent summary.
- **B — `badge`.** Most literal to shadcn, but **collides**: `badge` is already the `shape` token on
  Status Indicator (`:18`) and the count-marker family — rejected.
- **C — `label`.** Collides twice — with the form-label / accessible-name intent *and* with the HTML
  `<label>` element itself (a decorative tag is not a form caption); doubly rejected. **D — `lozenge`.**
  Atlassian-idiomatic but obscure outside it.

---

## Ruling — ratified 2026-06-20

All three forks resolved to **A** (red-team passed inline; the excluded branches are genuinely flawed
— widening *dilutes* Status Indicator, owning interactivity *duplicates* Action/Selection):

- **Fork 1 — Home: A — mint a distinct decorative intent.** Family-1 (decorative/categorical label) is
  the unhomed remainder; it earns its own home, mirroring the Notification-Marker split (#009).
- **Fork 2 — Interactivity: A — decorative-only; compose Action / Selection / remove-Action.** No
  baked interactive axis.
- **Fork 3 — Name: A — `tag` ("Tag Intent").** `label` doubly rejected (form-label intent + `<label>`
  element); `badge` collides with the `shape` token; `lozenge` obscure.

**Seed spec for the build** — dimensions (most-permissive defaults): `tone`
(`neutral|info|positive|caution|critical` + categorical/brand tone, default `neutral`), `emphasis`
(`subtle|solid|outline`, default `subtle`), `shape` (`badge|pill|tag`, reusing Status Indicator's
vocabulary). a11y: inert text, earns an accessible-name when it conveys meaning beyond color, not
announced via Live Region Status.

Build filed as **#1325** (mint the `tag` intent via `/new-standard`). Surfaced by reproduction #1243,
feeds gap-sweep #315.
