---
kind: story
size: 2
parent: "2555"
status: open
dateOpened: "2026-07-28"
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
  legible (`legend-size-rate`). This is the human-readable half of the ruler [#x4jvp33]/center deliver.
- Panel chrome matches the canonical panel grammar (grip · title · collapse · menu — shares [#x9hg7qz]).

## Where the code goes (locus)
`plateau-app:src/backlog-view/lane-board.ts` left-rail legend render.

## Acceptance
The left rail renders the canonical grammar `dl` (all keys above) and the ~9 min/pt size→height note, matching
the canonical §6/#2554 artifact. Both themes; `plateau-app` `npm test` + `we:` `check:standards` pass.
