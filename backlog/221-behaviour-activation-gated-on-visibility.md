---
type: decision
workItem: story
size: 5
status: resolved
dateOpened: "2026-06-08"
dateStarted: "2026-06-10"
dateResolved: "2026-06-11"
graduatedTo: "project:webtraits"
codifiedIn: "one-off"
tags: [webtraits, webbehaviors, activation-lifecycle, visibility, intersection-observer, native-first]
relatedReport: reports/2026-06-02-lazy-traits-loading.md
relatedProject: webtraits
---

# Behaviour/trait activation gated on **visibility**, not just `connected`

**The thesis (shared with [#222](/backlog/222-inert-dead-zone-behaviour-disable-scope/)):**
`connectedCallback` (being in the DOM) is not a sufficient signal for *when a behaviour should
activate*. Much in-DOM content is present but not yet relevant: collapsed accordions, inactive tabs,
`display:none` modals, sections far below the fold. Today the `CustomAttributeRegistry` observer
keys on **DOM presence, not visibility** — so it upgrades (and, for lazy traits, *loads*) everything
in the tree at `upgrade()`, visible or not. A trait whose host the user may never scroll to still
pays its cost at bootstrap.

**The idea:** let a behaviour/trait declare that it activates **when its host becomes visible**
(enters the viewport) and goes dormant when it leaves — a visibility gate on top of connectedness.
Borrow the native vocabulary rather than inventing it:

- **`IntersectionObserver`** — the platform API for "is this element in view"; the activation trigger.
- **`content-visibility: auto`** — the CSS primitive that already skips *rendering* off-screen
  content; a behaviour gate is the *scripting* analogue and should compose with it.

**Why it's the natural companion to lazy delivery ([#200](/backlog/200-trait-delivery-default-eager-override/)/[#202](/backlog/202-trait-delivery-per-usage-override/)):**
the trait `delivery` dimension governs *when a trait's code arrives*; this governs *when the trait
runs*. #202 added a per-usage **eager** (preload) override; a visibility gate is closer to the
inverse the #202 work deliberately scoped out — "lazier than the default" — but at a *meaningful*
granularity (visible/in-view) rather than the marginal eager→lazy apply-defer. It directly answers
the case raised against the lazy default: the submerged iceberg of in-DOM-but-hidden content that
currently loads at bootstrap regardless.

**Open design questions (this is partly a `decision`):**

- **Default vs. opt-in.** Is visibility-gating a per-trait dimension (like `delivery`), a per-usage
  attribute, or both — mirroring the manifest-default + `<trait>-delivery="eager"` per-usage pattern
  from #202? Recommend the same shape: a trait-author default, a page-author override.
- **Dormant semantics.** Does "not yet visible" mean *don't load the chunk*, *don't apply*, or
  *apply-but-pause*? Lazy + visibility-gated could mean "don't even fetch until in view" — a real
  bundle/runtime win the current observer can't deliver.
- **Re-activation.** Re-run on every re-entry, or activate-once-then-stay? Behaviour-dependent;
  needs a declared policy.
- **Vocabulary.** A reserved attribute (e.g. `<trait>-when="visible"` / a `when` modifier) that does
  not collide with the trait value slot or the `<trait>-delivery` override (#202).

**Scope (when picked up):**

- A visibility gate in `CustomAttributeRegistry` (or a wrapper) using `IntersectionObserver`:
  defer apply (and optionally lazy-load) until the host intersects; document re-activation policy.
- Compose with `delivery` (#200/#202): visibility-gated + lazy = fetch-on-view; visibility-gated +
  eager = apply-on-view from the main bundle.
- Spec section on `/projects/webtraits/` + a conformance demo (a below-the-fold trait that neither
  loads nor applies until scrolled into view).

Companion to [#222](/backlog/222-inert-dead-zone-behaviour-disable-scope/) (the `inert` dead-zone —
the *other* activation gate). Harvested from the #202 discussion (2026-06-08).

## Resolution (2026-06-10)

The four open design questions are decided; recorded as the **Visibility Gate** section of the
webtraits spec (`we:src/_data/traits.json` → `visibility_gate`, rendered on `/projects/webtraits/`).
Mirrors the #222 → #223 split: this `decision` item carries the rulings; the build is spun off as an
agent-ready item.

- **Default vs. opt-in** → two-layer shape like `delivery` (#202) / `inert` (#222): trait-author
  manifest default + page-author per-usage override. Default is the status quo (**activate-on-connect**),
  so the gate is strictly opt-in and non-breaking.
- **Vocabulary** → reserved **`<trait>-when="visible"`**, joining the `-delivery`/`-active` suffix
  family. `when` is a general *activation-trigger* axis (first value `visible`; room for `idle`/media
  triggers later); read at **runtime** like `-active`, not build-time like `-delivery`.
- **Dormant semantics** → falls out of composing with `delivery`, not a separate choice:
  `visible` + **lazy** = **fetch-on-view** (don't `import()` the chunk until intersecting — the real
  win); `visible` + **eager** = **apply-on-view** (defer construction/activation only). "Dormant" =
  *not-yet-activated*, never half-running.
- **Re-activation** → **derived from the existing `activationSurface` axis (#222)**, not declared a
  third time: `ambient` → **recurring** (deactivate on exit / re-activate on re-entry — pausing
  off-screen is the point); `interaction` → **once** (activate-and-stay; don't tear down wiring on
  scroll). Trait author may override. The gate toggles the shared
  `activatedCallback()`/`deactivatedCallback()` lifecycle (#223) via an `IntersectionObserver`,
  composing with the dead-zone's `MutationObserver`.

Build spun off → [#280](/backlog/280-implement-the-visibility-gate-intersectionobserver-activatio/).
Graduated to: `webtraits`.
