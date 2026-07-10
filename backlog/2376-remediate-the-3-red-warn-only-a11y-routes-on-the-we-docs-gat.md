---
kind: story
size: 2
parent: "777"
status: resolved
dateOpened: "2026-07-09"
dateStarted: "2026-07-10"
dateResolved: "2026-07-10"
graduatedTo: none
tags: []
---

# Remediate the 3 red warn-only a11y routes on the WE-docs gate

Three warn-only routes fail a11y and were first seen red only by #867's prep measurement: /semantics/ (button-name, select-name), /web-contexts/ (document-title, html-has-lang), /rules/backlog-workflow/ (scrollable-region-focusable). Remediate each so it measures green and becomes promotable per #867 Fork 1. Re-measure before starting (route list is from 2026-07-02).

## Progress (resolved 2026-07-10)

Re-measured first (`npx playwright test tests/a11y -g "semantics|web-contexts|backlog-workflow"` against the lane's own dev pair, `.env.local` sourced — the route list still matched). All three fixed at root cause, not papered over:

- **`/web-contexts/`** (`document-title`, `html-has-lang`): `we:src/web-contexts.md` was missing a `layout:` front-matter key pointing at the shared base layout, so 11ty rendered it standalone — no `<html lang>`/`<title>` wrapper at all. Added the missing layout reference. That in turn surfaced the page's Prism code block for the first time under the site theme: `.token.comment` (One Dark `#5c6370` on `#282c34`, 2.32:1) failed `color-contrast` (7 nodes) — lightened to `#949eab` (5.16:1) in `we:src/css/prism-theme.css`, same rationale as the existing inline-code fix in that file (#793).
- **`/semantics/`** (`button-name`, `select-name`): traced to a real bug in the FUI `component-render` SSR harness (a *different* repo, out of this lane's reach) — its card-body-parts renderer silently HTML-entity-decodes trusted `html` strings once, so a glossary term's intentionally-escaped example markup (meant to display as literal text, e.g. an escaped `button commandfor="panel-1"` tag) comes out the other side as a REAL, nameless button/select element. Worked around on the WE side (no FUI access from this lane) by double-encoding every glossary term's `definition`/`usage` field that carries this escaped-example-markup pattern (25 files under `we:src/_data/semantics/`) — the harness's single decode pass lands them back at the correct single-encoded, safe form. `we:src/_data/semantics/customizable-select.json` additionally had a genuinely unescaped literal select tag in its `term`/`definition` (not the entity pattern) — renamed the term to drop the raw angle brackets (slug unchanged, no anchor breakage) rather than double-encode, since `term` also renders outside the FUI pipeline (the alpha-index), where double-encoding would have shown the literal entity text instead. Net effect: the FUI decode bug itself is NOT fixed (still live for any future term authored with a single escaped-tag example — flagged here as a follow-up, not filed against this WE-only item). Small known tradeoff: a handful of the 25 terms' hover-tooltip text (the alpha-index `title=` attribute, a path that never reaches the FUI harness) now shows the double-encoded entities literally instead of the intended angle brackets — cosmetic only, not axe-checked.
- **`/rules/backlog-workflow/`** (`scrollable-region-focusable`, 4 nodes): the site's `pre` code blocks (`overflow-x: auto` in `we:src/css/style.css`) can scroll horizontally on a long unbroken line but were never keyboard-focusable. `we:src/assets/js/copy-code.js` (the client script that wraps every code block for the copy button) now sets a `tabindex` of `0` on the block it wraps, site-wide — the standard SCR29 fix.

`npm run check:standards` (whole-repo) and `npm test -- run` both green. Re-verified all three routes at 0 violations via the lane's own dev server before resolving. Deliberately did NOT add the three routes to the enforced route set (`we:tests/a11y/sitemap-routes.ts`) — the item's ask was to make them green/"promotable" per #867 Fork 1, not to promote them; promotion is a distinct, separate action left for a follow-up pass over the now-26-of-29-green warn-only set.
