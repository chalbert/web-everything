---
name: feedback_authoring_sot_is_the_standard_form
description: "The authoring source of truth must BE the standard's own form (write @scope CSS), never a tooling/impl mechanism (CSS Modules/vanilla-extract are lowering engines); impls are removable make-it-work-today adapters"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5ad38f00-5a3e-4e69-99b8-c9a8f733e9df
---

When WE has ratified a standard (a *guarantee*), the way the impl repo (FUI) **authors** to it must be the
standard's **own form** — write `@scope`-based CSS for the scoped-CSS standard, not a `.module.css` /
vanilla-extract / codegen format. The build- and runtime layers are **removable make-it-work-today
adapters** (transform / polyfill) that lower the standard form to today's browsers and are **dropped when
the native form ships**, leaving the authored source unchanged.

**Why:** this is native-first + minimize-lock-in + graceful-degradation applied to the *authoring* layer,
not just runtime. Promoting an impl mechanism (CSS Modules, vanilla-extract, a build-tool format) to the
authoring source of truth locks authors into a tooling convention that is **not** the standard — so when the
platform ships the native form, the source still isn't standard-aligned and the lock-in persists. Surfaced
on #1377 (webisolation L2): the prepared framing offered "pick CSS Modules vs vanilla-extract **as the
authoring format**"; the user reframed it — those are *lowering engines*, not authoring formats. Author to
the standard; build the adapters.

**How to apply:** for any "what format does FUI author X in?" decision, the authoring SoT is **forced to the
standard form** — that is *not a fork*. The genuine forks are (1) **which existing standard syntax to author
today** when the end-state syntax is unspecced (e.g. base `@scope {}` now — out-scoping only, which matches
L2/S1's guarantee — vs mint a provisional `isolated` ahead of csswg #11002), and (2) **the lowering
engine/seam** (where tooling like CSS Modules / PostCSS legitimately belongs — an impl pick).

**Now generalized into a standing rule** — this is one part of the broader **standard-consumability
doctrine**, codified as `we:docs/agent/platform-decisions.md#standard-consumability` (statute layer, #911;
cite the anchor, not #1377). The full doctrine: three layers never conflated (contract = guarantee, WE →
authoring SoT = standard form → impl/lowering = removable make-it-work-today adapters); the lowering is **one
pure agnostic transform core + thin adapters** spanning three orthogonal axes — **timing** (build/serve/
runtime) ⟂ **host/bundler** (vite/rspack/webpack/esbuild/rollup/CLI, none privileged; consume *uncompiled*
source with *your own* bundler) ⟂ **guarantee-strength** (Configurator dims); expose these as config, never
as author-format choices ("more than one valid way" = impl strategies, not authoring); the **only lock is
contract+conformance**; placement = contract+conformance → WE, reference transform+adapters → published
impl/tooling (FUI-owned, zero-lock-in), never `@webeverything`. First worked instance: #1377 (webisolation
L2). Related: [[feedback_minimize_lock_in_protocol_only_lock]], [[feedback_native_first_default]],
[[feedback_impl_is_not_a_standard]], [[project_polyglot_reach_forward_adapters]],
[[project_generator_is_tool_not_we_standard]], [[project_docs_rendering_boundary_we_iframes_fui]].
