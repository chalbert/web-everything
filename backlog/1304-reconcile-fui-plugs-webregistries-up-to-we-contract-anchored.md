---
kind: epic
parent: "1250"
locus: frontierui
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-21"
graduatedTo: none
tags: []
---

> **Split into a storied epic — 3 slices (`/slice 1304`, 2026-06-21,
> [we:reports/2026-06-21-backlog-split-analysis.md](../reports/2026-06-21-backlog-split-analysis.md)
> §"focused: #1304").** A finer seam than the same-day sweep saw: the work is a mechanical port + one
> bounded debug with a clean one-way DAG **D1 → {D2, P}** (green at every step). Children:
> - **D1** declarative core — port `we:declarativeRegistry.ts` (parse/compose/define/resolve/map-through)
>   onto FUI's already-reconciled `CustomElementRegistry` (#1354) + non-attribute tests. *(root)*
> - **D2** MOMENT-2 binding — port `we:ScopedRegistryAttribute.ts` + fix the FUI `CustomAttribute`
>   divergence so `bound=true` + its test block. *(blocked-by D1)*
> - **P** plugged-mode patching — copy WE's written `applyPatches`/`removePatches`/`isPatched`/`attachShadow`
>   + `we:globalPatching.test.ts`. *(blocked-by D1)*
>
> Scope now lives in the children; this item is the umbrella. The investigation below is retained as the
> shared grounding the slices draw on.

> **Outgrew — not batchable as one (sized 3 → 13, batch-2026-06-20).** The investigation below
> (carried forward from a prior attempt that reverted to keep FUI green) shows this is not a clean
> reconcile: it carries a genuine Plug-lifecycle fork plus #854 scoped-binding integration work.
>
> **The fork is carved — see [#1350](/backlog/1350-shared-plug-lifecycle-requirement-upgrade-downgrade-vs-1103-/)**
> (`/split` 2026-06-20, [we:reports/2026-06-20-backlog-split-analysis.md](../reports/2026-06-20-backlog-split-analysis.md)
> § "Focused: #1304"). Correction to the body below: the fork is **not FUI-only** — `we:plugs/core/Plug.ts`
> / `we:plugs/core/HTMLRegistry.ts` / `we:plugs/unplugged.ts` are byte-identical in both repos and **WE itself is RED** because
> #1103 dropped `downgrade()` from the registry but left the shared contract requiring it. And this reconcile
> is **NOT blocked by #1350**: it proceeds **preserving FUI's `downgrade`** (the clean #1101/#1102 + #854
> work below); #1350's convergence only gates the final byte-parity + the #1309 drift gate.
>
> **Split executed 2026-06-20 (size 13→8).** The clean `CustomElementRegistry` improvements (#1101/#1102)
> were carved to sibling **[#1354](/backlog/1354-reconcile-fui-plugs-webregistries-customelementregistry-clea/)**
> and the Plug-lifecycle fork to decision **[#1350](/backlog/1350-shared-plug-lifecycle-requirement-upgrade-downgrade-vs-1103-/)**.
> This item is now the **focused declarative-scoped-registration + global-patching core** (scope below).

# Reconcile fui:plugs/webregistries UP to WE — declarative scoped registration + global patching (core)

Port the #854 declarative scoped registration (`we:plugs/webregistries/ScopedRegistryAttribute.ts` +
`we:plugs/webregistries/declarativeRegistry.ts` + index exports) into `fui:plugs/webregistries/`, port the
#1100 global patching (`applyPatches`/`removePatches`/`isPatched`/`attachShadow` scoped-init — all TODO
stubs in `fui:plugs/webregistries/index.ts`) FUI-up, and **fix the MOMENT-2 binding** so the ported
`we:plugs/webregistries/__tests__/unit/declarativeRegistry.test.ts` binds (`bound=true`) in FUI's env. Internally entangled (the index patch
imports `applyScopedRegistryToHost` from `declarativeRegistry`) → one focused story, not batch fodder.
Preserves FUI's `downgrade` (the #1350 decision owns that). The clean `CustomElementRegistry` #1101/#1102
improvements are carved to **#1354**; the Plug-lifecycle fork to **#1350**.

## Investigation 2026-06-20 (batch-2026-06-20) — NOT a clean reconcile; carried forward (genuine divergence)

The card frames this as "port ScopedRegistryAttribute + declarativeRegistry + reconcile CustomElementRegistry
(2 diffs) FUI-up." Attempting the bring-up surfaced two real divergences a byte-copy from WE cannot resolve
(reverted to keep FUI green — FUI webregistries tests back to 23 passing):

1. **`downgrade()` is a hard FUI Plug-interface requirement that WE deleted.** WE's
   `CustomElementRegistry` removed `downgrade()` under the **#1103** native-first ruling (native
   `CustomElementRegistry` has no downgrade; the state machine is monotonic). But FUI's plug-registration
   contract **requires** `localName + upgrade + downgrade` — copying WE's version fails FUI's plug system
   at registration ("object must implement the Plug interface"). So FUI cannot simply adopt WE's surface;
   reconciling needs a decision/merge: either FUI's Plug interface drops the `downgrade` requirement
   (a FUI-architecture change, possibly its own decision item) or the registry keeps a FUI-only `downgrade`
   stub while adopting WE's #1101 `whenDefined` + #1102 duplicate-name/constructor checks + `#getStandInElement`.
2. **The new `ScopedRegistryAttribute` MOMENT-2 binding (#854) does not bind in FUI's env** — WE's
   `fui:plugs/webregistries/__tests__/unit/declarativeRegistry.test.ts` "binds the host to its declared registry on attach" fails (bound=false)
   when run against FUI, so the scoped-registration runtime needs FUI-side integration work, not just a copy.

What IS clean and deferred to the focused merge: WE's `whenDefined` (#1101), the duplicate-define DOMException
checks (#1102), and the extracted `#getStandInElement` are strict improvements over FUI's TODO/stub versions
and can be adopted **while preserving FUI's `downgrade`**. Carried forward from batch-2026-06-20 — outgrew the
"2 diffs" framing and intersects the FUI Plug-interface contract + #854 binding runtime.
