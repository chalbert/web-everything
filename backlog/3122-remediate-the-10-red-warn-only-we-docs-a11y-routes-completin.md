---
bornAs: xuy000v
kind: story
size: 5
parent: "777"
status: open
scope: ["we:tests/a11y/sitemap-routes.ts", "we:tests/a11y/__tests__/sitemap-routes.test.ts", "we:src/"]
scopeRationale: "The fix files are unknown until each of the 10 routes is triaged to root cause — mirrors #2376's shape (3 routes touched a layout front-matter key, a CSS theme file, and 25 unrelated data files depending on cause). we:src/ is a placeholder for whatever templates/CSS/data files the 10 routes' violations trace back to; narrow this once triage is done."
dateOpened: "2026-08-15"
tags: [dogfood, a11y, ratchet]
---

# Remediate the 10 red warn-only WE-docs a11y routes, completing the #867 ratchet drain

Ten of the 43 scope-C-derived a11y routes are still red, blocking the #867 Fork-2 enforce-by-default
flip (#2379). Fix each at root cause and promote all 10 into `ENFORCED_ROUTES`.

Measured 2026-08-15 via a live scope-C run against the running WE-docs origin (`:8080`): `/assets/visual-diff-surface-demo/` (color-contrast, html-has-lang, scrollable-region-focusable), `/backlog/001-resource-specs-and-plans/` (color-contrast, list, listitem), `/blocks/action-button/` (color-contrast), `/capabilities/adapters/base-select/` (select-name), `/cases/accordion/01-standard/` (document-title, html-has-lang), `/compat/` (color-contrast), `/demos/analytics-conformance-demo/` (color-contrast), `/module-resolution/` (document-title, html-has-lang), `/plugs/customattribute/` (color-contrast), `/semantics/` (select-name).

These are the same 10 routes the `we:tests/a11y/sitemap-routes.ts:34-37` comment named stale as of the 2026-07-28 `#2378` promotion pass — zero further remediation/promotion has landed since (`git log` shows no commits to that file since `#2378`). Fix each at root cause (mirror `#2376`/`#2377`'s per-route approach — both fixed the real markup/CSS defect, never suppressed the check), re-measure green, then append all 10 to `ENFORCED_ROUTES` (`we:tests/a11y/sitemap-routes.ts`) so the derived set fully equals the enforced set.

This is the genuine blocker on `#2379` (the Fork-2 enforce-by-default flip): `#2379`'s own precondition ("once `ENFORCED_ROUTES` equals the derived set and the lane is green") does not hold yet, and no open item was driving it there before this one was filed. Landing this item will make the self-announcing drain-trigger test (`we:tests/a11y/rendered-site-a11y.spec.ts:83-99`) FAIL by design ("drain complete — execute the #867 flip") — that is the intended signal, not a regression; `#2379` should land immediately after to clear it, ideally the same session/batch.

## Design

### Run order — measure, then triage per route, then promote in one edit

The remediation is ten independent root-cause fixes, but the *gate* work is one edit at the end. Do it in that
order; promoting as you go leaves the enforced set half-written if the batch stops early.

1. **Re-measure first, in the lane's own dev pair.** The route list is 2026-08-15 data, and #2376's own
   close-out records that re-measuring before fixing is what kept its list honest. `ELEVENTY_ORIGIN`
   (`we:tests/a11y/sitemap-routes.ts` ~L112) reads `WE_ELEVENTY_PORT`, so a lane clone derives from its OWN
   sitemap — without that env the fetch hits main's `:8080`, `gatedRoutes()` (~L141) silently collapses to its
   `ENFORCED_ROUTES` fallback, and the warn-only routes are never exercised at all. A green run in that state
   is a false green, so confirm the derived count is 43 (not 33) before trusting any measurement.
2. **Fix each at root cause.** `A11Y_ENFORCE=1` flips the whole lane to build-blocking, which is how you get a
   red-then-green signal per route without touching `ENFORCED_ROUTES`. The `-g` filter narrows to one route
   (the test title is `` `WE-docs a11y · ${path} (enforced|warn-only)` ``, ~L44).
3. **Promote all ten into `ENFORCED_ROUTES`** (~L39–75) in one edit, and update the two stale prose blocks in
   the same file that name them: the `PROMOTION (#2378…)` docblock's "43 derived, 33 green, 10 red" line
   (~L28–31) and the "Still warn-only (red at this measurement…)" list (~L34–37).

### One consumer test WILL redden, and it is not the drain trigger

`we:tests/a11y/__tests__/sitemap-routes.test.ts` is a **vitest** unit suite over the same module, and its
`promotes the measured-green routes into ENFORCED_ROUTES (#2378, per #867 Fork 1)` case (~L69–77) ends with:

```
// Routes red at the fresh measurement stay warn-only — NOT promoted.
expect(ENFORCED_ROUTES.has('/semantics/')).toBe(false);
expect(ENFORCED_ROUTES.has('/compat/')).toBe(false);
```

Both routes are in this item's ten. Promoting them flips those two assertions and turns that test red — in
the SHARDED `vitest run` of CI's `test` job, which is a different runner from `npm run test:a11y` entirely.
Update those two lines (they are a 2026-07-28 snapshot of "still warn-only", not an invariant) in the same
edit as the `ENFORCED_ROUTES` promotion. This is why the test file is in `scope:` and why criterion 3 below
runs vitest as well as playwright.

### The intended failure at the end

`we:tests/a11y/rendered-site-a11y.spec.ts` ~L83–99 asserts `isDrainComplete(derived)` is **false**. Promoting
the last ten makes it **true**, so that test FAILS with *"drain complete — execute the #867 flip"*. That is the
self-announcing trigger working, not a regression. Two consequences to plan for:

- **Do not silence it.** The whole point of #2378 pulling the trigger forward was that a milestone nobody
  notices rots. Suppressing or inverting the assertion here is the one thing this item must not do — #2379
  owns the inversion.
- **The lane lands red on that one test.** `we:backlog/2379-…md` is `status: open` and already carries
  `blockedBy: ["2377", "2376", "2378", "2375", "3122"]`, i.e. this item is its last open prerequisite. Land
  #2379 in the same session/batch, or state plainly on this item that `npm run test:a11y` is expected red on
  the drain-trigger test until it does.

### Root-cause discipline, from the two prior passes

#2376 and #2377 both fixed the real defect and neither suppressed a check. The causes #2376 found are the
priors worth carrying in: a missing `layout:` front-matter key (page rendered with no `<html lang>`/`<title>`
at all — which is exactly the `document-title` + `html-has-lang` pair seen here on `/cases/accordion/01-standard/`
and `/module-resolution/`), a Prism theme token below contrast in `we:src/css/prism-theme.css`, and an
`overflow-x: auto` `pre` that was not keyboard-focusable (the SCR29 fix in `we:src/assets/js/copy-code.js` —
the same `scrollable-region-focusable` violation now reported on `/assets/visual-diff-surface-demo/`). Check
those three before starting a fresh investigation; several of the ten may already be covered by a shared
template or CSS fix, which is also why the item's `scope` is deliberately broad.

`color-contrast` on six of the ten (`/backlog/001-…/`, `/blocks/action-button/`, `/compat/`,
`/demos/analytics-conformance-demo/`, `/plugs/customattribute/`, plus `/assets/visual-diff-surface-demo/`)
strongly suggests one or two shared theme values rather than six page-level bugs — measure the failing
node/selector before editing any page.

## Done when

1. `A11Y_ENFORCE=1 npm run test:a11y`, run against the lane's own dev pair, is green for all ten routes named
   in the digest — each was red before. Ten routes, ten enforced passes; a run that is green because the
   derived set collapsed to the 33-route fallback does NOT count (see Design step 1). (Tier 1.)
2. `ENFORCED_ROUTES` in `we:tests/a11y/sitemap-routes.ts` contains all 43 derived routes — one count check
   over the set, and `pendingWarnOnlyRoutes(derived)` returns `[]`. (Tier 2.)
3. `npx vitest run sitemap-routes` is GREEN — the two `toBe(false)` assertions on `/semantics/` and
   `/compat/` in `we:tests/a11y/__tests__/sitemap-routes.test.ts` (~L74–76) were updated with the promotion,
   not left to fail in CI's sharded `vitest run`. This is a different runner from `test:a11y`; running only
   the playwright suite hides it. (Tier 1.)
4. `npm run test:a11y` FAILS on exactly one test — `WE-docs a11y · #867 drain trigger` — with the message
   *"drain complete — execute the #867 flip"*, and on no other. That single expected failure IS the proof the
   ratchet drained; anything else red means a route regressed. State it on the item and on the PR. (Tier 1.)
5. The two stale prose blocks in `we:tests/a11y/sitemap-routes.ts` (the "43 derived, 33 green, 10 red"
   promotion docblock and the "Still warn-only" list) no longer name routes that are now enforced. (Tier 2 —
   one read of that file's header.)
6. No violation was suppressed: every fix is a markup/CSS/data change at root cause, and the per-route cause
   is recorded on this item the way #2376's close-out records its three. An axe rule disabled, a route removed
   from the derived set, or a `.axe-exclude` added fails this criterion. (Tier 3 — read the per-route notes
   added to this card.)

## Independent review — 2026-08-21

Confidence: **Medium**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: verify by mutation or reversion up front) — The 2026-08-15 measurement is 6 days stale by today (2026-08-21), but the card's Design step 1 explicitly requires re-measuring in the lane's own dev pair before trusting the list, and calls out the WE_ELEVENTY_PORT false-green trap (we:tests/a11y/sitemap-routes.ts:106-114).
- **consumer** (NOT addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — we:tests/a11y/__tests__/sitemap-routes.test.ts:69-77 hardcodes `expect(ENFORCED_ROUTES.has('/semantics/')).toBe(false)` and `.has('/compat/')).toBe(false)` — both routes the card promotes into ENFORCED_ROUTES. The card's declared scope (we:tests/a11y/sitemap-routes.ts, we:src/) omits this test file, and its Done-when never runs `npm test` (vitest), only `npm run test:a11y` (playwright) and a header re-read.
- **blast-radius** (addressed; strategy: measure against the real corpus before wiring) — Done-when #1 (A11Y_ENFORCE=1, whole lane) and #3 (npm run test:a11y fails on exactly one test, no other) together catch any collateral regression a shared color-contrast token fix could cause in already-enforced routes.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — The card explicitly forbids silencing the drain-trigger assertion and requires stating the expected single red test on the item and PR (Design 'The intended failure at the end').

**Corrections recommended:**

- none — the preparation held up as written.

The card's factual claims (route lists, line numbers, git history, the 33+10=43 math) all check out live, but it misses a consumer test file that will break the moment the 10 routes are promoted.

_Recorded through the declared `review-prep` operation._
