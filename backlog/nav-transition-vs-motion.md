---
type: decision
status: open
dateOpened: "2026-06-03"
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
