---
kind: story
size: 2
parent: "2555"
status: open
dateOpened: "2026-07-28"
tags: [plateau-loop, console, console-board, header, attention-strip, canonical-2554, slice-2555]
---

# Console board header + live indicator match canonical

Build the canonical header and the attention-strip live indicator. The committee found `header-brand-breadcrumb`,
`header-right-pills`, and `attn-live-indicator` **UNOWNED** by any open story.

## Scope
- **Header left**: brand mark + wordmark, `Constellation / Plateau Loop` breadcrumb, and the subtitle
  ("the execution plan — click a build to inspect; map / gated / timeline fold below") (`header-brand-breadcrumb`).
- **Header right pill cluster**: the `reference` pill (this board IS the state reference — see [#2715]), the
  lane-count pill (`lanes N · X◧ Y⚠`), the zoom (`− +`) control, the **theme toggle** (reads [#xzpkd8q]
  persistence), and the overflow `···` menu (`header-right-pills`).
- **Live indicator**: the attention strip's right-aligned `live · updated just now` text with a green status
  dot; `aria-live` polite on the strip (`attn-live-indicator`).

## Where the code goes (locus)
`plateau-app:src/backlog-view/lane-board.ts` header + attention-strip render.

## Acceptance
The header renders brand + breadcrumb + subtitle + the full right pill cluster, and the attention strip carries
the live/updated indicator + green dot, matching the canonical §6/#2554 artifact. Both themes; `plateau-app`
`npm test` + `we:` `check:standards` pass.
