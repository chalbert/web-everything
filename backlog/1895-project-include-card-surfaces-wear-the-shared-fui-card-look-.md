---
kind: story
size: 5
parent: "1601"
status: open
dateOpened: "2026-06-27"
dateStarted: "2026-06-29"
tags: [we-card, fui-card, card-style, base-flavor, dogfooding, css-dedup]
relatedProject: webdocs
---

# project-include card surfaces wear the shared fui-card look; retire bespoke section-card/standard-card style

## REOPENED 2026-06-29 — the resolve was REVERTED (false premise, caused a visual regression)

The resolve removed the bespoke `.section-card` / `.standard-card` frame on the theory that **every**
such surface also carries `.fui-card` (from #1608's migration) and so gets its frame there. **That premise
is false.** Those classes are used **bare** (no `.fui-card`) across ~14 templates — `we:src/backlog-pages.njk`,
`we:src/state-pages.njk`, `we:src/conformance.njk`, `we:src/plug-pages.njk`, `we:src/demos.njk`, and more.
Removing the frame stripped the white container from all of them — confirmed on `/backlog/NNN/` detail pages
(the `.section-card` wrapper computed to transparent bg / 0 border / 0 radius / 0 padding; content floated
on the bare page background). Reverted the `we:src/css/style.css` change; the bespoke frame is load-bearing
and stays.

**What would actually unblock this dead-CSS sweep:** first migrate the bare `.section-card` / `.standard-card`
surfaces so they *also* emit `.fui-card` (a #1601 sibling, broad), OR confirm `.fui-card` is globally loaded
on every page that uses these classes (it currently lands cross-origin only where the FUI registration ESM
loads — not on `/backlog/`). Until one of those holds, the frame can't be removed. **Lesson:** a "dead CSS"
removal must grep *every* consumer of the class, not just the migrated one — and a before/after visual check
on a sample page would have caught this immediately.

---

The **CSS-cleanup tail** of the card migration. #1608 migrates each card surface to a product component
(`standard-card`/`standard-section`) that composes the FUI primitive and thus wears the shared `.fui-card`
look — so the WE-local bespoke *frame* CSS (`.section-card` + `.standard-card` at
`we:src/css/style.css:817-845,1329-1351,1427`) becomes dead weight. This item is the dead-CSS sweep after
#1608: retire those frame rules, keeping only their non-look bits (`:target` scroll-margin, `h3`/`h4` heading
rules). Dogfoods #1886's tokenized-base principle instead of asserting it.

## Why this is its own item (the cleanup tail, not the migration)

#1608 authors the product components and migrates the surfaces onto them (the components compose `.fui-card`).
This item is the **follow-on CSS sweep** that removes the now-redundant bespoke frame once #1608 lands — kept
separate so the migration stays bounded and the dead-CSS removal is verified against live `:target`/anchor
behavior on its own. (Originally a prose "folded into #1886's base/flavor layering" residual — scaffolded into
a real, tracked item so it can't silently evaporate.)

## Current bespoke style (what to reconcile)

- **`we:.section-card`** (`we:src/css/style.css:817-845`) — border / radius / background frame **plus** `h3`/`h4`
  heading rules; `.section-card:target` scroll-margin (`1427`). The frame bits overlap `.fui-card`; the
  `:target` margin + heading rules are non-look and must survive.
- **`we:.standard-card`** (`we:src/css/style.css:1329-1351`) — frame + `:hover` + `h4` heading rule. After
  #1608 this class rides through onto the migrated `<article class="standard-card fui-card">`, so its frame
  rules become last-wins dead weight against `.fui-card`'s own frame.

## Scope

1. The migrated `standard-card` surfaces (ex-`<div class="standard-card">`, now `<article class="fui-card">`)
   get their frame from `.fui-card`; drop `.standard-card`'s redundant border/radius/background, keep only its
   non-look rules (`standard-card h4`).
2. The migrated `standard-section` surfaces (ex-`<section class="section-card">`, now `<section class="fui-card">`
   via the product component) get their frame from `.fui-card`; retire `.section-card`'s bespoke frame, keep
   `.section-card:target` scroll-margin + heading rules.
3. Confirm the shared `.fui-card` CSS is globally present on the docs page (it lands cross-origin once the FUI
   registration ESM loads — `we:src/css/style.css:1766-1767`) before removing any bespoke frame, so there is
   no unstyled flash.

## Done when

Project-include card surfaces render their frame from the single shared `.fui-card` look; `we:.section-card` /
`we:.standard-card` retain only their documented non-look responsibilities; no visual regression on the
`/project/*` docs pages and the deep-link `:target` anchors still scroll correctly.
