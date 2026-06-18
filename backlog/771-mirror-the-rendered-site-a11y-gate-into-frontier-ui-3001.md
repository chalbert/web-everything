---
type: issue
workItem: story
size: 3
status: resolved
blockedBy: ["763"]
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: frontierui/tests/a11y/rendered-site-a11y.spec.ts
tags: []
---

# Mirror the rendered-site a11y gate into Frontier UI (:3001)

Mirror the #770 axe-core/playwright gate into the frontierui repo so the FUI site (:3001) gets the same WCAG 2.1 A/AA rendered-page coverage, with its own hand-maintained route allowlist. Same warn→enforce ratchet posture. Follows the duplicated-dev-panel mirroring pattern (the gate in this repo natively covers only WE-docs). Ratified in #763 fork 3 = mirrored per-repo.

## Progress (2026-06-16, batch-2026-06-16) — built

- Mirrored WE's #770 rendered-site a11y gate into **frontierui**, following the duplicated-dev-panel per-repo pattern (ratified #763 Fork 3 = mirrored per-repo).
- **Dep:** added `@axe-core/playwright` (devDep) to frontierui.
- **Allowlist:** `fui:frontierui/tests/a11y/route-allowlist.ts` — FUI's own curated route set (`/`, `/blocks/`, `/adapters/`, `/demos/`, `/plugs/`, `/traits/`, `/about/`) + the WCAG 2.0/2.1 A+AA tag set.
- **Gate:** `fui:frontierui/tests/a11y/rendered-site-a11y.spec.ts` — same warn→enforce ratchet (`A11Y_ENFORCE=1` / per-route `enforce`), pinned to the FUI docs origin (`:8082`) so `/` gates the real site home not the Vite `:3001` shell. Wired into `fui:frontierui/playwright.config.ts` `testMatch`.
- **Verified:** `npx playwright test tests/a11y` → 7/7 pass warn-only against the running FUI servers; surfaced real pre-existing violations it now tracks (color-contrast etc.). FUI `npm run check:standards` green.
- The FUI-side remediate-then-enforce is the per-repo analogue of WE's #793 (fix the surfaced violations, flip routes to enforce) — left as the ratchet's next rung.
