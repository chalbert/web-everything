---
type: decision
workItem: story
size: 2
parent: "076"
status: resolved
dateOpened: "2026-06-06"
dateResolved: "2026-06-11"
graduatedTo: block:component
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

## Resolution (2026-06-11)
**Keep `preserve-on-move` — ratified; the native-first tension resolves on inspection.** The objection (don't invent a declarative surface the platform exposes only imperatively) does **not** bite here: `preserve-on-move` is a boolean that maps 1:1 to a structural custom-element opt-in, and the feature is *declarative-complete* — the opt-in **is** the method's presence, so the empty `connectedMoveCallback() {}` needs no runtime body. That is the exact ratified pattern of DC-12 `form-associated` (→ `static formAssociated = true`), **not** the deferred DC-14 case (`:state()` seeding is incomplete because states toggle at runtime; this has no runtime component). Providing declarative forms for imperative CE-lifecycle APIs is the whole purpose of the `<component>` block. Spelling fixed to **`preserve-on-move`** (most intent-descriptive). The non-empty-hook open edge (DC-5 `behavior`/`extends`) rides with that item, not this one. Already implemented (tier 2).
