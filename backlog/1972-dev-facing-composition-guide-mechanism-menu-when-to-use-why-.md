---
kind: story
size: 3
parent: "1963"
status: resolved
dateOpened: "2026-06-29"
dateStarted: "2026-06-30"
dateResolved: "2026-06-30"
tags: []
---

# Dev-facing composition guide — mechanism menu, when-to-use, why-not-is= FAQ

Surface #1963's dev-facing menu as a guide: the mechanism catalog with pros, cons and when-to-use, with STRONG worked examples of directive vs behaviour (behaviour is first-choice; a directive only for pre-connection or region control such as ViewIf and ForEach), the why-not-is= and is=-vs-transient FAQ (transient is broader: multi-root, polymorphic, single-substrate), and the FIXED, CONFIGURABLE, FREEDOM framing. These questions will be asked. Ratified under #1963.

## Resolution

Authored the dev-facing guide as a new **"Dev guide: which mechanism, and why"** section
appended to the canonical composition page —
`we:src/_includes/research-descriptions/dom-less-composition.njk` (rendered at
`/research/dom-less-composition/`, the dev-facing companion to #1963's catalog). It carries,
in order: the FIXED / CONFIGURABLE / FREEDOM two-angles framing; the mechanism menu (behaviour,
directive, transient, persistent light-DOM CE, `display:contents` provider, mixin) with
pros/cons/when-to-use; a worked directive-vs-behaviour example (behaviour first-choice; directive
only for `ViewIf` gating / `ForEach` repetition / region transform — proven by the
attach-after-connect lifecycle argument); the **why-not-`is=`** FAQ (every job dominated by
transient / `CustomAttribute` / family-B) and the **`is=`-vs-transient** FAQ (transient is broader:
multi-root, polymorphic, single-substrate); and the 5-point acceptance bar with the current
per-case verdicts. All grounded in the codified rubric in `we:docs/agent/block-standard.md#composition-rubric`.
