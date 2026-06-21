---
kind: task
parent: "1442"
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "fui:blocks/badge/BadgeElement.ts"
locus: frontierui
relatedProject: webcomponents
tags: [packaging, custom-elements, block-model, conversion, transient-element, badge, frontierui]
---

# Convert badge to we-badge custom element (transient/A)

Behavior-free presentational control: replace the createBadge factory with registerBadge(tag='we-badge') via the TransientElement pattern. Mechanism A by the codified guideline (we:docs/agent/block-standard.md Packaging governance §7); tag derives cleanly by #841. Independent of the other conversions.

## Progress (batch-2026-06-21)

- Added a `decorate(el)` hook to `fui:blocks/transient/TransientElement.ts` (no-op default, so AutoHeading
  and any plain tag-swap subclass are unaffected) — the seam a config-attribute control needs to map its
  attributes onto the native replacement.
- Built `fui:blocks/badge/BadgeElement.ts` (`extends TransientElement`): `<we-badge>` self-replaces with a
  native `<span class="fui-badge fui-badge--<tone>">`, mapping `tone`/`icon`/`status` config attributes in
  `decorate` (status → `role=status` + tone-prefixed `aria-label`). Reuses `BASE_CLASS`/`BADGE_TONES`
  (now exported from `Badge.ts`). `createBadge` kept for programmatic/plateau use.
- `fui:blocks/badge/registerBadge.ts` — `registerBadge(tag='we-badge')`, idempotent; exported from
  `blocks/badge/index.ts`; wired into `fui:plugs/bootstrap.ts`.
- Tested `fui:blocks/__tests__/unit/badge/BadgeElement.test.ts` — 5 tests (self-replace to span, tone→class,
  unknown-tone fallback, status role+aria-label, icon span). 53/53 in the suite; FUI `check:standards` → 0 errors.
