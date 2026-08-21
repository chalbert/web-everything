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

**Gating `/console-board` BREAKS two existing visual suites — this is the one thing that must be planned for,
not discovered.** `plateau-app:tests/visual/board.visual.spec.ts` does a bare
`page.goto('/console-board?demo=1', …)` (~L45) with no login simulation anywhere in its call chain, and then
asserts real fixture content; `plateau-app:tests/visual/real-route-fidelity.spec.ts` reaches the same route
through `plateau-app:scripts/dev/fidelity-render.mjs`, also unauthenticated. Both run under
`npm run test:e2e` — `plateau-app:playwright.config.ts` (~L19) has
`testMatch: ['tests/e2e/**/*.spec.ts', 'tools/explorer/**/*.smoke.spec.ts', 'tests/visual/**/*.spec.ts']` —
which is the very command criterion 1 uses as its proof. So if `/console-board` is ruled **gated**, the fix
redirects those visits to `/home` and both suites go red on a fixture assertion. Reconcile them in the same
change: have each simulate sign-in before navigating (the `authStore.isLoggedIn` flip
`plateau-app:tests/e2e/auth-shell-split.spec.ts` already does). If `/console-board` is ruled **public**,
nothing breaks — which is itself information the ruling should weigh.

**#2512's body will be falsified by this, and it says so explicitly.**
`we:backlog/2512-migrate-plateau-app-routes-into-per-product-subtrees-extract.md` (`status: open`) hardcodes
that `PRODUCT_ROUTES` keeps "the same 25 entries, renamed 1:1", says *"Do not add [the five] to
`PRODUCT_ROUTES` — they aren't in it today either"*, and its own Done-when requires `isProductRoute()` to
still exclude these five "matching today's behavior exactly" and
`plateau-app:tests/e2e/auth-shell-split.spec.ts` to be "(unchanged, still passes)". Every one of those goes
false when this lands, and a #2512 executor following its own text literally could re-strip the newly-gated
entries during the rename. Land a one-line correction onto #2512 in this same change — do not leave it to
#2512's own review to re-discover.

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
   asserts the redirect to `/home` — one assertion per route, so a partial fix cannot pass. The run must be
   green **whole**, including `plateau-app:tests/visual/board.visual.spec.ts` and
   `plateau-app:tests/visual/real-route-fidelity.spec.ts`, which the same `testMatch` picks up and which
   today reach `/console-board` unauthenticated. (Tier 1.)
2. Whichever of the five are ruled **public** get the mirror case instead: visited logged off, they render
   their own surface and do NOT redirect. A route with no case in either direction fails this criterion.
   (Tier 1.)
3. Each of the five appears in exactly one of `PUBLIC_ROUTES` or `PRODUCT_ROUTES` in
   `plateau-app:src/main.ts` — a single `grep` over that file shows all five and no duplicates across the two
   lists. (Tier 2.)
4. The public-vs-gated ruling for **all five** routes — the four `/console-*` surfaces AND `/skills` — is
   recorded on this item (one line each, naming who ruled) before the code lands. This is the product call
   the item names, and a silent "added them all to `PRODUCT_ROUTES`" is the failure mode; exempting `/skills`
   reproduces that failure for one route. (Tier 3 — read the ruling note added to this card.)
5. `we:backlog/2512-migrate-plateau-app-routes-into-per-product-subtrees-extract.md` no longer states that
   the five routes stay out of `PRODUCT_ROUTES`, that `isProductRoute()` matches "today's behavior exactly",
   or that `plateau-app:tests/e2e/auth-shell-split.spec.ts` is unchanged. One `grep` of that card for
   "same 25" and "unchanged, still passes". (Tier 2.)

## Independent review — 2026-08-21

Confidence: **Medium**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **consumer** (NOT addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — plateau-app:tests/visual/board.visual.spec.ts (`page.goto('/console-board?demo=1', ...)`, asserting real fixture content '#2261'/'Demo preview') and plateau-app:tests/visual/real-route-fidelity.spec.ts (via plateau-app:scripts/dev/fidelity-render.mjs, also a bare `page.goto(url,...)`) both navigate straight to /console-board with zero auth/login simulation anywhere in their call chain (verified: no `authStore`/`isLoggedIn`/login-form reference in either file or in plateau-app:tests/visual/capture.mjs), and both run under `npm run test:e2e` — plateau-app:playwright.config.ts's `testMatch` includes `tests/visual/**/*.spec.ts`, the exact command Done-when item 1 names as its acceptance proof. The card's own 'Where the proof goes' section swept only plateau-app:src/main.ts (exports) and plateau-app:tests/e2e/auth-shell-split.spec.ts, never the tests/visual/ or tests/fidelity/ trees. /console-board is framed by the card itself as an 'operator console surface' analogous to already-gated /backlog — the natural ruling — so landing the fix as designed (adding /console-board to PRODUCT_ROUTES) would flip these tests' target route to a /home redirect, breaking the fixture-content assertion with no task in the card to reconcile it. Disposition: introduced by this preparation (new card), worse than base (silently invalidates currently-meaningful, currently-passing coverage), not parallelizable (entangled with this item's own PRODUCT_ROUTES edit and ruling, can't be fixed in an unrelated lane) — this is the one gap that should hold the card until a task is added. Root cause: the consumer sweep scoped itself to the one test directory the card's body already named, rather than a repo-wide grep for the five literal route strings. Prevention: extend the mechanical 'consumer' presence check (per we:backlog/3103-*.md's own strategy: 'find consumers TWO ways') to grep tests/** and scripts/** for literal matches of every route a card proposes to move between PUBLIC_ROUTES/PRODUCT_ROUTES before the ruling is finalized — not currently a working gate (must be filed).
- **interface** (NOT addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — we:backlog/2512-migrate-plateau-app-routes-into-per-product-subtrees-extract.md (status: open, scope overlaps on plateau-app:src/main.ts and plateau-app:tests/e2e/) hardcodes several claims this card's fix falsifies: its redirect-mechanism section says PRODUCT_ROUTES gets 'the same 25 entries, renamed 1:1... Do not add [the five] to PRODUCT_ROUTES — they aren't in it today either'; its Task 3 says 'rename all 25 PRODUCT_ROUTES entries'; its own Done-when requires isProductRoute() to still exclude /skills and the four console routes 'matching today's behavior exactly', and requires plateau-app:tests/e2e/auth-shell-split.spec.ts to be '(unchanged, still passes)'. All of these go false the moment 3130 lands (adds entries to PRODUCT_ROUTES/PUBLIC_ROUTES and edits that same spec file). 3130's 'Ordering against #2512' section only notes #2512's scope 'will carry the rename of whatever this item lands' — it doesn't add a task to correct #2512's now-stale prose. Disposition: introduced by this card, worse than base if a future #2512 executor follows its own stale text literally (could re-strip the newly-gated entries during its 'same 25' rename, silently reopening the gap 3130 just closed) — but parallelizable, since #2512 already goes through its own independent review (which already caught two rounds of staleness in that same card) before it can land, and a one-line correction to #2512 suffices. Carve-out, not blocking here. Root cause: the ordering check verified scope/file overlap but not whether the sibling card's own hardcoded counts/claims survive this change. Prevention: extend interface-risk presence detection (already scripted per we:backlog/3103-*.md) to flag hardcoded counts or 'unchanged'/'not affected' claims inside an overlapping open card's body about the exact files being touched, not just scope-list intersection; not currently captured as a gate.
- **premise** (addressed; strategy: verify by mutation or reversion up front) — Every specific claim was re-verified against the live repo and held exactly: PUBLIC_ROUTES/PRODUCT_ROUTES/isProductRoute/syncAuthShell line numbers (plateau-app:src/main.ts:263,268-274,275-277,279-289) all match; the mount-conditional line numbers (:407,414-417) match; the CSS citation (plateau-app:src/styles/layout.css:331-337) matches, setting only display:grid + place-items:safe center with nothing that hides content; plateau-app:main.ts genuinely has zero `export` statements and no plateau-app:src/main.test.ts exists; both cited commits (c050cca, 0d0ed9e) are confirmed ancestors of current HEAD; none of the five routes carries a route:guard attribute in plateau-app:index.html (only /settings does) confirming the auth hole is real and total for all five.
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — Done-when items 1-2 require the new e2e assertions to fail before and pass after per route, one assertion per route so a partial fix can't pass — a real, not decorative, gate.

**Corrections recommended:**

- none — the preparation held up as written.

The card's own factual claims (line numbers, CSS lines, commit ancestry, npm scripts, zero-exports, e2e test names) all check out exactly against the live repo, and the core bug is real and precisely diagnosed — but the preparation's consumer sweep missed an existing test suite that already exercises /console-board unauthenticated, which the likely ruling would break.

_Recorded through the declared `review-prep` operation._
