---
kind: story
size: 3
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "we:webtheme/schemes.ts"
tags: [reproduction, gap-sweep, shadcn]
relatedProject: webtheme
relatedReport: reports/2026-06-20-1243-shadcn-first-gap-delta.md
---

# webtheme: scheme-paired accent role (light/dark primary flip)

Reproduction-conformance gap #1 from shadcn (#1243). shadcn flips --primary between schemes (light oklch(0.205 0 0) → dark oklch(0.985 0 0)); webtheme color.accent is a single scheme-invariant seed, so a system's dark-mode primary surface can't be expressed without a second theme. Add a scheme-paired accent role (light-dark() on the seed / a dark-accent anchor) so deriveSchemeRuntime tracks both schemes from one theme. Surfaced by reproduction #1243, feeds gap-sweep #315.

## Progress

Closed reproduction-conformance gap #1 (shadcn's per-scheme `--primary` flip) by adding an **opt-in
scheme-paired accent** to the webtheme scheme runtime:

- `we:webtheme/schemes.ts` — `deriveSchemeRuntime` now reads an optional `color.accent-dark` anchor
  (`tokenValueOptional`). When present (`SchemeRuntime.schemePaired === true`), each accent step compiles
  to `light-dark(oklch(from var(--color-accent) L c h), oklch(from var(--color-accent-dark) L c h))` — so
  the whole tonal scale flips per scheme from ONE theme, both seeds still runtime-tracked via relative
  color. The contrast gate validates each scheme's variant against its OWN background (light→bg-light via
  `AccentStep.value`, dark→bg-dark via the new `AccentStep.valueDark`). Absent the anchor, behavior is
  unchanged (single seed across both schemes) — fully backward-compatible.
- `we:webtheme/defaultTokens.ts` — documented the optional `accent-dark` anchor; the platform default
  stays single-seed (so existing derivations/goldens are untouched).
- `we:webtheme/__tests__/schemes.test.ts` — +6 tests for the paired path (schemePaired flag, light-dark
  step CSS, distinct dark literal, per-scheme validation, compiled CSS, single-seed no-regression). The
  byte-for-byte golden snapshot (single-seed defaultTokens) is unchanged. 42 webtheme tests green.

Feeds gap-sweep #315; surfaced by reproduction #1243.
