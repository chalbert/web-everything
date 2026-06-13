# Loan Origination demo — verification checklist

Exercise app A (#317). Manual smoke test for the demo served by Vite on `:3000`. The app is mounted
under the base path **`/demos/loan-origination/`** and drives the shipping **Router** block, so most of
this checklist guards the base-path / reload behavior that has regressed before.

> Entry URL: <http://localhost:3000/demos/loan-origination/index.html>
> (see `src/_data/demos.json`). The router maps that entry into route space via `base` + `entry` (#365).

## Routing & base path (the regression guard)

- [ ] **Cold load** of `…/loan-origination/index.html` redirects to `…/loan-origination/pipeline` and
      renders the pipeline — NOT a bare `/pipeline` at the origin root.
- [ ] **Reload (Cmd-R) on a deep route** `…/loan-origination/pipeline` re-renders the same view — no
      404, no blank page. Repeat for `/application`, `/processing`, `/underwriting`, `/admin`.
- [ ] **Deep-link paste**: open `…/loan-origination/underwriting` in a fresh tab → lands on that module.
- [ ] **Tab navigation**: clicking each module tab updates the URL to the base-qualified path
      (`…/loan-origination/<module>`) and the active tab gets `aria-current="page"` + `.active`.
- [ ] **Back / forward** buttons move between visited modules and keep the active tab in sync.
- [ ] The address bar **never** shows an origin-root path like `http://localhost:3000/pipeline`.

### Quick server-side fallback probe (no browser)

```bash
# deep route must serve the demo HTML (200), not 404:
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/demos/loan-origination/pipeline   # 200
# real assets must still be served by Vite, not swallowed by the SPA fallback:
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/demos/loan-origination/app.ts      # 200
```

If the deep route 404s: the dev server predates the `routerDemoFallback` entry in `vite.config.mts`
(it needs a Vite restart to pick up config changes), or a new module route was added to `MODULES`
without adding its segment to that fallback's regex.

## Standards surfaces (the app is the forcing function for these — see `conformance.json`)

- [ ] **Pipeline table** renders ~50 rows of the 5k book with sortable columns (`data-table`).
- [ ] **Pagination** controls window the full 5k; changing page re-slices the table (`pagination`).
- [ ] **Row selection** opens the master-detail trace panel; keyboard (arrows + Enter) selects too
      (`selection` via `master-detail`).
- [ ] **Trace panel** shows status chips, the decision trace, available lifecycle moves, and the audit
      timeline (`status-indicator`, `decision-trace`, `lifecycle`, `audit-trail`).
- [ ] **Advance a loan**: clicking an available move applies the transition, the chip updates, and a new
      entry appears in the audit timeline (`lifecycle` + `audit-trail` auto-log).

## Gotchas

- New route? Add it to **`MODULES`** in `app.ts` **and** to the loan-origination regex in
  `routerDemoFallback` (`vite.config.mts`) — otherwise its reload 404s.
- `route:link` and programmatic redirects must use **`routePath('/x')`** (base-qualified); the router
  does not prepend `base` to link/redirect targets, only to route patterns.
