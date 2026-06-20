---
kind: epic
status: resolved
dateOpened: "2026-06-06"
dateStarted: "2026-06-06"
dateResolved: "2026-06-18"
graduatedTo: none
tags: [webcomponents, component, declarative, attach-internals]
relatedProject: webcomponents
relatedReport: reports/2026-06-17-076-declarative-wc-apis-split-analysis.md
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
- [x] `attachInternals` → **default ARIA beyond role** (`default-aria-*`) — **carved to build [#853](/backlog/853-default-aria-defaults-beyond-role-on-component/)** (map-through, same shape as `default-role`; never inventoried before)
- [x] `connectedMoveCallback` / `moveBefore` (`preserve-on-move`) — ✅ landed (DC-15, backlog 084)
- [x] Observed attributes → template reflection (`observe=`) — ✅ **shipped** via [#825](/backlog/825-observe-attribute-reflection-compile-time-lowering-dc-4-b1-u/) + [#830](/backlog/830-lower-observe-and-to-observedattributes-attributechangedcall/) (DC-4 ratified, #792)
- [x] Lifecycle side-effects via the `behavior`/`extends` hook — DC-5 (#044) **ratified 2026-06-08**; declarative attribute **carved to build [#852](/backlog/852-behavior-extends-tier-2-enhancement-hook-on-component-dc-5-r/)** (was mis-labelled design-blocked)
- [x] Scoped registration (`scope=`) — **decided by [#854](/backlog/854-scope-declarative-scoped-registration-spelling-on-component/)**: scoped registration lives **off** `<component>` (a runtime declared-registry, not a compile-time `<component>` attribute; runtime built by [#901](/backlog/901-build-the-runtime-scoped-registration-mechanism-declared-reg/), reconciled by [#902](/backlog/902-reconcile-pre-existing-scope-presumptions-to-the-854-ruling-/)) — so there is **no `scope=` attribute on `<component>`** to build
- [x] Constraint validation — **decided by separation**: composes via Web Validation ([#085](/backlog/085-validation-adapters-multi-language/), which explicitly never wires into a component); a form-associated `<component>` reaches `setValidity` — no `<component>` attribute to build

### Deferred — out of scope for this epic (settled-as-deferred, not pending builds)
Each is a decision **not** to build now (platform-blocked or low-value); revisit triggers noted. No carve — nothing is buildable to slice. **Tracked for later in parked [#928](/backlog/928-remaining-declarative-component-capability-defers-custom-sta/)** (custom states, manual slots, shared stylesheets); reactive bindings stays under DC-4 [#042](/backlog/042-component-reactive-depth/)/[#792](/backlog/792-dc-4-binding-layer-compile-time-expr-contract-observe-reflec/).
- `attachInternals` → **custom states** — deferred (DC-14): seeding-only is low-value; revisit on a concrete use
- Reactive bindings — depends on unshipped Template Instantiation / DOM Parts — **defer (platform-blocked)**
- Manual slot assignment — `slotAssignment:'manual'` has no DSD attr; opting in renders empty slots without a JS `slot.assign()` layer (**footgun**) — defer to tier-3 (unblocked by the #852 behavior hook)
- Shared stylesheets — `<style>` covers per-component; cross-instance `adoptedStyleSheets` sharing has no form — defer

## Progress
- **Status:** open — **re-sliced 2026-06-17** (report [we:2026-06-17-076-declarative-wc-apis-split-analysis.md](../reports/2026-06-17-076-declarative-wc-apis-split-analysis.md)). The prior "all buildable work landed, remainder design-blocked" read was **stale**: tracing each blocked line to its real home showed two gating decisions had since ratified, so they are now plain builds. Carved out:
  - **[#852](/backlog/852-behavior-extends-tier-2-enhancement-hook-on-component-dc-5-r/)** — `behavior`/`extends` hook (DC-5 ratified 2026-06-08; was mis-labelled blocked). Ready build.
  - **[#853](/backlog/853-default-aria-defaults-beyond-role-on-component/)** — `default-aria-*` defaults beyond role (map-through, never inventoried). Ready build.
  - **[#854](/backlog/854-scope-declarative-scoped-registration-spelling-on-component/)** — `scope=` declarative spelling (the one genuinely-open design call; runtime fixed by #228, spelling unsettled).
  - **Resolved-in-place:** `observe=` shipped (#825/#830, DC-4 #792 ratified); constraint validation decided by separation (composes via Web Validation #085).
  - **Genuine defers:** custom states (DC-14, pending use), manual slot assignment (tier-3, unblocked by #852), shared stylesheets (no form), reactive bindings (platform-blocked on Template Instantiation / DOM Parts).

  Verified 2026-06-06: lowering present in `we:blocks/renderers/component/declarativeComponent.ts`; renderer + full suite green (1418 passing), `check:standards` 0 errors.
- **Branch:** docs/standard-authoring-workflow
- **Done:**
  - Bucket 2 — `delegates-focus` / `clonable` / `serializable` via `shadowInitLiteral()` (fixed key order); fixtures #6–#7; docs; `shadowInitOptions` decision.
  - Bucket 3 attachInternals — `formAssociated` + `defaultRole` on `ComponentDef`; parsed (`form-associated` boolean, `default-role` ARIA-token-validated); generated class emits `static formAssociated` + `#internals = this.attachInternals()` + constructor `internals.role` in fixed member order; runtime twin **guards `attachInternals`** (absent in happy-dom). Fixture #8 (`x-rating`); 9 new tests (**47 total green**). Docs: [we:component.njk](../src/_includes/block-descriptions/component.njk) authoring contract + Element-internals section + Feature Inventory; [fui:blocks.json](../src/_data/blocks.json) `elementInternals` decision + webStandard; 2 semantics terms. Grounding: report DC-12/13/14 + [backlog 082](/backlog/082-component-attach-internals/). Demo **8/8**; verified in Chromium (`x-rating.formAssociated === true`).
- **Done (cont'd):** `preserve-on-move` (DC-15) — `preserveOnMove` on `ComponentDef`; emits empty `connectedMoveCallback()` (conditionally added at runtime); fixture #9 (`x-keepalive`); 6 tests (**53 total**); docs + `preserveOnMove` decision + `atomicMove` webStandard + Atomic Move term + [backlog 084](/backlog/084-component-preserve-on-move/). Demo **9/9**; Chromium-verified (`moveBefore` preserves focus).
- **Next:** remaining Bucket 3 is **design-blocked**, not quick builds — `observe=`/reactive bindings need the binding layer (DC-4); lifecycle side-effects need the `behavior`/`extends` hook (DC-5); scoped registration, manual slot assignment, shared stylesheets each need their own design call. Surface for discussion before building; don't auto-pick.
- **Notes:** lowering in [we:declarativeComponent.ts](../blocks/renderers/component/declarativeComponent.ts); class members must stay in fixed order (static → #internals → #root → constructor → connectedCallback) for determinism; attachInternals unavailable in happy-dom → unit tests assert generated source, browser/E2E exercises behavior.
