---
kind: story
size: 3
status: resolved
dateOpened: "2026-06-26"
dateStarted: "2026-06-26"
dateResolved: "2026-06-26"
graduatedTo: none
tags: [website, gate, exposure, drift, catalogs]
---

# Catalog-index completeness gate: every artifact type needs a top-level index + nav entry

A whole class of drift keeps slipping past the "expose everything through the website" rule: an artifact type ships **detail pages** (`/<type>/{id}/`) but never gets a **top-level index** (`/<type>/`) or a nav entry, so the type is only reachable by deep-linking. Adapters had exactly this (fixed in the #1792 follow-up — `we:src/adapters.njk` + nav). Auditing for it surfaced more: `/plugs/`, `/projects/`, `/resources/`, `/states/` all have detail pages but **no index page at all** (the type-root URL 404s). The fix is to make the invariant machine-enforced so the next new registry can't repeat it.

## The invariant
For every artifact type `T` that has a detail-page template (a `we:src` `*-pages.njk` with permalink `T/{id}/`), there must exist **(a)** a top-level index resolving to `/T/`, and **(b)** a nav entry linking `/T/` in `we:src/_layouts/base.njk` — unless `T` is on an explicit exemption allowlist with a stated reason.

## Build
- Add a rule to `we:scripts/check-standards.mjs` (or `we:scripts/check-standards-rules.mjs`) that:
  - derives the detail-page type set by scanning the `we:src` templates for a permalink of the form `<type>/{id}/`;
  - for each type, confirms a top-level index is produced (a scoped one-off 11ty build and check for the type-root index, or assert a `we:src` `<type>.njk` / index permalink) and that a `weNavLink("/<type>/", …)` is present in `we:src/_layouts/base.njk`;
  - errors (or warns first, then errors) on any type missing either, unless allowlisted with a reason.
- Note: `check:standards` skips the 11ty build today (see [project_check_standards_skips_11ty_build] memory / docs), so decide whether this rule does a scoped build or asserts template existence statically.
- Build the four missing indexes (`/plugs/`, `/projects/`, `/resources/`, `/states/`) mirroring `we:src/adapters.njk`, or allowlist any that are intentionally surfaced elsewhere (e.g. projects may be a homepage-organizing unit, not a flat catalog) — decide per type.

## Acceptance
- The gate fails when a detail-page type has no index/nav entry and isn't allowlisted.
- The four currently-missing types are each either built or explicitly exempted with a reason.
- `check:standards` green.

## Outcome (shipped)
- **Gate:** new section 6g in `we:scripts/check-standards.mjs` derives detail-page types from `permalink: "<type>/{{ …id }}/"` templates and errors on any missing a top-level index or a `weNavLink("/<type>/")` in `we:src/_layouts/base.njk`, unless in the `INDEX_EXEMPT`/`NAV_EXEMPT` allowlists (each entry carries a reason). Negative-tested: removing an index flips the gate red.
- **Built indexes:** `we:src/plugs.njk` (56), `we:src/resources.njk` (6), `we:src/states.njk` (3) — mirror `we:src/adapters.njk`; all added to the Standards nav.
- **Exempted:** `projects` (INDEX + NAV) — its catalog is the homepage (`/`), which lists every project by category.
- `check:standards` green; one-off 11ty build renders all four type-root indexes.

_Surfaced during the #1792 hidden-docs / exposure cleanup._
