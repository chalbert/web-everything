---
kind: story
size: 3
parent: "777"
status: open
blockedBy: ["2377", "2376", "2378", "2375", "3122"]
scope:
  - we:tests/a11y/sitemap-routes.ts
  - we:tests/a11y/rendered-site-a11y.spec.ts
  - we:tests/a11y/__tests__/sitemap-routes.test.ts
  - fui:tests/a11y/sitemap-routes.ts
  - we:docs/agent/platform-decisions.md
dateOpened: "2026-07-09"
tags: [dogfood, a11y, ratchet]
---

# Fork-2 endgame: flip the a11y gate to enforce-by-default at the drained milestone

Per [#867](/backlog/867-per-page-rollout-ratchet-for-the-we-docs-fui-dogfood/) Fork 2 (b), codified at
[we:docs/agent/platform-decisions.md#gate-rollout-ratchet](../docs/agent/platform-decisions.md#gate-rollout-ratchet):
once `ENFORCED_ROUTES` equals the live derived scope-C set and the lane is green, invert
`we:tests/a11y/rendered-site-a11y.spec.ts`'s posture to build-blocking-by-default, with an explicit
`WARN_ROUTES` opt-out set replacing `ENFORCED_ROUTES`.

## Status: NOT build-ready today — blocked-in-fact on an un-filed precondition

**The drain is not complete.** Measured 2026-08-15 against the live WE-docs origin (`:8080`,
`deriveScopeCRoutes(fetchSitemapPaths())` run directly): **43 derived routes, 33 enforced, 10 still
warn-only** — the exact same 10 the `we:tests/a11y/sitemap-routes.ts:34-37` comment named stale as of
the 2026-07-28 `#2378` promotion pass (`git log` shows zero commits to that file since). Re-running axe
against all 10 confirms they are genuinely red today, not just unpromoted-but-green:
`/assets/visual-diff-surface-demo/` (color-contrast, html-has-lang, scrollable-region-focusable),
`/backlog/001-resource-specs-and-plans/` (color-contrast, list, listitem), `/blocks/action-button/`
(color-contrast), `/capabilities/adapters/base-select/` (select-name),
`/cases/accordion/01-standard/` (document-title, html-has-lang), `/compat/` (color-contrast),
`/demos/analytics-conformance-demo/` (color-contrast), `/module-resolution/` (document-title,
html-has-lang), `/plugs/customattribute/` (color-contrast), `/semantics/` (select-name).
`isDrainComplete()` (`we:tests/a11y/sitemap-routes.ts:171-176`) returns `false` against this live
measurement, and the self-announcing drain-trigger test
(`we:tests/a11y/rendered-site-a11y.spec.ts:83-99`) is passing (asserting "not yet drained") — it has not
fired.

**This item's own trigger condition — "once `ENFORCED_ROUTES` equals the derived set" — genuinely does
not hold, and no open backlog item was driving it there.** Filed
[#3122](/backlog/3122-remediate-the-10-red-warn-only-we-docs-a11y-routes-completin/) — "Remediate the 10
red warn-only WE-docs a11y routes, completing the #867 ratchet drain" — to close that gap and added it
to `blockedBy` above. **Do not start building this item until #3122 resolves.** Landing #3122 will
itself flip the drain-trigger test red by design ("drain complete — execute the #867 flip") — that is
the intended forcing function, not a regression, and this item should land immediately after (same
session/batch, ideally) to clear it. Everything below is the decided design so the build can start the
moment the blocker clears — **re-measure the route set at execution time rather than trusting anything
above verbatim** (the ratified decision says the same,
`we:backlog/867-per-page-rollout-ratchet-for-the-we-docs-fui-dogfood.md` line 271).

## Grounding — what exists today (all line numbers verified against this clone, 2026-08-15)

- **`we:tests/a11y/sitemap-routes.ts`** — `ENFORCED_ROUTES` (lines 39-75, currently 33 entries),
  `deriveScopeCRoutes` (86-104), `ELEVENTY_ORIGIN`/`fetchSitemapPaths` (114-134, unaffected by this
  item), `gatedRoutes()` (141-144, fallback-to-`ENFORCED_ROUTES` on empty derive is at line 143 — **the
  ratified decision's own code sketch cites this line as `we:tests/a11y/sitemap-routes.ts:96`; that
  number is stale** (pre-`#2378`) — cite 143, not 96, when this item builds), `pendingWarnOnlyRoutes`
  (151-156), `isDrainComplete` (171-176). Header block "FORCED INVARIANT (#774, not a fork)" is lines
  12-15.
- **`we:tests/a11y/rendered-site-a11y.spec.ts`** — imports at 19-28; per-route enforce decision at line
  41 (`const enforce = ENFORCE_ALL || ENFORCED_ROUTES.has(path);`); the self-announcing drain-trigger
  test is lines 71-99 (added by `#2378`, its whole job is to fire exactly once, at this milestone).
- **`we:tests/a11y/__tests__/sitemap-routes.test.ts`** (112 lines) — imports and asserts against
  `ENFORCED_ROUTES`, `isDrainComplete`, `pendingWarnOnlyRoutes` throughout (lines 4-7, 52-77, 80-111).
  All of it needs to change shape (see Tasks).
- **A consumer NOT owned by the a11y gate also imports from this module:**
  `we:tests/smoke/rendered-site-smoke.spec.ts:16,26` — `import { gatedRoutes } from
  '../a11y/sitemap-routes'; … for (const path of gatedRoutes()) { … }`. It does **not** import
  `ENFORCED_ROUTES`/`WARN_ROUTES`, only the route list, so the enforce/warn inversion itself does not
  touch it — but `gatedRoutes()`'s fallback-on-fetch-failure behavior changing from "return the enforced
  seed" to "throw" (below) **does** reach it: a sitemap-fetch failure will now crash smoke-spec test
  collection too, not just the a11y spec's. The ratified decision's stated rationale (a silent
  zero-routes-green pass is the hole the fallback closes) applies identically to the smoke lane, so this
  is very likely the *correct* shared behavior, not a bug — but it must be a **named, verified**
  consequence, not a surprise a builder finds mid-review. Task 4 below covers it.
- **`fui:tests/a11y/sitemap-routes.ts`** (frontier-ui repo, checked out at
  `/Users/nicolasgilbert/workspace/frontierui` in this environment) — its own, **separate**
  `ENFORCED_ROUTES` (lines 24-33, 8 entries) and header (lines 1-9). FUI's gate has **no**
  `isDrainComplete`/drain-trigger test at all (`#2378`'s scope was `we:` only) — FUI never got a
  self-announcing milestone signal, so FUI's own Fork-2 flip has no trigger to fire it and is **not**
  in scope here, even though FUI's own 8-route enforced set already equals its own derived set per that
  file's comment (unverified live in this pass — no FUI dev server was running; irrelevant to this
  item's scope either way, since this item does not invert FUI's logic).
- **`we:docs/agent/platform-decisions.md#gate-rollout-ratchet`** (lines 990-1021) — **the rule this item
  executes is already fully codified here**, written at `#867`'s 2026-07-09 ratification
  (`git log -S"Gate-rollout ratchet" -- we:docs/agent/platform-decisions.md` → `369eceb5`, the `#867`
  ratify commit). It already states both forks, the self-announcing-trigger obligation, and the "`#774`
  rider (ii) superseded" lineage in its own `Lineage:` footer. **This item's originally-declared scope
  line ("plus a `we:docs/agent/platform-decisions.md` entry recording the supersession lineage") is
  therefore already
  satisfied — no new rule text is owed.** The only thing this item could add there is an optional,
  small dated note that the flip *executed* for WE's gate (see Tasks, optional).

## The decided design (already ratified — this item applies it, does not re-litigate it)

No open fork remains; `#867` Fork 2 = (b) is ratified. What follows is the concrete code shape, made
precise against the file lines above (the ratified decision gave a sketch; this fills every gap it left
open).

**`we:tests/a11y/sitemap-routes.ts`:**
```ts
// Replaces ENFORCED_ROUTES (lines 39-75). Starts empty at flip time IF #3122 fully drained the set
// (re-measure — do not assume). Any route still red at execution time becomes an explicit, dated entry
// here instead, per the ratified "experimental surfaces opt out visibly and temporarily" shape.
export const WARN_ROUTES: ReadonlySet<string> = new Set<string>([
  // '/new-experimental-surface/', // opted out 2026-XX-XX, promote-by <date or condition>
]);
```
```ts
// gatedRoutes() (was lines 141-144) — fail-closed: no more silent fallback to a (now-nonexistent)
// enforced-seed array. A caller with a legitimate reason to tolerate a fetch failure must catch this.
export function gatedRoutes(origin?: string): string[] {
  const derived = deriveScopeCRoutes(fetchSitemapPaths(origin));
  if (derived.length === 0) {
    throw new Error(
      'a11y gate: sitemap fetch failed — cannot derive the route set (fail-closed post-#867 flip, #2379)',
    );
  }
  return derived;
}
```
`isDrainComplete` and `pendingWarnOnlyRoutes` (151-176) are **removed** — their sole reason to exist was
detecting this exact milestone, which has now fired and been executed; keeping them around as dead
exports invites a stale re-import. Rewrite the header block (12-15) to state the new invariant and the
`#774` rider-(ii) supersession lineage, e.g.:
```ts
// POSTURE (post-#867 Fork-2 flip, executed <DATE>, #2379): a derived route is build-blocking BY
// DEFAULT; WARN_ROUTES (above) is an explicit, reviewable exception set for routes opting out
// temporarily (new/experimental surfaces). This supersedes #774 rider (ii) — "a newly-derived route
// enters warn-only" — as a successor ruling on changed facts once the site was fully measured and
// drained (docs/agent/platform-decisions.md#gate-rollout-ratchet). #774 part (i) — enforcement is
// always an explicit, reviewable set, never runtime-auto-derived — is PRESERVED: WARN_ROUTES is still
// hand-maintained, exactly like ENFORCED_ROUTES was.
```

**`we:tests/a11y/rendered-site-a11y.spec.ts`:**
```ts
// line 41 was: const enforce = ENFORCE_ALL || ENFORCED_ROUTES.has(path);
const enforce = ENFORCE_ALL || !WARN_ROUTES.has(path);
```
Update the import list (19-28) to drop `ENFORCED_ROUTES`/`isDrainComplete`/`pendingWarnOnlyRoutes`, add
`WARN_ROUTES`. **Delete the drain-trigger test block (71-99) entirely** — its job (detect + loudly
announce this exact milestone) is done; leaving it in place after the flip either asserts a proposition
(`isDrainComplete`) that no longer means anything once `ENFORCED_ROUTES` is gone, or (if left wired to
`WARN_ROUTES`) trivially always passes and is dead weight.

**`fui:tests/a11y/sitemap-routes.ts`** — header only (lines 7-9), **no logic change**:
```ts
// Note (#2379, <DATE>): WE's own mirror gate flipped to enforce-by-default once WE's derived set fully
// drained (docs/agent/platform-decisions.md#gate-rollout-ratchet). FUI's gate keeps #774's
// warn-only-entry posture until FUI's OWN derived set fully drains AND FUI grows its own
// self-announcing drain-trigger (not built here — #2378's trigger was we:-scoped only, see this item's
// Grounding section). The ruling applies per repo, mirrored not shared (#774/#849) — FUI's flip is a
// distinct, future item.
```

**`we:tests/a11y/__tests__/sitemap-routes.test.ts`** — the `deriveScopeCRoutes`/scope-C tests (9-50) are
untouched (that logic doesn't change). Replace:
- The two `ENFORCED_ROUTES`-membership tests (52-77) with `WARN_ROUTES`-shape tests: e.g. "WARN_ROUTES
  starts empty (or contains only dated, commented-justified entries)" and a regression pin per any route
  actually opted out at flip time.
- The entire "drain trigger" `describe` block (80-111) — delete the `isDrainComplete`/
  `pendingWarnOnlyRoutes` tests (that logic is gone); add a test for `gatedRoutes()`'s new throw-on-empty
  behavior (mock/stub `fetchSitemapPaths` → `[]`, assert it throws) to replace the "fetch failure = not
  drained" coverage that block used to carry.

## Tasks (build order)

1. **Re-measure** (`deriveScopeCRoutes(fetchSitemapPaths())` against a live server) — confirm the
   derived set now fully equals `ENFORCED_ROUTES` (i.e. `#3122` actually landed the fix). If any
   route has drifted red since #3122 landed, either fix it first or add it to the new `WARN_ROUTES`
   as an explicit, dated opt-out — do not flip over a red route silently.
2. `we:tests/a11y/sitemap-routes.ts`: rename `ENFORCED_ROUTES` → `WARN_ROUTES` (empty, or seeded per
   step 1), invert `gatedRoutes()` to throw on empty derive, remove `isDrainComplete` +
   `pendingWarnOnlyRoutes`, rewrite the header block.
3. `we:tests/a11y/rendered-site-a11y.spec.ts`: invert the enforce line, update imports, delete the
   drain-trigger test block.
4. `we:tests/smoke/rendered-site-smoke.spec.ts`: run it once against a live server with the sitemap
   briefly unreachable (or a quick unit-level stub of `fetchSitemapPaths`) to confirm the new throw
   behavior fails loud-and-clear rather than crashing the whole Playwright run in a confusing way; adjust
   only if it doesn't degrade cleanly (no design change expected, verification only).
5. `we:tests/a11y/__tests__/sitemap-routes.test.ts`: rewrite per the Interfaces section above.
6. `fui:tests/a11y/sitemap-routes.ts` (**separate repo, separate PR** — the frontierui repo's own
   pipeline, the same delivery precedent `#2375` used — landed there via its own PR, recorded on the WE
   item via `graduatedTo`): header-only edit, no logic change.
7. Optional: append one dated line under `we:docs/agent/platform-decisions.md#gate-rollout-ratchet`
   (after line 1019) recording that WE's gate executed the flip, e.g. "**Executed for WE's gate:** #2379
   (landed \<DATE\>)." Not required — the rule itself is already complete without it.
8. Gate: `npm run check:standards` (0 errors); `npx playwright test --project=chromium tests/a11y`
   against a live server (all routes pass under the new default-enforce posture); `npx vitest run
   we:tests/a11y/__tests__/sitemap-routes.test.ts`; `npx playwright test --project=chromium tests/smoke`
   (unaffected happy-path).

## Done when

- `we:tests/a11y/sitemap-routes.ts` exports `WARN_ROUTES` (no `ENFORCED_ROUTES`, `isDrainComplete`, or
  `pendingWarnOnlyRoutes` remain — `grep -rn "ENFORCED_ROUTES\|isDrainComplete\|pendingWarnOnlyRoutes"
  we:tests/` returns nothing under `we:tests/a11y/`).
- `we:tests/a11y/rendered-site-a11y.spec.ts` line 41's equivalent reads
  `!WARN_ROUTES.has(path)` — a route is enforced unless explicitly listed; the drain-trigger test block
  is gone.
- `gatedRoutes()` throws when `fetchSitemapPaths()` returns `[]`, verified by a unit test that stubs the
  fetch to fail.
- `npx playwright test --project=chromium tests/a11y` run against a live, current WE-docs server is
  fully green (every derived route enforced, 0 violations) — proving the flip didn't silently make the
  build red on landing.
- `npm run check:standards` → 0 errors.
- Both "FORCED INVARIANT (#774)" header comments are rewritten — `we:tests/a11y/sitemap-routes.ts:12-15`
  states the executed flip + the rider-(ii) supersession; `fui:tests/a11y/sitemap-routes.ts:7-9` notes
  WE's flip without claiming FUI's own gate inverted.
- The FUI-repo edit lands as its own PR in the `frontierui` repo (mirrors `#2375`'s delivery precedent).

## Delivery shape

**Two PRs, not one** — this item spans two separate repos with separate PR pipelines (`web-everything`
and `frontierui`), the same delivery shape `#2375`'s FUI mirror-drain used (a FUI-side PR, recorded on
the WE item via `graduatedTo`). The WE-side PR (tasks 1-5, 7-8) is the substantive change and lands as
**one piece** — steps 2 and 3 must land together (inverting the spec's enforce line without renaming the
set it reads, or vice versa, breaks the build immediately, there is no safe intermediate commit). The
FUI-side PR (task 6) is a trivial, independent, comment-only edit with no behavior change and no coupling
to the WE PR's landing order — it can land before, after, or never (nothing depends on it functionally;
it exists only for documentation accuracy in that file).

**Hard precondition, not a design question:** do not open the WE-side PR until a fresh measurement
confirms the derived set is fully drained (Task 1) — this item flips a gate from fail-open to
fail-closed, and flipping it over even one red route ships a build-blocking false failure to every
future WE-docs PR until someone notices and reverts.
