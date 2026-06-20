---
kind: story
size: 13
parent: "1250"
locus: frontierui
status: open
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
tags: []
---

> **Outgrew — not batchable as one (sized 3 → 13, batch-2026-06-20).** The investigation below
> (carried forward from a prior attempt that reverted to keep FUI green) shows this is not a clean
> reconcile: it carries a genuine **FUI Plug-interface fork** (drop the `downgrade()` requirement — a
> FUI-architecture decision — vs keep a FUI-only `downgrade` stub) plus #854 scoped-binding integration
> work. Needs a focused session: carve the downgrade-requirement decision first, then the merge.

# Reconcile fui:plugs/webregistries UP to WE (contract-anchored)

Audit fui:plugs/webregistries vs contract+vectors, then port ScopedRegistryAttribute + declarativeRegistry + reconcile CustomElementRegistry (2 diffs) FUI-up.

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
