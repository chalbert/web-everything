---
kind: decision
status: open
size: 3
locus: frontierui
dateOpened: "2026-06-27"
tags: [custom-state-set, states, declarative-component, native-first]
---

# Declarative custom-state surface: how a <component> declares & toggles ElementInternals.states for :state() styling

Surfaced while working #1794. FUI's declarative `<component>` (`fui:blocks/renderers/component/declarativeComponent.ts`) already maps `ElementInternals` declaratively — `form-associated` → `attachInternals()` and the `default-aria-*` surface (#853). The natural next member is **custom states** (`internals.states` / `CustomStateSet`) so a declarative component exposes internal state styled by native `:state(...)`. The open call is the *shape*: how a declarative `<component>` (no author class body) (a) **declares** its states and (b) **toggles** them at runtime — e.g. a `states="open active"` attr + imperative escape hatch, binding to reactive expressions, or a `state-when` predicate. Decide the surface; #1794's adoption lands on it.

## What you decide
The declarative authoring surface for `CustomStateSet` on `<component>` — declaration syntax + the runtime toggle mechanism — consistent with the existing `form-associated` / `default-aria-*` declarative ElementInternals members.

## Context from the #1794 survey
- `CustomStateSet` (`internals.states`) is currently **unused** anywhere in FUI.
- The ad-hoc host attributes that *looked* like state candidates (`AutoComplete` `resize`/`shift`) are actually **public config** (observed attributes with public getters/setters) — CustomStateSet must NOT replace author-facing config.
- The one genuine internal-state candidate (`AutoComplete` open/expanded) is delegated to the `Anchored` behavior and already correctly modeled via `aria-expanded`; an imperative `internals.states.add('open')` adoption there is low-value without a CSS/demo consumer.
- So the real leverage is the **declarative** surface above, not a scattered imperative retrofit.

## Lineage
Forked out of #1794 (native :state alignment), which `blockedBy` this.
