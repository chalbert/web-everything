---
type: idea
status: open
dateOpened: "2026-06-07"
tags: [droplist, anchor, popover, positioning, provider, floating-ui, di]
relatedReport: reports/2026-06-02-dropdown-trait-composition.md
relatedProject: webblocks
crossRef: { url: /backlog/136-anchor-trait-behavior/, label: Anchor trait behavior }
---

# Make the anchor positioning *strategy* a swappable DI provider

Building the `anchor` trait (#136) delivered the behavior/provider split tracked in
[#023](/backlog/023-droplist-composition-open-contracts/) (contract 1): the `anchor`
behavior owns open/dismiss, and the new `anchored` behavior owns placement — emitting
**CSS Anchor Positioning** (`anchor-name` ↔ `position-anchor`, `position-area`,
`position-try-fallbacks`) plus optional Popover, the native-first path from
[#063](/backlog/063-terminology-native-anchor-field/).

What's still open is the *strategy swap*: CSS Anchor Positioning is not yet in every
engine, so a surface that must place correctly there needs a **JS fallback** (e.g. a
Floating UI adapter). Per #023/open-question #2 that strategy belongs behind a **DI
provider** the surface consumes — `anchored` declares *intent* (placement + collision),
the provider decides *how* (native CSS vs. JS loop). Today `anchored` hardcodes the
native path.

Build:
- A `positioningStrategy` provider on the injector chain (mirrors `loaderIntent`):
  resolves `native` (CSS, the current behavior) or a JS adapter.
- `anchored` reads it and delegates: native → emit CSS (as now); JS → run a placement
  loop (anchor rect → preferred side → flip/shift/resize → write inset), cleaned up on
  disconnect.
- Feature-detect CSS anchor positioning to pick a sane default when unset.

Acceptance: `anchored` defers placement to an injected strategy; the native CSS path is
the default and unchanged, and a JS adapter can be swapped in app-wide via one injector
line. Validate both against a **real browser demo** (the placement/`position-area`
mapping is currently asserted only as emitted styles in happy-dom — never positioned
for real); a conformance-playground autocomplete is the natural home.
