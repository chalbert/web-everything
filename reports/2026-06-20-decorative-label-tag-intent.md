# Decorative label/tag intent vs lifecycle Status Indicator — prior-art survey (#1319)

Prior-art survey grounding decision [#1319](/backlog/1319-decorative-label-tag-intent-distinct-from-lifecycle-status-i/),
surfaced as gap **#6** of the shadcn first reproduction-conformance delta
(we:reports/2026-06-20-1243-shadcn-first-gap-delta.md). shadcn's `badge` maps onto WE's
**Status Indicator** intent (`button→action`, `input→input`, `badge→status-indicator`), but
Status Indicator is *lifecycle-state-driven* — the visual member of the Web Lifecycle protocol,
reading a provider's current state + next transitions. shadcn's badge is a **decorative/standalone
label** with author-supplied tone and no lifecycle. Mapping one onto the other over-constrains it.
This survey gathers how the leading design systems carve the "badge/tag/chip/label" family before
the call, per *design-first.md → step 1*.

## The recurring three-way split in the prior art

Every benchmarked system splits the overloaded "badge" word along a **semantic-source** axis, not a
visual one. Three distinct families recur:

| Family | What supplies the meaning | shadcn | Ant Design | Carbon | Fluent 2 | MUI | Atlassian | Primer | Bootstrap |
|---|---|---|---|---|---|---|---|---|---|
| **Decorative / categorical label** | author-supplied tone/category, static, no provider | **Badge** (default/secondary/destructive/outline) | **Tag** (color, closable) | **Tag** (read/operational, dot-status) | **Badge** (tone variants) | **Chip** (deletable/clickable) | **Lozenge** (subtle/bold appearance) | **Label** / **Token** | **Badge** |
| **Lifecycle / state status** | an entity's state machine | — | **Badge** (status dot: success/processing/error/warning/default) | status `Tag` w/ dot | **PresenceBadge** | — | Lozenge w/ status appearance | — | — |
| **Count / dot notification marker** | a count overlaid on a host element | — | **Badge** (count/dot overlay) | — | **CounterBadge** | **Badge** (count) | — | **CounterLabel** | **Badge** (pill count) |

Reading: the word "badge" lands in a *different* family per system — shadcn's Badge is family 1
(decorative), Ant's Badge is family 3 (count overlay), Fluent has all three under different names.
The stable concept is not the word but the **semantic source**.

## WE already split this family once — by semantic source

WE has already separated the **count/dot notification marker** (family 3) into its own intent:
**Notification Marker** (`we:src/_data/intents/notification-marker.json`) — "the unread/attention
MARKER family … a marker, not a message — distinct from the Feedback / System Notification render
surfaces. Spun out of #009." So the WE precedent is exactly the split this decision proposes: when
one industry word ("badge") carries multiple semantic sources, WE homes each source in its own
intent rather than overloading one. Family 3 is already carved; **Status Indicator owns family 2
(lifecycle); family 1 (decorative) is the unhomed remainder.**

## Why the decorative case does not fit Status Indicator

Status Indicator (`we:src/_data/intents/status-indicator.json`) is defined *by* its lifecycle tie:

- summary (`:5`): "Canonical display of a domain entity's **lifecycle state** … plus the available
  next transitions … **The visual member of the Web Lifecycle protocol.**"
- description (`:35`): "It is the visual member of the Web Lifecycle protocol: it **reads the same
  lifecycle provider** and renders the current state plus … the moves available from here."
- `affordance` dimension (`:27`): `display-only | actionable` — actionable "surfaces the available
  next **transitions** (from the provider) as controls."
- `events` (`:36`): `["transition"]`.

A decorative label has **no provider, no transitions, no `transition` event, and no state machine**.
Its tone is author-asserted (`<Badge variant="secondary">`), not computed from a lifecycle. Widening
Status Indicator to cover it would force its provider/transition machinery to be optional, hollow out
the `affordance` axis, and falsify its own one-line identity ("the visual member of the Web Lifecycle
protocol"). That is the "over-constrains" the gap recorded — but read the other way: it is Status
Indicator that gets *diluted*, not just the badge that gets over-constrained.

## The decorative label's own axes (from the prior art)

A purely decorative label converges on three declarative dimensions across the systems:

- **tone** — semantic color: shadcn `default|secondary|destructive|outline`, Atlassian
  `default|success|removed|inprogress|new|moved`, Carbon's category palette. Splits into *severity*
  tones (reusable with Status Indicator's `neutral|info|positive|caution|critical`) and *categorical/
  brand* tones (arbitrary category color — Ant Tag's free color, Carbon's category hues) that carry no
  severity.
- **emphasis** — visual weight: Atlassian `subtle|bold`, shadcn `default(solid)|secondary|outline`.
- **shape** — `badge`(boxed) `|pill` `|tag`(notch) — overlaps Status Indicator's `shape` vocabulary.

## The interactivity seam — compose, don't bake

Several systems fold *interactive* behavior into the same component: Ant Tag is closable, Carbon has
read/operational tags, Material chips filter, MUI Chip is deletable/clickable, Primer Token is
removable. But those behaviors are **already WE intents**: a clickable label is **Action**
(`we:src/_data/intents/action.json`), a filter chip is **Selection**
(`we:src/_data/intents/selection.json`), a removable token composes a remove **Action**. WE's standing
pattern is to keep the new intent *decorative-only* and **compose** the interaction intent — exactly
how **Reaction** composes **Expressive Symbol** (`we:src/_data/intents/reaction.json`,
`we:src/_data/intents/expressive-symbol.json`) and **Text-Formatting Controls** composes button/droplist. Baking a
`closable`/`clickable` axis into the decorative intent would duplicate Action/Selection and violate
the separate-and-decouple bias.

## Naming

"Badge" is unavailable — it is the *shape* token on both Status Indicator (`:18`, `shape: badge`) and
the count-marker family. Candidates from the prior art: **Tag** (Ant, Carbon — connotes
categorical/decorative, widely understood), **Label** (Primer — collides with form-label /
accessible-name), **Lozenge** (Atlassian — idiomatic but obscure), **Decorative Badge** (descriptive
but reuses the overloaded word). **Tag** is the cleanest non-colliding name.

## Recommendation (to ratify in #1319)

1. **Mint a distinct decorative label/tag intent** (Fork 1, med-high) — the separate-and-decouple
   bias plus the in-repo precedent (notification-marker already split family 3 by semantic source).
   Widening Status Indicator is the *flawed* branch: it dilutes the lifecycle contract that defines
   the intent.
2. **Decorative-only; compose Action/Selection for interactivity** (Fork 2, med-high) — mirrors
   reaction→expressive-symbol; a closable/clickable axis would duplicate existing intents.
3. **Name it `tag` ("Tag Intent")** (Fork 3, med) — "badge" is taken by the shape token; "tag" is the
   common non-colliding decorative name.

Dimensions are *supported by default* (not forks): `tone` (reuse the severity scale + add a
categorical/brand tone), `emphasis` (`subtle|solid|outline`, default `subtle`), `shape`
(`badge|pill|tag`, reuse Status Indicator's vocabulary). a11y: a decorative label is inert text
(accessible-name when it conveys meaning beyond color); it does **not** announce via
live-region-status (no state change to announce).
