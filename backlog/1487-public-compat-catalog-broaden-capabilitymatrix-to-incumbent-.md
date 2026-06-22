---
kind: story
size: 5
parent: "1451"
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "we:src/compat.njk"
tags: []
---

# Public /compat/ catalog — broaden capabilityMatrix to incumbent libs as peer columns

Build the ratified #1450 outcome: broaden we:src/_data/capabilityMatrix.json from native substrates (face, base-select) to incumbent libraries (Floating UI, Mousetrap, TanStack, FUI, focus-trap, …) as rows, and render the public /compat/ catalog (peer column per impl, no privileged/reference column) per we:docs/agent/platform-decisions.md rule #7. Reuses the existing column-per-impl grid at we:src/capabilities.njk:21-39. Build-time schema task: library rows need a supported/partial/unsupported tier vocabulary alongside the native-first substrate tiers (native-ok/polyfill-ok/capability-hard), which are platform-relative and don't apply to a JS lib. New public surface ⇒ page + nav + authoring note + validator (Catalogs Auto-Render From JSON). The red/missing-cell count is #1451's front-A metric.

## Progress (batch-2026-06-21-1429-1487)

Built the ratified #1450 outcome — the public `/compat/` peer-column catalog. Verified live (HTTP 200 on
:8080; both columns + tier vocabs + the axis-scope section render):
- **Build-time schema task** — `we:src/_data/capabilityMatrix.json`: added a `kind` discriminator
  (`native` default | `library`) + a second tier vocabulary `libraryTiers: [supported, partial,
  unsupported]` for library impls (the native-first substrate tiers are platform-relative and don't apply
  to a JS lib). Updated the validator (`we:scripts/check-standards-rules.mjs` — new `LIBRARY_TIER_STATES`,
  per-impl tier-set keyed on `kind`, `kind` enum check) so a `library` row tiers on the coverage axis;
  rules unit suite green (280/280).
- **Broadened rows** — added two incumbent **peer columns**: `floating-ui` (anchor-positioning supported,
  popover partial, the rest unsupported — a single-domain incumbent) and `frontier-ui` (FUI, the reference
  lib, the greenest column — strength *earned/visible*, never status-declared, per #1450→A). Both tier the
  full 21-capability grid (completeness invariant). + adapter-description partials
  `we:src/_includes/capability-adapter-descriptions/{floating-ui,frontier-ui}.njk`.
- **Public surface** — `we:src/compat.njk` (→ `/compat/`): the neutral peer-column grid (no privileged
  column), dual-vocab legend, the impl-neutrality framing, + nav entry in `we:src/_layouts/base.njk` and the
  Vite proxy allowlist (`we:vite.config.mts`). Kept `we:src/capabilities.njk` as the **native-substrate**
  resolver view (filtered to `kind:native`) so the two surfaces stay distinct.

**Finding surfaced (the #1450 "one row per lib" assumption's gap):** the 21 capabilities are all
**native-platform-feature** ids, so incumbents in *other* domains — **focus-trap** (focus containment),
**Mousetrap** (keyboard shortcuts), **TanStack** (data-grid/query) — map onto **zero** of them and would be
meaningless all-grey rows. Broadening to those libs needs the capability **axis** grown to their domains
*first* — surfaced on `/compat/` as a "Scope of the axis" note and routed to the **#1451** library-adapter
watch (the ongoing front-A program), not forced in here. Gate green (0 errors).
