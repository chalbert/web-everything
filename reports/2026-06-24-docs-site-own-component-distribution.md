# Docs-site own-component distribution — bundle vs cross-origin vs defer (#1748 prep)

**Date:** 2026-06-24 · **Decision:** [#1748](/backlog/1748-we-docs-site-mechanism-to-load-register-fui-transient-elemen/) · **Research topic:** `/research/docs-site-own-component-distribution/`

## Question

How does the **published** WE docs site (Eleventy) load + register FUI transient custom elements
(`<we-badge>` / `<we-filter-chip>`) so server-emitted `<we-*>` tags upgrade in place? Candidates:
(a) bundle a pinned component package into the docs' own assets; (b) cross-origin import the registration
ESM from a served FUI origin at runtime; (c) defer with the inline `<span>` macros until a published
component package exists.

## Generic prior art (the industry norm)

Surveyed Material Web, Adobe Spectrum Web Components, Microsoft FAST/Fluent, Shoelace/Web Awesome, GitHub
Catalyst, Salesforce LWC, and several government design systems. The production norm is **(a) bundle a
pinned, tree-shaken npm package** into the site's own assets, with `:not(:defined){visibility:hidden}` or
SSR to kill the FOUCE upgrade flash. **Cross-origin / CDN ESM (b)** is uniformly the *prototyping* tier —
production-viable only with version-pin + SRI and an accepted second-origin runtime cost (FAST/Fluent's
"pin-and-self-host the CDN bundle" is the one production-leaning variant, and it collapses back toward (a)).
**Defer (c)** has no real end-state precedent; it is only ever a stand-in before a package exists. Standards
watch: WICG Scoped Custom Element Registries (revamped 2025) targets the CDN-vended-widgets case but is not
yet production-stable.

## WE-specific inversion (verified against the tree)

For WE the generic "bundle wins" answer is **overridden by the constellation boundary**:

- **(a) bundle is boundary-ILLEGAL.** `we:docs/agent/platform-decisions.md` we-fui-embed-boundary rule 6:
  a build-time `import '@frontierui'` into WE's build "is the only thing that actually violates the
  boundary" (#700/#239). Bundling FUI components into WE docs assets is exactly that import.
- **(b) cross-origin is already RATIFIED for this archetype.** Rule 7 (#1621) prescribes, by name, for
  "many-small, behavior-free, server-rendered components (a board of hundreds of pills)": register once
  via a runtime cross-origin import from the FUI origin, emit `<we-*>` server-side, inject the block's
  exported CSS (`BADGE_CSS`-style) globally, ship a `we-*{}` SSR baseline. Per-instance mode-C is rejected.
- **The served origin already exists in production.** `we:src/_data/links.js:8` →
  `frontierUrl: local ? "http://localhost:3001" : "https://frontierui.dev"`; `we:src/_layouts/base.njk:418`
  cross-origin-imports the `fui:embed/in-document.ts` module from the `frontierUrl` origin for the #865
  chrome shell, with `.catch()` graceful degradation to the SSR baseline. The "published docs have no
  served FUI origin" premise in the original item is false.
- **No #907 gate.** `registerBadge()` / `registerFilterChip()` exist now (`fui:blocks/badge/registerBadge.ts:19`,
  `fui:blocks/filter-chip/registerFilterChip.ts:19`, #1669/#1603). Cross-origin import consumes them from
  the served origin by URL — it does NOT need the human-gated npm publish (#872/#907); only (a) bundle would.

## Recommendation

- **Generic docs site:** (a) bundle a pinned tree-shaken package.
- **WE specifically: (b) cross-origin import** the FUI registration ESM from the existing
  `frontierUrl` origin, with the rule-7 SSR baseline — the ratified, boundary-legal, zero-new-infra,
  no-#907-gate path. The only prep is a small FUI-served registration entry (`fui:embed/badges-in-document.ts`)
  mirroring `fui:embed/in-document.ts`. (c) defer is rejected as avoidance (components + origin both exist);
  (a) bundle is rejected as the lone boundary violation.

## Skeptic

Skeptic attacked the original (c)-defer/(a)-bundle lean → **REFUTED**: verified `we:src/_data/links.js:8`,
`we:src/_layouts/base.njk:418`, and rule 6/rule 7 in the tree. The cross-origin origin is live in prod,
(a) is the named boundary violation, (b) is ratified by name. Default flipped to **(b)**.
