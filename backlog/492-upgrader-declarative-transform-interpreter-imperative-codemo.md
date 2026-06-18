---
type: issue
workItem: story
size: 5
parent: "097"
status: resolved
dateOpened: "2026-06-13"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
tags: []
---

# Upgrader declarative transform interpreter + imperative codemod escape hatch

Build slice (b) of the ratified #191 version-migration upgrader (Fork 2 = declarative-first). Build the engine-side interpreter that applies a changelog-manifest migration entry's DECLARATIVE transform to a call site (no codemod module to write or trust), plus the imperative escape hatch: when an entry references a codemod (jscodeshift/ts-morph-style) for a transform too complex to declare, run it under #102's author/integrity-hash trust metadata. Includes the held-open sub-decision from #191: enumerate the declarative change-kind vocabulary the engine interprets natively (rename-attr / move-dimension / retire-provider / re-namespace …) against the real breaking-change history. Ready now.

## Progress

Resolved 2026-06-13 — slice (b) built as [we:transformInterpreter.ts](../blocks/renderers/upgrader/transformInterpreter.ts), executing the ordered plan slice (a) produces.

**Declarative-first interpreter.** Four native change-kinds, each interpreted via a DOM round-trip
(the engine's `normalizeHtml` model). The held-open #191 sub-decision (which vocabulary) is resolved by
one rule — *a kind earns a slot only if it maps to a mechanically distinct markup rewrite*, intent alone
lives in the changelog `summary`:

- `rename-attr` — attribute name changes, value verbatim.
- `move-dimension` — value relocates to another attribute, optionally remapped through a `valueMap`
  (a configurator dimension whose value-space also changed) — the remap is what makes it more than a rename.
- `retire-provider` — a retired registry-provider id on an attribute → rewrite to its replacement, or
  **flag** (diagnostic, never silently dropped) when none exists.
- `re-namespace` — custom-element tag-prefix rewrite (`<we-*>` → `<fui-*>`), nested-safe.

Anything outside this set drops to the imperative escape hatch — never silently skipped (`applied: false`
+ diagnostic).

**Imperative escape hatch (trust-gated, #102).** A codemod is resolved from an injected, caller-owned
`CustomCodemodRegistry` (a devtools provider seam, no global singleton — same discipline as #494's
analyzer-seam cleanup) and run **only** when the registered codemod's `integrity` matches the manifest
author's declared hash. Missing / mismatched / throwing → refused with a diagnostic, never executed.

**Descriptor.** Restructured the planner's migration linkage `MigrationRef` into a discriminated union
`DeclarativeMigration | ImperativeMigration` (`mode`), the declarative vocabulary types living beside the
#102-mirrored descriptor in [we:versionMigrationPlanner.ts](../blocks/renderers/upgrader/versionMigrationPlanner.ts).
`applyMigrationPlan()` threads each step's output into the next — the version-gated run loop executed.

Gate: `check:standards` green; 18 new/updated unit tests pass (full renderer suite 630 green, 2 skipped).

**Unblocks #493** (slice c — wire the version-migration kind as a second input adapter on the engine,
driving planner → this interpreter → `verifyUpgrade`). Its other blocker #491 is already resolved, so #493
is now ready.
