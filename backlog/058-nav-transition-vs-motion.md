---
type: decision
workItem: story
size: 2
status: resolved
dateOpened: "2026-06-03"
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
graduatedTo: none
tags: [navigation, motion, intent, view-transitions, composition]
relatedReport: reports/2026-06-03-navigation-intent-vocabulary.md
relatedProject: webintents
crossRef:
  url: /intents/navigation/
  label: Navigation Intent
---

# Keep the navigation `transition` ↔ motion `physics` boundary clean

The Navigation Intent's `transition` dimension (`directional` | `fade` | `none`) owns *direction* only; the [Motion intent](/intents/motion/)'s `physics` (`natural` | `immediate` | `reduced`) owns *feel* (easing, duration, `prefers-reduced-motion`). The split exists because direction is derived from history-traversal direction — a fact Motion structurally cannot know — while feel is a global motion preference independent of navigation.

⚠ RECONCILE: when a block reads *both* intents to drive a View Transition, confirm there is no overlap or contradiction (e.g. `transition: none` vs a non-`reduced` `physics`). Decide the precedence rule: `transition: none` should suppress the animation entirely regardless of `physics`; `reduced` physics should degrade a `directional` transition to a minimal/instant change, not cancel the navigation. Document the resolution in whichever block first composes both (likely Router or a Tabs block).

## Resolution (2026-06-11)

The two dimensions are **orthogonal, not ranked**: `transition` owns *whether/which direction*, `physics` owns *duration/easing and whether decorative motion plays at all*. The Router block — the first/only block composing both — resolves the overlaps with three rules:

1. **`transition: none` ⇒ no view transition.** `startViewTransition()` is skipped regardless of `physics`; instant swap.
2. **`physics ∈ {reduced, immediate}` ⇒ collapse to an instant/minimal swap.** Direction becomes moot. `reduced` is preference-driven (`prefers-reduced-motion`), `immediate` is perf-driven (<16ms) — same outcome by design. (Folding `immediate` in with `reduced` extends the original note, which named only `reduced`.)
3. **Otherwise** (`physics: natural`) ⇒ full animation in `transition`'s direction.

**Invariant above all three: the route/DOM change always commits** — `physics`/`transition` gate only the decorative wrapper, never the navigation. Tabs and any future composer inherit this by reference.

Documented in [Router block](/blocks/router/) → *Transition direction vs Motion feel* (`src/_includes/block-descriptions/router.njk`).
