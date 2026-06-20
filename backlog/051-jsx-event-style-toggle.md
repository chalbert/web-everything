---
kind: decision
size: 2
status: resolved
dateOpened: '2026-06-03'
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
graduatedTo: none
codifiedIn: "one-off"
preparedDate: "2026-06-11"
tags:
  - jsx
  - adapters
  - events
relatedReport: reports/2026-06-03-jsx-adapter-feature-mapping.md
relatedProject: webadapters
crossRef: { url: /adapters/jsx-adapter/, label: JSX Adapter }
---

# JSX adapter — support both event spellings behind a UI toggle

The JSX mirror dialect supports two spellings of one handler: the canonical/reversible **string behavior** `on:click="inc($event)"` and the convenience **function prop** `onclick={inc}`. A **named** handler round-trips between them (the function name is the string path the injector resolves); an **inline closure** `onclick={() => …}` has no string path and is one-way. The user wants both available, with a UI sub-toggle on the source toggle to switch which spelling is displayed.

## Digest

Grounded in the [JSX Event-Style](/research/jsx-event-style/) research topic (framework prior art: React/Preact `onClick={fn}`, Solid `on:click={fn}`, Vue `@click="inc($event)"`, Lit `@click=${fn}`, native DOM inline-string vs `addEventListener`) plus the companion feature-mapping report (row 5). Two forks, each with a **bold** default. **Fork 1: author function-style now, string-style canonical** — the function prop is JSX's ergonomic draw, the string behavior is the one form with an HTML representation, so it is the reverse-transform target. **Fork 2: scope the round-trip to named handlers; inline closures are an explicit lossy edge** — the transform synthesizes a handler name or flags lossy, never silently drops behavior. The display sub-toggle reuses the existing soft `html | react` dialect machinery, not a new protocol.

## Axis framing

The handler-attachment surface is the most divergent across the JSX/template ecosystem, and the WE renderer already implements both branches: a **function** value attaches via `addEventListener` and leaves no trace in serialized HTML ([we:JSXRenderer.ts:191-194](../blocks/renderers/jsx/JSXRenderer.ts#L191-L194)), while a **string** on* value is set as a content attribute so it survives to HTML — a branch added explicitly so a non-function on* value is not silently dropped, #245 ([we:JSXRenderer.ts:201-204](../blocks/renderers/jsx/JSXRenderer.ts#L201-L204)); namespaced `on:click` passes through as a plain attribute ([we:JSXRenderer.ts:234](../blocks/renderers/jsx/JSXRenderer.ts#L234)). The reverse transform **drops** expression/function props `name={…}` because they have no HTML representation — the LOSSY rule ([we:jsxToHtml.ts:39-40](../blocks/renderers/jsx/jsxToHtml.ts#L39-L40)). The precedent for a soft spelling-preference toggle already exists: the `html | react` naming dialect (`class`/`onclick` vs `className`/`onClick`) governs codegen while both stay accepted on input — "a soft preference, not a protocol" ([we:dialect.ts:1-18](../blocks/renderers/jsx/dialect.ts#L1-L18); reverse normalization at [we:jsxToHtml.ts:32-37](../blocks/renderers/jsx/jsxToHtml.ts#L32-L37)). The two forks below decide (1) which spelling is authored vs canonical, and (2) where the round-trip guarantee stops.

### Recommended path at a glance

Ratify both rows, or override the one you'd change. The **confidence** column says where judgment is actually needed vs. where to nod.

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 · authored vs canonical spelling** | function-style authored (`onclick={inc}`), string-style canonical (transform target) | string-style canonical for authoring too *(rejected — forfeits JSX's type-checked-function draw)* | **High** — function is the ecosystem majority; only string serializes to HTML |
| **2 · round-trip scope (lossy edge)** | guarantee scoped to **named** handlers; inline closures synthesize-a-name or flag lossy | drop closures silently / forbid closures entirely | **High** — platform fact (closures have no string path); precedent is the existing #235 dialect |

## Fork 1 — which spelling is authored, which is canonical?

Crux: the function prop `onclick={inc}` is what JSX exists to give you (a type-checked, editor-resolvable reference), but only the string behavior `on:click="inc($event)"` has an HTML representation, so only it can be the reversible/canonical layer ([we:JSXRenderer.ts:201-204](../blocks/renderers/jsx/JSXRenderer.ts#L201-L204) survives to HTML; [we:jsxToHtml.ts:39-40](../blocks/renderers/jsx/jsxToHtml.ts#L39-L40) drops the function form). Framework prior art splits cleanly: React/Solid/Lit attach functions; Vue and native inline use strings ([JSX Event-Style](/research/jsx-event-style/) findings 1-2).

- **(A — recommended) Author function-style now; string-style is the canonical transform target.** The renderer's function branch already targets it; the string behavior stays the layer the reverse AST transform emits and the injector resolves a named function through (as `we:declarative-spa-jsx.tsx` already does). The string⇄function *display* toggle lands once authored HTML/JSX pairs or the live transform exist, reusing the existing soft-preference machinery ([we:dialect.ts:1-18](../blocks/renderers/jsx/dialect.ts#L1-L18); `we:source-toggle.njk` / `we:mode-selector.js`) — a second axis of the same toggle, not a new protocol. Cost: the canonical and authored forms differ, so a closure needs the Fork-2 handling.
- **(B) String-style canonical for authoring too.** Internally consistent — authored and canonical coincide, and there is no lossy-closure case (closures aren't expressible). But it forfeits the type-checked function reference that is JSX's primary draw over plain HTML strings (an editor checks `onclick={inc}` but treats `"inc($event)"` as opaque). Rejected.
- *Rejected:* a third "React-native" path (camelCase `onClick={fn}` as the authored canonical) — that is the **naming** axis already owned by the shipped `html | react` dialect ([we:dialect.ts](../blocks/renderers/jsx/dialect.ts)), orthogonal to this function-vs-string spelling axis; do not conflate the two.

## Fork 2 — where does the round-trip guarantee stop (the inline-closure lossy edge)?

Crux: a **named** handler `onclick={inc}` ⇄ `on:click="inc($event)"` round-trips because the function name *is* the string path the injector resolves; an **inline closure** `onclick={() => …}` is an anonymous expression with no string path, and the reverse transform's expression-prop strip drops it ([we:jsxToHtml.ts:39-40](../blocks/renderers/jsx/jsxToHtml.ts#L39-L40)). This is a platform fact, not a WE choice — the question is how the toggle/transform *handles* the closure, not whether it round-trips.

- **(A — recommended) Scope the reversible guarantee to named handlers; treat inline closures as an explicit lossy edge.** On reverse, the transform either **synthesizes a stable handler name** (lifting the closure to a named injector handler) or **flags the cell lossy** in the source toggle — never silently drops behavior. Mirrors how the feature-mapping report's row 5 already classifies the cell (⚠️ reversible for named, one-way for closures) and how #235's dialect documents its tolerated-but-lossy input.
- **(B) Forbid inline closures in authored JSX entirely.** Guarantees total reversibility but removes a natural JSX affordance and pushes trivial one-liners (`() => count++`) into named-handler boilerplate; over-restrictive for the most-flexible-default bias.
- *Rejected:* silently dropping closures on reverse (the current bare `jsxToHtml` strip behavior with no flag) — loses behavior invisibly, the exact footgun the #245 string-survival branch was added to prevent.

## Progress

**Status:** open — prepared 2026-06-11 into prepared-fork shape (digest + glance table + two `## Fork` sections, grounded in the published [JSX Event-Style](/research/jsx-event-style/) research topic and grep-verified `file:line` refs in `blocks/renderers/jsx/`).

Gated on the Axis-1 slice (feature-mapping table + `we:source-toggle.njk` + the realigned renderer). See the mapping report row 5 and the parked `jsx-rendering-strategy-axis`. The display toggle is the second axis of the already-shipped `html | react` soft dialect, not new protocol surface.

## Resolution — ratified 2026-06-11

- **Fork 1 — (A) author function-style (`onclick={inc}`), string-style canonical**: the function prop is JSX's ergonomic, type-checked draw and the ecosystem majority (React/Solid/Lit), but only the string behavior serializes to HTML, so it must be the reversible transform target — the renderer already implements both branches.
- **Fork 2 — (A) round-trip guarantee scoped to named handlers; inline closures synthesize-a-name or flag lossy**: a named handler's function name *is* the string path the injector resolves (round-trips), while a closure has no string path — a platform fact, so on reverse the transform either lifts the closure to a named handler or flags the cell lossy, never silently drops behavior (mirrors the #245 string-survival branch).

**Follow-on builds (not yet scaffolded):**

- Land the string⇄function display sub-toggle on `we:source-toggle.njk` reusing the `html | react` soft-dialect machinery · build / size 2 · blockedBy: the Axis-1 slice (feature-mapping table + realigned renderer) → #324
- Implement the reverse-transform closure handling (synthesize stable handler name, else flag lossy in the source toggle) · build / size 2 · blockedBy: none → #325
