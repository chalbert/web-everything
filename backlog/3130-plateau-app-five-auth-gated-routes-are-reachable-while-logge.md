---
bornAs: xyefflx
kind: task
status: open
dateOpened: "2026-08-15"
tags: []
---

# plateau-app: five auth-gated routes are reachable while logged off (PRODUCT_ROUTES is missing /skills and the four /console-* routes)

Found while preparing #2512 (route-prefix migration). plateau-app:src/main.ts's PRODUCT_ROUTES array (isProductRoute's gate) omits /skills, /console-board, /console-cases, /console-ruling, /console-micro, so syncAuthShell never bounces a logged-off visitor off them — and the logged-off shell CSS only re-centers content, it does not hide it, so a direct visit renders the real page. Fix: rule whether Plateau Loop's console surfaces are meant to be public or gated (a product call, not mechanical), put each route in the right list, and add an e2e assertion per route. Verified live during #2512's independent review.

Original filing detail, kept verbatim: the five routes' post-#2512 prefixed forms are `/docs/skills`,
`/loop/console-board`, `/loop/console-cases`, `/loop/console-ruling`, `/loop/console-micro`; the CSS cited is
`plateau-app:src/styles/layout.css:331-337`; first verified on `plateau-app` main @ `0d0ed9e`.

## Design

**The judgment call comes first, and it is not this item's to make silently.** `/console-board`,
`/console-cases`, `/console-ruling` and `/console-micro` are Plateau Loop's operator console surfaces; `/skills`
is a catalog. Whether those are meant to be public (like `/deck`, `/pricing`, `/constitution`) or gated
(like `/backlog`, `/explorer-runs`) is a product call. Two lists exist and both are hand-maintained in
`plateau-app:src/main.ts`: `PUBLIC_ROUTES` (a `Set`, ~L263) and `PRODUCT_ROUTES` (an array, ~L268–274). A route
in NEITHER falls through to the public `/*` 404 by design (~L265–267 comment) — that fall-through is why these
five are silently reachable rather than loudly broken. So the fix is "put each of the five in the RIGHT list",
not "add all five to `PRODUCT_ROUTES`".

**The mechanism, confirmed on `plateau-app` main @ `c050cca`.** `syncAuthShell(path)` (~L279) bounces only when
`!loggedIn && !PUBLIC_ROUTES.has(path) && isProductRoute(path)`. `isProductRoute` (~L275) is
`path === '/' || PRODUCT_ROUTES.some(r => path === r || path.startsWith(r + '/'))`. None of the five is in
`PRODUCT_ROUTES`, so the third conjunct is false and no bounce fires. `syncAuthShell` runs at boot (~L1026) and
on every route change (~L391), so both the direct-URL and in-app-navigation paths are equally ungated. The five
routes do mount real content while logged off — `tryMountSkillsCatalog` (~L407), `tryMountCardTaxonomyDocs`
(~L414), `tryMountLaneBoard` (~L415), `tryMountRulingSurface` (~L416), `tryMountMicroDecisionSurface` (~L417)
are all reached from the same route-change handler with no auth predicate. And the CSS confirms nothing hides
them: `.app-shell.logged-off .app-main` (`plateau-app:src/styles/layout.css:331-337`) sets only
`display: grid` + `place-items: safe center`.

**Ordering against #2512.** #2512 (route-prefix migration, `status: open`, `blockedBy: ["2510"]`) has NOT
landed, so the routes are still at their un-prefixed names today. Fix them at the names that exist NOW
(`/skills`, `/console-board`, `/console-cases`, `/console-ruling`, `/console-micro`) — waiting for #2512
leaves a live auth hole open behind an 8-point migration. #2512's own scope already lists
`plateau-app:src/main.ts` and `plateau-app:tests/e2e/`, so it will carry the rename of whatever this item
lands.

**Where the proof goes.** `plateau-app:src/main.ts` has **zero exports** and there is no `plateau-app:src/main.test.ts`, so
`isProductRoute` / `PRODUCT_ROUTES` are not unit-reachable as the file stands. Two options: export them (a
one-line change that makes a vitest unit possible, `npm test` = `vitest run`), or assert through the existing
Playwright e2e — `plateau-app:tests/e2e/auth-shell-split.spec.ts` already has the harness and the two auth
cases (`logged-off visitor sees the public shell with the landing mounted`, `simulated sign-in flips to the
app shell`), run by `npm run test:e2e`. The e2e route is what the item's own body asks for and it proves the
redirect end-to-end rather than the list membership; the export is cheaper and catches list drift. Doing both
is reasonable for a task this size.

## Done when

1. `npm run test:e2e` in `plateau-app` fails before and passes after, with a case in
   `plateau-app:tests/e2e/auth-shell-split.spec.ts` that visits each of the five routes while logged off and
   asserts the redirect to `/home` — one assertion per route, so a partial fix cannot pass. (Tier 1.)
2. Whichever of the five are ruled **public** get the mirror case instead: visited logged off, they render
   their own surface and do NOT redirect. A route with no case in either direction fails this criterion.
   (Tier 1.)
3. Each of the five appears in exactly one of `PUBLIC_ROUTES` or `PRODUCT_ROUTES` in
   `plateau-app:src/main.ts` — a single `grep` over that file shows all five and no duplicates across the two
   lists. (Tier 2.)
4. The public-vs-gated ruling for the four `/console-*` surfaces is recorded on this item (one line each,
   naming who ruled) before the code lands — this is the product call the item names, and a silent
   "added them all to `PRODUCT_ROUTES`" is the failure mode. (Tier 3 — read the ruling note added to this
   card.)
