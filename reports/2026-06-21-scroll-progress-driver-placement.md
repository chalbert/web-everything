# Scroll-driven UI — scroll-progress driver placement survey

Prior-art survey grounding decision [#1407](/backlog/1407-scroll-driven-ui-scroll-progress-scroll-spy-scroll-linked-an/)
(verb-axis straggler of [#1390](/backlog/1390-interaction-paradigm-inventory-verb-axis-gap-lens-find-missi/)).
Per design-first step 1, prior art is gathered before the forks are framed so the dimensions reuse
platform vocabulary.

## The concern

UI driven by scroll *position / progress* — scroll-spy (highlight the active section in nav),
scroll-linked animation (progress bars, reveals, parallax), sticky-on-scroll. WE owns `viewport-presence`
(enter/leave observation) and `animation-orchestration` (intra-element build-ins), but **neither owns
continuous scroll-progress as a driver**.

## Native grounding — CSS Scroll-driven Animations is the substrate

[CSS Scroll-driven Animations Module L1](https://drafts.csswg.org/scroll-animations-1/) converts an
animation's progress from a *time* basis to a *scroll-position* basis. Vocabulary the intent adopts:

- **`animation-timeline`** — the binding property: `scroll()` (anonymous scroll-progress timeline),
  `view()` (anonymous view-progress timeline), `<dashed-ident>` (named), `auto` / `none`.
- **`scroll()`** — progress of a *scroll container* (the whole track). Args: scroller (`nearest` | `root`
  | `self`) + axis (`block` | `inline` | `x` | `y`). The continuous driver for progress bars, parallax,
  sticky-progress.
- **`view()`** — progress of *an element through the viewport*. Args: axis + start/end insets. The
  per-element reveal driver.
- **Named ranges** (the `view()` vocabulary): `cover`, `contain`, `entry`, `exit` (+ `entry-crossing` /
  `exit-crossing`), scoped via **`animation-range: entry 0% cover 50%`**.
- **`scroll-timeline-name` / `-axis`** and **`view-timeline-name` / `-axis` / `-inset`** — the named
  (non-anonymous) form, letting a timeline declared on a scroller drive animation on a *different*
  element.
- Progress is a normalized **0→100% (0..1)** value across the chosen range — the single conceptual
  primitive.

**Support (June 2026):** Chrome/Edge/Opera full; **Safari 26 shipped full support**; Firefox fully
implemented behind a Firefox `about:config` flag
([caniuse](https://caniuse.com/mdn-css_properties_animation-timeline_scroll),
[MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_scroll-driven_animations)). `animation-timeline`
is *silently ignored* by non-supporting engines, so the lowering path is clean: declare intent → emit
native `scroll()` / `view()` → guard with `@supports (animation-timeline: scroll())`, JS fallback
(IntersectionObserver / scroll listener writing a `--progress` custom property, or the WAAPI
`ScrollTimeline` / `ViewTimeline` objects) only where the native property is absent. Continuous
scroll-linked motion is exactly the class `prefers-reduced-motion: reduce` targets, so the intent
**composes `motion`** — reduced ⇒ collapse the animated channel to a static end-state.

## Finding 1 (load-bearing) — continuous scroll-progress is a distinct driver, not an enter/leave boolean

Every consumer in this space consumes a *0..1 progress value*, not a binary in-view flag:
[Motion `useScroll` → `scrollYProgress`](https://motion.dev/docs/react-scroll-animations) is explicitly "a
value between 0 and 1" piped through `useTransform`; [GSAP ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/)
exposes `scrub` + a `progress` 0..1 and adds `pin` / parallax; CSS `scroll()` / `view()` *are* a
normalized progress timeline. This is categorically distinct from `viewport-presence`'s `enter` / `leave`
— IntersectionObserver answers "in or out," it does **not** give a continuous position within the range.
The residual is real and recurs across three independent UX shapes (progress bar, parallax/reveal,
sticky-progress).

## Finding 2 — scroll-spy is a *discrete active-section* concern, not the progress driver

[Bootstrap ScrollSpy](https://getbootstrap.com/docs/5.3/components/scrollspy/) was rewritten onto
IntersectionObserver; community scroll-spy is uniformly IO `threshold` / `rootMargin` picking the active
section. It emits *which section is current* (a discrete winner) — precisely `viewport-presence`'s `enter`
/ `leave` + a "pick the most-present" reducer, **not** a continuous 0..1 driver.

## Finding 3 — sticky / "stuck" state is native and separable

`position: sticky` plus the new
[`scroll-state(stuck: …)`](https://developer.mozilla.org/en-US/docs/Web/CSS/@container) container query
gives stuck-state styling with no JS; Lenis/Locomotive deliberately wrap *native* scroll so `position:
sticky` keeps working. Sticky-on-scroll is a layout/CSS concern that *optionally* feeds the progress
driver (sticky-progress headers), not part of the driver itself. Smooth-scroll/parallax libraries (Lenis,
Locomotive, GSAP, AOS) are *implementations* of the same conceptual driver — FUI-side adapters/resolvers,
not WE vocabulary (impl-is-not-a-standard, minimize-lock-in).

## WE-tree decomposition

- **[we:src/_data/intents/viewport-presence.json](../src/_data/intents/viewport-presence.json)** owns the
  *discrete in/out trigger over IntersectionObserver*: `reference` (`viewport` | `scroll-ancestor`),
  `margin` (`flush` | `anticipatory`), `coverage` (`sliver` | `partial` | `majority` | `full`); events
  `enter` / `leave`. Explicitly "owns the trigger, not the UX decision." **Gives no continuous position.**
- **[we:src/_data/intents/animation-orchestration.json](../src/_data/intents/animation-orchestration.json)**
  owns *intra-element build-in sequencing*: `sequence` (`parallel` | `stagger` | `chain`), `trigger`
  (`on-view` | `on-step` | **`on-scroll`** — glossed "scroll-linked progress (Scroll-driven Animations)"),
  `replay` (`once` | `re-enter`); composes `motion`. It already *names* scroll as a build-in *trigger* but
  does not define the **scroll-progress value/range vocabulary** (`scroll()` / `view()`, `animation-range`,
  axis, named ranges) — it consumes "on-scroll" as an opaque start condition.
- **Precedent — the `web-scroll-observation` research topic** already ruled "the platform ships no scroll
  domain — decompose onto native seams," classified "scroll-driven animations (`animation-timeline` — a
  motion concern)," and carved out *only* `viewport-presence` as the reusable residue. It deliberately left
  the **motion-side continuous driver unbuilt** — that gap is exactly #1407.

**The unowned residual:** a **continuous scroll-progress driver** — a normalized 0..1 timeline value
derived from `scroll()` (track) or `view()` (element-through-viewport), scoped by an `animation-range` over
named ranges on a chosen `axis`. `viewport-presence` gives a boolean edge; `animation-orchestration`
consumes scroll as an opaque trigger but never models the progress/range/axis vocabulary.

## Recommended placement

- **Fork 1 — home of the continuous driver:** a **new `scroll-progress` driver intent** (homed
  `webintents`), composed by `animation-orchestration` and others (~85%). Extending `viewport-presence` is
  the *broken* branch (its charter is the boolean trigger, IntersectionObserver — the wrong native
  substrate for a continuous ScrollTimeline value). Folding the value into `animation-orchestration`
  over-couples — scroll-progress drives non-animation consumers too (scroll-spy nav, a reading-progress
  indicator, sticky-progress), so per bias-toward-separation it earns its own composable home, and
  `animation-orchestration` *composes* it (replacing its opaque `on-scroll` trigger with "driven by
  `scroll-progress`").
- **Fork 2 (sub-fork) — scroll-spy:** a **composition** of existing `viewport-presence` (observe N
  sections) + the consumer choosing the active one — *not* new vocabulary (~80%). Folding discrete
  active-section into the continuous driver is the broken branch (it would mis-model a "pick the
  most-present of N" reducer as a 0..1 value). Watch item: if "which section is active" needs shared
  cross-consumer vocabulary, a thin `viewport-presence` "most-present" selection mode could be warranted.

Net: #1407 builds **one** new intent (`scroll-progress`); scroll-spy and sticky stay compositions of
existing intents + native CSS. Build note (not for ratification): rewire
`animation-orchestration.trigger: on-scroll`'s gloss to cite `scroll-progress`.
