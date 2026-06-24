---
kind: decision
status: resolved
dateOpened: "2026-06-24"
dateStarted: "2026-06-24"
dateResolved: "2026-06-24"
graduatedTo: 1758
preparedDate: "2026-06-24"
relatedProject: webcomponents
relatedReport: reports/2026-06-24-docs-site-own-component-distribution.md
codifiedIn: "docs/agent/platform-decisions.md#we-fui-embed-boundary"
tags: [docs, fui-embed, transient-element, badge, filter-chip, cross-origin]
---

# WE docs site mechanism to load + register FUI transient elements (badge/filter-chip) — bundle vs cross-origin vs defer

## Digest

How does the published WE docs site load + register FUI's `<we-badge>` / `<we-filter-chip>` runtime so the
backlog pills #1598 migrates upgrade in place? Prepared default: **(b) cross-origin import the FUI
registration ESM from the existing `frontierUrl` origin**. The original defer/bundle lean was **refuted in
prep**: (a) bundle is the *one* thing the WE→FUI boundary forbids (rule 6); (b) is already ratified by name
for these many-small server-rendered pills (rule 7 / #1621); and a served FUI origin is already live in
prod — so there is no #872/#907 publish gate, only a small FUI-served entry to build. Confidence med-high.

## Framing

The crux is the WE↔FUI **source-dependency direction**, not the rendered pixels. `we:docs/agent/platform-decisions.md`
we-fui-embed-boundary **rule 6** is explicit: the docs *website* is a downstream consumer free to render
FUI, and the single guard is that it consume FUI "by **runtime URL bundle** (mode C), *never* a build-time
`import '@frontierui'` into its build; that import would invert the direction (#700/#239) and is **the only
thing that actually violates the boundary**." **Rule 7** (#1621) then prescribes, for "many-small,
behavior-free, server-rendered components (a board of hundreds of pills)" — exactly the backlog badges —
"register the element **once** via a runtime cross-origin import from the FUI origin, emit `<we-*>`
server-side, let each upgrade in place … inject the block's exported CSS (`BADGE_CSS`-style) globally and
ship a `we-*{}` SSR baseline to kill the upgrade flash." The mechanism already runs in production:
`we:src/_layouts/base.njk:418` cross-origin-imports the `fui:embed/in-document.ts` module from
`we:src/_data/links.js:8`'s `frontierUrl` (`https://frontierui.dev` in prod) for the #865 chrome shell,
with `.catch()` degradation to the SSR baseline. The registration helpers exist now —
`fui:blocks/badge/registerBadge.ts:19` and `fui:blocks/filter-chip/registerFilterChip.ts:19` (#1669/#1603).
Industry prior art (Material/Spectrum/FAST/Shoelace/GitHub — `/research/docs-site-own-component-distribution/`)
makes *bundle* the generic production norm, but WE's boundary rule **inverts** that here: the generic norm's
build-time package import is precisely WE's lone boundary violation.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| Fork 1 — published-docs loading mechanism | **(b) cross-origin import the FUI registration ESM from the `frontierUrl` origin** (rule-7 model, mirrors the #865 chrome shell) | (a) bundle the FUI package into docs assets | Med-high |

## Decision (ratified 2026-06-24)

**Ruling: (b) — cross-origin import the FUI registration ESM from the `frontierUrl` origin.** The
published WE docs register `<we-badge>` / `<we-filter-chip>` via a runtime cross-origin `import(...)`
of a small FUI-served entry (mirroring the #865 chrome shell at `we:src/_layouts/base.njk:418`), with a
`we-*{}` SSR baseline and `.catch()` degradation — the rule-7 transient-CE model applied to the docs
pill board. (a) bundle stays *rejected* (the lone rule-6 boundary violation + a #872/#907 publish gate);
(c) defer stays *rejected* (avoidance — components + origin + mechanism all already exist).

Red-team verdict (attack failed): the strongest case against (b) — "the published docs now depend on
`frontierui.dev` at runtime to style pills" — names a coupling that *already exists today* (the chrome
shell depends on the identical origin with the identical degradation). (b) adds badges to a dependency
already in production; no new origin, no new infra, no new boundary category. The only inversion rule 6
forbids (a build-time package import) is exactly what (b) avoids.

Graduates to the build successor **#1758** (FUI serves `fui:embed/badges-in-document.ts`; WE adds the
second guarded cross-origin import + SSR baseline in `we:src/_layouts/base.njk`), which #1598 is
re-pointed `blockedBy`. Codified: `we:docs/agent/platform-decisions.md` we-fui-embed-boundary (rule-7
application note).

## Fork 1 — how the published WE docs site loads + registers the FUI transient elements

**Fork-existence:** a genuine either/or — the published docs load FUI registration code exactly one way,
and the alternatives are mutually exclusive end-states; option (a) is moreover *excluded* by a ratified
invariant (rule 6), which makes this a real fork with a forced-out branch, not a support-both.

Crux refs: `we:docs/agent/platform-decisions.md` rule 6 (build-time `import '@frontierui'` = the only
boundary violation) + rule 7 / #1621 (cross-origin transient-CE model, by name); `we:src/_layouts/base.njk:418`
+ `we:src/_data/links.js:8` (the served origin already imported in prod); `fui:blocks/badge/registerBadge.ts:19`,
`fui:blocks/filter-chip/registerFilterChip.ts:19` (helpers exist); the ~10 docs pill macros in
`we:src/_includes/backlog-badges.njk` (the migration surfaces, #1598).

- **(b) Cross-origin import from the `frontierUrl` origin — _recommended_.** A small FUI-served entry
  (`fui:embed/badges-in-document.ts`, mirroring `fui:embed/in-document.ts`) calls
  `registerBadge(); registerFilterChip();` and injects the exported CSS once; the docs add a second
  cross-origin `import(...)` of that served entry in `we:src/_layouts/base.njk` guarded by
  `setTrustedOrigins`, with a `we-badge{}` / `we-filter-chip{}` SSR baseline. **Boundary-legal** (runtime
  URL bundle, not a build-time import), **already-ratified** (rule 7), **zero new infra** (reuses the live
  `frontierUrl` origin + the #865 pattern), and **no #872/#907 gate** (consumes by URL, not an npm
  package). Cost: the badge styling depends on `frontierui.dev` at runtime — but that degrades to the SSR
  baseline exactly like the chrome shell, which rule 7 mandates the baseline for.
- **(a) Bundle the FUI components into the WE docs assets.** *Rejected* — a build step pulling
  `@frontierui/blocks/{badge,filter-chip}` into a `we:src/assets/js/` bundle is a build-time
  `import '@frontierui'` into WE's build, which `we:docs/agent/platform-decisions.md` rule 6 names as the
  **one thing that violates the WE→FUI boundary** (#700/#239). It is also the only option that needs the
  human-gated #872/#907 publish. Production norm everywhere else, but boundary-illegal here.
- **(c) Defer the migration; keep the inline `<span>` macros.** *Rejected* — avoidance, not a blocker: the
  components exist (#1669/#1603), the served origin is live (`we:src/_layouts/base.njk:418`), and the
  mechanism is ratified (rule 7). Deferring buys nothing the cross-origin path doesn't already have, and
  the dogfood thesis applies to the docs board as much as any consumer page (rule 6).

Sub-fork (deferred, not blocking): #1598's taxonomy pills (kind/tier/tags) ride the #1669 `we-tag` work;
only the status-indicator surfaces (status/epic-status/reason) are in-scope for the first migration. This
loading-mechanism decision is independent of that split.

**Skeptic:** REFUTED → flipped the original (c)/(a) lean to **(b)**. The skeptic verified `we:src/_data/links.js:8`
(prod `frontierUrl` = `https://frontierui.dev`), `we:src/_layouts/base.njk:418` (already cross-origin-imports
it in prod), and rule 6/rule 7 — proving the "no served origin in prod" premise false, (a) bundle the named
boundary violation, and (b) the ratified path. The one surviving cost (runtime dependence on the FUI origin)
is the precise case rule 7's SSR baseline is designed for.

## Lineage

Surfaced during batch-2026-06-23-1725-1665 working #1598; #1598 is `blockedBy` this. Grounds: #1621 (the
transient-CE model + rule 7, `we:docs/agent/platform-decisions.md`), rule 6 (the WE→FUI boundary,
#700/#239), #1499 (cross-origin import precedent), #1669/#1603 (the shipped components), #872/#907 (the
published-package end-state — needed only by the rejected option (a)). Research: `/research/docs-site-own-component-distribution/`.
Report: `we:reports/2026-06-24-docs-site-own-component-distribution.md`.
