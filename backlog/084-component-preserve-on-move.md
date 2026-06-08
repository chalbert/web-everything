---
type: decision
workItem: story
size: 2
parent: "076"
status: open
dateOpened: "2026-06-06"
tags: [webcomponents, component, declarative, lifecycle]
relatedReport: reports/2026-06-03-declarative-component-element.md
relatedProject: webcomponents
crossRef: { url: /blocks/component/, label: Component block }
---

# DC-15 — Declarative state-preserving moves (`preserve-on-move`)

`Element.moveBefore()` relocates a connected node **without** disconnecting it, but a custom element only gets state preservation (focus, media playback, iframes, shadow tree) if it **defines `connectedMoveCallback`** — an imperative-only opt-in with no HTML form today.

**Recommendation (implemented, tier 2):** a boolean **`preserve-on-move`** attribute emits an empty `connectedMoveCallback()` in the lowered class. The opt-in *is* the method's presence, so an empty body is sufficient and the feature is **declarative-complete** — the author writes no JS. The method is added conditionally so other elements keep default disconnect/reconnect semantics.

**Runtime note.** happy-dom lacks `moveBefore`, so the conformance suite asserts (a) the generated source contains `connectedMoveCallback() {}` and (b) the runtime twin defines the method on the prototype only when requested. Real browsers exercise the atomic move.

**Open edges:** whether a non-empty hook (e.g. a `behavior`/`extends` callback, DC-5) should ever be wired here; spelling (`preserve-on-move` vs `atomic-move` vs `keep-alive`).
