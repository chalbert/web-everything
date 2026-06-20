---
kind: decision
size: 5
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:src/_includes/project-webportals.njk"
codifiedIn: "docs/agent/platform-decisions.md#contract-surface-platform-idiom"
preparedDate: "2026-06-19"
relatedProject: webportals
relatedReport: reports/2026-06-19-web-portals-protocol-shape.md
tags: [webportals, design]
---

# Ratify the Web Portals protocol — resolve the 4 spec open questions

**Prepared, ready to ratify.** No protocol shape was settled yet; the four forks below are grounded in a
prior-art survey published as the `/research/` topic
[web-portals-protocol-shape](/research/web-portals-protocol-shape/) (session report
`we:reports/2026-06-19-web-portals-protocol-shape.md`), each carrying a **bold** recommended default. The
survey reshaped two forks: Fork 1 gained a declarative-attribute surface the spec omitted, and Fork 3 is
**settled by shipped architecture** — the spec duplicates an intent that already exists.

The Web Portals spec (`we:src/_includes/project-webportals.njk:296-463`, `status:concept`) is a mature
declarative-HTML portal protocol (React-`createPortal` / Vue-`<Teleport>` equivalent) built on
[Web Injectors](/projects/webinjectors/) as the logical-tree backbone. It is **not** superseded by WICG
Portals (a different concept — page-navigation transitions; spec §wicg-portals-note). What's missing is
ratification of the **protocol contract shape** — four open questions the spec itself raises
(`we:project-webportals.njk:888-894`) that gate the #1001 polyfill build.

The four questions decompose along one axis: **how closely each contract surface tracks platform
precedent.** Q1 is the *structural-relationship surface* (`we:project-webportals.njk:300-313` — the writable
`logicalParent` interface); Q2 is the *event-propagation surface* (`we:project-webportals.njk:325-343` —
`bubblesLogical`/`logicalPath`/`composed`); Q3 is the *focus surface*
(`we:project-webportals.njk:388-418` — primitive #4 `focusscope`/`createFocusScope`); Q4 is the
*lifecycle/resolution surface* (`we:project-webportals.njk:448-454` — the directive's `connectedCallback`
target resolution). The survey's finding is consistent across all four: align to the platform's own
idioms (writable-element-reference-property-plus-IDREF-attribute, separate-flag-not-overload,
compose-don't-duplicate, forgiving-default-plus-diagnostic).

## Ruling — RATIFIED 2026-06-19 (all four forks)

All four forks ratified individually and the spec edits below are **applied** to
`we:src/_includes/project-webportals.njk`. This section is the record of the call.


Grounding re-verified against the live tree (spec `:296-463`, `:888-894`; the four Open Questions match
the four forks verbatim; the Focus Containment Intent and its Modal/Anchor composition seams confirmed at
`we:src/_data/intents.json:290`/`:906`/`:1332`, and Anchor's `escape` strategy already composes Web
Portals). **All four main forks ratify on their prepared default (A).** Two skeptic sub-agent passes (one
per flagged sub-decision) both landed and **amend the prepared sub-leans** — each amendment makes the
protocol *more* coherent (one logical tree; no timers), neither overturns a fork:

- **Fork 1 → A ✓ RATIFIED 2026-06-19 (revised after a merit/alignment re-review — the earlier "writable
  property has no validation hook" rationale is WITHDRAWN):** a JS accessor `set logicalParent(v)` validates (cycle →
  `HierarchyRequestError`) and fires `logicalparentchange` exactly as a method would, so capability was
  never the differentiator. Judged on platform alignment, the idiomatic shape for "a relationship to
  another element, declared by an IDREF attribute" is a **writable element-reference property** —
  `button.popoverTargetElement` (writable `Element | null` paired with the `popovertarget` IDREF
  attribute) and `htmlFor` (on `<label>`) (writable string reflection) are the precedents. Only the *resolved
  chain* is read-only in the platform (`parentNode`, `label.control`) — which maps here to
  `logicalAncestors()`/`logicalInjector`, not to the single-parent setter. **Ruling:** keep the spec's
  writable `logicalParent` property but *complete* it — add the declarative `logicalparent="id"` content
  attribute (the genuinely-missing front door, matching `for`/`slot`/`popovertarget`) and document the
  validation + `logicalparentchange` contract on set. Drop the redundant `setLogicalParent()` method. The
  spec's `:303` was almost right; it lacked the attribute and the documented contract, not writability.
  ~80%.
- **Fork 2 → A ✓ RATIFIED 2026-06-19** (pre-retarget `logicalPath`, fresh retarget per hop, separate `composedLogical` flag +
  `composedLogicalPath()`). **Sub-decision AMENDED → the retarget host at a logical hop is the
  DECLARATION element, not the mount element.** The skeptic trace showed mount-as-host contradicts the
  spec's own `:451` (`logicalParent` = "this directive's parent" = the declaration site), leaks the
  outlet as `event.target`, and collapses nesting when two portals share one outlet; declaration-host is
  the only choice congruent with `logicalAncestors()`/`logicalInjector`/context resolution. The physical
  render site remains available via native `composedPath()`. ~90%.
- **Fork 3 → A ✓ RATIFIED 2026-06-19** (strike primitive #4; compose the existing Focus Containment Intent). Forced invariant —
  Modal (`:906`) and Anchor (`:1332`) already compose it "rather than redefine"; folding it in would
  contradict a shipped seam. ~92%.
- **Fork 4 → A ✓ RATIFIED 2026-06-19** (deferred-by-default attach-or-observe + diagnostic + `required` opt-out). **Sub-decision
  AMENDED → the diagnostic trigger is STRUCTURAL, not a wall-clock timeout: warn unresolved targets at
  `DOMContentLoaded` (initial load) and after one `requestAnimationFrame` for portals connected post-load
  (the streamed/SPA analogue of "the injection batch settled"); reuse the single root `InjectorRoot`
  MutationObserver the protocol already rides on rather than spawning a per-portal/document-wide
  observer. No `timeout` attribute in the contract.** A timeout has no correct value, makes conformance
  vectors flaky, and is the one mechanism every cited framework rejected. ~80% (residual: confirm at
  #1001 that `InjectorRoot`'s observer is document-rooted — sees a `document.body` target appended by
  unrelated code; if subtree-only, add one timer-free root-level fallback observer — does not change the
  trigger).

**Spec edits to apply at ratification** (against `we:project-webportals.njk`): Fork 1 adds the `logicalparent` IDREF
content attribute and documents the writable `logicalParent` property's validating setter +
`logicalparentchange` contract (`:300-313`), keeping `logicalAncestors()`/`logicalInjector` read-only;
Fork 2 adds the
`composedLogical`/`composedLogicalPath()` contract + the pre-retarget rule + the declaration-host
retarget rule to `:325-343`; Fork 3 **deletes** primitive #4 (`:388-428`) and replaces it with a
"composes Focus Containment Intent" note; Fork 4 specifies the directive's missing-target behavior at
`:448-454` with the structural trigger; the Open Questions block (`:888-894`) is replaced with a
"Resolved — see #1000" note.

## Worked examples (per fork)

All examples use the spec's real usage syntax (`we:project-webportals.njk:471` — `<template is="portal"
target="#…">`, `logicalparent`, `on-click`, `data-bind`).

### Fork 1 — `logicalParent`: declarative attribute + writable element-reference property (revised A)

A tooltip physically renders in a top-layer outlet (to escape `overflow:hidden`/stacking) but must resolve
context — theme, injectors — from its *trigger's* subtree, not from the outlet:

```html
<div id="card" data-theme="dark">
  <button id="trigger" aria-describedby="tip">Help</button>
</div>

<portal-outlet id="tooltips"></portal-outlet>

<!-- Renders into #tooltips, but logically parented back to #card -->
<template is="portal" target="#tooltips">
  <div id="tip" role="tooltip" logicalparent="card">Saves your draft every 30s</div>
</template>
```

`#tip` lives in `#tooltips` physically, but `getContext('theme')` walks the logical chain → `#card` →
resolves `dark` (spec `:317`). The declarative IDREF attribute is the front door (matches `for`/`slot`/
`popovertarget`).

The IDL surface mirrors the platform's `popovertarget` / `popoverTargetElement` pair — a **writable
element-reference property**, *not* a method:

```js
// Imperative surface = the writable property (idiomatic, like button.popoverTargetElement):
tip.logicalParent = card;            // ✓ writable element-reference property; reflects the IDREF attribute
tip.logicalParent;                   // → #card (the assigned element)

// The setter does real work — capability was never the issue with a property:
const set = (el, v) => { /* detach from prior logical parent, validate, fire event */ };
a.logicalParent = b;
b.logicalParent = a;                 // ❌ throws DOMException HierarchyRequestError — setter rejects a cycle
tip.addEventListener('logicalparentchange', onReparent);  // setter fires it on re-point — mirrors slotchange

// Only the RESOLVED CHAIN is read-only (like parentNode / label.control):
[...tip.logicalAncestors()];         // read-only walk: [#card, body]
tip.logicalInjector;                 // read-only resolved injector
```

The spec's existing `logicalParent: Node` (`:303`) is *kept* and writable — what it lacked was the
declarative `logicalparent` attribute above and the documented validation + `logicalparentchange`
contract on the setter. No `setLogicalParent()` method (the writable property is the imperative surface,
per `popoverTargetElement`).

### Fork 2 — logical bubbling: declaration-element retarget host (ratified A + amended sub-decision)

Nested portals — the case that decides the retarget host. Portal **A** is declared inside `#card`, mounts to
`#o1`; portal **B** is declared inside A's content, mounts to `#o2`; a button in B fires a logical-bubbling
click:

```html
<div id="card">
  <template is="portal" target="#o1">          <!-- A: declared in #card, mounts to #o1 -->
    <div id="a-content">
      <template is="portal" target="#o2">      <!-- B: declared in A, mounts to #o2 -->
        <button id="btn">Go</button>
      </template>
    </div>
  </template>
</div>
<portal-outlet id="o1"></portal-outlet>
<portal-outlet id="o2"></portal-outlet>
```

```js
btn.dispatchEvent(new MouseEvent('click', { bubbles: true, composedLogical: true }));
```

Logical chain of `#btn`: `btn → a-content → #card → body` (each hop via `logicalParent`, set to the
*declaration* parent per spec `:451`). A listener on `#card`:

| | `e.target` seen by `#card` | `e.composedLogicalPath()` |
|---|---|---|
| **Ratified — declaration host** | the A declaration node (a child `#card` actually contains) | `[btn, …, B-decl, …, A-decl, #card, body]` — every entry is in the logical tree |
| **Rejected — mount host** | `#o1` (an outlet in `<body>` that `#card` does *not* contain) | leaks `#o1`/`#o2`; if two portals share `#o1`, indistinguishable |

Mount-host injects the physical outlet (layout infra) as the event's identity and contradicts `:451` —
that's why the sub-decision flipped to declaration-host. The physical site is still reachable via native
`composedPath()`; the two paths stay pure.

Orthogonality the separate flag preserves:

```js
new Event('x', { composed: true });        // crosses the TARGET'S SHADOW boundary — native meaning, untouched
new Event('x', { composedLogical: true });  // crosses LOGICAL (portal) boundaries — orthogonal, default false
e.stopLogicalPropagation();                  // stops only the logical leg; DOM bubbling continues
```

### Fork 3 — focus scopes: compose, don't own (ratified A — forced invariant)

The struck primitive #4 and the struck usage at `:472`:

```html
<!-- ❌ STRUCK (spec `:388-428` and the `:472` usage example): duplicates the Focus Containment Intent -->
<div class="widget-modal" focusscope="trap returnfocus">…</div>
```

After: the portal owns *DOM/context escape* only; focus containment is the surface's separate concern,
satisfied by the native substrate the Focus Containment Intent already names (`<dialog>.showModal()` →
auto-`inert` + top layer + `:modal` + trap + restore, per `we:intents.json:290`/`:906`):

```html
<my-widget>
  <template is="portal" target="#modals">     <!-- portal: DOM + logical-context escape -->
    <dialog class="widget-modal">
      <h2 data-bind="widgetTitle"></h2>
      <button on-click="closeModal">Close</button>
    </dialog>
  </template>
</my-widget>
```

```js
dialog.showModal();   // focus trap + inert + restore — owned by Focus Containment Intent, NOT the portal
```

Orthogonality (why folding them is wrong): you can **portal without a trap** (a toast/tooltip in an
outlet — no focus trap) and **trap without a portal** (an in-place `<dialog>` wizard step that never
moves in the DOM). Two concerns, two homes.

### Fork 4 — deferred target resolution: structural trigger (ratified A + amended sub-decision)

```html
<!-- (1) Target present at connect → attaches immediately -->
<portal-outlet id="modals"></portal-outlet>
<template is="portal" target="#modals">…</template>

<!-- (2) Target defined LATER in source (streamed / author-ordered) → observed via the shared
     InjectorRoot MutationObserver, attaches when #late appears. NO warning (resolved before the
     structural trigger fires). -->
<template is="portal" target="#late">…</template>
<!-- …more streamed markup… -->
<portal-outlet id="late"></portal-outlet>

<!-- (3) Typo'd target → never resolves → console.warn at the STRUCTURAL trigger:
     DOMContentLoaded on initial load, or one requestAnimationFrame after a post-load connection.
     ⚠ "Web Portals: target '#modlas' never resolved." (no wall-clock timeout anywhere) -->
<template is="portal" target="#modlas">…</template>

<!-- (4) Fail-fast opt-in -->
<template is="portal" target="#modals" required>…</template>
<!-- throws synchronously in connectedCallback if #modals is absent (Vue non-defer behavior, opt-in) -->
```

Why structural over timeout: a timeout has no correct value (200ms over-waits on fast loads, under-waits
on slow streams → false warnings), makes conformance vectors flaky, and is the one mechanism every cited
framework rejected. The protocol rides Web Injectors, whose `InjectorRoot` already runs one document-level
`MutationObserver` — reuse it (one observer, O(1) regardless of portal count) rather than spawning a
per-portal observer. *Residual to confirm at #1001:* that `InjectorRoot`'s observer sees a target appended
to `document.body` by unrelated code; if it's subtree-scoped, add one timer-free root-level fallback.

## Recommended path at a glance

| # | Fork | Recommended default | Main alternative (excluded) | Confidence |
|---|------|---------------------|------------------------------|------------|
| 1 | `logicalParent` surface | **`logicalparent="id"` IDREF attribute + writable `logicalParent` element-reference property (validating setter + `logicalparentchange`), mirroring `popovertarget`/`popoverTargetElement`** | Method-only (`setLogicalParent()`); or bare undocumented property | med-high (~80%) |
| 2 | Logical bubbling vs shadow retargeting | **Pre-retarget `logicalPath`, fresh retarget per hop, separate `composedLogical` flag + `composedLogicalPath()`** | Overload native `composed`/`composedPath()` | med-high (~80%) |
| 3 | Focus scopes | **Strike primitive #4; compose the existing Focus Containment Intent** | Fold focus into the portal directive | high (~90%) |
| 4 | Deferred target resolution | **Deferred-by-default (attach-or-observe) + bounded console warning + `required` opt-out** | Hard error (Vue non-`defer`) · silent no-op | med (~75%) |

## Boundary (settled — not a fork)

Per WE=contracts (a framework-specific runtime/impl is never a `@webeverything` artifact): the
**protocol** (the `logicalParent` contract, the logical-propagation event contract, the directive
contract) is the `@webeverything` artifact; the **polyfill/runtime impl** is FUI
([#1001](/backlog/1001-implement-web-portals-logical-tree-polyfill-portal-directive/)). This decision
settles only the contract shape.

## Fork 1 — `logicalParent`: what IDL surface mutates the single logical parent?

*Fork reframed after a merit/alignment re-review (the original "writable property is flawed — no
validation hook" framing is WITHDRAWN).* A JS accessor `set logicalParent(v)` can validate (throw
`HierarchyRequestError` on a cycle) and fire `logicalparentchange` exactly as a method can — so capability
never separated the branches. The real question is purely platform-idiom: for "a relationship to another
element, declared by an IDREF attribute," what is the IDL mutation surface?

The platform's idiom is a **writable element-reference property**: `button.popoverTargetElement` is a
writable `Element | null` paired with the `popovertarget` IDREF content attribute; `htmlFor` (on `<label>`) is a
writable string reflection of `for`. What the platform keeps **read-only** is only the *resolved chain* —
`Node.parentNode`, `label.control`, `assignedSlot` — which maps here to `logicalAncestors()` /
`logicalInjector`, not to the single-parent setter. So a writable `logicalParent` is the precedented
surface, and the spec's `:303` was almost right; what it lacked was the declarative attribute and a
documented validation/event contract.

- **A — `logicalparent="id"` IDREF content attribute (declarative front door) + the spec's writable
  `logicalParent` element-reference property, completed with a validating setter (cycle →
  `HierarchyRequestError`) + `logicalparentchange` on re-point.** *Recommended default.* Mirrors the
  `popovertarget` / `popoverTargetElement` platform pair; keeps `logicalAncestors()`/`logicalInjector`
  read-only. The directive (`we:project-webportals.njk:451`) sets it via the property.
- B — Method-only (`setLogicalParent()` + read-only getter). *Coherent but less idiomatic:* the platform
  models element-reference relationships as writable properties (`popoverTargetElement`), not setter
  methods; a method would be the odd one out, and the writable property already gives the validation/event
  hooks. Redundant given A.
- C — Bare writable property with **no** content attribute and **no** documented validation/event contract
  (the spec as literally written at `:303`). *Rejected — but only for the missing attribute + contract, not
  for being writable.* Writability is correct; an undocumented bare property loses the pure-HTML
  declarative front door the project exists to provide.

## Fork 2 — logical bubbling vs. Shadow DOM event retargeting & `composed`

*Fork exists because:* overloading native `composed`/`composedPath()` to carry logical-tree hops is a
**broken** branch — `composed` is defined as crossing the *target's shadow boundary*, and native
retargeting builds a shadow-adjusted path up-front at dispatch; reusing that adjusted `target` for a
portal hop adjusts to the wrong boundary and breaks `composedPath()` truncation semantics. Logical-tree
propagation and shadow-boundary crossing are two distinct concerns that cannot share one flag.

Crux (`we:project-webportals.njk:332-336`): the spec adds `logicalPath` and `stopLogicalPropagation()` but
leaves the shadow-composition undefined. WHATWG DOM facts: the event path is assembled up-front before
any listener runs (each entry stores a shadow-adjusted target); `composed: true` crosses the target's
shadow boundary; React synthetic events bubble the React tree, not the DOM (the closest prior art to
`bubblesLogical`).

- **A — Compute `logicalPath` pre-retarget (a parallel pass over the logical chain), run a fresh retarget at each logical hop (host = the portal's logical mount point), and add a *separate* opt-in `composedLogical` flag (default `false`) + `composedLogicalPath()` accessor.** *Recommended default.* Keeps logical-boundary crossing orthogonal to shadow-boundary crossing; default-`false` preserves encapsulation.
- B — *Rejected:* overload native `composed`/`composedPath()` for logical hops. Conflates two boundary types; breaks `composedPath()` semantics.
- **Sub-decision to confirm at ratify (~20% residual):** the exact retarget host at a logical hop — the portal's *mount* element vs. its *declaration* element. Recommend mount element; the deciding agent should walk one nested-portal example (skeptic-flag this row).

## Fork 3 — focus scopes: fold into the portal directive, or compose the existing intent?

*Fork exists because:* the spec proposes primitive #4 — a `focusscope` attribute + `createFocusScope()`
API (`we:project-webportals.njk:388-418`) — but folding focus into the portal is the **broken** branch: it
**duplicates and contradicts a shipped seam.** The [Focus Containment Intent](/intents/focus-containment/)
(`we:src/_data/intents.json:290`) already owns "confining keyboard focus to an active surface, making the
rest of the page `inert`, where focus lands when it opens, and where it returns when it closes," and the
[Modal](/intents/modal/) (`we:intents.json:897`), [Anchor](/intents/anchor/) (`we:intents.json:1323`), and
[Autofocus-on-Activation](/intents/autofocus-on-activation/) (`we:intents.json:1963`) intents each
explicitly *compose* it "rather than redefine it." This is a **forced invariant → ratify**, not a weigh.

Focus containment is orthogonal to portaling: you can trap without a portal (in-place wizard step,
in-place `<dialog>`) and portal without a trap (toast, tooltip, non-modal popover). The platform
substrate (`inert`, `<dialog>.showModal()` auto-inert + top layer + `:modal`, WAI-ARIA APG modal pattern)
lives under the existing intent.

- **A — Strike primitive #4 from the Web Portals spec; the portal *composes* the Focus Containment Intent, never owns it.** *Recommended default.* Honours bias-toward-separation and the shipped compose-don't-redefine seam.
- B — *Rejected:* fold focus containment into the portal directive (`focusscope`/`createFocusScope`). Contradicts the Focus Containment Intent and the Modal/Anchor/Autofocus composition seam already shipped.

## Fork 4 — deferred target resolution (target not in DOM yet)

*Fork exists because:* the default missing-target behavior is a single choice — error, queue-until-present,
and no-op-until-present **cannot all be the default**, and each has a real flaw at the extremes (hard
error is brittle for streamed/author-ordered HTML; silent no-op hides typos). A genuine either/or on the
default.

Crux (`we:project-webportals.njk:448-454`): the directive's `connectedCallback` resolves the target outlet,
but the spec doesn't say what happens when it's absent. Prior art: Vue 3.5 `<Teleport defer>` resolves
after the current render cycle (still errors a tick later); React `null` container throws; Solid defaults
`mount` to `document.body`; Angular CDK is imperative (host built first). No framework queues
open-endedly — but native HTML has no single "mount tick" (the parser streams; source order is
author-controlled).

- **A — Deferred-by-default: attach immediately if the target is present, else observe (scoped `MutationObserver`) and attach when it appears; after a bounded window emit a console warning naming the unresolved target; offer a `required` attribute for fail-fast.** *Recommended default.* The forgiving behavior is the most-permissive value (the restriction is the author's opt-in, per most-flexible-default); the bounded warning kills the silent-typo objection.
- B — *Rejected:* hard error if absent (Vue non-`defer`). Too brittle for HTML's streamed / author-ordered DOM — a target legitimately defined later in source would throw.
- C — *Rejected:* silent no-op until present. Hides typo'd targets with no diagnostic.
- **Sub-decision to confirm at ratify (~25% residual):** the diagnostic trigger — "parser-complete" is clean on initial load but fuzzy for SPA/streamed injection, so the bounded window is likely a per-portal configurable timeout. Pin the trigger and the observer scope (document vs. declared ancestor).

## Context

- **Graduation:** resolving this decision unblocks the #1001 polyfill build (the directive, logical-tree, and event-propagation runtime are FUI). Forks 1, 2 and 4 imply protocol *attributes* (e.g. Q4's `required`/timeout), not impl strategies — so no separate Technical Configurator card.
- **Spec edits implied by the ruling** (applied at resolution, against `we:project-webportals.njk`): Fork 1 adds the `logicalparent` IDREF attribute + documents the writable `logicalParent` property's validating-setter/`logicalparentchange` contract (`:300-313`), keeping the resolved chain read-only; Fork 2 adds the `composedLogical`/`composedLogicalPath()` contract and the pre-retarget rule to `:325-343`; Fork 3 **deletes** primitive #4 (`:388-428`) and replaces it with a "composes Focus Containment Intent" note; Fork 4 specifies the directive's missing-target behavior at `:448-454`.
- **Confidence lives in the glance table** (one home, no per-fork dupe). The two sub-decisions (Fork 2 retarget host, Fork 4 diagnostic trigger) are the only rows flagged for a skeptic sub-agent pass at ratification.
