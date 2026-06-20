---
kind: story
size: 3
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "we:webtheme/tokens.ts"
tags: [reproduction, gap-sweep, shadcn]
relatedProject: webtheme
relatedReport: reports/2026-06-20-1243-shadcn-first-gap-delta.md
---

# webtheme: calc-derived radius scale from a base radius token

## Progress (batch-2026-06-20) — DONE

Added a **calc-derived offset (templated value)** capability to the webtheme token model and derived the
default radius scale from one base:
- `we:webtheme/tokens.ts` — new `isTemplated` / `templatedRefs` / `mapTemplatedRefs` helpers (a value
  string carrying embedded `{group.token}` refs but not a bare alias, e.g. `calc({radius.base} - 2px)`).
  `resolveTokens` now substitutes each embedded ref with its resolved literal (so the `@property`
  initial-value is a concrete `calc(0.5rem - 0.25rem)`), cycle/dangling-guarded exactly like a bare alias.
- `we:webtheme/compile.ts` — `declaredValue` emits a templated value as native `calc(... var(--ref) ...)`,
  so the derived step tracks its base at runtime (shadcn's pattern); `@property` keeps the resolved literal.
- `we:webtheme/defaultTokens.ts` — radius is now base-derived: `base: 0.5rem`, `sm = calc(base - 0.25rem)`,
  `md = {radius.base}`, `lg = calc(base + 0.5rem)`. **Computed values preserved** (sm 0.25rem, md 0.5rem,
  lg 1rem); re-theming `base` now shifts the whole scale instead of drifting — the #1243/#2 gap closed.
- `we:webtheme/__tests__/tokens.test.ts` — 6 new assertions (detect/refs, resolve→literal calc, compile→
  `calc(var(--ref) …)`, dangling+cycle guards, default-scale base-derivation). **18 tests green.**

Reproduction-conformance gap #2 from shadcn (#1243). shadcn derives its radius scale by calc() offsets of one base (--radius-md = calc(--radius - 2px), sm/lg/xl likewise); webtheme radius is a flat, independent scale with no way to encode the derived relationship, so the scale drifts from the base when a project re-themes the base radius. Allow a radius token to express a calc-derived offset of a base radius (DTCG alias + offset, compiled to native calc()). Surfaced by reproduction #1243, feeds gap-sweep #315.
