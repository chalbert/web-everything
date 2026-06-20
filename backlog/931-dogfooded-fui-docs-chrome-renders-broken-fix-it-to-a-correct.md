---
kind: story
size: 8
parent: "777"
status: resolved
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: "@frontierui/blocks/disclosure-nav/"
locus: frontierui
relatedProject: webdocs
tags: [dogfood, fui-blocks, chrome]
---

# Dogfooded FUI docs chrome renders broken — fix it to a correct collapsed horizontal header

#865 mounted the FUI mode-C chrome on the live WE-docs and was resolved as "browser-verified (0 axe violations)" — but axe only checks a11y, so the **visual** breakage was never caught. The mounted chrome renders broken on every page: a 586px-tall, full-width vertical accordion with all sections force-expanded, the page content shoved entirely below the fold, and the warm body gradient bleeding over everything. This item makes the dogfooded FUI chrome render a correct compact **horizontal** header that matches the SSR baseline, so #777 ("the site as conformance proof") actually holds. Locus FUI (impl→FUI, #765).

## Root cause (Playwright-confirmed on the live :8080/:3001, 2026-06-18)

The FUI mode-C SDK `attachShadow`es `#we-chrome-shell` and calls `fui:embed/chrome-in-document.ts` → `mountInDocument`, which composes `createSectionedNav()` / `createButton()` into the **shared** app-shell shadow root via `mountAppShell`. Three independent defects make this render broken as a site header:

1. **Composed sub-block CSS is dropped.** The `create*` factories return unstyled DOM; each block's stylesheet ships only through its own `mount*`/demo path, never into the shared app-shell root (which injects only its own `SHELL_CSS`). → nav + header buttons render with zero styling. *(Partial fix already applied — see below.)*
2. **sectioned-nav defaults every section open, with no toggle wired.** In the mode-C in-document mount there is no behavior registry, so the APG-disclosure heads (`aria-expanded`/`aria-controls`) never collapse — all 3 lists render un-`hidden` (measured `openLists: 3 of 3`), producing 586px of stacked links. The factory must default sections collapsed and wire click/Escape toggling imperatively (the `mountInDocument` convention, like #870's note on `nav:section`).
3. **app-shell lays the nav as a full-width vertical block + no content surface.** `mountAppShell` appends `<nav>` as a block after `<header>` with no horizontal layout, and `.fui-app-shell__main` has only `padding: 1rem` (no opaque surface). So the nav is a full-width sidebar-shaped strip and WE's body gradient (`we:style.css` `body { background: linear-gradient(...) }`, intended as a subtle frame behind a `.page-sheet`) bleeds across the whole viewport.

The SSR baseline (FUI host blocked → graceful degradation) renders the **correct** target: a compact horizontal top-right disclosure nav, gradient as a subtle frame. That is the visual contract reproduced below.

## Decided approach — recreate the SSR nav as a FUI block

Rather than restyle the vertical `sectioned-nav` into a header (a buried fork: reuse vs new block), the call
was to **faithfully reproduce the nav WE-docs already ships** as a new FUI block. Key realization: the SSR
nav *is* the full responsive disclosure nav (horizontal dropdown-panels desktop, vertical accordion under
940px); FUI's `sectioned-nav` (#870) only built the **vertical-accordion half** — which is exactly why the
mount looked like a stuck-open mobile menu. So the fix ports the whole SSR nav (`we:src/css/style.css`
`.nav-menu*` + `we:src/assets/js/reveal-nav.js`) into a dedicated **`disclosure-nav`** block. `sectioned-nav`
stays the pure vertical accordion for sidebars; `disclosure-nav` is the horizontal-popup header.

## Resolved — built + browser-verified (2026-06-18)

**FUI (`../frontierui`):**
- **New block `fui:blocks/disclosure-nav/DisclosureNav.ts`** — horizontal APG Disclosure Navigation: a row of
  `<button aria-expanded aria-controls>` heads, each disclosing an absolutely-positioned dropdown `__panel`,
  collapsing to an inline accordion under 940px. CSS ported from `.nav-menu*` (custom props resolved to the
  theme's concrete values, since shadow-isolated styles don't inherit `--color-*`). Behavior ported from
  `we:src/assets/js/reveal-nav.js` and wired imperatively (no in-document behavior registry): click/Enter/
  Space toggles (siblings close), Escape collapses + refocuses the head, outside click/focus dismisses.
  Sections default **collapsed**. `createDisclosureNav` / `mountDisclosureNav` / `mountInDocument` +
  `fui:blocks/disclosure-nav/index.ts`.
  - **Shadow-DOM fix:** the document-level outside-click handler uses `event.composedPath()`, not
    `event.target` — across a shadow boundary the event retargets to the host, so `target` checks wrongly
    classified every in-nav click as "outside" and slammed the panel shut on open.
- **`fui:blocks/app-shell/AppShell.ts`** — added `navInHeader` so the nav landmark sits *inside* the header
  bar (brand-left / nav+controls-right via `margin-left:auto`) instead of as a full-width block below it.
- **`fui:embed/chrome-in-document.ts`** — composes `createDisclosureNav` with `navInHeader: true`, injects
  `DISCLOSURE_NAV_CSS` into the shared shell root (the defect-1 composed-CSS gap, now via this block).
- Earlier defect-1 groundwork kept: `SECTIONED_NAV_CSS` / `BUTTON_CSS` exported for shared-root composition.
- Registered: `fui:src/_data/blocks.json` + `fui:blocks/package.json` exports.
- Tests: `fui:blocks/__tests__/unit/disclosure-nav/DisclosureNav.test.ts` (9) + 2 new `#931 regression guards`
  in `fui:embed/__tests__/chrome-in-document.test.ts` (nav-in-header, sections-collapsed).

**WE (`.`):**
- `we:src/_data/blocks/disclosure-nav.json` + `we:src/_includes/block-descriptions/disclosure-nav.njk`
  (the `/blocks/disclosure-nav/` page, renders 200). Regenerated `we:AGENTS.md` inventory.

**Verified (Playwright, live :8080 + :3001):** the mounted nav is **31px tall** (was 586), all sections
**collapsed** by default (0 visible panels; was 3-of-3 open), page content starts at **y=65** (was 659).
Clicking a head opens its dropdown popup; outside-click + Escape close it; the current route's link is bold.
No console errors. Matches the SSR baseline.

**Gates:** FUI `tsc` clean, `vitest` 1808 pass / 0 fail, `check:standards` 0 err. WE `check:standards` 0 err
(the one remaining repo error is a registry code-path ref in another session's untracked split report, not this work);
11ty dryrun clean.

## Notes

- Does **not** reopen #865 — its transport (#881 `data-chrome-config`) and mount machinery are correct and
  shipped; this item superseded only the visual-correctness portion that #865's axe-only "verified" claim
  overstated. The new regression guards make a layout regression fail a unit test, not just an eyeball.
- The earlier "opaque content surface" criterion turned out unnecessary: once the nav is a compact bar, the
  body gradient reads as the same subtle frame as the SSR baseline (which also has no `.page-sheet` on
  `/backlog/`). No app-shell surface change was needed.
- No global custom-element tag registered (the WE↔FUI tag-naming convention is the open decision #841),
  consistent with the rest of the #870 chrome set.
- **Interim by design — superseded by #934.** This block's behavior is hand-wired `addEventListener`, which
  re-implements the existing `nav:section`/`nav:list` WE traits. It fixed the *rendering* but is a weak
  conformance proof. The proper version composes those traits via the webbehaviors registry (gated on the
  #932 mode-C registry-boot decision); the rework is epic #934. This incident also motivated the work-method
  reinforcement #933 (enforce compose-over-hand-roll). Treat the disclosure-nav behavior code as provisional.
