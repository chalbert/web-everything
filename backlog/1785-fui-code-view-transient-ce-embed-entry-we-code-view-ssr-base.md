---
kind: story
size: 3
parent: "1599"
status: resolved
dateOpened: "2026-06-26"
dateStarted: "2026-06-26"
dateResolved: "2026-06-26"
graduatedTo: 1599
locus: frontierui
relatedProject: webdocs
tags: [webdocs, code-view, transient-ce, embed-boundary]
---

# FUI code-view transient-CE embed entry (we-code-view) + SSR baseline

The foundational prerequisite unblocking the #1599 code-view family (#1604/#1605/#1606) — the code-view counterpart to the badge `#1758` embed entry. Ship `fui:embed/code-view-in-document.ts`: a runtime cross-origin-importable entry that calls `registerCodeView('we-code-view')` and injects the code-view CSS once into the host document. Decide the SSR/FOUC baseline for a SHADOW-DOM transient CE (`CodeViewElement` uses a shadow root, unlike the light-DOM self-replacing `we-badge`) — how the pre-upgrade code surface avoids a flash and what `we-code-view{}` baseline WE ships. Wire the import into `we:src/_layouts/base.njk` beside the #1758 badges import; then the three children unblock.

## Progress (batch-2026-06-26-1745-1775)

SSR/FOUC baseline decided: **progressive enhancement** (following the #1758 badge precedent's structure,
adapted for code-view's shadow root). Unlike the light-DOM self-replacing `we-badge`, `CodeViewElement`
uses a shadow root with no `<slot>`, so it can't project SSR children — instead the docs server-render the
source in light DOM (`<we-code-view><pre><code>…</code></pre>`, visible immediately, no flash) and the
element hydrates `code` from that text on upgrade.
- `fui:blocks/code-view/CodeViewElement.ts` — `connectedCallback` hydrates `_code` from light-DOM
  `textContent` when unset (a `.code=` setter still overrides); exported `codeViewHostCss(tag)` — the
  host-document baseline for the pre-upgrade surface (the shadow CSS can't reach light DOM). +2 unit tests.
- `fui:embed/code-view-in-document.ts` — `registerCodeViewInDocument()`: registers `<we-code-view>` +
  injects `codeViewHostCss` once (mirrors `fui:embed/badges-in-document.ts`).
- `we:src/_layouts/base.njk` — cross-origin import of the entry beside the #1758 badges import (mode C,
  load-failure-silent).
- `we:src/css/style.css` — the static `we-code-view{}` SSR baseline that stands alone if the FUI host
  never loads.

Once shipped, the three #1599 children (#1604/#1605/#1606) unblock. FUI gate baseline-steady (34); WE gate
green (0 errors, scoped); 11ty build clean.
