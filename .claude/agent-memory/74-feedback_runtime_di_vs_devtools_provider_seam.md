---
name: feedback_runtime_di_vs_devtools_provider_seam
description: "A CustomXRegistry is a runtime-DI standard seam only if the running app/standard consults it; a tool consulted once at author/build time is a devtools provider seam, not a registry standard"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: fa5f6ad9-3136-4bdf-b6af-a5b8c304de77
---

A `CustomXRegistry` / inject-a-provider seam is a **runtime dependency-injection standard seam ONLY
when the running app (or the standard at render/compile time) consults it** — that's why
`CustomRenderStrategyRegistry` (#052) and `CustomCompilerRegistry` (#081) are legit: the project
injects a provider that the *running* standard looks up, and the registry is a lock-minimization point
at the standard's surface (late binding, swappable impl, graceful degradation).

What does NOT fit that mold: a capability consulted **once, by a tool, at author/migration/build
time** (e.g. the upgrader's analyzer seam, #094/#191). It never runs in anyone's app. The
provider-*injection need* can still be real and good (swap a deterministic reference impl for a
BYO-key model impl), but the **concept is a devtools provider seam, not a runtime-registry standard** —
it must not drift into being presented as a protocol or a standard registry. Two tells of cargo-culted
runtime-registry shape on a devtools: (1) a doc comment claiming kinship with the runtime registries
("the SAME inject-a-provider shape as Custom*Registry"); (2) a **global mutable singleton** with HMR
re-registration — a devtools doesn't need a global, it more naturally takes its providers as an
explicit input (pass them into the call), so demote the singleton to explicit injection.

**Why:** registries-as-architecture are a runtime concept; reaching for one in devtools mislabels an
impl detail as a standard surface, which inflates lock-in framing and muddies the standard-vs-impl
line. **How to apply:** before calling something a `CustomXRegistry`/standard seam, ask *who consults
it and when* — running app at runtime → runtime-DI standard seam; a tool once at author/build time →
devtools provider seam (plain injected provider list, not a global registry, not a protocol). This is
orthogonal to a placement decision: a tool can still reuse one engine/pipeline (anti-drift) while its
provider seam is correctly named devtools. Distinct from [[feedback_impl_is_not_a_standard]] (an impl
satisfying a standard ≠ a protocol) and [[feedback_minimize_lock_in_protocol_only_lock]]
(devtools = zero lock-in, protocols = the only lock). First drawn out reframing #191 Fork 1.

**Codified:** the canonical rule is `docs/agent/platform-decisions.md#runtime-di-vs-devtools-provider-seam` (the statute is source-of-truth; the `#NNN` above is provenance, not the reference).
