# Static-site token-CSS transport — decision-prep grounding (#1824)

**Date:** 2026-06-26 · **Grounds:** decision [#1824] (parent #1683) · **Blocks:** #1813 · **Relates:** #1682 / #1731 / #1752 / #700 / #907

## What this decision is

FUI slices 1 (#1811) + 2 (#1812) shipped the token injector + a one-way CSS emit. #1813 is the WE-locus
migration of `we:src/css/style.css`'s hand-authored `:root` token vars onto that emitted set. It is **not**
clean wiring: WE's Eleventy build cannot `import '@frontierui'` (the #700 ban), a runtime `import()` +
`applyTokenVars` injects vars *after* first paint (FOUC, violating #1813's "renders identically"), and the
site's brand values diverge from FUI's default theme. Two calls: (1) how the emitted CSS reaches WE's build
output FOUC-free without a build-import; (2) where the WE-site's token *values* live.

## Grounding (real tree — `we:` = webeverything, `fui:` = frontierui)

### The emit mechanism

- `fui:plugs/webtheme/emitCss.ts:57-63` — `emitTokenCss(theme, selector=':root')` returns a **string**
  (a `:root { … }` block). Doc: "the build-time / static-set emit a build step writes to a stylesheet once."
- `fui:plugs/webtheme/emitCss.ts:71-74` — `applyTokenVars(el, theme)` mutates a live element's inline style
  (the **runtime path that causes FOUC** #1813 forbids).
- `fui:plugs/webtheme/defaultTheme.ts:16-53` — the default `ResolvedTheme` is a **dark** theme
  (`background:#0b1020`, `text:#e8ecf6`, `primary:#5b8cff`) with 9 color names.
- **`emitTokenCss` has no production consumer** — whatever #1824 picks is the first.

### The ban + current linking

- `we:src/_layouts/base.njk:9-10` — a plain static stylesheet link to the passthrough-copied
  `we:src/css/style.css`.
- `we:src/_layouts/base.njk:434` — the #700 ban comment: "NEVER a build-time `import '@frontierui'`"; WE
  consumes FUI **only** via runtime cross-origin `import()` (mode C).
- Eleventy passthrough-copies `we:src/css` (`we:.eleventy.js:265`) — so a file under `we:src/css/` reaches
  the build output as a linkable asset. There is **no** mechanism to passthrough from a sibling repo / URL;
  the file must be physically present in WE's tree at build time.
- Eleventy runs arbitrary Node JS at build via `we:src/_data/` `.js` globals (33 of them) — so a
  `we:src/_data/` global can produce a token-CSS string and `we:src/_layouts/base.njk` can inline it in a
  server-rendered `<style>`.

### The values diverge (verified)

- `we:src/css/style.css:1-27` — WE's `:root` is a **light "Slate"** palette (`--color-bg #f8fafc`,
  `--color-primary #4f46e5`), ~21 vars across color/font/spacing/radius/shadow, WCAG-AA-tuned (#793).
- **`var(--token*)` appears 0 times in `we:src/`; `var(--color*)` appears 627 times** (verified by grep).
  FUI's dark default lacks names WE needs (`--color-bg`, `--color-text-main`, `--color-surface-alt`,
  `--color-accent`, …). So consuming the FUI default verbatim would invert the site, and a name-only alias
  is impossible without supplying the missing names.

### The published end-state (Fork-1 B status)

- `we:backlog/907-*.md` — `@webeverything/contracts` is **unpublished** (`npm view` → E404), pinned
  `0.0.0`, and **human-gated** (clears only when a human runs the publish ceremony). It is a **type-only**
  contract package, not a CSS/token artifact. There is no published FUI token-CSS artifact of any kind. So
  Fork-1 B ("read a published artifact at build time") is premature and not agent-buildable.

### The #1731 crossing precedent (Fork-1 A grounding)

- `fui:tools/maas/` (the served-route plugin + serve handlers) — #1731 (resolved, codified
  `we:docs/agent/platform-decisions.md#we-data-crosses-via-fui-served-route`) + #1752 (built) established
  FUI build-emitting/serving an artifact that WE consumes cross-origin. It serves JS today, not CSS, and
  over HTTP for **runtime** fetch — so a token stylesheet must land as **build-time** bytes in WE's tree
  (inline or passthrough-copied), not a browser-runtime link to the FUI host, to stay FOUC-free.

## Skeptic pass (refute-only sub-agent) — verdicts folded

- **Fork 1 — SURVIVES-WITH-AMENDMENT.** The intent (build-time, pre-paint, no build-import; B deferred) is
  right, but "committed/copied `.css` + static link" reintroduces a drift surface (a frozen snapshot of
  FUI's theme with no re-emit trigger — strictly worse than the no-drift guarantee #1683 exists for).
  **Folded:** prefer **server-side inline** of `emitTokenCss()`'s string into `we:src/_layouts/base.njk`
  head via a `we:src/_data/` global (the bytes fetched/read fresh each build from the #1731
  served-route/CLI boundary) — equally FOUC-free, no committed generated file, no second-origin
  render-block. If a file is wanted, it must be build-emitted-not-committed (gitignored), never a committed
  snapshot.
- **Fork 2 — REFUTED.** The original default (emit FUI `--token-*` + keep the hand-authored `--color-*`
  `:root` override, defer the project-theme home) **does not perform the migration**: `var(--token*)` = 0 in
  `we:src/` so the emit is dead weight nothing reads, and #1813's acceptance ("no longer hand-declares the
  token `:root` vars … renaming a token at source updates the site's var") is unmet. Deferring the
  project-theme home with no trigger is a #1620 soft-park. **Folded:** stand up the **WE-site project theme
  now** (the load-bearing slice, not a follow-up) — a WE-authored override (the light brand values + the
  names FUI's dark default lacks) extending FUI's default via `ThemeSource.with()`
  (`fui:plugs/webtheme/ThemeSource.ts:73`, the wired `config-extends-platform-default` mechanism), emit
  **that resolved theme**, and wire the site's vars to the emit (alias the legacy `--color-*` names to the
  emitted `--token-*` in one generated block so the 627 call sites keep working *and* derive from the
  injector). #1813 is almost certainly undersized at `size:3` given this — flag for re-size.

## Net effect on the downstream build

This prep changes #1813's shape: the migration is **blocked on a WE-site project-theme mechanism existing**
(Fork 2 (a)), not a cosmetic emit bolt-on. The decision should rule that mechanism in (it is specifiable now
per the three-layer carve), and #1813 should be re-sized / possibly split (the project-theme home + the
alias-bridge generation are real work beyond a 3-point wiring slice).
