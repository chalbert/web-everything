---
kind: task
parent: "1250"
locus: frontierui
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "fui:plugs/webregistries/CustomElementRegistry.ts"
tags: [plugs, webregistries, reconciliation, frontierui, contract-anchored]
---

# Reconcile fui:plugs/webregistries CustomElementRegistry clean improvements (#1101 whenDefined + #1102 getStandIn/dup-guard) FUI-up

Contract-audit then port WE's #1101 `whenDefined` real promise + #1102 `#getStandInElement` extraction +
duplicate-define guard into `fui:plugs/webregistries/CustomElementRegistry.ts`, **PRESERVING FUI's
`downgrade` + FUI import paths** (audit, don't blind-copy — #1270 principle 1). Update the FUI unit test.
Independent of the #1350 downgrade decision and the #1304 declarative/patching core — immediately
batchable. Carved from #1304 during `/split`
([we:reports/2026-06-20-backlog-split-analysis.md](../reports/2026-06-20-backlog-split-analysis.md)).

## Grounded delta (FUI behind WE, 2026-06-20)

FUI's `fui:plugs/webregistries/CustomElementRegistry.ts` lags WE on three resolved, fork-free changes:

- **#1101 `whenDefined` real promise.** FUI still reject-stubs
  ([fui:plugs/webregistries/CustomElementRegistry.ts:134-137](../../frontierui/plugs/webregistries/CustomElementRegistry.ts#L134));
  WE ships a pending-resolver map fired from `define()`
  ([we:plugs/webregistries/CustomElementRegistry.ts:79-98,180-190](../plugs/webregistries/CustomElementRegistry.ts#L180)).
- **#1102 `#getStandInElement` extraction + duplicate-define guard.** FUI has the inline TODO stand-in
  ([fui:plugs/webregistries/CustomElementRegistry.ts:110-118](../../frontierui/plugs/webregistries/CustomElementRegistry.ts#L110))
  and `// TODO: Validate…` at the define site (`:80`); WE extracts `#getStandInElement` + throws the
  per-registry duplicate-name/constructor `DOMException`
  ([we:plugs/webregistries/CustomElementRegistry.ts:83-98,149-162](../plugs/webregistries/CustomElementRegistry.ts#L149)).

**Preserve, do not touch:** FUI's `downgrade()` (the #1350 decision owns that; this slice keeps the
status quo so FUI stays green and `isPlug`/`register()` keep passing) and FUI's local import paths.

## Demo / done-when

FUI `npx vitest run plugs/webregistries` green with the ported behaviours asserted (whenDefined
pending→define resolves with the ctor; stand-in for autonomous + customized-built-in; duplicate-name and
duplicate-constructor throw). FUI build stays green.

## Progress (2026-06-20, batch-2026-06-20-1344-1342)

**Contract-anchored audit (#1270):** diffed `fui:plugs/webregistries/CustomElementRegistry.ts` against WE
— the only deltas were the three resolved changes below plus WE's #1103 `downgrade()` removal (deliberately
**not** adopted). Confirmed FUI's base classes expose the helpers the guard needs
(`fui:plugs/core/CustomRegistry.ts` `hasOwn`, `fui:plugs/core/HTMLRegistry.ts` `getLocalNameOf`). Ported
FUI-up:

- **#1101 `whenDefined` real promise** — added the `#whenDefinedResolvers` pending map, the fast-path
  `has()` resolve, the pending-promise registration, and the fire-on-`define()` settlement (replacing the
  reject-stub).
- **#1102 `#getStandInElement` extraction** — replaced the inline stand-in build with the extracted private
  method (autonomous → `HTMLElement`; customized-built-in → matching `HTML*Element` base).
- **#1102 duplicate-define guard** — replaced the `// TODO: Validate…` with the per-registry
  duplicate-name (`hasOwn`) and duplicate-constructor (`getLocalNameOf`) `NotSupportedError` `DOMException`s.

**Preserved (not touched):** FUI's `downgrade()` stub (the #1350 decision owns convergence) and FUI's
local import paths — the file now differs from WE *only* by those two intentional points.

Updated `fui:plugs/webregistries/__tests__/unit/CustomElementRegistry.test.ts`: un-skipped the
already-defined resolve, added pending→define resolve, and added the duplicate-name + duplicate-constructor
throw cases. `npx vitest run plugs/webregistries` → **26 passed**. Gate clean (no webregistries finding;
the 2 residual errors are the pre-existing `notification`/`signature-pad` manifest gaps).
