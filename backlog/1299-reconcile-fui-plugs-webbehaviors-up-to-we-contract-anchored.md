---
kind: story
size: 3
parent: "1250"
locus: frontierui
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
tags: []
---

# Reconcile fui:plugs/webbehaviors UP to WE (contract-anchored)

## Progress (batch-2026-06-20) — DONE

Plug core landed in FUI (fui:plugs/webbehaviors):
- **`ownerElement` getter** added to `CustomAttribute.ts` (mirrors native `Attr.ownerElement`, #1121),
  with the existing **`target` getter kept as a `@deprecated` back-compat alias** returning the same
  `#target` — zero consumer breaks; the alias is removed by the enforcement tail #1333.
- **`whenDefined(name)`** added to `CustomAttributeRegistry.ts` (#1119): a `#whenDefinedResolvers` map,
  a single drain point in `define()` covering both eager and lazy (`#loadLazy → define`) paths, resolves
  immediately for already-defined names, never rejects.
- Doc-comment follow-through in `index.ts` (`this.target` → `this.ownerElement` in the usage example).
- Plug unit tests extended: `ownerElement` + deprecated-`target`-alias parity assertions, and 3
  `whenDefined` cases (already-defined / pending / multi-awaiter). **68 tests green.**

`whenDefined` (#1119) on FUI's plug is intentionally *not* the rejecting webregistries stub. The #1120
throwing name-validation is NOT in this slice — it's the enforcement tail (#1333). Migration siblings
#1328–#1332 (`blockedBy: 1299`) now unblocked to flip `.target` → `.ownerElement` per area.

Gate: FUI `check:standards` is red on 2 pre-existing catalog-completeness errors
(`blocks/notification/`, `blocks/signature-pad/` missing blocks.json entries) — unrelated to this
webbehaviors changeset; not caused here.


Add the `ownerElement` getter + a deprecated `target` alias + `whenDefined` to FUI's webbehaviors plug — the foundational core of the webbehaviors reconcile, with the cross-cutting consumer migration carved into sibling slices under #1250.

## Sliced 2026-06-20 (`/slice 1299` — `we:reports/2026-06-20-backlog-split-analysis.md`) — size 13 → 3

This story is now **re-scoped to its foundational core slice (size 3, batchable)**; the cross-cutting
consumer migration is carved into siblings under the parent epic #1250 (not nested — #1299 already has
`parent: 1250`). The work was all *volume, no fork* (#1119/#1120/#1121 resolved), and becomes safely
sliceable once a **deprecated `target` alias** is added up front (keeps all consumers green so each area
drains independently). Investigation correction: the "96 files" figure below overcounts — `event.target`
(25) and `fui:plugs/webinjectors/Injector.ts:69`'s own `Injector.target` (9) are **not** the
CustomAttribute getter; the real #1121 blast radius is ~24 CustomAttribute subclasses + 2 plug tests + 5
demos.

**#1299 (this story, size 3) = the plug core:** add the `ownerElement` getter + keep a **deprecated
`target` alias** (zero consumer breaks) + `whenDefined` (#1119) to
`fui:plugs/webbehaviors/CustomAttribute.ts` + `fui:plugs/webbehaviors/CustomAttributeRegistry.ts` +
`fui:plugs/webbehaviors/index.ts`; update the 2 plug unit tests to assert ownerElement + alias +
whenDefined. Foundation — every migration sibling `blockedBy` this.

**Migration siblings under #1250** (`blockedBy: 1299`, 5-wide parallel; then the enforcement tail
`blockedBy` all of them): **#1328** droplist · **#1329** navigation/router/tabs/type-ahead · **#1330**
view/for-each/data-grid/attributes · **#1331** traits/temporal/workflow-engine · **#1332** SPA +
visibility-gate demos · **#1333** enforce #1120 throw + drop the alias. See the split report for the
per-slice DAG.

---

> **History — superseded sizing (kept for lineage).** The two sections below recorded the pre-split
> `size 2 → 8 → 13` reasoning while #1299 was a single oversized item. They are **superseded by the
> *Sliced 2026-06-20* section above**: the scope they call "epic-scale, not batch fodder" is now exactly
> the carve realised in #1328–#1333, and #1299 itself is the size-3 plug core.

## Pre-split sizing — size 2 → 8 (grounded 2026-06-20, batch-2026-06-20-1297-1306)

The "3 content diffs" framing undercounts. Auditing the real drift (FUI vs WE + the resolved
decisions): WE is ahead on all three, and each is **contract-settled** (not a fork) —

- `CustomAttribute`: WE renamed the host property `target` → `ownerElement` per **#1121**
  (resolved 2026-06-19, ruled `ownerElement`, the `target` branch is broken). FUI still uses `target`.
- `CustomAttributeRegistry`: WE adds `whenDefined(name)` (**#1119**, resolved) + a `#assertValidName`
  hyphen/`:`-namespace check (**#1120**, resolved; spec `we:src/_includes/project-webbehaviors.njk:83`)
  that **throws** on bare names. FUI lacks both.
- `fui:plugs/webbehaviors/index.ts`: doc-comment follow-through (`ownerElement`, hyphenated examples).

The impl reconcile itself is ~3 files, but it **drags a consumer migration** that makes this an 8, not a 2:

1. **`target` → `ownerElement`** across FUI consumers — `fui:plugs/webbehaviors/__tests__/unit/CustomAttribute.test.ts`,
   `fui:plugs/webbehaviors/__tests__/unit/CustomAttributeRegistry.test.ts`, and demos `fui:demos/visibility-gate.ts`, `fui:demos/visibility-gate-heavy.ts`,
   `fui:demos/declarative-spa.html` (529L), `fui:demos/declarative-spa-jsx.tsx` (343L), `fui:demos/declarative-spa-unplugged.html` (616L).
2. **#1120 hyphen enforcement** then **throws at `define()`** on every bare name FUI currently uses —
   `ambient, auto, clickable, poll, reveal, sortable, sticky, toggle, tooltip` (tests) and
   `claim, counter, form, heavy, loan, policy, pulse, reveal, todo` (demos). Each rename touches the
   `define()` call **and** the element markup + companion config attrs (`reveal-when`, `poll-when`,
   `auto-when`, `sticky-when`) + querySelectors. Copying the WE impl wholesale would have broken 54 FUI
   unit tests and thrown at runtime in the SPA demos — which is why those consumer renames were carved out
   to #1328–#1333 (the alias in this core slice keeps them green until each migrates).

So this slice was assessed as a per-domain audit **+** a browser-verifiable demo migration (probe fui
:3001), not a mechanical 3-file copy — which is what drove the carve above (the migration became #1328–#1332).

> **Cross-family caveat for #1250:** the drift map's "differ" count is **direction-agnostic and includes
> structural path diffs, not just feature drift** — e.g. webguards (#1302) "2 diffs" are almost entirely
> WE `../../guard/` vs FUI `../../blocks/guard/` import paths + doc comments, *not* a real feature gap. So
> the reconcile slices are **not a blind copy of WE files over FUI** (that breaks FUI's imports); each
> needs a per-file audit to separate repo-structural diffs from genuine drift. Re-scope the family
> (per-domain audit) before treating any as a clean size-2/3 batch item.

## Pre-split sizing — size 8 → 13 (grounded 2026-06-20, batch-2026-06-20) — epic-scale blast radius

Measured the real blast radius of the `target` → `ownerElement` rename (#1121, where the `target` branch
is ruled broken — no alias). Across `fui:` **96 files** reference `.target`: **36 FUI source block-behaviors**
(every droplist trait, all 3 navigation behaviors, the view directives, data-grid, for-each, tabs, type-ahead,
router RouteLinkBehavior, temporal traits, workflow engine, OnEventAttribute, …) plus the 2 CustomAttribute
unit-test files (~54 assertions) and ~8 demos. Renaming the `CustomAttribute` getter without a back-compat
alias breaks all 96 at once. Compounding it, #1120's `#assertValidName` hyphen/`:`-namespace check **throws**
on bare names, so any FUI attribute registered under a bare name would start erroring on adoption.

At the time this read as an epic-scale cross-cutting migration (the original was set `size: 13`). That
sizing drove the split realised above. The suggested split it recorded — now carved as #1299 + #1328–#1333 — was:
- a plug slice that adds `ownerElement` and keeps a **deprecated `target` alias** (so the 96 consumers don't
  break in one commit), + `whenDefined` (#1119);
- per-area consumer-migration slices (droplist / navigation / view / data-grid / router / temporal / demos /
  tests) flipping `.target` → `.ownerElement`;
- a final slice that flips on #1120's throwing name-validation after auditing every `define()` call for bare
  names, then removes the `target` alias.
Carried forward from batch-2026-06-20 — outgrew (real scope 96 files, not the re-scoped 8).

## Sliced 2026-06-20 (`/slice 1299` — `we:reports/2026-06-20-backlog-split-analysis.md`) — size 13 → 3

This story is **re-scoped to its foundational core slice** and the migration carved into siblings under
the parent epic #1250 (not nested — #1299 already has `parent: 1250`). The work was all *volume, no fork*
(#1119/#1120/#1121 resolved), and becomes safely batchable once a **deprecated `target` alias** is added
up front (keeps all consumers green so each area drains independently). Investigation correction: the
"96 files" overcounts — `event.target` (25) and `fui:plugs/webinjectors/Injector.ts:69`'s own
`Injector.target` (9) are **not** the CustomAttribute getter; the real #1121 blast radius is ~24
CustomAttribute subclasses + 2 plug tests + 5 demos.

**#1299 (this story, size 3) = the plug core:** add the `ownerElement` getter + keep a **deprecated
`target` alias** (zero consumer breaks) + `whenDefined` (#1119) to
`fui:plugs/webbehaviors/CustomAttribute.ts` + `fui:plugs/webbehaviors/CustomAttributeRegistry.ts` +
`fui:plugs/webbehaviors/index.ts`; update the 2 plug unit tests to assert ownerElement + alias +
whenDefined. Foundation — every migration sibling `blockedBy` this.

**Migration siblings under #1250** (`blockedBy: 1299`, 5-wide parallel; then the enforcement tail
`blockedBy` all of them): droplist · navigation-cluster · view-cluster · traits/temporal-cluster ·
demos · then enforce #1120 throw + drop the alias. See the split report for the per-slice DAG.
