---
kind: story
size: 3
parent: "1683"
status: open
locus: webeverything
blockedBy: ["1811", "1812"]
dateOpened: "2026-06-27"
tags: [design-tokens, theme, webinjectors, website]
---

# JS-first token runtime — slice 3: migrate we:src/css/style.css :root vars onto the emitted set

The WE-locus migration slice of #1683. The WE docs site hand-authors its design tokens as `:root` custom properties in `we:src/css/style.css` (the `--color-*` / `--spacing-*` / `--radius-*` / `--shadow-*` / `--font-*` families). Once slices 1 (#1811, injector theme SoT) and 2 (#1812, one-way CSS emit) land in FUI, migrate those hand-authored `:root` vars onto the injector-emitted set so the site's tokens come from the one source (no parallel hand-authoring), consuming the FUI runtime per the constellation import pattern.

## Acceptance
- `we:src/css/style.css` no longer hand-declares the token `:root` vars that the injector now emits; the site renders identically (no visual diff).
- Removing/renaming a token at the source updates the site's CSS var via the emit, not a hand edit.
- `check:standards` green; `eleventy` build clean.
