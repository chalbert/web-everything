---
type: issue
workItem: story
size: 3
parent: "757"
locus: frontierui
status: resolved
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
tags: []
---

# fui:adapters.njk: drive from webdocs/adapters modules, expose status

`fui:src/adapters.njk` hardcodes its catalog as two literal `project-card` divs (storybook, mintlify) — ironic, since the page text claims "dropping in one more module — no registry, no wiring." A third module dropped into `webdocs/adapters/` would not appear, and there is no status indicator. Make the page data-driven the way `fui:src/_data/demos.js` already is: a new `fui:src/_data/adapters.js` scans `webdocs/adapters/*.ts` (skipping `we:types.ts` and `__tests__`), and `fui:adapters.njk` loops over the result, rendering every adapter with a status meter (reuse the `fui:status-badge.njk` macro). A half-built adapter then shows up automatically with a `draft` badge instead of being invisible.

## Acceptance

- `fui:src/_data/adapters.js` enumerates the real `webdocs/adapters/*.ts` modules (today: storybook, mintlify; `we:types.ts`/`__tests__` excluded).
- `fui:adapters.njk` renders one card per discovered adapter from that data — no inline-hardcoded card list.
- Each card shows a status badge; both current adapters are `implemented`.
- Adding a new sibling module makes a card appear with no template edit (matches the page's own "no wiring" promise).
- `/adapters/` on `:3001` still renders the contract section + "adding your own" guide.

## Recommended approach — where status/label/summary come from

The modules don't carry display metadata today. Go with **declared in-module**: each adapter exposes a parseable `@status` tag + lead-paragraph in its header comment, read as text exactly like `fui:demos.js` reads `<title>`. Truly "driven by the actual adapter," no runtime-contract change, a not-ready module declares its own `draft`. (The fallback — a curated status/summary map inside `fui:adapters.js` — is rejected as the default: it reintroduces a second place to maintain, the drift this epic exists to kill.)

## Notes

- Relates to resolved #741 (which authored the hardcoded page). This supersedes that page's static card list.
- Reference pattern: `fui:src/_data/demos.js` (WE #738) — filesystem glob → auto-discovered catalog.
