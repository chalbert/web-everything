---
type: idea
workItem: story
size: 3
parent: "076"
status: resolved
dateOpened: "2026-06-17"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: blocks/renderers/component/declarativeComponent.ts
tags: [webcomponents, component, declarative, accessibility, attach-internals]
relatedProject: webcomponents
crossRef: { url: /blocks/component/, label: Component block }
---

# `default-aria-*` defaults beyond role on `<component>`

`default-role` ([#082](/backlog/082-component-attach-internals/), landed) sets **only** `internals.role` ([declarativeComponent.ts:132](../blocks/renderers/component/declarativeComponent.ts#L132)). The rest of the `ElementInternals` **default-ARIA surface** — `ariaLabel`, `ariaDescription`, `ariaChecked`, `ariaDisabled`, `ariaExpanded`, `ariaHasPopup`, `ariaLevel`, `ariaOrientation`, `ariaSelected`, `ariaValueNow`/`ariaValueMin`/`ariaValueMax`/`ariaValueText`, … — is the **same constructor-time map-through shape**: platform-settled semantics, no binding layer needed. It was never inventoried in #076; this finishes the `attachInternals` default-semantics story.

## Scope
- Expose `default-aria-*="…"` attributes following the `default-role` precedent (validated tokens; instance `aria-*=` / IDL still overrides — these are *defaults* in the ARIA semantics cascade).
- Emit into the constructor next to `internals.role`, behind the existing `attachInternals` guard (absent in happy-dom), keeping the fixed member order.
- Map attribute → `internals.aria*` property name; reject unknown `default-aria-*` keys with a diagnostic.
- Feature-Inventory row + `defaultAria` decision/`webStandard` entry in [blocks.json](../src/_data/blocks.json); fixture + unit tests (assert generated source); browser/E2E asserts the default applies and an author attribute overrides it; demo step.

## Notes
- Spelling follows the shipped `default-role` (single validated attribute) — a build, not a fresh design call.

## Progress (2026-06-17, batch-2026-06-17) — built

- **Lowering** ([declarativeComponent.ts](../blocks/renderers/component/declarativeComponent.ts)): `ComponentDef.defaultAria: {prop,value}[]`; `parseDefinition` reads every `default-aria-*` attribute, kebab→camel maps it to an `internals.aria*` property (`default-aria-has-popup` → `ariaHasPopup`), validates against the string-valued `VALID_ARIA_PROPS` set (43 ARIAMixin props; element-reference IDL excluded), rejects unknown keys + empty values, and sorts for deterministic emit. `generateClassSource` emits each into the constructor next to `internals.role` (role first), behind the existing `attachInternals` guard, single-quote/backslash-escaped — fixed member order (static → #internals → #root → constructor → connectedCallback) preserved.
- **Docs + data**: Feature-Inventory row + a `default-aria-*` bullet on [component.njk](../src/_includes/block-descriptions/component.njk); extended the `elementInternals` `designDecisions` entry (openPoint `…/#853`) in [blocks.json](../src/_data/blocks.json). (Also corrected the stale "built-in hook" Feature-Inventory row for `behavior`/`extends` → design-pending #852, since that mechanism is now an open decision.)
- **Demo**: extended the form-associated slider fixture ([component-cases.ts](../blocks/renderers/component/__fixtures__/component-cases.ts) case 8) with `default-aria-value-min/max/now`, exercised by the Component Adapter Playground + conformance suite.
- **Verified**: 62 vitest cases (8 new for default-aria: map-through, kebab keys, role+aria order, attachInternals trigger, unknown-key + empty-value rejection, quote-escaping, runtime no-throw); `check:standards` 0 errors; 11ty build clean and `/blocks/component/` renders the new surface.
