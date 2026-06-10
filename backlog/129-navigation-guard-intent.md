---
type: decision
workItem: story
size: 5
status: open
dateOpened: "2026-06-06"
tags: [intent, navigation-guard, beforeunload, unsaved-work, async, ux, harvest]
relatedProject: webintents
crossRef: { url: /intents/background-task/, label: Background Task Intent }
---

# Navigation guard — warn before leaving with in-flight or unsaved work (candidate intent)

Harvested while authoring the [Background Task Intent](/intents/background-task/) (#113). That intent's `navigationGuard` dimension warns the user before they navigate away or close while a task is still in flight. But **"warn before you leave with work still in flight" is the same paradigm as "warn before discarding unsaved form edits"** — both arm the `beforeunload` prompt and an in-app route-leave confirm based on dirty/in-flight state.

Rather than redefine that behavior inside every intent that needs it (Background Task, Validation/forms, an editor with unsaved changes, …), pull it out as its own **composable intent**: a single contract for *guarding a navigation against loss of state*, which the others reference.

Candidate shape (to design):
- The **condition** that arms the guard (dirty state, in-flight async, custom predicate).
- The **two surfaces** it mediates: the native `beforeunload` prompt (cross-document / close) and the SPA route-leave confirm (same-document) — these are different primitives that must present as one contract.
- Relationship to the [Background Task Intent](/intents/background-task/) (`navigationGuard` becomes a *consumer* of this) and to forms/validation.
- Browser-standard grounding: the `beforeunload` event, the Navigation API's `navigate` event (`intercept`/cancel), and `History`/`popstate`.

Follow the canonical authoring method ([design-first.md](../docs/agent/design-first.md)) — research prior art, verify overlap, term-first semantics — before writing JSON.
