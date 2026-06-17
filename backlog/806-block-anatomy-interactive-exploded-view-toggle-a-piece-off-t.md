---
type: idea
workItem: story
size: 5
status: resolved
parent: "746"
locus: frontierui
blockedBy: ["809", "815"]
dateOpened: "2026-06-16"
dateResolved: "2026-06-17"
graduatedTo: frontierui/workbench/mount.ts (anatomy exploded view + degrade)
tags: [webdocs, frontierui, block-explorer, anatomy, graceful-degradation, plateau-embed]
---

# Block anatomy interactive exploded view + toggle-a-piece-off-to-degrade

The interactive half of the block anatomy view (#748 shipped the static Built-on/Used-by graph in `src/block-pages.njk`). Adds the devtools-style **exploded / layered view** (stack intents → traits → plugs → tokens, hover to highlight each layer's contribution) and the **toggle-a-piece-off-to-degrade** live graceful-degradation demo. Both manipulate the *running* block. Includes the conformance-playground fixture (#748 acceptance bullet 4). Share the provider↔consumer graph with #092 / #755, don't duplicate.

**Re-homed to FUI-locus (#809).** Per the #809 ruling these manipulations live as chrome inside the FUI-owned workbench (#815, iframe+chrome distribution), where chrome and block are same-origin — host-side intra-FUI, no cross-boundary channel. This supersedes the original "blockedBy #786 / mode-C is the only path" framing: mode C is the *no-chrome* bare-component distribution, not where this interactive view lives. `blockedBy #815`; built `@frontierui`.

## Progress

Resolved 2026-06-16 (locus: frontierui). Built on the #815 workbench shell (the interactive half of the #748 anatomy view), all host-side DOM:
- **Exploded composition stack** (`workbench/registry.ts` `anatomy` field + `mount.ts` Anatomy panel): the block's layers — intents → traits → tokens, outermost-first, kind-coloured — for `auto-complete` (Selection + Anchor intents; Filter/Resize/Windowed traits; height-cap + accent tokens). Hovering a layer shows its contribution in the caption and outlines the affected element.
- **Toggle-a-piece-off-to-degrade**: a `removes`-bearing layer toggles off live — a token piece is removed from the stage (the listbox height-cap falls back to its CSS default), a trait piece is force-off and the Traits-panel control syncs (no drift). The running block degrades to what remains — the graceful-degradation / minimize-lock-in proof.
- **Playground fixture** (#748 acceptance bullet 4): a new e2e asserts the exploded layers render, hover surfaces the contribution, toggling the cap piece degrades the listbox (96px→192px), and degrading the filter piece syncs the trait control. All 6 workbench specs pass; `tsc --noEmit` + `check:standards` green.
- The shared provider↔consumer wiring graph (#092/#755) is the WE-docs overlay half (#832), rendered around the embed — not duplicated here.
