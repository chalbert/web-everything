---
kind: decision
size: 3
status: resolved
dateOpened: "2026-06-08"
dateStarted: "2026-06-09"
dateResolved: "2026-06-09"
codifiedIn: "docs/agent/platform-decisions.md#behavior-activation-lifecycle"
tags: [webtraits, webbehaviors, activation-lifecycle, accessibility, inert, dead-zone, native-first]
relatedReport: reports/2026-06-02-lazy-traits-loading.md
relatedProject: webtraits
---

# The `inert` dead-zone — a declarative scope that disables contained behaviours by default

**The thesis (shared with [#221](/backlog/221-behaviour-activation-gated-on-visibility/)):**
`connectedCallback` is not a sufficient activation signal. A second case (beyond visibility) is a
region that is **visible but inactive** — present and painted, but not meant to be live: a preview, a
disabled fieldset, a skeleton, a snapshot, a region behind a not-yet-confirmed gate. Behaviours
inside such a region should default to **dormant**, with a way to override per placement.

**The accessibility vocabulary to borrow (native-first):** the platform already names "visible but
non-interactive" — the HTML **`inert`** global attribute. An `inert` element and its whole subtree
are removed from the tab order, non-clickable, and excluded from assistive-technology *interaction*
while remaining rendered/visible. That is precisely the "dead zone." Related, narrower terms worth
capturing as standard terms: **`aria-disabled`** (semantically disabled, still perceivable/focusable)
and **`aria-hidden`** (removed from the a11y tree, may still be visible) — distinct from `inert`,
which is the interaction-level dead zone we want.

**The idea:** treat an `inert` (or a reserved dead-zone) subtree as a **behaviour-activation
boundary**: traits/behaviours within it register but stay dormant by default — the region disables
them — and a per-usage override re-enables a specific one (mirroring the #202 page-author override
pattern, inverted: the scope disables, the override re-enables).

**Open decisions (this item is the design call):**

- **Reuse `inert` vs. a dedicated attribute.** Leaning reuse: `inert` already means "non-interactive
  subtree," so behaviours honouring it is consistent and free for authors. But `inert` has its own
  focus/AT semantics — does "behaviour dormant" always coincide with "user can't interact"? Decide
  whether to piggy-back on `inert` or introduce a behaviour-specific dead-zone marker that composes
  with it.
- **Default-off vs. opt-in honouring.** Do *all* behaviours go dormant inside the dead zone
  automatically, or only ones that declare they respect it? Auto is simpler and more correct
  (a live behaviour in an inert region is usually a bug), but some behaviours legitimately must keep
  running (e.g. an autosave that should not stop because a preview is shown).
- **Override syntax + conflict-freedom.** A per-usage re-enable (e.g. `<el sortable sortable-active>`
  or a `keep-active` modifier) that does not collide with the trait value slot or the
  `<trait>-delivery` override (#202).
- **Lifecycle.** What fires when a region flips `inert` ↔ live at runtime — activate/deactivate
  callbacks? This couples to #221's dormant/re-activation semantics; align the two.

**Why it matters:** "connected ≠ active" is the unifying insight behind #221 and this item. Capturing
`inert` as the dead-zone primitive grounds the standard in real accessibility vocabulary instead of
invented jargon, and gives authors a declarative way to scope behaviour activation — the disable
counterpart to #202's per-usage enable.

Companion to [#221](/backlog/221-behaviour-activation-gated-on-visibility/) (visibility gate) and the
per-usage override pattern in [#202](/backlog/202-trait-delivery-per-usage-override/). Harvested from
the #202 discussion (2026-06-08).

## Resolution (2026-06-09)

All four open decisions ruled with the user. This item was the design call; the implementation is
the agent-ready successor [#223](/backlog/223-inert-dead-zone-implementation/).

1. **Reuse `inert` — do not invent a parallel marker.** Native-first: `inert` already means
   "non-interactive subtree," it inherits down the tree, and authors get the dead-zone for free.
   `inert` is specifically an *interaction* dead-zone (focus/click/AT); that scopes what auto-honours
   it (ruling 2), it does not justify a separate attribute. `aria-disabled` / `aria-hidden` stay
   documented-but-distinct terms — behaviours do **not** key off them.
2. **Auto-dormant, scoped to interaction-driven behaviours, + a page-author re-enable.** Mirror the
   #200/#202 two-layer shape (trait-author default + page-author override), but resolve the autosave
   counterexample by *meaning*, not a flag: a behaviour that responds to user interaction (sortable
   drag, dropdown open) is definitionally meaningless inside `inert`, so it goes dormant
   automatically; a behaviour that runs independent of interaction (autosave, polling) isn't
   addressed by `inert`'s semantics at all, so it's simply unaffected. The trait declares its
   activation surface; the autosave bug never arises. Genuine exceptions use the per-usage override.
3. **Override syntax `<trait>-active` (presence re-enables), matching the `<trait>-delivery` suffix
   convention** shipped in #202. `<ul sortable sortable-active>` re-enables `sortable` inside an
   inert region. Binds to the named trait, dodges the value slot (`sortable="desc"`), no new
   vocabulary. A bare unscoped `keep-active` is rejected (which trait?).
4. **Factor out a shared `activate()` / `deactivate()` lifecycle, co-owned with #221.** A behaviour
   has two orthogonal states — *connected* (in DOM) and *active* (should run). Both the visibility
   gate (#221) and this dead-zone toggle the *active* state; `connectedCallback` /
   `disconnectedCallback` stay about DOM presence. Runtime detection = a `MutationObserver` watching
   `inert` (and ancestor `inert`, since it inherits). The lifecycle contract is specified once and
   #221 consumes it.

**Net:** the disable-counterpart to #202's per-usage enable, built on native `inert`, sharing #221's
activation lifecycle.

## Progress

**Status:** resolved 2026-06-09 — decision made with the user; build handed to [#223](/backlog/223-inert-dead-zone-implementation/).

**Branch:** docs/standard-authoring-workflow.

**Done:** all four open decisions ruled (reuse `inert`; auto-dormant scoped to interaction-driven
behaviours + page-author re-enable; `<trait>-active` override syntax; shared `activate()`/`deactivate()`
lifecycle co-owned with #221).

**Next:** none for this item — implementation is #223; the shared lifecycle is foundational for #221.
