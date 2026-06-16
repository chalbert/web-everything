---
type: issue
workItem: story
size: 2
status: resolved
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
tags: []
---

# Site navs lack a current-page active state (FUI header + WE docs)

The FUI site header nav and the WE docs nav render no current-page indicator — live-confirmed on :3001/adapters/, where the Adapters link is byte-identical to its siblings (no aria-current, no class). Wire active state using the aria-current=page pattern the repo's own nav:list block spec already defines.

## Evidence (2026-06-16, Playwright on `:3001/adapters/`)

Drove the live page: the `<nav>` has 7 links; the one for the page we're on (`Adapters`, `href=/adapters/`) carries **no `aria-current`, no class** — indistinguishable from siblings. Console clean, so this is a pure markup/styling gap, not a JS failure.

## Where

- **FUI header** — `frontierui/src/_layouts/base.njk:21-29`: hardcoded `<a>` list with inline styles, no current-page logic.
- **WE docs header** — `webeverything/src/_layouts/base.njk`: disclosure menu (#645), also no current-page state on links or section heads.

## The fix (approach is settled — dogfood our own spec)

The repo already ships the correct pattern; the sites just don't use it:

- Block spec: `src/_includes/block-descriptions/nav-list.njk` — `aria-current="page"` + `.active`, indicator = left-border + weight (not color alone).
- Working impl: `demos/navigation-demo.css:55-66`.

In each layout, mark the link whose `href` is a **prefix** of `page.url` (not exact-equality, or top-level items go dark on every child page) with `aria-current="page"`, then style off `a[aria-current="page"]` with a border/weight cue (WCAG 1.4.1 — never color alone) and keep a distinct `:focus-visible` ring. Best practice: WCAG 2.4.8, ARIA APG current-page.

Independent of /backlog/763-gate-ui-best-practices-on-website-changes-rendered-site-a11y/ (which would *catch* this class of regression going forward); this item fixes the present instance and can ship now.
