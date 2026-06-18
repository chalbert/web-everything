---
type: issue
workItem: story
size: 5
status: resolved
parent: "746"
relatedProject: webdocs
dateOpened: "2026-06-16"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: scripts/gen-wrapper/genWrapper.mjs
crossRef: { url: /backlog/811-decide-the-forward-component-emit-substrate-per-framework-em/, label: "Substrate decision (#811)" }
tags: [webdocs, adapters, polyglot, generation, conformance, wrapper, cem]
---

# Consume-mode per-framework wrapper generator (block CEM → React/Vue/etc wrapper source artifact)

The WE-owned substrate for the polyglot panel **#753** consume-mode, split out at the layer seam per
**#811**. Generate thin per-framework **wrapper source** (React/Vue/Svelte/Angular) for a block from its
**custom-elements-manifest** — the ratified CEM protocol WE already derives via
[we:gen-cem.mjs](../scripts/gen-cem.mjs). The wrapper forwards props → attributes/properties and wires
events/slots, keyed off the CEM (Lit-Labs `gen-wrapper-*` / Stencil output-target precedent). This is a
**forward-adapter / author-time devtools artifact** (the #463/#505/#507 polyglot family): WE owns the
neutral contract + the generation, and **emits code only**. The live-test render and the panel UI are
**FUI's** ([#753](/backlog/753-polyglot-adapter-panel/), `locus: frontierui`) via the #701 `fuiDemo`
iframe; the conformance badge consumes the **#506** deterministic gate.

This is the genuinely agent-ready, WE-buildable slice that **#811** unblocked ("ship consume mode first —
cheap, rides the ratified CEM"). It is the *appetite probe* before author-mode source transpilation
(#818, deferred/demand-gated).

## Why this is WE-ownable (and the panel is not)

Per #811's per-fork classification: **substrate/generation = a WE forward-adapter artifact**; the **live
render is FUI's** (docs-rendering boundary — WE never renders FUI block code). Consume mode "mints no new
protocol — it reuses `custom-elements-manifest`." So the generator (CEM → wrapper string) lives in WE; the
Block Explorer panel that *displays + live-tests* it lives in FUI (#746 homes the workbench in FUI).

## Build

- A generator module: `(cem, target) => wrapperSource`, consuming the CEM that
  [we:gen-cem.mjs](../scripts/gen-cem.mjs) derives from `fui:blocks.json`. Targets: **React + Vue** to start
  (the ≥2 the panel needs), structured so Svelte/Angular slot in.
- Per target, emit a thin wrapper: render the custom-element tag; map reactive props → properties (vs
  attributes) per the CEM's property/attribute split; forward events (`addEventListener` ↔ `on*`); pass
  through slots/children. "Flag, don't fake" anything the CEM under-specifies.
- Expose the generated source as a plain string artifact (no DOM, no FUI import) so FUI's panel and the
  #506 conformance gate can both consume it. A small CLI/exported fn is enough; the panel wires it in.
- Unit-test the emitted source against a fixture block's CEM (shape + key forwarding assertions).

## Acceptance

- [x] Given a block's CEM, the generator emits valid React **and** Vue wrapper source that references the
      block's tag, properties, and events.
- [x] Output is a pure string artifact with no FUI/runtime-DOM dependency (so it crosses the layer seam
      to FUI cleanly).
- [x] Unit tests cover prop/attribute/event forwarding for at least one fixture block.

## Notes

Splits the WE half out of #753 (mirrors how #755 was split at the layer seam). Author-mode idiomatic
source transpilation is the separate, deferred #818 (needs an emit-purpose IR; demand-gated behind this
probe). Conformance badge rendering belongs to the FUI panel + #506; this item only produces the code the
badge grades.

## Progress

- **Status:** resolved
- **Branch:** docs/standard-authoring-workflow
- **Done:**
  - [we:scripts/gen-wrapper/genWrapper.mjs](../scripts/gen-wrapper/genWrapper.mjs) — pure
    `generateWrapper(declaration, target)` over a CEM `custom-element` declaration; React (`.tsx`) +
    Vue (`.ts`) emitters. Forwards attributes as element bindings, reactive properties onto the
    instance (React via ref/effect, Vue via `.prop`), events as `onPascal` handlers / Vue `emit`,
    children → default slot. Drops private/method/static members. "Flag, don't fake": throws on a
    non-custom-element (class) declaration. Also exports `customElementDeclarations(manifest)`,
    `TARGETS`, `wrapperExtension`.
  - [we:scripts/gen-wrapper/cli.mjs](../scripts/gen-wrapper/cli.mjs) + `npm run gen:wrapper` (`--check`
    mode) — materializes `generated/wrappers/<target>/<Name>.<ext>` from `we:custom-elements.json`.
  - [we:scripts/gen-wrapper/__tests__/genWrapper.test.mjs](../scripts/gen-wrapper/__tests__/genWrapper.test.mjs)
    — 17 vitest cases (React + Vue forwarding, flag-don't-fake, manifest extraction, metadata).
- **Next:** none — done. Real-block wrapping waits on **#822** (fui:blocks.json carries no `tagName`/
  attributes today, so the CEM emits 0 custom-element declarations; the generator is contracted against
  the CEM shape and unit-tested with a fixture). FUI panel that consumes this is **#753**.
- **Notes:** all 17 tests green; `gen:wrapper` reports 0 emitted today (honest — see #822);
  `check:standards` green.

## Framing correction (#892, 2026-06-18)

Per #855 B2, the generator is **impl/tooling, not a `@webeverything` standard**. #892 re-homed the canonical
generator to Frontier UI (`frontierui/tools/gen-wrapper/`); the WE-side `scripts/gen-wrapper/` copy this item
produced is now a **demoted reference fixture** subordinate to the CEM (the #461 pattern), not a shipped
standard. WE's owned conformance is the generator-agnostic behavioral vectors + runner (`wrapper-conformance/`,
#891). Only the CEM contract crosses the WE→FUI seam; the generator code does not.
