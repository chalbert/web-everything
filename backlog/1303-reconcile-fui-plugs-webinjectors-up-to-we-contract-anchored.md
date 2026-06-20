---
kind: story
size: 2
parent: "1250"
locus: frontierui
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "fui:plugs/webinjectors/InjectorRoot.ts"
tags: []
---

# Reconcile fui:plugs/webinjectors UP to WE (contract-anchored)

Audit fui:plugs/webinjectors vs contract+vectors, then reconcile InjectorRoot + Node.injectors.patch (2 content diffs) FUI-up.

## Progress

Reconciled `fui:plugs/webinjectors` UP to the WE contract — 2 real drifts where FUI was behind:

- `fui:plugs/webinjectors/InjectorRoot.ts` — added the `customTrackers` provider slot to
  `ProviderTypeMap` (`type CustomTrackerRegistry = any;` + `customTrackers: CustomTrackerRegistry;`),
  matching WE's provider type map. FUI's file is now byte-identical to WE's.
- `fui:plugs/webinjectors/Node.injectors.patch.ts` — adopted WE's more-robust static-property carry-over:
  a `FUNCTION_OWN_KEYS` set that also skips `arguments`/`caller` (not just `prototype`/`length`/`name`),
  so copying descriptors off the original `Node` can't trip the function poison-pill keys. Comment updated
  to WE's (references the #1011 patch-interaction harness). Behavior now matches WE.

FUI webinjectors unit tests green (175 passed, 1 skipped). FUI `check:standards` red only on the 2
PRE-EXISTING catalog-drift errors (`fui:blocks/notification/`, `fui:blocks/signature-pad/`) unrelated to
this changeset — stepped over per the batch gate-red-scoped-to-own-work rule.
