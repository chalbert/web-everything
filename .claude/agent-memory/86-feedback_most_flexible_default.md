---
name: feedback_most_flexible_default
description: "When a dimension exposes a default, pick the most flexible/permissive value as default; the restriction is the opt-in"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 80b26a4d-d06f-4836-85f8-2733da82853e
---

When a fork is "which value is the default for a configurable dimension," pick the **most flexible / most permissive** option as the default, **always** — the constraint is what an author opts into, not the default.

**Why:** a permissive default is a superset; authors narrow it deliberately (like `<select required>` or input constraints). Defaulting to the restricted value surprises and forces opt-out.

**How to apply:** e.g. #064 tree-select `selectableNodes: any | leaf` → default `any` (any node selectable), `leaf` is the opt-in restriction. Pairs with [[feedback_dimension_vs_fixed_mechanic]] (only expose as a dimension if both branches are legitimate end-states) and [[feedback_native_first_default]] / [[feedback_config_extends_platform_default]].

**Corollary — if it's an intent-level concern, expose the whole axis as configurable, don't bake one behavior.** When a fork lands at the Intent layer (the declarative UX "what"), the user's rule is "all should be allowed and configurable": surface every legitimate value as a configurable dimension (with most-flexible defaults), rather than collapsing to a single fixed behavior with hidden ride-alongs. E.g. #064 Fork 4 cascade → not one on/off knob but `cascade` + `valueReporting` dimensions, each fully exposed. (Contrast: a deterministic transform with no vendor-interop story is NOT a Protocol — protocols are for impl-swappable contracts only; see [[feedback_minimize_lock_in_protocol_only_lock]].)

**Codified:** the canonical rule is `docs/agent/platform-decisions.md#native-first-baseline` (the statute is source-of-truth; any `#NNN` above is provenance, not the reference).
