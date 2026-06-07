---
type: idea
status: open
dateOpened: "2026-06-07"
tags: [droplist, windowed, virtualization, scroll, behavior, pointer, a11y]
relatedReport: reports/2026-06-02-dropdown-trait-composition.md
relatedProject: webblocks
crossRef: { url: /blocks/autocomplete/, label: Autocomplete block }
---

# Add the scroll / height-driven windowing path to `windowed`

`windowed` (#137) virtualizes a long collection on the **active item** — the keyboard / a11y path
(arrow keys shift the window, the active option is always mounted). That path was built and proven
because happy-dom has **no layout**, so scroll offset and element heights are untestable there.

The pointer/scroll half is still missing: a real virtualizer also windows on **scroll position**,
mapping `scrollTop` + a (fixed or measured) item height to the visible slice, with overscan, and a
spacer/translate so the scrollbar reflects the FULL model. Build that path so a mouse user dragging
the scrollbar through 10k options renders only the visible window, while the active-item invariant
from #137 still holds (the focused option never unmounts even when scrolled out of view).

- Add a `itemHeight` option (fixed) and/or measured-height mode; window from `scrollTop`.
- Keep the scroll path and the active path coherent — both feed one window computation.
- Verify with a Playwright/browser test (real layout), not happy-dom, since this is layout-driven.

Acceptance: `windowed` renders only the visible slice while scrolling a long list with the mouse, the
scrollbar reflects the full model, and the active-always-mounted invariant still holds under scroll.
