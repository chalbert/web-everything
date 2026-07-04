---
name: feedback_impl_is_not_a_standard
description: "Don't conflate an implementation with a standard — a native API / substrate is an impl that satisfies the standard, registered as a resolver impl, not authored as a protocol/catalog entry"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 673cbd9d-ed01-4124-993b-fec4b7c577de
---

The **standard** layer is the contract: intents, capabilities, protocols, the block/family definition. An **implementation** is a concrete substrate that *satisfies* that contract — e.g. the `face` (FACE/custom) and `base-select` (native) rows in `capabilityMatrix.json`'s `impls[]`, and the WC wrappers in `frontierui/blocks/droplist/*`. A native browser API like `appearance: base-select` is an **implementation substrate, not a standard of its own.**

So when a backlog item says "promote X to a first-class adapter/standard," first ask: *is X a standard, or an implementation of one?* If it's an impl: it gets **registered as a resolver impl** (a `capabilityMatrix.json` row — that file already *is* the impl listing) and #024's co-equal-substrate ruling applies; it does **not** get a hand-authored protocol, and **don't manufacture a standards surface** for it (no `adapters.json` entry — that catalog is rendering/syntax/library adapters). The real work an impl implies is a **build** (the wrapper + intent plumbing + form/a11y/degradation), captured as its own item — often deferred/`parked` on a browser-support precondition — not a standards artifact.

**Why:** in #020 ("promote base-select to a first-class adapter?") I initially mis-cast a native impl as a standards artifact (proposing an `adapters.json`/protocol surface). The user corrected it: base-select fulfils more intents so it makes sense to use, but you still need a WC wrapper to plug intents onto it — so it's *an eventual implementation, not a standard*. Ruling: recognition was already done (resolver impl row), no standard authored, build deferred to [parked] #291.

**How to apply:** keep the layer split sharp (see [[reference_repo_constellation]], [[npm_scope_mirrors_layer]], [[feedback_protocol_first_class]]). Standards-authoring effort goes to contracts; substrates/native-APIs are impls registered in the capability matrix and resolved via `native-first` ([[feedback_native_first_default]], [[feedback_config_extends_platform_default]]). Don't standardize an implementation.
