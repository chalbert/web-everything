---
kind: task
status: open
locus: plateau-app
dateOpened: "2026-06-20"
tags: [plateau-app, testing, e2e, playwright, inert-gate]
---

# plateau-app test:e2e is inert — Playwright not installed

`plateau:package.json` declares `"test:e2e": "playwright test"` but `@playwright/test` / `playwright` is absent from its deps, so the script errors out (an inert gate). Either add Playwright as a devDep (+ `npx playwright install`) or drop the script. Surfaced 2026-06-20 when a #1238 browser verify had to run via webeverything's Playwright instead of plateau-app's own.

Decide: (a) install Playwright in plateau-app and make `test:e2e` real (wire ≥1 smoke spec — the public/app shell split #1238 is a natural first e2e), or (b) drop the dead script if e2e is intentionally centralized elsewhere. Verified absent 2026-06-20: `@playwright/test` and `playwright` both unresolvable from `plateau-app/node_modules`.
