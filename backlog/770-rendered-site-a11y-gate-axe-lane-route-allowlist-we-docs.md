---
type: issue
workItem: story
size: 3
status: resolved
blockedBy: ["763"]
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: tests/a11y/rendered-site-a11y.spec.ts
parent: "800"
tags: []
---

# Rendered-site a11y gate — axe lane + route allowlist (WE-docs)

Add @axe-core/playwright to the existing Playwright integration lane (reuses the running dev servers per we:playwright.config.ts:24-41) and gate a hand-maintained allowlist of WE-docs URLs (:8080 here, proxied via :3000) against WCAG 2.1 A/AA tags. Warn-only ratchet first (advisory over the curated route set), flip to build-blocking once the set is green. Ratified in #763 fork 1/2/3 = A/A/A.

## Progress (2026-06-16, batch-2026-06-16) — built

- **Dep:** added `@axe-core/playwright` (devDep, we:package.json) — the one new surface the #763 ruling called for; `@playwright/test` was already wired.
- **Allowlist (Fork 3 = A):** [we:tests/a11y/route-allowlist.ts](../tests/a11y/route-allowlist.ts) — a hand-maintained, reviewed `GATED_ROUTES[]` over the stable WE-docs catalog index surfaces (`/`, `/intents/`, `/blocks/`, `/protocols/`, `/adapters/`, `/capabilities/`, `/demos/`, `/governance/`, `/research/`, `/backlog/`), plus the WCAG tag set (`wcag2a/2aa/21a/21aa`). NOT auto-derived (the deferred Fork-3 alternative).
- **Gate (Fork 1 = A):** [we:tests/a11y/rendered-site-a11y.spec.ts](../tests/a11y/rendered-site-a11y.spec.ts) — one test per route, `AxeBuilder(...).withTags(WCAG_TAGS).analyze()`. Pinned to the WE-docs origin directly (`test.use({ baseURL: 'http://localhost:8080' })`) so `/` gates the real docs home, not the Vite `:3000` demo-launcher shell. Wired into `we:playwright.config.ts` `testMatch` as `tests/a11y/**/*.spec.ts` (reuses the running servers).
- **Posture (Fork 2 = A):** warn → enforce ratchet. Every route is warn-only by default (violations → `console.warn` + a test annotation, build stays green); flip a single route with `enforce: true` or the whole lane with `A11Y_ENFORCE=1`.
- **Verified:** `npx playwright test tests/a11y` → 10/10 pass warn-only against the running servers. The gate surfaced **real** pre-existing violations it now tracks: site-wide `color-contrast` (e.g. 949 nodes on `/research/`, 627 on `/backlog/`) and `document-title`/`html-has-lang` misses on some pages — left as warn-only (fixing them is the ratchet's next rung, carved to a follow-up). `check:standards` green for this changeset (the one error is #792, a concurrent session's untracked file).
- **Carved:** the remediate-then-enforce follow-up (fix the surfaced violations, flip routes to `enforce`).
