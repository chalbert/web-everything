# Scroll / Observation — survey & fork analysis (`webscroll`, gap #7)

**Date:** 2026-06-11 · **Item:** [#014](/backlog/014-gap-7-webscroll-project/) · **Research topic:** [web-scroll-observation](/research/web-scroll-observation/)

## Why this survey exists

Gap #7 names a sprawling surface — `IntersectionObserver`, scroll-driven animations
(`animation-timeline`), CSS scroll-snap, virtualization, infinite scroll,
`content-visibility`, scroll restoration — and asks one structural question: **is "Scroll /
Observation" a Web Everything *project* (a new top-level standard like
[webpositioning](/projects/webpositioning/)), a new *intent*, or neither?** No design exists
yet. This survey gathers the web-platform prior art per design-first step 1 so the call is made
against the real platform shape, not a hunch — and reconciles it with the **already-shipped**
`advance:auto` scroll-trigger seam so we do not create two homes for scroll-triggering.

The load-bearing finding up front: **the platform does not model "scroll" as one domain — it
ships several independent primitives, each already a distinct concern WE either owns or should
own as a small intent.** "Scroll" is a *substrate*, like "the network" or "the DOM" — not a
cohesive standard. So the recommended answer to "project vs intent" is **neither a monolithic
project nor one intent**: decompose the surface onto its native seams, most of which already
have homes.

## The platform landscape (prior art)

### 1. `IntersectionObserver` — "is this in view", the trigger primitive

The platform's own async, off-main-thread answer to "did element X enter/leave a viewport (or
scroll-margin around it)?". It replaced scroll-event + `getBoundingClientRect` polling.
Critically, **WE already consumes it in three separate places**, each correctly scoped to a
*different* intent:

- **Auto-advance / infinite scroll** — the Collection Operations `advance:auto` dimension
  ([we:intents.json:1622](../src/_data/intents.json#L1622)) fetches the next slice at a zero-height
  *scroll sentinel* observed by IntersectionObserver ([we:semantics.json:783](../src/_data/semantics.json#L783),
  [fui:blocks.json:2354](../src/_data/blocks.json#L2354)).
- **Viewport-eager prefetch** — the Prefetch intent's `eagerness: viewport`
  ([we:intents.json:419](../src/_data/intents.json#L419)) triggers a speculative fetch when a link
  scrolls into a `rootMargin` band ([fui:blocks.json:1484](../src/_data/blocks.json#L1484)).
- **Visibility-gated trait activation** — a trait can activate *when its host enters the
  viewport* rather than on `connectedCallback`, driven by IntersectionObserver and framed
  explicitly as the scripting analogue of `content-visibility: auto`
  ([we:traits.json:78](../src/_data/traits.json#L78), [we:traits.json:83](../src/_data/traits.json#L83)).

This is the crux of fork 1: **IntersectionObserver is a shared mechanism, not a domain.** Three
intents already use it without sharing an owner, and that is *correct* — each expresses a
different UX intent (fetch-more vs prefetch vs activate) that merely *happens* to need the same
trigger. A "webscroll" intent that "owns scroll-triggering" would have to claw all three back
into one home, contradicting separation-of-concerns. The platform agrees: there is no "scroll
observation" API umbrella; there is one observer used for many purposes.

### 2. Scroll-driven animations (`animation-timeline`, `scroll()`, `view()`) — CSS, not JS

A 2024 CSS feature: `animation-timeline: scroll()` / `view()` drives a keyframe animation's
*progress* from scroll position, running **off the main thread** with no JS. This is
categorically different from *scroll-triggered* (fire-once-on-enter, IntersectionObserver's
job): scroll-driven animations play/pause/reverse continuously with the scrollbar. It is a
**styling/motion** concern — it belongs with WE's motion/transition vocabulary, not a scroll
domain. Native-first verdict: defaults map to `scroll()`/`view()` timelines; a JS library
(GSAP ScrollTrigger) is an opt-in enhancement for unsupported browsers.

### 3. CSS scroll-snap — declarative, pure CSS

`scroll-snap-type` / `scroll-snap-align` snap scrolling to item boundaries (carousels,
paginated panes). Entirely declarative CSS with native `scrollsnapchange`/`scrollsnapchanging`
events (2024+). No JS observation needed. This is a **layout/carousel** concern — it lands on a
future carousel block, not a scroll domain.

### 4. `content-visibility: auto` — rendering skip, the native virtualization floor

`content-visibility: auto` + `contain-intrinsic-size` lets the browser skip rendering
off-screen subtrees while preserving correct scroll height — native, zero-JS "virtualization
lite". WE's [Windowed Collection](/intents/windowed-collection/) intent
([we:intents.json:332](../src/_data/intents.json#L332)) is the JS-virtualization escalation above
this native floor. we:traits.json explicitly names `content-visibility: auto` as the rendering
analogue of its visibility-gated activation ([we:traits.json:83](../src/_data/traits.json#L83)).
**Virtualization already has a home** (Windowed Collection); a scroll project would duplicate it.

### 5. Scroll restoration — `History.scrollRestoration`, the navigation seam

`history.scrollRestoration = 'manual' | 'auto'` ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/History/scrollRestoration))
hands the app control of scroll position across history navigation — the classic infinite-scroll
back-button problem (the listing snaps to the bottom of a too-short page before items rehydrate;
[Chrome blog](https://developer.chrome.com/blog/history-api-scroll-restoration)). This is a
**navigation/routing** concern. Collection Operations already binds the related URL-state seam
to the History API via its `urlSync` dimension ([we:intents.json:1630](../src/_data/intents.json#L1630)),
warning that `advance:auto` is "only advisable when this is on, else the footer and back button
break". Scroll restoration is the routing layer's job (a Router/Navigation concern), not a new
scroll standard.

### 6. `scrollend` event — the long-missing "scroll settled" signal

`scrollend` (2024) finally fires when scrolling *stops*, replacing debounced `scroll` hacks.
It is a low-level event primitive, not a domain — consumed by whichever concern needs
"scrolling settled" (snap commit, lazy-reveal). No ownership question.

### Synthesis: there is no native "scroll domain"

| Native primitive | UX concern it serves | WE home (current or proposed) |
|---|---|---|
| `IntersectionObserver` | fetch-more, prefetch, activate-on-view | **already 3 intents** (Collection Ops, Prefetch, Traits) |
| `animation-timeline`/`scroll()`/`view()` | scroll-driven *motion* | motion/transition vocabulary |
| `scroll-snap-*` | carousel / paginated panes | future carousel block |
| `content-visibility:auto` + JS windowing | virtualization | **Windowed Collection** (exists) |
| `History.scrollRestoration` | back-button position | Router / navigation |
| `scrollend` | "scroll settled" event | raw event, no owner needed |

Every cell already maps to an existing or clearly-adjacent home. **No residual surface justifies
a `webscroll` project or a monolithic scroll intent.** A project is a top-level *standard* with a
single owner and a `/projects/` tile ([we:projects.json](../src/_data/projects.json)); webpositioning
qualified because anchoring is *one* coherent provider-shaped problem. "Scroll" is not — it is
six unrelated problems that happen to share a scrollbar.

## The forks

### Fork 1 — Project vs intent vs decomposition (the headline call)

**Crux:** does "Scroll / Observation" become a project, an intent, or get decomposed onto its
native seams? The survey shows IntersectionObserver is a *shared mechanism* used by three
already-separated intents ([we:intents.json:1622](../src/_data/intents.json#L1622),
[we:intents.json:419](../src/_data/intents.json#L419), [we:traits.json:78](../src/_data/traits.json#L78)),
and every other scroll primitive already has a home (table above).

- **(A) `webscroll` project.** A top-level standard owning the whole surface. *Rejected:* there
  is no single coherent provider-shaped problem (unlike webpositioning's one anchoring engine);
  it would claw three correctly-separated intents into one home and duplicate Windowed Collection.
- **(B) One monolithic "scroll observation" intent.** Same fatal flaw at the intent layer —
  conflates fetch-more, prefetch, and activation under one UX label they don't share.
- **(C — recommended) Decompose; no new top-level entity.** Confirm each native primitive's
  existing/adjacent home (table above). The *only* genuinely unowned, reusable piece is the
  low-level "is-in-view trigger" mechanism — and that is fork 2.

**Default: (C) decompose. Close the gap as "no project, no monolith — already homed."**

### Fork 2 — The shared IntersectionObserver mechanism: extract a `viewport-presence` intent, or leave it triplicated?

**Crux:** three intents independently wire IntersectionObserver
([fui:blocks.json:1484](../src/_data/blocks.json#L1484), [fui:blocks.json:2354](../src/_data/blocks.json#L2354),
[we:traits.json:81](../src/_data/traits.json#L81)) with the same `root`/`rootMargin`/`threshold`
vocabulary. Is that duplication worth a shared low-level intent?

- **(A — recommended) Extract a thin `viewport-presence` intent** — a *mechanism* intent owning
  only the observe-vocabulary (`root`, `rootMargin`, `threshold`, enter/leave) that the three
  consumers *compose*, exactly as Collection Ops composes Loader/Windowed Collection rather than
  re-implementing them. It does **not** own the UX decision (fetch vs prefetch vs activate) —
  those stay where they are. This dissolves the "two homes for scroll-triggering" risk by giving
  the *trigger* one home and the *intent* three.
- **(B) Leave it triplicated.** Cheapest now; but the same `rootMargin` defaulting bug would have
  to be fixed in three places, and a fourth consumer would copy it again.

**Default: (A) — a thin shared `viewport-presence` mechanism intent that the existing three
consumers compose; UX ownership unchanged.** (Most-flexible default; the restriction — keeping it
inline — would be the regression.)

### Fork 3 — The `advance:auto` seam: who owns it after decomposition?

**Crux:** the dated seam note (2026-06-03) on this item asked whether the Collection Operations
`advance:auto` IntersectionObserver scroll-trigger
([we:intents.json:1622](../src/_data/intents.json#L1622), wired at
[fui:blocks.json:2354](../src/_data/blocks.json#L2354)) stays in `collection-operations` or moves to
this domain. Folds 1+2 answer it cleanly.

- **(A — recommended) `advance:auto` stays a Collection Operations dimension; only the *trigger*
  delegates to `viewport-presence`.** The *intent* ("when the user scrolls to the boundary, fetch
  the next slice") is a pagination/collection UX decision and stays put — infinite scroll is
  `append + auto`, a derived opt-in already correctly modeled. The shared observe-mechanism moves
  to fork 2's intent; the dimension does not move. No two homes: trigger has one, semantics has one.
- **(B) Move auto-advance to the scroll domain.** *Rejected:* it would split pagination across two
  homes and re-open the "infinite scroll is a third mode" confusion the intent explicitly closed.

**Default: (A) — Collection Operations keeps `advance:auto`; it composes the `viewport-presence`
trigger.** Resolves the dated seam.

## Recommendation summary

Close #014 as **"no `webscroll` project, no monolithic scroll intent."** The surface decomposes
onto native seams that already have homes; the single reusable residue is a thin
`viewport-presence` mechanism intent the three existing IntersectionObserver consumers compose.
`advance:auto` stays in Collection Operations and composes that trigger — resolving the dated seam
without two homes.

## Cross-references

- Decision: [#014 — Scroll/Observation project (gap #7)](/backlog/014-gap-7-webscroll-project/)
- Seam: [#062 pagination ↔ windowed-collection](/backlog/062-pagination-windowed-collection-seam/) + 2026-06-03 pagination research
- Composes / adjacent: [Collection Operations](/intents/collection-operations/) ·
  [Windowed Collection](/intents/windowed-collection/) · [Prefetch](/intents/prefetch/) ·
  [Loader](/intents/loader/) · visibility-gated trait activation ([we:traits.json:78](../src/_data/traits.json#L78))
- Sibling gap projects: [#015 view-transitions](/backlog/015-gap-8-view-transitions-protocol/) ·
  [#016 webcommands](/backlog/016-gap-9-webcommands-project/)
