---
name: project-config-three-layer-carve
description: "webeverything.config splits 3 ways — contract→WE, resolver impl→FUI, project values→product; the generic resolver is a FUI primitive, not plateau"
metadata: 
  node_type: memory
  type: project
  originSessionId: 63746a1e-4cda-4dc5-808d-d0f30a7ee993
---

The `webeverything.config` surface is not one home — it carves into **three constellation layers**:

- **Contract → WE.** The `DimensionResolver` interface, `WebEverythingConfig` schema + guards, the
  `defineConfig` author surface (the standard *form* a project writes), the native-first default
  *declarations* (e.g. autoDefine = `strict-explicit`), and conformance vectors. What WE *defines*.
- **Resolver impl → FUI.** `resolveDimension`/`resolveConfig` runtime composition + `platformFlavor.ts`
  factory wiring (flavor factories, the per-dimension resolvers). The generic, default-less, reusable
  runtime that *satisfies* the contract — i.e. FUI implementing the WE config standard, like any other.
- **Project config VALUES → product layer** (plateau-app / the project repo). "This project picks
  lazy-dom" — consumes contract + impl.

**Why:** #1702 built the whole surface at `we:config/`, placing runtime resolver impl in WE — a #1282
violation ([[project_we_zero_standard_implementation]]: WE holds zero standard impl). The fix is NOT
plateau-app (the user's first instinct, and #1662's `locus:`): the resolver is *generic and reusable*,
so it's a FUI **primitive**, not product orchestration. #1662's plateau-app locus marked the *consumer*
(layer 3), not the impl home. This is the canonical contract→WE / impl→FUI / product→plateau shape
([[reference_repo_constellation]], [[managed_offering_constellation_layering]],
[[project_conformance_verifier_vs_subject]]).

**How to apply:** when a WE-resident module both (a) defines a format/interface and (b) executes a runtime
algorithm over it, split it — types/schema/interface/vectors stay WE, the runtime impl goes to FUI via
[[project_placement_test_does_fui_consume_runtime]]. Don't reflexively route "project-facing" impl to
plateau; a *generic reusable* mechanism is a FUI primitive. Tracked: #1780 (carve `we:config/`), which
unblocks #1779 (auto-define registry → FUI). Beware: a WE module importing a relocated FUI impl is a
banned backward edge ([[feedback_constellation_backward_edge_is_module_import]]) — relocate the WE-side
*consumer* first so nothing is stranded.

**Codified:** the canonical rule is `docs/agent/platform-decisions.md#constellation-placement` (the statute is source-of-truth; the `#NNN` above is provenance, not the reference).
