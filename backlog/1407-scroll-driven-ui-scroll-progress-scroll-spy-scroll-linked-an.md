---
kind: decision
size: 3
parent: "099"
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: none
codifiedIn: one-off
tags: [decision, book-candidate, scroll, scroll-driven, scroll-spy, gap, interaction]
relatedReport: reports/2026-06-21-scroll-progress-driver-placement.md
preparedDate: "2026-06-21"
---

# Scroll-driven UI — scroll-progress / scroll-spy / scroll-linked animation: placement

Verb-axis straggler (completeness sweep of [#1390](/backlog/1390-interaction-paradigm-inventory-verb-axis-gap-lens-find-missi/)):
UI driven by scroll *position / progress* — scroll-spy (highlight the active section in nav), scroll-linked
animation (progress bars, reveals, parallax), sticky-on-scroll
([prior-art survey](/research/scroll-progress-driver-placement/)). WE owns
[we:src/_data/intents/viewport-presence.json](../src/_data/intents/viewport-presence.json) (enter/leave
observation) and
[we:src/_data/intents/animation-orchestration.json](../src/_data/intents/animation-orchestration.json)
(intra-element build-ins), but **neither owns continuous scroll-progress as a driver**.

The axis the prep pins to the real tree: a **continuous 0..1 progress value** is categorically distinct
from a boolean in-view edge. The native substrate is CSS Scroll-driven Animations — `animation-timeline:
scroll()` (whole-track progress) / `view()` (element-through-viewport), scoped by `animation-range` over
named ranges (`entry`/`exit`/`cover`/`contain`) on an `axis`; Safari 26 shipped it, Chrome/Edge ship it,
and `animation-timeline` is silently ignored elsewhere (clean `@supports` + JS-fallback lowering). Every
consumer (Motion `useScroll → scrollYProgress`, GSAP ScrollTrigger `progress`/`scrub`) reads a 0..1 value
that `viewport-presence`'s IntersectionObserver `enter`/`leave` cannot give. `animation-orchestration`
already *names* `trigger: on-scroll` but consumes it as an **opaque start condition** — it never models the
progress/range/axis vocabulary. The prior `web-scroll-observation` research topic explicitly carved out
only `viewport-presence` and left this **motion-side continuous driver unbuilt** — that gap is #1407.

### Triage context

- **Kind**: Intent (driver) · **Native grounding**: CSS Scroll-driven Animations (`animation-timeline: scroll()/view()`, `animation-range`, named ranges); `prefers-reduced-motion`; `position: sticky` + `scroll-state(stuck:)`
- **Native-first**: ◆ medium (adopt the CSS vocabulary, lower to native, JS fallback) · **Gap**: ◆ medium · **Effort**: ◆ medium · **Surfaced by**: #1390 (verb-axis straggler)

### Recommended path at a glance

Ratify both rows, or override just the one you'd change. **Confidence** says where judgment is actually needed.

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 · home of the driver** | mint a new **`scroll-progress` driver intent**, composed by `animation-orchestration` | extend `viewport-presence` *(rejected — boolean trigger ≠ continuous driver; wrong substrate)* · fold into `animation-orchestration` *(rejected — over-couples; non-animation consumers)* | **~85%** — continuous progress recurs across 3 UX shapes |
| **2 · scroll-spy (sub-fork)** | a **composition** of `viewport-presence` + a "pick active" reducer (no new vocabulary) | fold into `scroll-progress` *(rejected — discrete winner ≠ 0..1 value)* | **~80%** — IO active-section is already viewport-presence's shape |

## Fork 1 — where does the continuous scroll-progress driver live?

*Fork-existence:* the excluded branch is **"extend `viewport-presence`,"** and it is **broken** — that
intent's charter is the *discrete* `enter`/`leave` trigger over IntersectionObserver (a boolean edge),
which is the wrong native substrate for a *continuous* ScrollTimeline value; forcing both event models into
one intent contradicts its own "owns the trigger, not the UX decision" charter. The coherent branches (new
intent vs fold-into-animation) genuinely diverge on the home, so this is a real either/or.

**Fork 1 (a) — mint a new `scroll-progress` driver intent (recommended, ~85%).** Homed in `webintents`, it
owns the driver vocabulary — `reference` (`scroll()` track vs `view()` element), `axis`, `range` (named
ranges via `animation-range`) — and emits a normalized 0..1 progress value, adopting the CSS Scroll-driven
Animations vocabulary and lowering to native where supported. Like `viewport-presence` it is a *mechanism*
intent: it owns the driver, not the UX decision. `animation-orchestration` *composes* it (its opaque
`on-scroll` trigger becomes "driven by `scroll-progress`").

**Fork 1 (b) — fold the value into `animation-orchestration` (rejected).** Coherent but over-couples:
scroll-progress drives **non-animation** consumers too (scroll-spy nav, a reading-progress indicator,
sticky-progress headers), so per bias-toward-separation it earns its own composable home rather than living
inside the build-in sequencer.

**Fork 1 (c) — extend `viewport-presence` (rejected).** The broken branch above.

*The residual (~15%):* if no consumer beyond animation ever needs the bare progress value, (b) would be
tighter — but scroll-spy and progress-indicators already demonstrate non-animation consumers, satisfying
the recurrence test.

## Fork 2 — where does scroll-spy (discrete active-section) live? *(sub-fork)*

*Fork-existence:* scroll-spy is discrete (one active section); the new driver is continuous (0..1).
Putting scroll-spy *inside* `scroll-progress` is the **broken** branch — it would mis-model a "pick the
most-present of N" reducer as a 0..1 value. The coherent options diverge on whether scroll-spy needs new
vocabulary at all.

**Fork 2 (a) — scroll-spy = a composition of `viewport-presence` (observe N sections) + the consumer
choosing the active one; no new vocabulary (recommended, ~80%).** Bootstrap ScrollSpy is exactly
IntersectionObserver + an argmax the consumer already owns.

**Fork 2 (b) — fold scroll-spy into `scroll-progress` (rejected).** The broken branch above.

**Fork 2 (c) — a separate small `active-section` intent.** Likely overkill — it's `viewport-presence` + an
argmax reducer.

*The residual (~20%):* the watch item is a shared **`active` event *contract*** (an `aria-current`-shaped
signal two independently-authored consumers — e.g. an FUI nav component + a separate content area — can
interoperate on), **not** a reducer/selection mode. No such consumer pair exists yet ⇒ it stays a watch
item, triggered only by a real two-consumer interop need.

### Merit re-derivation (discussion 2026-06-21)

Promoting the residual to a first-class `viewport-presence` "most-present" *selection mode* (so the argmax
isn't re-implemented per consumer) was raised and **rejected on the merits**. The decisive split: the part
that genuinely *recurs and bugs out* in scroll-spy — the last-short-section-can't-reach-top rule, tie-break
order, the activation offset — is **UX policy, not mechanism**. viewport-presence's charter keeps the UX
decision with the consumer; a standardized mode would have to bake one policy (picking a UX winner the
standard shouldn't pick — violates most-flexible-default). The genuinely *shared mechanism* (observe N +
their `coverage` values) viewport-presence already provides, and the divergent policies (docs-sidebar ≠ TOC
≠ form-step) are not a single reducer to hoist — so the anti-triplication rationale doesn't transfer. **Net:
Fork 2a (composition, no new vocabulary) stands; the only standards-worthy residual is the `active` event
contract above, not a reducer.**

> **Ruling — RATIFIED 2026-06-21.** **Fork 1:** mint a new **`scroll-progress` driver intent**
> (homed in `webintents`), owning the driver vocabulary (`reference` = `scroll()`/`view()`, `axis`,
> `range`), emitting a normalized 0..1 value, lowering to native CSS Scroll-driven Animations with a
> `@supports` + JS fallback; `animation-orchestration` *composes* it (its opaque `on-scroll` becomes
> "driven by `scroll-progress`"). **Fork 2:** scroll-spy stays a **composition** of `viewport-presence`
> + a consumer-owned reducer — **no new vocabulary** (the recurring/buggy part is UX policy the charter
> keeps with the consumer; the shared mechanism is already in `viewport-presence`). The only
> standards-worthy residual is a shared **`active` event *contract*** (aria-current-shaped), kept a
> **watch item**, triggered only by a real two-independently-authored-consumer interop need.
> **Red-team:** both attacks (1b fold-into-animation; promote-residual-to-selection-mode) were run and
> **failed** — nothing amended. **Realizing work:** `scroll-progress` intent authoring filed separately;
> sticky-on-scroll stays native (`position: sticky` + `scroll-state(stuck:)`); Lenis/GSAP/AOS = FUI
> adapters, never WE contract.

---

### Supported by default (not forks)

- **Adopt CSS `scroll()`/`view()` as the lowering target** — declare intent, lower to `animation-timeline`
  natively, `@supports` + JS (`ScrollTimeline` / IO) fallback. (native-first)
- **`prefers-reduced-motion` honored by composing the `motion` intent** — reduced ⇒ static end-state / no
  parallax (mirrors `animation-orchestration`).
- **Both `scroll()` (track) and `view()` (element) modeled** as the two reference modes; **most-permissive
  default axis = `block`** with the axis exposed as a dimension.
- **Sticky-on-scroll = native `position: sticky` + `scroll-state(stuck:)`**, not WE vocabulary; only
  sticky-*progress* consumes `scroll-progress`.
- **Smooth-scroll / parallax libraries (Lenis / Locomotive / GSAP / AOS) = FUI-side impl/adapters**, never
  WE contract (impl-is-not-a-standard, minimize-lock-in).

### Realizing work (post-ratification, separately prioritized)

If Fork 1 (a) ratifies: author the `scroll-progress` intent JSON (`reference`/`axis`/`range` dimensions),
rewire `animation-orchestration.trigger: on-scroll`'s gloss to cite it, and add a demo (progress bar +
parallax reveal). File via `/new-standard`. Not part of this placement call.
