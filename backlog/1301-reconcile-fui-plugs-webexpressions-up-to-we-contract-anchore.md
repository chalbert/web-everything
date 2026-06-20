---
kind: story
size: 3
parent: "1250"
locus: frontierui
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "fui:plugs/webexpressions/CustomTextNodeRegistry.ts"
tags: []
---

# Reconcile fui:plugs/webexpressions UP to WE (contract-anchored)

Audit fui:plugs/webexpressions vs contract+vectors, then port ExplicitHTMLInsertion.patch + reconcile 4 diffs (CustomTextNode*, UndeterminedTextNode, index) FUI-up.

## Progress

Reconciled `fui:plugs/webexpressions` UP to WE — FUI was behind on three additive features:

- **Ported** `fui:plugs/webexpressions/ExplicitHTMLInsertion.patch.ts` (WE-only) — wired into `fui:plugs/webexpressions/index.ts`
  applyPatches/removePatch (came with WE's index).
- **`fui:plugs/webexpressions/CustomTextNodeRegistry.ts`** → WE's version: cloak-attribute removal after upgrade (#1124),
  parser `excludedElements` + `#isInsideExcludedElement` skip, and the MutationObserver `addedNodes`
  dynamic-insertion upgrade (#1125). These are additive — they do NOT touch the core upgrade/`instanceof`
  wiring.
- **`fui:plugs/webexpressions/CustomTextNodeParser.ts`**, **`fui:plugs/webexpressions/UndeterminedTextNode.ts`**, **`fui:plugs/webexpressions/index.ts`** → byte-identical to WE.
- Ported the 5 WE-only tests (addedNodes, excludedElements, ExplicitHTMLInsertion.patch, cloakRemoval,
  unplugged). FUI webexpressions tests green (104, 2 skipped).

Note: this is the plug-CONTRACT reconcile. The separate **#1207** demo-runtime bug (the `{{name}}`
upgrade not firing in `we:demos/text-interpolation-demo.html`) stays carried-forward — its root cause is
the WE demo's bootstrap wiring, not the FUI plug surface, and is unaffected by these additive features.
FUI `check:standards` red only on the 2 pre-existing notification/signature-pad errors (stepped over).
