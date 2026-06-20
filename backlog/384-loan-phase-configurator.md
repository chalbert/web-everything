---
kind: story
locus: exercise-app
size: 8
status: resolved
parent: "317"
dateOpened: "2026-06-12"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: demos/loan-origination/configurator/ (S6 product & rate configurator — eligibility constraint graph + rate-sheet/LLPA/lock pricing; /pricing module)
tags: [exercise-app, loan-origination, configurator, pricing, phase]
---

# Phase S6 — product & rate configurator

Functional phase of exercise app A ([#317](/backlog/317-exercise-app-loan-origination/)). Select a loan
product from a catalog whose eligibility constraints filter the available set given the application; derive
rate/price from a rate sheet keyed by (product, LTV band, credit band, term, lock) + LLPAs; recompute
payment/APR/cash-to-close. See the [requirements report](/reports/2026-06-11-exercise-app-loan-origination-requirements/)
(M5). Drives the **Technical Configurator / NL-to-config** paradigm (constraint graph).

## Progress

- **2026-06-15 — built (exercise app A).** New `/pricing` ("Product & Pricing") module:
  - `we:demos/loan-origination/configurator/productConfigurator.ts` — the **constraint graph**:
    `evaluateEligibility`/`evaluateCatalog` evaluate each catalog product's constraints (credit score,
    LTV ceiling, occupancy, loan-amount band, term offered) against the app's derived facts → eligible set
    + the *failing* edges (the "why-not"); `configureQuote` derives the quote from the rate sheet (base +
    LLPA by credit/LTV band + the lock-period adjustment — the full (product, LTV, credit, term, lock) key)
    and recomputes monthly P&I, PITI payment, an APR approximation (bisection over net proceeds), and
    cash-to-close. Pure functions over the existing `we:catalog.ts` pricing domain + `we:facts.ts`.
  - `we:demos/loan-origination/configurator/productConfiguratorView.ts` — eligible products as selectable
    cards, ineligible ones dimmed with the failing constraint(s); a lock selector re-prices; eligibility
    chips **reuse the active status-indicator block** (platform-first). Wired into `we:app.ts` (`/pricing`
    module + skeleton + mount on entry, pricing a representative book application) + styles in `we:app.css`.
  - **SPA-fallback fix:** added `pricing` to the router-demo fallback regex in `vite.config.mts` so a deep
    link / reload of `/demos/loan-origination/pricing` serves the demo HTML. (Asset dir named
    `configurator/`, not `pricing/`, to avoid colliding with the route segment in that same regex — the
    `wizard/`-vs-`/application` convention.)
  - **Conformance:** `check:standards` + `check:app-conformance` green (92%, 12/13, 0 FAIL, compliant). The
    Technical-Configurator constraint-graph paradigm recorded as a **Layer-2 candidate standard** (a
    reusable WE decision-surface; the eligibility predicates share the rules-engine shape).
  - **Verified live** on :3000 (Playwright): 6 products (3 eligible / 3 ineligible with constraint
    reasons), lock 30→60 bumps the note rate 8.000%→8.250%, no console errors.
  - graduatedTo: `demos/loan-origination/configurator/` (the S6 product & rate configurator).
