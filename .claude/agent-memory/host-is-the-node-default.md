---
name: host-is-the-node-default
description: "presentational custom element = the host IS the node (class + ElementInternals role/aria, no sub-element); wrap a real child only for irreplaceable-native; the reproducibility test picks a block's node-shape"
metadata: 
  node_type: memory
  type: project
  originSessionId: 8ba47e6a-4327-45a2-a1da-a4bcdbf4eb78
---

For a WE/FUI block that wraps a native tag, pick the runtime node-shape by the **reproducibility test** (3 buckets, codified `we:docs/agent/block-standard.md#packaging-governance-1321`, #2028):

1. **Host-reproducible** (semantics = role + ARIA only — `<span>`/`<div>`/headings/landmarks) → **host-is-the-node**: the `<we-*>` custom element carries the `.fui-*` class and its role/aria via `ElementInternals`, **zero sub-element** (the budgeted-host-node spine). Default for badge, tag, card, section-card, auto-heading.
2. **Irreplaceable-native** (unique rendering/interaction — `<progress>`/`<meter>`/form controls) → wrap a real native child inside a `display:contents` host (#1962 (B)).
3. **Content-model-constrained** (parent accepts only the real tag — `<option>`/`<tr>`/`<li>`) → reserved transient (#1962 (A)).

**Why:** a forced custom-element host is a React-fragment equivalent — adding a redundant `<span>`/`<div>` is waste, and `ElementInternals` reproduces role/aria/heading-level on the host natively. Even a real `<hN>`'s only edge (document outline / `hN{}` CSS) is moot under a platform theme-base + intents styling system — so build role-aware tooling (`[role=heading]`) rather than keep the tag.

**How to apply:** default a presentational leaf to host-is-the-node; reach for a real child only when the native element has behaviour/rendering ARIA can't fake. Full tag-by-tag classification is tracked by #2059. Corollary learned the hard way this session: a decision item's own "X is statute-barred / already settled" framing can be an overread of the cited ruling — read the ruling's own text before foreclosing a fork ([[verify-ratified-citation-against-live-status]]). See also [[propose-standard-in-platform-shape]], [[native-first-default]].
