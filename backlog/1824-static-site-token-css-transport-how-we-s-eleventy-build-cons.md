---
kind: decision
parent: "1683"
status: open
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
preparedDate: "2026-06-26"
relatedReport: reports/2026-06-26-static-site-token-css-transport.md
tags: [webtheme, tokens]
---

# Static-site token-CSS transport: how WE's Eleventy build consumes the FUI-emitted token CSS without a build-import or FOUC

Prepared and ready to ratify. FUI slices 1 (#1811) + 2 (#1812) shipped the token injector + a one-way CSS
emit; #1813 migrates `we:src/css/style.css`'s hand-authored `:root` token vars onto it. The recommended
path: **FUI build-emits, the bytes cross into WE's build via the #1731 served-route/CLI boundary and are
inlined server-side into `we:src/_layouts/base.njk` head** (no build-import, no FOUC, no committed
generated file); and **stand up the WE-site project theme now** — a WE-authored light-brand override (plus
the names FUI's dark default lacks) extending the FUI default via `ThemeSource.with()`, emitted as the
resolved theme, with the legacy `--color-*` names aliased to the emitted `--token-*` so the site's 627 call
sites keep working *and* derive from the injector. Grounded in
[the prep report](../reports/2026-06-26-static-site-token-css-transport.md) and
[the research topic](/research/static-site-token-css-transport/).

The axis is *how a one-way emit (`fui:plugs/webtheme/emitCss.ts:57-63` returns a `:root{}` string;
`applyTokenVars` at `:71-74` is the runtime FOUC path) crosses a deliberate build-import boundary and
re-homes the site's brand values*. WE cannot `import '@frontierui'` at build time (#700,
`we:src/_layouts/base.njk:434`); Eleventy passthrough-copies `we:src/css` (`we:.eleventy.js:265`) and runs
build JS via `we:src/_data/` globals, so the emit can be inlined pre-paint. The decisive, verified facts:
`var(--token*)` appears **0** times in `we:src/` while `var(--color*)` appears **627** — so an emit the
site never reads is not a migration; and FUI's default is a **dark** theme missing names WE needs
(`fui:plugs/webtheme/defaultTheme.ts:16-53`), so consuming it verbatim would invert the site.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|------|--------------------|------------------|------------|
| Fork 1 — build-time transport | **(a) FUI build-emit → cross via the #1731 boundary → inline server-side into `we:src/_layouts/base.njk` head** | (b) Published-artifact read (premature — #907 unpublished/human-gated) | High |
| Fork 2 — token VALUES home | **(a) Stand up the WE-site project theme now + alias legacy `--color-*` to emitted `--token-*`** | (b) Keep the old `--color-*` override + defer (refuted); (c) consume FUI default verbatim (ruled out) | Med-high |

## Fork 1 — build-time transport

**Fork-existence:** a real either/or — (a) and (b) are mutually-exclusive sources for the emitted bytes, and
(b) is the *flawed/excluded* branch **now**: there is no published FUI token-CSS artifact, and
`@webeverything/contracts` is unpublished + human-gated (`we:backlog/907-*.md`, `npm view` → E404, pinned
`0.0.0`) and type-only — so (b) is not agent-buildable, not merely more expensive.

**Crux.** The emit must reach the page as **build-time** CSS resolved before first paint (a runtime
`import()` + `applyTokenVars` is post-paint → FOUC, violating #1813's no-visual-diff acceptance), and WE
cannot build-import FUI. Eleventy gives two pre-paint sinks: a server-rendered `<style>` (via a
`we:src/_data/` global) or a `<link>` to a passthrough-copied file under `we:src/css`.

**Options.**
- **(a) FUI build-emit, cross via the #1731 boundary, inline server-side** *(default)* — FUI's
  `emitTokenCss()` string crosses into WE's build via the ratified #1731/#1752 served-route/CLI boundary
  (`we:docs/agent/platform-decisions.md#we-data-crosses-via-fui-served-route`), read **fresh each build**,
  and is inlined into `we:src/_layouts/base.njk` head. No build-import, no FOUC, no second-origin
  render-block, and — critically — **no committed generated artifact** to drift out of sync. If a cached
  file is ever wanted it must be build-emitted-not-committed (gitignored), never a committed snapshot.
- **(b) Published-artifact read** — *Rejected* for now; depends on the #700/#907 published-package
  end-state, which is unpublished and human-gated. Re-home to (b) when a versioned token artifact publishes
  (residual below).

**Skeptic:** SURVIVES-WITH-AMENDMENT → folded. The attack ("a committed/copied `.css` + `<link>` is a
drift surface strictly worse than the no-drift guarantee #1683 exists for; server-side inline is simpler
and equally FOUC-free") is adopted: the default is now inline-fresh-each-build, not a committed file.

## Fork 2 — where the WE-site's token VALUES live

**Fork-existence:** a real either/or on where brand values are homed, and **both** alternatives are *flawed*:
(b) keep the hand-authored `--color-*` `:root` and merely bolt the FUI emit on top is **broken** — verified
`var(--token*)` = 0 in `we:src/`, so the emit is dead weight nothing reads and #1813's acceptance ("no
longer hand-declares the token `:root` vars … renaming a token at source updates the site's var") is unmet;
(c) consume the FUI default verbatim is **broken** — FUI's dark default would invert the light site and
lacks names WE needs. Only (a) is coherent.

**Crux.** Per the three-layer carve (contract→WE, impl→FUI, **values→product**) the WE site's brand values
are the product/values layer and should extend the FUI default — and the mechanism is **already wired**:
`ThemeSource.with(overrides)` (`fui:plugs/webtheme/ThemeSource.ts:73`, the `config-extends-platform-default`
primitive). The only missing piece is a WE-authored override object holding the light values + the names
FUI's default lacks.

**Options.**
- **(a) Stand up the WE-site project theme now + alias bridge** *(default)* — WE authors a theme override
  (the existing light `--color-*` values + the missing names) consumed by `ThemeSource.with()` over the FUI
  default; the build emits **that resolved theme** as `--token-*`; and one generated block aliases the
  legacy `--color-*` names to the emitted `--token-*` (`--color-primary: var(--token-color-primary)`) so the
  627 call sites keep working *and* now derive from the injector (satisfying #1813's "renaming a token at
  source updates the site's var"). The project-theme home is the load-bearing slice, not a follow-up.
- **(b) Keep `--color-*` override, defer the project-theme home** — *Rejected*; leaves the emit unread (no
  migration) and the deferral is a #1620 soft-park (no concrete trigger).
- **(c) Consume FUI default verbatim** — *Rejected*; dark/light clash inverts the site; missing names.

**Sub-fork (folded):** *call-site rename vs alias bridge* — rewriting all 627 `var(--color-*)` sites to
`--token-*` is the cleaner end-state but high-churn and risky for "no visual diff"; the **alias bridge**
(default) achieves the migration's acceptance with near-zero churn, leaving a full rename as a later
cleanup. Residual: the exact on-disk home of the WE override object (a WE `_data` module vs a TS theme
module) — specifiable now, ruled at the build.

**Skeptic:** REFUTED → flipped. The original default (emit `--token-*` + keep `--color-*`, defer the home)
was refuted: it migrates nothing (`var(--token*)` = 0) and soft-parks the home. The default is now
project-theme-now + alias bridge, and **#1813 is flagged undersized** (`size:3`) — it now carries the
project-theme mechanism + alias generation and should be re-sized/split.

## Supported by default (not decisions)

- **JS-first SoT** — the injector/`ThemeSource` is the source of truth; CSS vars are a one-way projection
  (the JS-first theme-tokens ruling, #1682). Both forks keep WE a pure consumer of the emit; no token is
  re-authored in CSS.
- **`emitTokenCss` selector/shape** — unchanged; WE consumes the `:root{}` string as-is.

## Context

- **Blocks:** #1813 (`blockedBy: ["1824"]`). This prep changes #1813's shape — it is blocked on the WE-site
  project-theme mechanism existing (Fork 2 (a)), not a cosmetic emit bolt-on, and is almost certainly
  undersized at `size:3`.
- **Lineage:** parent epic #1683 (JS-first token slices); FUI slices #1811 + #1812; the JS-first ruling
  #1682; the #1731/#1752 served-route crossing; the #700/#907 published-package end-state (Fork 1 (b)'s
  future home).
