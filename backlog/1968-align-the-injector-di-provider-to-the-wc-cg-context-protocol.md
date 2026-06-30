---
kind: story
size: 5
parent: "1963"
status: resolved
dateOpened: "2026-06-29"
dateStarted: "2026-06-30"
dateResolved: "2026-06-30"
tags: []
---

# Align the injector (DI provider) to the WC-CG Context Protocol — zero-node DI

Case 6 (DI provider) is strongest as a zero-node, standards-aligned mechanism: the WC-CG Context Protocol (a bubbling context-request event any ancestor answers; proven in lit context). Align WE's injector (#1044) to it per the plug-to-direction rule so it migrates cleanly when the standard lands. The display:contents host stays the cheap-node fallback (AX fixed 2023; interactive-only residual), not primary. Ratified under #1963.

## Resolution

The injector now exposes the WC-CG Context Protocol as an **event front door over the existing chain
resolution** — the DOM-walk stays as the cheap-node fallback (not removed), per the plug-to-direction rule
(#95 / #1963 item 7), so it migrates cleanly when the native standard ships.

- **Contract (WE, type-only / compile-erased)** — `we:webinjectors/contract.ts` adds `ContextRequest<T>`,
  `ContextCallback<T>`, and `ContextRequestEventType`: the standards-track wire shape (bubbling, composed
  `context-request`; nearest ancestor answers; `subscribe` slot carried for migration fidelity). WE holds
  zero impl; only the contract crosses the seam.
- **Impl (FUI)** — `fui:plugs/webinjectors/ContextProtocol.ts`: `ContextRequestEvent` (bubbles + composed,
  carries `context` + `callback`), `requestContext()` / `getContext()` consumer helpers, and
  `installContextProtocol(root)` — a single ancestor listener that answers a `context-request` by resolving
  the key through the **same** injector chain a `consume()` reads (`InjectorRoot.getProviderOf`) and
  `stopPropagation()`s on the first satisfying ancestor (WC-CG "nearest ancestor wins"). Zero added node.
  Exported from `fui:plugs/webinjectors/index.ts`; unit-tested in
  `fui:plugs/webinjectors/__tests__/unit/ContextProtocol.test.ts` (event shape, ancestor resolution,
  unanswered-bubble, zero-node assertion, and event-vs-chain parity).
