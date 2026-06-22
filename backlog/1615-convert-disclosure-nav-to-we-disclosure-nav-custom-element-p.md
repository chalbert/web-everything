---
kind: story
size: 3
parent: "1442"
status: resolved
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "@frontierui/blocks/disclosure-nav/DisclosureNavElement.ts (<we-disclosure-nav>)"
locus: frontierui
relatedProject: webcomponents
relatedReport: reports/2026-06-22-1442-slice-wave-3.md
tags: [packaging, custom-elements, block-model, conversion, disclosure-nav, frontierui]
---

# Convert disclosure-nav to we-disclosure-nav custom element (persistent light-DOM B)

Register the disclosure-nav block as a we-disclosure-nav custom element via the persistent light-DOM (B) mechanism, mirroring the shipping reference at fui:blocks/wizard/WizardElement.ts. Styled-noun nav widget with disclosure open/collapse state -> persistent B per the #1381 packaging guideline (we:docs/agent/block-standard.md §7). Wave-3 slice (we:reports/2026-06-22-1442-slice-wave-3.md), flat application of an already-shipping pattern, no buried fork.

## Progress

Resolved 2026-06-22 (batch-2026-06-22-1615-1208). Added the persistent light-DOM `<we-disclosure-nav>`
element, mirroring `fui:blocks/deck/DeckElement.ts` / `fui:blocks/stepper/StepperElement.ts`:

- `fui:blocks/disclosure-nav/DisclosureNavElement.ts` — `DisclosureNavElement` + idempotent
  `registerDisclosureNav(tag='we-disclosure-nav')` (#841 overridable tag). The reactive `config`
  property is the B-mechanism binding surface (a consumer sets `el.config = {…}` post-mount to re-render);
  zero-config renders the shared default demo nav.
- `fui:blocks/disclosure-nav/DisclosureNav.ts` — extracted `DEFAULT_DISCLOSURE_NAV_CONFIG` (shared by
  Mode-C `mountInDocument` + the element) and added `mountDisclosureNavLight(host, config)`: builds the
  `createDisclosureNav` markup into the light-DOM host and boots the shared nav registry over the host's
  *root node* (`CustomAttributeRegistry.upgrade` takes a `RootNode`, not an `Element`; the `nav:*` traits
  scope by attribute, only on this nav's own markup). Styles ride a one-time `document.head` injection
  (#1349 S1 light-DOM floor) — never shadowed.
- `fui:blocks/disclosure-nav/index.ts` — re-exports the element + helper.
- `fui:blocks/__tests__/unit/disclosure-nav/DisclosureNavElement.test.ts` — registration idempotency,
  light-DOM hosting (no shadow), reactive `config` re-render, default-config fallback. (Trait *runtime*
  activation stays the NavSection/NavMenubar suites' + #946 e2e's job — the test DOM parses the `nav:`
  colon prefix off.) 12/12 green; FUI `check:standards` 0 errors.
- `we:src/_data/blocks/disclosure-nav.json` — `implementedBy` → the element file; `exports` + summary
  updated to name `<we-disclosure-nav>`.
