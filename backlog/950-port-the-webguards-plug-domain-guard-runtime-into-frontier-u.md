---
type: decision
workItem: story
size: 3
parent: "170"
status: open
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
tags: []
---

# Reconcile the webguards plug against FUI's already-restructured `blocks/guard` runtime (#875)

Originally framed as an additive FUI-side port (copy `guard/{provider,registry,index,accessControl}` +
`plugs/webguards/*` + bootstrap wiring, contract via the wired `@webeverything/contracts/guard` alias).
**Attempted in batch-2026-06-18 and reverted** — the port premise is void: **the guard runtime already
lives in FUI** and the remaining seam is a genuine design reconciliation, not a mechanical copy.

## Why it outgrew — surfaced mid-port (batch-2026-06-18)

Tracing the real FUI tree before merging revealed:

- **`fui:frontierui/blocks/guard/` already exists** (committed by **#875** — *"consume contract halves from
  `@webeverything/contracts` — retire FUI byte copies"*): the `provider`/`registry`/`accessControl`/`index`
  modules, importing the contract via the `@webeverything/contracts/guard` alias. So the `guard/` half of
  this card is **already done**, at `fui:blocks/guard/` (not a fresh top-level `guard/`). A naïve copy
  duplicates it.
- **`fui:blocks/guard/registry.ts` already exports `class CustomGuardRegistry`** (standalone — *not*
  extending the plug-core `CustomRegistry`) with `define(provider, asDefault)` + `fui:blocks/guard/index.ts`
  `createDefaultRegistry()`. The WE webguards plug (`we:plugs/webguards/CustomGuardRegistry.ts`) defines a
  **same-named `CustomGuardRegistry` that EXTENDS `CustomRegistry`** (the #606 plug-family pattern). Porting
  the plug therefore collides: two classes, same name, different bases. The override
  `define(provider: CustomGuardProvider)` is incompatible with the `CustomRegistry` base under FUI's `tsc`
  (`TS2416`) — it compiles in WE only because WE has no such standalone twin. (Functionally the ported tests
  pass once re-pointed at `fui:blocks/guard`, but the type model is the real conflict.)

## The fork (needs a call before the build)

**How should the webguards plug relate to the #875-restructured standalone `fui:blocks/guard` registry?**

- **A — plug wraps/defers to `blocks/guard`.** The webguards plug re-exports `blocks/guard`'s standalone
  `CustomGuardRegistry` + `createDefaultRegistry` and only adds the plug wiring (window global + injector
  `customGuards` in `fui:plugs/bootstrap.ts`). No duplicate class, no `CustomRegistry`-extending override.
  Least invasive; honours #875's restructure. *Risk:* guards aren't a `CustomRegistry`-family plug like the
  other domains (webstates/webcontexts), a #606-uniformity gap.
- **B — make `blocks/guard`'s registry a `CustomRegistry`-family plug.** Refactor the standalone registry to
  extend plug-core `CustomRegistry` (matching WE's plug pattern + the other FUI plug domains), unifying the
  #606 swappable-registry mechanism across guards too. More invasive; reverses part of #875's "standalone"
  choice — needs to confirm #875 didn't make it standalone deliberately.

Recommend **A** (defer to #875, minimal) unless #606 plug-uniformity for guards is a hard requirement — but
this reverses a prior structural choice (#875), so it gets a real call, not a batch improvisation. Once
decided, the build is small (plug wiring + a `fui:src/_data/plugs.json` webguards catalog entry + bootstrap
`customGuards`). Sibling `webvalidation` port is #725 (likely the same reconciliation vs any #875 twin —
check before claiming). WE-side deletion stays #449's job.
