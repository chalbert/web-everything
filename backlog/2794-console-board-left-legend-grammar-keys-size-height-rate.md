---
bornAs: xgmio7d
kind: story
size: 2
parent: "2555"
status: resolved
dateOpened: "2026-07-28"
dateResolved: "2026-07-31"
scope: ["plateau-app:src/backlog-view/lane-board.ts", "plateau-app:src/backlog-view/lane-board.css"]
graduatedTo: none
tags: [plateau-loop, console, console-board, legend, canonical-2554, slice-2555]
---

# Console board left legend — grammar keys + size→height rate

Render the canonical "How this board works" legend panel on the left rail. The committee found
`legend-grammar-keys` and `legend-size-rate` **UNOWNED** — the board ships no in-surface key to its own grammar.

## Scope
- **Grammar `dl`** — the canonical key list, each term + gloss:
  - `scope lease` — a running lane owns its files; overlaps wait · dies at merge
  - `scope breach` — build wrote outside its lease — pause · resolve at drain
  - `✕ rival` — same files, no dependency — order is your choice
  - `dotted cell` — not ready yet, deeper in the chain
  - `⚡ frees n` — teal = completing this frees n items / gates its chain
  - `▮ sized` — cell height ≈ size estimate
  - `strips ‹›` — lanes that don't fit collapse — board never scrolls sideways
  (`legend-grammar-keys`)
- **Size→height rate** — state the ~9 min/pt rule that maps size points to cell height, so the geometry is
  legible (`legend-size-rate`). This is the human-readable half of the ruler [#2789]/center deliver.
- Panel chrome matches the canonical panel grammar (grip · title · collapse · menu — shares [#2792]).

## Where the code goes (locus)
`plateau-app:src/backlog-view/lane-board.ts` left-rail legend render.

## Acceptance
The left rail renders the canonical grammar `dl` (all keys above) and the ~9 min/pt size→height note, matching
the canonical §6/#2554 artifact. Both themes; `plateau-app` `npm test` + `we:` `check:standards` pass.

## Resolution (2026-07-31) — delivered-by-shell, no new PR
A verification pass found this **already delivered** on `plateau-app` main — no build needed.
`renderGlossary()` in `plateau-app:src/backlog-view/lane-board.ts` (~lines 1084–1106) renders the
`dl.lb-gloss-body` "How this board works" panel in `.lb-leftrail`, mounted unconditionally on every board
mount. It shows all seven canonical keys — `scope lease`, `scope breach`, `✕ rival`, `dotted cell`,
`⚡ frees n`, `▦ sized` (with the `≈9 min/point` size→height rate), `strips ‹›` — plus one additive
`policy ⚙` entry. Chrome (grip · title · collapse · menu) matches the panel grammar via `.lb-gloss-head`.
CSS lives at `plateau-app:src/backlog-view/lane-board.css` (`.lb-gloss*`). Confirmed against fresh
`origin/main` (`1eb15df`, includes #2789 + #2795).

**Residual — deferred to #2796.** The rendered wording is a semantically-equivalent paraphrase of this
item's spec text (not byte-exact), and the panel carries one additive term (`policy ⚙`) not in the spec's
seven-key list. Both are alignment nits, not missing functionality — they belong to **#2796**
(regenerate the console-board visual baseline from the §6/#2554 canonical artifact, retiring v68), which
owns reconciling rendered copy against the canonical artifact. Not re-opening this item for wording-only
drift.
