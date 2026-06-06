---
type: idea
status: active
dateOpened: "2026-06-06"
dateStarted: "2026-06-06"
tags: [webcomponents, component, declarative, attach-internals]
relatedProject: webcomponents
crossRef: { url: /blocks/component/, label: Component block }
---

# Make more of the custom-element imperative API declarative on `<component>`

The `<component>` element today declares `name`, `shadow` mode, and the template (its children). A large part of the custom-element / Web Components surface is still **imperative-only** — `attachShadow` options, `ElementInternals` (form association, default ARIA, custom states), observed-attribute reflection, lifecycle hooks, scoped registries. This item tracks giving those a **declarative spelling on `<component>`**, native-first: lean on Declarative Shadow DOM attributes where the platform already has them; only invent an attribute where it has none. Each capability lands as a Feature-Inventory row on the block page (+ a DC open point when it needs a design call).

## Bucket 1 — already declarative (done / baseline we lean on)
No work: `shadow="open|closed|none"`, `<style>` in template, native slots / `part` / `exportparts`, native `is=` (not adopted — Safari refuses customized built-ins).

## Bucket 2 — map-through: native attribute exists, just wire it onto `<component>` (no design)
Mechanical — the platform settled the spelling via Declarative Shadow DOM; we forward it into the lowering's `attachShadow(init)`.

- [x] **`delegates-focus`** → `attachShadow({ delegatesFocus: true })` (native `shadowrootdelegatesfocus`) — ✅ landed
- [x] **`clonable`** → `attachShadow({ clonable: true })` (native `shadowrootclonable`) — ✅ landed
- [x] **`serializable`** → `attachShadow({ serializable: true })` (native `shadowrootserializable`) — ✅ landed

**Bucket 2 complete.**

## Bucket 3 — needs refinement: no declarative form anywhere yet (real design work, one DC point each)
- [x] `attachInternals` → **form participation** (`form-associated`) — ✅ landed (DC-12, backlog 082)
- [x] `attachInternals` → **default role/ARIA** (`default-role`) — ✅ landed (DC-13, backlog 082)
- [ ] `attachInternals` → **custom states** — deferred (DC-14): seeding only is low-value; revisit on a concrete use
- [ ] Constraint validation — compose target (Web Validation) undecided
- [ ] Observed attributes → template reflection (`observe=`) — syntax unspecified
- [ ] Reactive bindings — depends on unshipped Template Instantiation / DOM Parts
- [x] `connectedMoveCallback` / `moveBefore` (`preserve-on-move`) — ✅ landed (DC-15, backlog 084)
- [ ] Lifecycle side-effects — inherently JS; needs the `behavior`/`extends` hook (DC-5) — **design-blocked**
- [ ] Observed attributes → template reflection (`observe=`) — **blocked on DC-4** (binding layer); reflecting *into* content needs `{{expr}}`. `:host([attr])` styling is already native.
- [ ] Reactive bindings — depends on unshipped Template Instantiation / DOM Parts — **defer**
- [ ] Manual slot assignment — `slotAssignment:'manual'` has no DSD attr; opting in renders empty slots without a JS `slot.assign()` layer (**footgun**) — defer to tier-3
- [ ] Scoped registration — `scope` semantics + native scoped-registry alignment unsettled — **design-blocked**
- [ ] Shared stylesheets — `<style>` covers per-component; cross-instance `adoptedStyleSheets` sharing has no form — defer

## Progress
- **Status:** active — **Bucket 2 fully landed**; **Bucket 3: attachInternals** (DC-12/13) **and `preserve-on-move`** (DC-15) **landed**. Every *cleanly-buildable, self-contained* item is now done — the rest are genuinely design-blocked (see re-tiered Bucket 3 list above).
- **Branch:** docs/standard-authoring-workflow
- **Done:**
  - Bucket 2 — `delegates-focus` / `clonable` / `serializable` via `shadowInitLiteral()` (fixed key order); fixtures #6–#7; docs; `shadowInitOptions` decision.
  - Bucket 3 attachInternals — `formAssociated` + `defaultRole` on `ComponentDef`; parsed (`form-associated` boolean, `default-role` ARIA-token-validated); generated class emits `static formAssociated` + `#internals = this.attachInternals()` + constructor `internals.role` in fixed member order; runtime twin **guards `attachInternals`** (absent in happy-dom). Fixture #8 (`x-rating`); 9 new tests (**47 total green**). Docs: [component.njk](../src/_includes/block-descriptions/component.njk) authoring contract + Element-internals section + Feature Inventory; [blocks.json](../src/_data/blocks.json) `elementInternals` decision + webStandard; 2 semantics terms. Grounding: report DC-12/13/14 + [backlog 082](082-component-attach-internals.md). Demo **8/8**; verified in Chromium (`x-rating.formAssociated === true`).
- **Done (cont'd):** `preserve-on-move` (DC-15) — `preserveOnMove` on `ComponentDef`; emits empty `connectedMoveCallback()` (conditionally added at runtime); fixture #9 (`x-keepalive`); 6 tests (**53 total**); docs + `preserveOnMove` decision + `atomicMove` webStandard + Atomic Move term + [backlog 084](084-component-preserve-on-move.md). Demo **9/9**; Chromium-verified (`moveBefore` preserves focus).
- **Next:** remaining Bucket 3 is **design-blocked**, not quick builds — `observe=`/reactive bindings need the binding layer (DC-4); lifecycle side-effects need the `behavior`/`extends` hook (DC-5); scoped registration, manual slot assignment, shared stylesheets each need their own design call. Surface for discussion before building; don't auto-pick.
- **Notes:** lowering in [declarativeComponent.ts](../blocks/renderers/component/declarativeComponent.ts); class members must stay in fixed order (static → #internals → #root → constructor → connectedCallback) for determinism; attachInternals unavailable in happy-dom → unit tests assert generated source, browser/E2E exercises behavior.
