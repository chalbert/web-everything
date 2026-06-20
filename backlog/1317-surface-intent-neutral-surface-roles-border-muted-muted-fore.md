---
kind: story
size: 5
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "we:webtheme/defaultTokens.ts"
tags: [reproduction, gap-sweep, shadcn]
relatedProject: webintents
relatedReport: reports/2026-06-20-1243-shadcn-first-gap-delta.md
---

# surface intent: neutral surface roles (border, muted, muted-foreground)

## Progress (batch-2026-06-20) — DONE

Added a cross-cutting **`surface` role group** to `we:webtheme/defaultTokens.ts` (shadcn
`--border`/`--input`/`--muted`/`--muted-foreground` parity): `surface.border` → `{color.gray.6}`,
`surface.input` → `{surface.border}` (input outline = border, shadcn `--input ≈ --border`),
`surface.muted` → `{color.gray.1}` (muted bg), `surface.muted-foreground` → `{color.gray.9}` (muted text)
— each aliases the neutral gray scale so it tracks the theme. Compiles to `--surface-border:
var(--color-gray-6)`, `--surface-input: var(--surface-border)`, etc. The neutral roles now have a token
home.

**Placement note (same as #1316):** the card said "surface intent," but intents are **UX-only** (no token
refs, ratified #403) — so these themeable color tokens live in webtheme (the role tier); the `surface`
intent stays untouched. Test added to `we:webtheme/__tests__/tokens.test.ts`; 18 green. Closes shadcn
#1243/#5; feeds #315.
Reproduction-conformance gap #5 from shadcn (#1243). shadcn leans on neutral surface roles --border / --input / --muted / --muted-foreground / --secondary; webtheme exposes only bg/fg/accent and delegates the rest to intents (#403), but no intent currently supplies neutral border/muted surface roles, so input borders and muted text have no token home. Add neutral surface roles to the surface intent. Surfaced by reproduction #1243, feeds gap-sweep #315.
