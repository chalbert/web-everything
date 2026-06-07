---
type: idea
status: active
dateOpened: "2026-06-06"
tags: [droplist, autocomplete, custom-element, demo, registration, traits]
relatedReport: reports/2026-06-02-dropdown-trait-composition.md
relatedProject: webblocks
crossRef: { url: /blocks/autocomplete/, label: Autocomplete block }
---

# Register a real `<auto-complete>` custom element + browser demo

#122 proved the `filter` + `clearable` + `focus-delegation` + `selection` composition end-to-end via
an integration test that upgrades the behaviors manually (`attach` + `connectedCallback`) — the same
"runnable" proof the rest of the plateau attribute lib uses. What does **not** exist yet is a shipping,
registered `<auto-complete>` element or a browser-runnable demo: the element glue (open-on-focus,
fetch-on-`filter`, write-on-commit) lives only inside the trace test's harness.

Build the convenience element + a demo:

- **Register `<auto-complete>`** — a form-associated custom element that internally composes the five
  traits over its `<input role="combobox">` + `<ul role="listbox">` + shared `role="status"` region,
  and owns the glue the test currently fakes (open/dismiss — ideally delegating to `anchor` #136,
  commit-write-back, source wiring). Decide the granularity question from
  [#023](/backlog/023-droplist-composition-open-contracts/): one `<drop-list>` with attributes vs. a
  distinct `<auto-complete>` tag.
- **Browser demo** — a conformance playground (per the demo-first workflow) driving a live async
  source so the "par → arrow → enter" trace is visible/clickable, not just asserted in jsdom.
- **Enhancement to fold in:** `filter`'s client matcher is plain substring (`par` won't match
  `Pärnu`). Add diacritic-insensitive normalization (NFD + strip combining marks) for the client
  path so accented options match — small, bounded, and a real autocomplete expectation.

Acceptance: `<auto-complete>` is a registered element with a green conformance playground showing the
full trace against a live source; the diacritic-insensitive client match lands with it.
