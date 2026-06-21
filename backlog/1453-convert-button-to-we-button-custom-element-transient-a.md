---
kind: story
size: 3
parent: "1442"
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "fui:blocks/button/ButtonTransientElement.ts"
locus: frontierui
relatedProject: webcomponents
tags: [packaging, custom-elements, block-model, conversion, transient-element, button, frontierui]
---

# Convert button to we-button custom element (transient/A)

Apply #1381's ratified mechanism A to the button: replace the createButton/mountButton factory (fui:blocks/button/Button.ts:50-58) with registerButton(tag='we-button') built on the shipping TransientElement pattern (fui:blocks/transient/TransientElement.ts:28). we-button upgrades, transfers attributes to a real native `<button>`, and erases itself; declarative behaviors ride CustomAttributes on the surviving native button. The #1381-named reference application, still unbuilt. Demoable via the embed/contract mountInDocument path.

## Progress (batch-2026-06-21)

- Built `fui:blocks/button/ButtonTransientElement.ts` (`extends TransientElement`, reusing the #1454
  `decorate` hook): `<we-button>` self-replaces with a native `<button type=button>` — or `<a>` when
  `href` is set (href transfers; icon link). `decorate` maps `variant` (default/icon/toggle, validated,
  fallback default) → modifier class, `icon`/`label` → content + accessible name (icon-only → `aria-label`),
  and `toggle` → `aria-pressed` (+ `aria-controls`/`aria-expanded`). Class named `ButtonTransientElement`
  to avoid colliding with the existing exported `ButtonElement` union type. Per #1381, click/toggle
  *behavior* rides a CustomAttribute on the surviving native control — the element does the structural
  transform only. `createButton` kept for programmatic use.
- `fui:blocks/button/registerButton.ts` — `registerButton(tag='we-button')`, idempotent; exported from
  `blocks/button/index.ts` (+ `BASE_CLASS`/`BUTTON_VARIANTS`); wired into `fui:plugs/bootstrap.ts`.
- Tested `fui:blocks/__tests__/unit/button/ButtonTransientElement.test.ts` — 4 tests (button+type=button,
  href→`<a>` + icon-only aria-label, toggle aria, unknown-variant fallback). 13/13 button suite; FUI
  `check:standards` → 0 errors.
