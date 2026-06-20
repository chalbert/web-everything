---
kind: task
parent: "934"
status: resolved
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: blocks/navigation/NavSectionBehavior.ts
locus: frontierui
relatedProject: webdocs
tags: [dogfood, chrome, traits, webbehaviors]
---

# Shadow-scope nav:section trait lookup for mode-C mounts

controlledElement in fui:blocks/navigation/NavSectionBehavior.ts:47 uses bare document.querySelector → inert inside a shadow root; switch to this.target.getRootNode()-scoped lookup so nav:section resolves its panel in a mode-C chrome mount. Confirm nav:list (fui:blocks/navigation/NavListBehavior.ts:105) already scopes to this.target. Precondition for #934 trait composition.

## Progress (batch-2026-06-18) — resolved

- **Fix.** `controlledElement` in `fui:blocks/navigation/NavSectionBehavior.ts` now scopes the selector
  lookup to `this.target.getRootNode()` — a `ShadowRoot` inside a mode-C chrome mount, the `Document`
  in light DOM (narrowed `ShadowRoot | Document`, else fall back to `document` for a detached subtree).
  The controlled element is a **sibling** referenced by selector, so the scope is the shared root, not
  `this.target` (which would only see descendants).
- **nav:list confirmed.** `fui:blocks/navigation/NavListBehavior.ts` already scopes its lookups to
  `this.target.querySelectorAll(...)` (descendant query) — inherently shadow-safe; no change needed.
- **Tests.** Added a `shadow-root scoping (#941)` describe block to
  `fui:blocks/__tests__/unit/navigation/NavSectionBehavior.test.ts` (resolves inside a shadow root,
  does NOT leak to a same-id light-DOM decoy, wires aria-controls + toggle against the shadow sibling).
  23/23 unit tests pass; FUI `check:standards` green (0 errors).
- Unblocks the #934 cascade roots (#943/#944/#945 depend on shadow-safe `nav:section`).
