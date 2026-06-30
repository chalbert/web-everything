---
name: plug-decision-ratifies-contract-not-impl
description: "A plug decision ratifies the WE contract (a web-platform proposal), never the FUI implementation mechanism — impl is secondary, swappable, possibly another lib"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 761ec8aa-6a29-46b9-9009-2e23f9edf717
---

A plug **is** a proposed missing web standard. A decision about a plug ratifies **only the
WE-level contract** — the API shape + observable semantics as a future first-class web-platform
proposal. The **implementation mechanism** — how FUI realizes it (prototype patch vs out-of-band
WeakMap, the residue classification, polyfill/emitted-ESM shape, install ordering) — is
**secondary, FUI-canonical, and replaceable**: a *different* library could supply the plug (e.g.
a faster one) and be equally valid **as long as it conforms to the same WE contract**. FUI is just
*one* implementation.

**So: never elevate an impl-mechanism question into a WE ratification.** It is not a standards
fork — it is an FUI build detail (record candidates non-bindingly; decide in FUI). The only
implementation constraint the contract carries is a **feasibility floor**: it must be
*implementable*, not implemented a particular way.

**Why:** #1892 framed itself as "how does the plugged form intercept an undeclared `internals.states`
toggle — patch vs out-of-band?" and spent a whole session (two reframes + a red-team) ratifying an
implementation mechanism. None of patch/residue/seam-free-ESM is a WE decision. The only WE call was
the `declareStates(internals, vocab, {severity?})` **contract** (a closed, validated state vocabulary
as a platform proposal). The tell you mis-scoped: the "fork" turns on impl words (residue / patch /
polyfill shape), not on observable contract.

**How to apply:** when a plug decision's fork is about *mechanism*, stop — split it: ratify the
contract at WE; route the mechanism to FUI as non-binding candidates. Sharpens [[fork-vs-config-classification-gate]]
(a mechanism "fork" is a kind-misroute) and rule 95 (plug = proposed standard) / rule 6 (WE zero impl).
Encoded: `we:docs/agent/platform-decisions.md#native-first-baseline` (the *Decision-discipline corollary*
under "Plug = a proposed missing standard"). See [[red-team-each-decision-update]].
