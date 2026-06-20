---
kind: story
size: 5
status: resolved
locus: webeverything
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: none
tags: []
---

# Align implementedBy<->exports modeling so the export-shape gate can enumerate a block's full surface

Prereq for the #927 export-shape drift arm (filed when #927 was attempted+reverted in
batch-2026-06-18). The export-shape gate can't enforce today because a block's `implementedBy` names
**one** file while its `exports` span **sibling** modules — `router` points at `we:RouteViewElement.ts`
but declares `registerRouter`/`RouteOutletElement` living in sibling files; same for `for-each`, `tabs`,
`transient-component` (~7 blocks). A single-file gather can't see them, so the arm fails 7 blocks on a
modeling artifact, not real typos. This item aligns the model: either point `implementedBy` at an
enumerable module index, or scope `exports` to the named file, across the mismatched blocks — so #927's
resolver has a sound surface to compare against.

## Progress (batch-2026-06-18) — resolved

**Ruling on the body's "either/or": point `implementedBy` at the module index (option A), never scope
`exports` (option B).** B is the flawed branch — `router` genuinely exports `RouteOutletElement`/
`registerRouter`/… (it has two tag names, `we-route-view` + `we-route-outlet`); truncating `exports` to
one leaf file would make the contract **lie** about the block's real public surface. So A is forced, and
it is also the **already-dominant convention** (`app-shell`, `button`, `nav-list`→`navigation`, `tabs`
already point at the module index) — not a new design, a straggler-alignment.

- **Re-pointed 6 deep-file blocks** to their enumerable index barrel (e.g. `fui:blocks/router/index.ts`)
  in each block JSON under `we:src/_data/blocks/`: `router`, `for-each`, `transient-component`, `view`,
  `type-ahead`, `resource-loader` (`tabs` already pointed at its barrel). Used the explicit barrel form
  (matches `we:scripts/gen-cem.mjs`'s own canonical fallback, and is unambiguous for #927's resolver).
  Verified each barrel exists and re-exports the full surface where the block is a clean modeling artifact.
- **CEM regenerated** (`gen:cem`) — `we:custom-elements.json` `path`/`module` for exactly those 6 blocks
  now point at the barrel; no other churn. The §8c impl-resolution gate still resolves all (dir → index
  barrel), no `does not resolve` regressions.
- **Did NOT touch `exports` or mask drift.** My (regex, same limitation #927 flags) survey found 3 of the
  "7" are **real export drift**, not modeling artifacts — `tabs` (declares a component+attributes surface;
  FUI ships `TabGroupBehavior`), `transient-component` (`SmartLink`/`withSelfReplacement` absent), `view`
  (4 `View*` symbols absent). These are exactly what #927's gate exists to surface, so they are **left as
  findings**, with the source-of-truth call (fix `we:` `exports` vs build the FUI surface) deferred to
  #927. The full partition (clean / real-drift / renderer-no-barrel) is written into **#927's body** as
  the map its resolver will meet. #948's scope (a) — make the surface enumerable — is complete; (b) the
  TS-program resolver remains #927's work.
