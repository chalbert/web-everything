---
kind: story
size: 3
parent: "1601"
status: resolved
dateOpened: "2026-06-26"
dateStarted: "2026-06-26"
dateResolved: "2026-06-26"
graduatedTo: 1601
locus: frontierui
relatedProject: webdocs
tags: [webdocs, card, transient-ce, embed-boundary]
---

# FUI card transient-CE embed entry (we-card) + SSR baseline

The foundational prerequisite unblocking the #1601 catalog tiles-to-card family (#1607/#1608) — the card counterpart to the badge `#1758` embed entry and the code-view `#1785`. Ship `fui:embed/card-in-document.ts`: a runtime cross-origin-importable entry registering a transient `<we-card>` over `fui:blocks/card/CardElement` and injecting the card CSS once into the host document. Decide the card CE's SSR/FOUC baseline — does it self-replace to light-DOM like `we-badge` or keep a shadow root, and what `we-card{}` SSR baseline WE ships so the pre-upgrade tile doesn't flash. Wire the import into `we:src/_layouts/base.njk`; then #1607/#1608 unblock.

## Progress (batch-2026-06-26-1745-1775)

SSR/FOUC baseline resolved cleanly to the #1758 badge precedent: `CardElement` is a `TransientElement` that
**self-replaces to light DOM** (`<we-card>` → `<article class="fui-card">`, like `we-badge` — NOT a shadow
root), so the FUI styles are `.fui-card`-keyed and injected into the host document; WE ships a static
`we-card{}` baseline for the pre-upgrade surface. No block change needed (card already self-replaces, CARD_CSS
already exported).
- `fui:embed/card-in-document.ts` — `registerCardInDocument()`: registers `<we-card>` + injects CARD_CSS once
  (mirrors `fui:embed/badges-in-document.ts`). +3 unit tests.
- `we:src/_layouts/base.njk` — cross-origin import beside the #1758 badges / #1785 code-view imports.
- `we:src/css/style.css` — static `we-card{}` SSR baseline (stands alone if the FUI host never loads).

Once shipped, the #1601 catalog tiles→card children (#1607/#1608) unblock. FUI gate baseline-steady (34);
WE gate green (0 errors, scoped); 11ty build clean.
