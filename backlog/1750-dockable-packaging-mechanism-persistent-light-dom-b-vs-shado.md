---
kind: decision
parent: "1442"
status: resolved
dateOpened: "2026-06-24"
dateStarted: "2026-06-24"
dateResolved: "2026-06-24"
graduatedTo: none
codifiedIn: "docs/agent/block-standard.md#packaging-governance-1321"
preparedDate: "2026-06-24"
locus: frontierui
relatedProject: webcomponents
relatedReport: reports/2026-06-24-1442-slice-wave-5.md
tags: [packaging, custom-elements, block-model, conversion, dockable, decision, frontierui]
---

# dockable packaging mechanism: persistent light-DOM (B) vs shadow (C, #1349-S2)

## Digest

Pick dockable's custom-element packaging mechanism — the **last block** under epic #1442. Transient (A)
is out (dockable is stateful), so the call is B vs C, the shape of resolved sibling #1674. Recommended
default: **Fork B — persistent light-DOM** (~85%). On the §7 test shadow C is warranted only against
*hostile host CSS* — but dockable's consumer builds its own workspace (friendly host), it is reactive +
content-owning (hosts the author's own panes), and in-leak isolation rides the #1349 `webisolation`
contract without shadow's `ElementInternals` / `::part` tax. Skeptic confirmed B on merit and showed C
would *break* the as-built popout/serialize/drag machinery. One open fork.

## Framing

The decision applies the #1381 mechanism-selection guideline codified in `we:docs/agent/block-standard.md`
§7 (Packaging governance). The §7 B-vs-C test is explicit: pick by what the **primary consumer** needs —
"block facing **hostile / unknown host CSS** that opts into #1349 S2 → (C) shadow (pays the ElementInternals
+ `::part` tax)"; otherwise a reactive / content-owning block → (B) persistent light-DOM, with in-leak
isolation carried by the #1349 `webisolation` contract (§7 item 4 — "encapsulation is **not**
shadow-exclusive"). So the C trigger is a *hostile host*, not *complex chrome*. Dockable ships today as
light-DOM: `fui:blocks/dockable/renderDockable.ts:32` scopes under `BASE_CLASS = 'we-dockable'` with
`WE_DOCKABLE_CSS` keyed on `.we-dockable` (#1349 S1, no shadow; no `attachShadow`/`<slot>` anywhere in the
block). It is content-owning — panes land in real light-DOM `<section tab-panel>` children joined by id
(`fui:blocks/dockable/renderDockable.ts:160,186`), and popout `adoptNode`s the actual panel subtree into a
new window (`fui:blocks/dockable/popoutDockable.ts:100-115`). The sibling #1674 (pan-zoom-surface, identical
B-vs-C shape) resolved to **B** on exactly this reasoning (reactive + content-owning + friendly host) and
its own C-skeptic survived; its conversion task #1707 has landed. This is already-researched ground (the §7
guideline + the #1674 precedent), so no new prior-art survey is needed — the Wave-5 split report is linked.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| Fork 1 — packaging mechanism | **B — persistent light-DOM** (reactive + content-owning + friendly host; §7) | C — shadow (#1349-S2 hostile-host opt-in) | Med-high |

## Fork 1 — persistent light-DOM (B) vs shadow (C)

**Fork-existence:** a genuine either/or — a block is packaged as exactly one mechanism, and C is the
*excluded* branch unless the §7 hostile-host condition holds (a forced gate, not a free choice). Transient
(A) is independently excluded: A is for behavior-free presentational controls, and dockable is a stateful
recursive split tree with drag-to-dock topology mutation, serialize/restore, and popout-to-window.

Crux refs: the §7 B-vs-C test (`we:docs/agent/block-standard.md` §7, item 4 `webisolation`); the as-built
light-DOM state (`fui:blocks/dockable/renderDockable.ts:32`); content-owning panes + popout reparenting
(`fui:blocks/dockable/renderDockable.ts:160,186`, `fui:blocks/dockable/popoutDockable.ts:100-115`); the
resolved sibling precedent (`we:backlog/1674-pan-zoom-surface-packaging-mechanism-persistent-light-dom-b-.md`).

- **(B) Persistent light-DOM — _recommended_.** Selected on the §7 merit, mirroring #1674: dockable is
  **reactive** (serialize/restore + topology state), **content-owning** (it hosts and reparents the
  author's *own* panes, which must keep inheriting page styles), and its **host is friendly** (the consumer
  builds its own workspace, not an unknown third-party page). In-leak isolation rides the #1349
  `webisolation` contract (§7 item 4), so B keeps the no-conflict guarantee without the
  `ElementInternals` / `::part` tax. A hostile-host deployment is served by the #1349-S2 **opt-in upgrade
  on top of B**, not by taxing every friendly-host consumer. (As-built alignment is a zero-cost
  consequence, not the justification — the merit case stands on its own.)
- **(C) Shadow (#1349-S2).** *Rejected* — warranted only if the dock *chrome* must survive hostile/unknown
  host CSS, which the §7 test does not trigger for dockable's friendly-host consumer; complex chrome raises
  the *stakes* of isolation but not *which mechanism* delivers it (light-DOM `webisolation` covers in-leak).
  The strongest pro-C argument — "slot the author panes so you get isolated chrome **and** inheriting
  panes" — is **defeated by the code**: dockable is not slot-based; its panels are light-DOM `<section>`s
  reached by `querySelector('[data-dock-panel]')` and `adoptNode`-reparented on popout
  (`fui:blocks/dockable/popoutDockable.ts:100-115`), so a shadow boundary would break the already-built
  #1510–1514 drag/serialize/popout slices, forcing a re-architecture for no friendly-host benefit.

**Skeptic:** SURVIVES-WITH-AMENDMENT. Attacks on "chrome needs isolation" (§7 trigger is hostile host, not
complexity), "#1674 doesn't bind" (it does — same reactive/content-owning/friendly-host shape), and "is it
shipped to hostile hosts" (no — the S2 opt-in covers that edge) all failed; the decisive one, "slotting
makes C strictly better," collapsed because dockable has no slot architecture and C would break its popout
machinery. Two amendments folded in above: (1) the ruling leads on the §7 merit, **not** "it's what ships
today" (status-quo bias); (2) the pro-C slotting counter + its defeat are recorded.

## Decision turn

Rule B vs C on the §7 test (does the block opt into #1349-S2 hostile-host isolation? — no). On resolve, file
the `we-dockable` conversion `task` under #1442 on pickup (the Wave-1–4 convention: #1674 → #1707, #1675 →
#1706). When that task lands, #1442's catalog is fully drained and the epic resolves.

## Ruling — B (persistent light-DOM), ratified 2026-06-24

**B — persistent light-DOM.** Ratified on the §7 friendly-host test (dockable does **not** opt into
#1349-S2). The discussion grounded three reinforcing facts against the real tree, none of which moved the
call off B:

1. **Dockable is an element, not a behavior.** The packaged unit is the workspace *container* (`we-dockable`,
   a content-owning recursive partition tree), so §7's A/B/C block-packaging governance applies cleanly. The
   "can-do" verbs are already factored out as internal behaviors (`DockDragBehavior`/`DockSplitBehavior`),
   coordinated by the container over *its* topology — not a free-floating capability on arbitrary elements.
2. **Panes are arbitrary author content.** `renderStack` creates empty `<section data-dock-panel={id}>` slots
   and the host registers its own DOM by id (`fui:blocks/dockable/renderDockable.ts:160,186`). Because the
   container adopts arbitrary author elements that must keep inheriting page CSS, a shadow boundary (C) would
   cut every adopted pane off from page styles — and dockable has no `<slot>` to rescue them — actively
   breaking the content-owning model. This is the *strongest* argument **for** B.
3. **The container has real chrome + style.** Root `<div.we-dockable>` with `[data-dock-divider]` resize
   handles and `we-tabs` strips, styled by `WE_DOCKABLE_CSS` injected once globally to `document.head`,
   scoped by `.we-dockable` descendant selectors (#1349 S1, no shadow). So a shadow boundary *could* isolate
   something — but the chrome's isolation need is **conditional** (hostile host only; this consumer is
   friendly) while the panes' need to inherit is **unconditional**. B serves both; C sacrifices the panes to
   protect chrome that needs no protection here. A future hostile-host deployment is served by the #1349-S2
   opt-in on top of B.

Graduates to the `we-dockable` conversion task (filed below), mirroring #1674 → #1707.

## Lineage

Parent epic #1442; Wave-5 split [we:reports/2026-06-24-1442-slice-wave-5.md](/reports/2026-06-24-1442-slice-wave-5.md).
Sibling mechanism decisions: #1674 (pan-zoom-surface B-vs-C, resolved → B, conversion #1707), #1675
(temporal A-vs-B, resolved → A, conversion #1706). Block realization: #1485 (slices #1510–1514) + #1627
(dockview adapter). Deferral gate (now cleared): #1653 (dockable protocol owner), #1486 (protocol mint).
Guideline: `we:docs/agent/block-standard.md` §7 (#1381).
