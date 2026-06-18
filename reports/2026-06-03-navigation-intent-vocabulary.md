# Navigation Intent Vocabulary — From One Dimension to Five

**Date**: 2026-06-03
**Point**: The Navigation Intent was the thinnest in the catalog (one `structure` axis) while the Router block already implemented scroll, history, transition, and leave-guard behaviors with no UX vocabulary to name them — this expands the intent to five orthogonal, standards-grounded dimensions.
**Research page**: `/research/navigation-intent-vocabulary/`
---

## Question

What standard do we have around navigation, and is its UX vocabulary complete? The
[Navigation Intent](../src/_data/intents.json) (`navigation`) carried a single dimension —
`structure` = hierarchical | lateral | linear — while its sibling intents carry five or six
(`modal` 5, `anchor` 6, `loader` 5, `validation` 5). Meanwhile the
[Router block](../src/_includes/block-descriptions/router.njk) already ships `scroll`,
`transition`, `route:guard:leave`, and Navigation-API history control. The intent
**under-described its own implementation**: a Tabs or Wizard block could declare its IA shape
but had no vocabulary to declare scroll behavior, history contribution, transition direction,
or leave-guarding. What other separable navigation-UX concerns deserve to be first-class
dimensions?

## Recommendation

Expand `navigation` from one dimension to **five**, and bump its status `concept → draft`. Each
added dimension passes the intent bar: user-perceivable behavior, a closed set of 2–4 named
values, orthogonal to `structure`, and grounded in a web platform standard.

| Dimension | Values | Grounding | Disposition |
|---|---|---|---|
| `structure` (kept) | hierarchical · lateral · linear | IA convention | kept; description de-overloaded |
| `history` | push · replace · none | Navigation API `navigate({history})` | **add — strongest fit** |
| `scroll` | auto · top · preserve · manual | `NavigateEvent.intercept({scroll})` + History `scrollRestoration` | **add** |
| `transition` | directional · fade · none | View Transitions API + transition *types* | **add — direction only; feel defers to `motion`** |
| `guard` | free · confirm · blocked | Navigation `intercept`/`preventDefault` + `beforeunload` | **add** |
| `persistence` | url · memory · session | URL vs History `state` (TanStack convention) | **add — softer grounding** |

**Compose by reference, do not own:**

- **Prefetch eagerness** → already the [`prefetch`](../src/_data/intents.json) intent
  (`eagerness: viewport|hover|interaction`). Navigation composes it; the vocabulary stays there.
- **Animation feel** (spring / instant / reduced) → already [`motion`](../src/_data/intents.json)
  (`physics: natural|immediate|reduced`, honors `prefers-reduced-motion`). Navigation's
  `transition` owns *direction* only — `motion` can't, because it doesn't know a navigation is
  "forward."
- **Focus-on-route-change** → a11y-critical, but the correct answer is opinionated (move to the
  new view's main heading, per WAI-ARIA APG) and it overlaps
  [`focus-delegation`](../src/_data/intents.json). Navigation declares the `focusReset` contract
  by reference; the closed value set stays with a focus-owning intent. Do not duplicate.
- **`aria-current`** (page / step / location) → *derived from* `structure` (`page` for
  hierarchical/lateral, `step` for linear), so it fails the orthogonality test. The structure
  contract specifies the mapping; it is not a separable axis.

**Out entirely (implementation/config, not UX preference):** nested/parallel routing, base path,
hash-vs-history router mode, deep-link 404 fallback, cross-document-vs-same-document execution
mode, lazy view loading (eagerness → `prefetch`; pending UX → `loader`).

## Key Findings

1. **`history` is the textbook fit.** `navigate(url, { history: "auto" | "push" | "replace" })`
   is a named platform enum that directly determines what the Back button does. We expose
   `push | replace | none`; `none` covers transient view changes that should not enter the back
   stack. ([MDN: Navigation.navigate](https://developer.mozilla.org/en-US/docs/Web/API/Navigation/navigate))

2. **`scroll` is the platform's binary knob, refined for users.** The API gives
   `intercept({ scroll: "after-transition" | "manual" })` and History `scrollRestoration =
   "auto" | "manual"`. The *user-facing* refinement of "what manual does" is `top` vs `preserve`
   — exactly the abstraction an intent adds over the raw API. React Router's `<ScrollRestoration>`
   exists because the SPA default isn't enough — evidence the choice is real.
   ([MDN: NavigateEvent.intercept](https://developer.mozilla.org/en-US/docs/Web/API/NavigateEvent/intercept),
   [History.scrollRestoration](https://developer.mozilla.org/en-US/docs/Web/API/History/scrollRestoration))

3. **`transition` directionality has no other home.** Browser-initiated Back navigations (back
   button / edge-swipe) carry **no** View-Transition type, so directional animation must be
   *derived* from history-traversal direction. `motion` owns feel (easing, reduced-motion);
   direction is a navigation concept `motion` structurally cannot know. We keep the value set to
   `directional | fade | none` and defer timing/easing to `motion`.
   ([MDN: View Transition API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API),
   [Chrome: same-document VT](https://developer.chrome.com/docs/web-platform/view-transitions/same-document))

4. **`guard` is doubly grounded.** "Can the user be stopped before leaving" is standardized on
   *both* the Navigation API (`navigate` event `canIntercept` + `preventDefault`/`intercept`) and
   `beforeunload` (cross-document / tab-close). Cross-framework convergence (React Router
   `useBlocker`, Vue `beforeRouteLeave`) corroborates. Values: `free | confirm | blocked`. The
   in-app "unsaved changes" prompt composes with [`modal`](../src/_data/intents.json).
   ([MDN: beforeunload](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event))

5. **`persistence` is the real "is this deep-linkable?" choice** — most relevant exactly where
   `structure` is `lateral` (is the active tab in the URL?) or `linear` (is the wizard step
   shareable?). Grounded in the WHATWG URL-vs-History-`state` split: `url` (path/search, survives
   refresh & share), `session` (History `state`, survives traversal not share), `memory`
   (in-memory only). Weakest grounding of the five — a convention split rather than a single enum
   — flagged as an open point.
   ([MDN: Working with the History API](https://developer.mozilla.org/en-US/docs/Web/API/History_API/Working_with_the_History_API))

6. **The intent was lagging the block, not the other way around.** Every added dimension maps to
   a Router attribute that already exists: `scroll` → `<route-view scroll>`, `transition` →
   `<route-view transition>`, `guard` → `route:guard:leave`, `history` → Navigation API
   `history` option. Documenting the vocabulary closes a design-first gap, it does not request new
   implementation.

## Open Points (registered in backlog)

- **`nav-persistence-grounding`** 🔶 DECIDE — `persistence` rests on a URL-vs-History-`state`
  convention, not a single platform enum. Confirm the three-value set (`url | memory | session`)
  or collapse to `url | memory`.
- **`nav-transition-vs-motion`** ⚠ RECONCILE — confirm the boundary: `navigation.transition` owns
  direction (`directional | fade | none`); `motion.physics` owns feel. Ensure no overlap creeps
  in when a block reads both.
- **`nav-focus-reset-home`** 🔶 DECIDE — focus-on-route-change should be referenced, not owned.
  Decide whether the closed value set (`heading | target | preserve | auto`) lives as a new axis
  on [`focus-delegation`](../src/_data/intents.json) or stays an APG-cited prose contract.

## Files Created/Modified

| File | Action |
|---|---|
| `we:reports/2026-06-03-navigation-intent-vocabulary.md` | Created — this report |
| `we:src/_data/researchTopics.json` | Added `navigation-intent-vocabulary` topic |
| `we:src/_includes/research-descriptions/navigation-intent-vocabulary.njk` | Created — research write-up |
| `we:src/_data/intents.json` | `navigation`: split `structure`, added `history`/`scroll`/`transition`/`guard`/`persistence`, status `concept → draft`, summary + description rewrite |
| `we:src/_data/semantics.json` | Added `deep link`, `view transition`, `history disposition` |
| `fui:src/_data/blocks.json` | Router cross-check (no change needed / dimension-attribute map noted) |
| `we:backlog/057-nav-persistence-grounding.md` | Created — open point |
| `we:backlog/058-nav-transition-vs-motion.md` | Created — open point |
| `we:backlog/056-nav-focus-reset-home.md` | Created — open point |
