---
kind: story
size: 2
status: resolved
locus: plateau-app
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "plateau:tests/e2e/auth-shell-split.spec.ts"
tags: [plateau-app, testing, e2e, playwright, inert-gate]
---

# plateau-app test:e2e is inert — install Playwright + wire a smoke spec

## Progress (batch-2026-06-20) — DONE

The `plateau:test:e2e` gate is now real and green:
- Added `@playwright/test` (`^1.40.0`; resolved 1.61.0) as a devDep in `plateau:package.json`; ran
  `npx playwright install chromium`.
- Added `plateau:playwright.config.ts` — `baseURL http://localhost:4000`, `testDir ./tests/e2e`,
  `testIgnore **/dist/**`, and a `webServer` that **reuses** an already-running `npm start` locally
  (`reuseExistingServer: !CI`) and boots fresh in CI — mirrors `we:playwright.config.ts`.
- Wired the first smoke spec `plateau:tests/e2e/auth-shell-split.spec.ts` — the #1238 public/app shell
  split: a logged-off context lands on the public shell (`.app-shell.logged-off` + `[data-test=
  landing-mount]` visible); a simulated sign-in via `#login-form` flips to the app shell (modifier
  dropped + `nav.sidebar-nav` visible).
- Added `playwright-report/` + `test-results/` to `plateau:.gitignore` (generated artifacts).
- **`npm run test:e2e` → 2 passed (3.5s)** against the running :4000 server.

`plateau:package.json` declares `"test:e2e": "playwright test"` but `@playwright/test` / `playwright` is absent from its deps, so the script errors out (an inert gate). Surfaced 2026-06-20 when a #1238 browser verify had to run via webeverything's Playwright instead of plateau-app's own. Verified absent 2026-06-20: `@playwright/test` and `playwright` both unresolvable from `plateau-app/node_modules`.

**Not a decision — a defect with a forced fix.** The "drop the dead script (e2e centralized elsewhere)" branch is broken: there is no central e2e. Both sibling constellation repos self-run Playwright — `we:package.json` and `fui:package.json` each pin `@playwright/test ^1.40.0` with their own config (`we:playwright.config.ts`, `fui:playwright.config.ts`) and spec trees (`we:blocks/__tests__/e2e`, `fui:blocks/__tests__/e2e`, …). plateau-app — the actual product — is the only repo with none, so deleting the script leaves the worst-covered surface uncovered. The fix is to make the gate real, matching the established sibling convention.

Build:
- Add `@playwright/test` (pin `^1.40.0` to match siblings) as a devDep; run `npx playwright install` (chromium).
- Add a minimal `plateau:playwright.config.ts` — `baseURL: http://localhost:4000` (plateau-app's Vite port), `webServer` that **reuses** an already-running `npm start` locally and boots fresh in CI (mirror `we:playwright.config.ts`), `testIgnore: **/dist/**`.
- Wire ≥1 smoke spec — the public/app shell split (#1238) is the natural first e2e (assert the public shell vs. the app shell each mount).
- `npm run test:e2e` green from `plateau-app/`.
