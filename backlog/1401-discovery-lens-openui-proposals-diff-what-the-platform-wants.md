---
kind: story
size: 3
parent: "1399"
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: none
tags: [discovery, lens, openui, platform, standards-in-flight, gap, book-candidate]
---

# Discovery lens — OpenUI proposals diff (what the platform wants to standardize)

Run the [discovery](/backlog/1399-latent-standard-discovery-lens-catalogue-each-lens-only-emit/)
discipline against the **OpenUI** community-group catalogue and active WHATWG/W3C UI proposals. OpenUI
exists to answer "which components/behaviors *should* be standardized," so its research pages (select /
selectlist / customizable-select, popover, anchor positioning, tabs, toggle, tooltip, menu, combobox,
spinner, breadcrumb, …) are a curated list of latent standards with prior-art already gathered. Diff each
against [we:src/_data/intents/](../src/_data/intents/) + [we:src/_data/blocks/](../src/_data/blocks/);
every ❌ / partial → a card (placement-unsure → `decision`). Overlaps the platform-API watch
([#1257](/backlog/1257-platform-standards-watch-keep-we-current-as-the-web-platform/)) — coordinate so a
shipped-API and its OpenUI origin don't double-file.

## Do

- List the current OpenUI research/proposal index (cite date).
- For each proposal: covered / partial / ❌ against the registry.
- File a `book-candidate` card per gap; reuse #1257 where the proposal has already shipped as a Baseline API.

## Run 1 — 2026-06-21 (OpenUI Community Group component research index)

Diffed the OpenUI component research catalogue against
[we:src/_data/intents/](../src/_data/intents/) + [we:src/_data/blocks/](../src/_data/blocks/).

**Covered** (named owner): accordion → `disclosure`/`disclosure-nav` (+ exclusive-accordion via the
details-name capability); breadcrumb → `breadcrumb`; buttons → `button`/`action` (+ `command` intent /
Invoker Commands capability); carousel → `carousel`; checkbox → `checkbox`; combobox → `type-ahead` +
`autocomplete` + `dropdown`; dialog → `dialog`/`modal`; disclosure → `disclosure`; dropdown →
`dropdown`/`droplist`; grid → `data-grid`; listbox → `selection` + `droplist`; menu / menu-button →
`menu` (+ `inline-trigger`); notify/toast → `notification` (+ `notification-marker`); pagination →
`pagination`; progress → `flow-progress` (+ `status-indicator`); radio → `radio-group`; select →
`droplist` + the Customizable `<select>` capability; slider → `slider`; spinner → `stepper`; switch/toggle
→ `toggle-switch`; table → `data-table`; tabs → `tabs`; tag/chip → `tag`; tooltip → `tooltip`; tree →
`tree-select`.

**Gaps — none new.** Every un-owned OpenUI item is already filed by a sibling lens or routed to the
platform-API watch, so filing here would duplicate:
- meter/gauge → already [#1410](/backlog/1410-meter-gauge-quantitative-readout-standard-placement/) (APG lens).
- treegrid → already [#1411](/backlog/1411-treegrid-hierarchical-interactive-data-grid-standard-placeme/) (APG lens).
- toolbar/roving-tabindex → already [#1409](/backlog/1409-toolbar-roving-tabindex-control-group-standard-placement/) (APG lens).

**Dismissed with reason (shipped-API → route to [#1257](/backlog/1257-platform-standards-watch-keep-we-current-as-the-web-platform/), per the no-double-file note):**
- *Popover* → Baseline 2024, owned by the `popover` capability; *Anchor Positioning* → the Anchor
  Positioning Protocol (`anchor` intent); *Customizable `<select>`* → the `customizable-select` capability;
  *Invoker Commands (`command`/`commandfor`)* → the `invokers` capability + `command` intent. These are
  platform APIs WE already consumes — the platform-standards watch (#1257) tracks their evolution, not a new
  book-candidate.
- *interest invokers (`interestfor`, hover/focus-triggered popovers / hovercards)* → the emerging declarative
  trigger for the `hover-intent` intent + `tooltip` concern; an in-flight platform API → #1257, not a new
  standard.
- *scroll-marker / `::scroll-button` carousel, scroll-driven UI* → the scroll concern is already filed as
  [#1407](/backlog/1407-scroll-driven-ui-scroll-progress-scroll-spy-scroll-linked-an/) (verb-axis); the
  carousel concern is owned by `carousel`.
- *pull-to-refresh* → already [#1396](/backlog/1396-pointer-gestures-swipe-long-press-pinch-pull-to-refresh-plac/) (pointer-gestures).
- *toggletip* → a composition of `tooltip` (transient surface) + `popover` + `live-region-status`
  (announce); a tooltip interaction dimension, not its own standard. (A `we:src/_data/semantics/toggletip.json`
  glossary term already records the concept.)

**Conclusion:** the OpenUI component axis is **saturated** against the WE registry (WE was built largely
from this prior art) — 0 new cards this round, consistent with the /gap-sweep component-axis saturation
(2026-06-20). Re-run when OpenUI publishes a genuinely new research page.

## Done when

Every OpenUI proposal has a verdict and each gap is a filed card or dismissed-with-reason.
**Round 1 complete (2026-06-21) — 0 new cards (axis saturated; emerging APIs routed to #1257).**
