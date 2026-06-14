---
type: idea
workItem: story
size: 5
locus: frontierui
status: open
dateOpened: "2026-06-14"
blockedBy: []
tags: [plugs, frontier-ui, webeverything, superset, reconciliation, refactor]
crossRef: { url: /backlog/449-wire-the-we-plugs-alias-in-frontier-ui-and-delete-the-vendor/, label: "Blocks #449 (alias + delete vendored plugs)" }
---

# Reconcile the 16 divergent FU↔WE plugs files so WE is a true runtime superset (precursor to #449)

Surfaced 2026-06-14 (batch claim on #449). #449's premise — "after #447 + #448 WE is the runtime superset;
files reach FU via the alias, no copy-down" — is **false**. A diff of `frontierui/plugs/` vs
`webeverything/plugs/` finds, beyond 8 expected FU-only files, **16 common files that diverge**, with **FU
ahead in some** (`webcontexts/CustomContext.ts`: 24 FU-only lines). Aliasing+deleting would **lose FU runtime
code**. This converges the trees so WE is a true superset (porting FU-ahead files up first); it gates #449.

## The 16 divergent common files

Expected WE-ahead (per #449's own list — adopt WE): `webinjectors/Injector.ts`, `webinjectors/index.ts`,
`webregistries/CustomElementRegistry.ts`.

**Unexpected divergences — direction must be verified per file before any deletion** (FU may be canonical):
`bootstrap.ts`, `core/cloneUtils.ts`, `webbehaviors/CustomAttributeRegistry.ts`, `webcomponents/cloneHandlers.ts`,
`webcontexts/CustomContext.ts` (FU ahead, proven), `webcontexts/Node.contexts.patch.ts`,
`webexpressions/CustomTextNodeParser.ts`, `webexpressions/CustomTextNodeRegistry.ts`,
`webexpressions/UndeterminedTextNode.ts`, plus 4 divergent test files
(`__tests__/e2e/webcomponents.spec.ts`, `core/__tests__/pathInsertionMethods.extended.test.ts`,
`webcomponents/__tests__/unit/Element.insertion.patch.test.ts`, `webinjectors/__tests__/unit/Injector.test.ts`).

## What this item does

Per divergent file, determine the canonical version and converge the two trees so `webeverything/plugs/`
is a **true superset** of `frontierui/plugs/`: where WE is genuinely ahead, confirm FU loses nothing by
adopting it; where **FU is ahead** (e.g. `CustomContext.ts`), port FU's additions up into WE first (WE is
the upstream per the constellation: WE standard layer → FUI impl). No FU runtime behaviour may be lost.
This re-opens the assumption #447/#448 were meant to establish — either they were incomplete or FU diverged
after them; the close-out must state which.

## Why a precursor, not part of #449

#449 is the destructive step (delete `frontierui/plugs/`, repoint 8 aliases). It is only safe once WE is a
proven superset — otherwise the delete is lossy. So this reconciliation is the gate: resolve it, then #449
becomes the mechanical alias + delete it was always meant to be.

## Gate

`npm run check:standards` in `../frontierui`; a per-file diff of the two trees shows WE ⊇ FU (no FU-only
runtime lines remain) before #449 is unblocked.
