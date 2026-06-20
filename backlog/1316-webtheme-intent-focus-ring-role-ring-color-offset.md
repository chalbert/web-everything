---
kind: story
size: 3
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "we:webtheme/defaultTokens.ts"
tags: [reproduction, gap-sweep, shadcn]
relatedProject: webintents
relatedReport: reports/2026-06-20-1243-shadcn-first-gap-delta.md
---

# webtheme/intent: focus-ring role (ring color + offset)

## Progress (batch-2026-06-20) — DONE

Added a cross-cutting **`ring` role node** to `we:webtheme/defaultTokens.ts` (shadcn `--ring` /
`--ring-offset` parity): `ring.color` (aliases `{color.accent}` so the focus outline tracks the theme),
`ring.width` (2px), `ring.offset` (2px) → compiles to `--ring-color: var(--color-accent)`,
`--ring-width`, `--ring-offset`. The focus affordance now has a token home.

**Placement note:** the card framed this as "the interaction/focus intent layer," but intents are
**UX-only** (no token refs, ratified #403) — so the themeable color+offset tokens live in webtheme (the
role tier), and the `interaction` intent stays untouched. The rule decides the placement; not a fork.
Test added to `we:webtheme/__tests__/tokens.test.ts` (ring-color→accent var, ring-offset literal); 18
green. Closes the shadcn #1243/#4 gap; feeds #315.
Reproduction-conformance gap #4 from shadcn (#1243). shadcn focus-visible uses a --ring color + --ring-offset; webtheme has no focus-ring token role (its semantic tier is the intents, #403), so the focus affordance has no token home. Add a focus-ring role (ring color + offset) on the interaction/focus intent layer so a themed focus outline is expressible. Surfaced by reproduction #1243, feeds gap-sweep #315.
