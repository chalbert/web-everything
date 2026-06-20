---
kind: story
size: 3
parent: "150"
status: resolved
dateOpened: "2026-06-09"
dateStarted: "2026-06-09"
dateResolved: "2026-06-09"
tags: [jsx-adapter, dev-experience, authoring-preferences, dialect, lowering, native-first]
relatedReport: reports/2026-06-07-dev-authoring-preferences-architecture-intents.md
relatedProject: webadapters
crossRef: { url: /backlog/150-dev-authoring-preferences-architecture-intents/, label: "Dev-prefs decision (#150)" }
---

# Make the JSX authoring dialect configurable (`class`/`className`, `for`/`htmlFor`, `onclick`/`onClick`)

The agent-ready proof spun out of the [#150](/backlog/150-dev-authoring-preferences-architecture-intents/)
decision: the **first working dev-preference adapter** and a concrete demonstration of the soft-preference
posture (opt-in, lowered, **never forced**, zero lock-in — see the lock-in principle from #150).

The JSX adapter is already a dialect adapter — `class`/`for`/`onclick` is the baked-in HTML-mirror
dialect, with `className`/`htmlFor`/`onClick` tolerated as React-compat aliases. This item exposes the
dialect as a **configurable authoring preference** rather than a hard-coded choice.

## Scope

- Add a dialect preference to the JSX adapter config: `html` (default — `class`/`for`/`onclick`) vs
  `react` (`className`/`htmlFor`/`onClick`). Default stays **`class`** (HTML-mirror, native-first).
- Both dialects continue to be *accepted* on input (tolerant); the preference governs codegen/output and
  any lint/format normalization the adapter emits.
- Demo + conformance-playground coverage showing the same source authored in either dialect.

## Notes

- This is a *soft preference*, not a protocol — violating it offends a convention, it doesn't break
  interop. Keep it opt-in with a sane default; do not force it.
- Defer the lowering-vs-native-check boundary (#150 Q3) and any precedence-with-hand-edited-config
  question (#150 Q4) to implementation — decide them here, in the concrete, not abstractly.
