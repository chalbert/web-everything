---
type: issue
workItem: story
status: resolved
dateOpened: "2026-06-09"
dateStarted: "2026-06-09"
dateResolved: "2026-06-09"
size: 3
graduatedTo: protocol:auto-define-strategy
tags: [components, custom-elements, self-registration, auto-define, contract]
parent: "227"
relatedProject: webcomponents
crossRef: { url: /projects/webcomponents/#protocol-auto-define-strategy, label: Auto-Define Strategy Protocol }
---

# Ship the Auto-Define contract: `defineElement` helper + `static tagName` + `AutoDefineStrategy`

Successor build to the #227 ruling (graduated to the **Auto-Define Strategy Protocol**,
`/projects/webcomponents/#protocol-auto-define-strategy`). This item implements the native-baseline
mechanics — the parts that need no strategy object.

## Scope

- **`defineElement(tag, ctor)` helper** — idempotent + collision-safe + HMR-safe
  (`customElements.get(tag) ?? customElements.define(tag, ctor)`). This is the one call every module
  makes. Replace the bare top-level `customElements.define(...)` the generators emit today
  (`we:blocks/renderers/component/declarativeComponent.ts:151`,
  `we:blocks/renderers/functional/functionalComponent.ts:71`) with a call to it, so re-import / duplicate
  tag / HMR re-run stop throwing.
- **`static tagName`** — generated classes carry `static tagName` as the single source of truth for
  tag↔class binding. The JSX class path resolves `<UserCard/>` → `tagName` →
  `document.createElement(tag)` (registry upgrade path), not a bare `new`.
- **`AutoDefineStrategy` contract type** — `readonly key`, `trigger`, optional `resolve(tag)`,
  `define(tag, ctor, scope?)`. Mirror the `CustomRenderStrategy` contract file shape. Ship the
  contract + the `explicit` baseline (which is just the helper); the inferring strategies and the
  registry land in #242.

## Done when

- Generators emit `defineElement(...)`; re-import/HMR no longer throws (test).
- `static tagName` present on generated classes; JSX path resolves through it.
- `AutoDefineStrategy` contract type exported with the `explicit` baseline documented.
- Hand-author parity: the documented hand-written form is the same `defineElement` call.

Carries the concept from plateau, not its render-time-WeakMap POC. Sibling build to the render-strategy
contract decomposition (#080).
