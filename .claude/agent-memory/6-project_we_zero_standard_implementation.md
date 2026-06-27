---
name: project_we_zero_standard_implementation
description: "FOUNDATIONAL WE↔FUI placement (consolidates the cluster): WE holds ZERO standard implementation — ever. Classify every file into the 3 allowed buckets before touching it. Full statute: platform-decisions.md#constellation-placement."
metadata:
  node_type: memory
  type: project
  originSessionId: c11fff23-8609-4cda-ada8-1f02bacf96e9
---

**The single load-bearing rule of this repo. Do not relitigate it; apply it.** This memory **consolidates
the WE↔FUI cluster** (former separate memories: docs-rendering-boundary, dogfood, generator-is-tool,
vision-is-plateau, npm-scope-mirrors-layer) — all facets of one invariant, all now **statute** in
`we:docs/agent/platform-decisions.md`. Cite the doc anchors below rather than re-deriving.

**WE never contains an implementation of a standard it defines. Never. The implementation always lives in
FrontierUI (FUI).** (Ratified + codified: #1282/#1246, `platform-decisions.md#constellation-placement`.)

Every file in `webeverything` is exactly one of three **allowed** buckets — or it is **misplaced** (→ FUI / delete):

1. **Standard definition** ✅ — contracts, protocols, intents, conformance *vectors*, catalog
   (`src/_data/blocks/*` with `implementedBy` → FUI), semantics, types. The spec, not the runtime.
2. **Authoring/validation tooling** ✅ — scripts that *write*/*validate* the standard (`backlog.mjs`,
   `check:standards`/`check:health`, the calibrator, generators *that emit from the contract*, conformance
   *verifiers* that read output as **data**, #1467). Dev tooling ≠ standard impl — the distinction I keep
   missing. **Bound (#1771):** a generator that *runs the standard's own runtime/renderer* to produce data
   (e.g. running `serve()` to emit author-mode source) is **executing the impl → FUI**, not tooling —
   "runs over WE's own fixtures, in-repo, drift-tested" does NOT make it a tool. The #1566 carve-out is for
   declarative *checks* (schema-validity, completeness), never for executing the impl to produce data; the
   generated data stays WE only if WE no longer runs the generator (FUI runs the transform, WE consumes
   output as data). → `#constellation-placement`.
3. **The website** ✅ — the WE-docs site **dogfoods by consuming FUI's impl** (mode-C runtime bundle /
   `fuiDemo` iframe), never a WE-local one. When the website needs an impl, pointing it at FUI **is the
   correct way / the GOAL** (#777). **WE is NOT expected to author demos** (user, 2026-06-22): a WE demo
   page **embeds the FUI-hosted demo** (`#701 fuiDemo` iframe / mode-C), never runs its own WE
   bootstrap+logic. A standalone `we:demos/*` that boots a WE runtime is **legacy** → relocate the demo to
   FUI and swap the WE page to a FUI embed (the #1353 / #1355 / #1531 track). So a broken WE demo is a
   **relocate-to-FUI signal, not a fix-in-place task** — don't patch its bootstrap/runtime.
   **In the docs templates** (njk), dogfood a component by **emitting its `<we-*>` element** (register-once,
   upgrades in place — the §7.7 reference shape for many-small presentational pills, lighter than per-instance
   mode-C); **never hand-reproduce its lowered native output** (`<span class="fui-badge…">`) in the template —
   that is WE re-holding the impl + coupling to FUI-**internal** class names. Domain palettes ride the
   component's `className` escape + docs-local CSS, never a widened FUI enum (#1621).

❌ **Standard implementation — NEVER in WE:** block runtimes, `…Behavior.ts`, engines, anything that
*executes* the standard. All → FUI. The test for "forbidden": *does this execute a standard's runtime?*

**Corollary — WE has no SSR/render engine of its own (a render engine is impl → FUI).** Today the
WE-docs site renders via **Eleventy** (deep: ~460 njk, ~30 `_data` globals); MaaS serve routes
(#1760/#1771/#1841) serve **JS modules**, not rendered HTML, and there's no DSD/hydration emit in WE.
If "WE renders X server-side" ever comes up, route the render engine to **FUI's render/serve path**,
not a "WE SSR". Moving the docs site **off Eleventy** is a **separate net-new `type:decision` under
epic #777** with "whose SSR" left open — don't fold it into a narrower plumbing decision. Surfaced
ratifying #1824 (static-site token-CSS transport, website-local, `codifiedIn one-off`); adjacent but
distinct: #425/#398 (self-host web-docs *UI primitives* / the web-docs product).

**The consolidated sub-rules (each now an anchor in platform-decisions.md — cite, don't re-open):**
- **website ≠ standard** (#932): the boundary binds the **`@webeverything` package** (no build-time
  `@frontierui` SOURCE import; WE→FUI direction), NOT the WE-docs website. Violation test = source-import
  *direction*, not runtime execution / rendered pixels / an in-document mode-C mount. → `#we-fui-embed-boundary` rule 6.
- **WE renders FUI only via the iframe / mode-C SDK** (#700/#765): no `frontierui` source alias; mode-C
  in-document Shadow-DOM render shipped (FUI's SDK renders; impl stays FUI). → `#we-fui-embed-boundary`.
- **`@webeverything` = standard artifacts only, never imports `@frontierui`** (#239); impl publishes
  `@frontierui/*`. "Standalone / no FUI import" ≠ standard. → `#constellation-placement` rule 3.
- **A codegen / generator is a TOOL, not a standard** (#855): WE ships the CEM contract + conformance
  vectors; FUI (or own-repo) owns the generator. Even pure-data is impl if only one project's build/runtime
  depends on its shape (#779). → `#standard-consumability`.
- **Vision / any impl capability = a Plateau no-leakage service the WE *project* consumes** (#475), never a
  WE standard; no published `@webeverything` artifact may depend on it. → `#no-leakage-client`.

**How to apply:** find code/refs in WE → **classify first** (definition? authoring/validation script?
website-dogfooding-FUI?). None of those (it *delivers* a runtime) → misplaced: delete / move to FUI, never
"repoint" to import FUI blocks, never re-home onto another WE impl. Related: [[reference_repo_constellation]],
[[project_managed_offering_constellation_layering]], [[feedback_impl_is_not_a_standard]],
[[project_polyglot_reach_forward_adapters]].

**Codified:** the canonical rule is `docs/agent/platform-decisions.md#constellation-placement` (the statute is source-of-truth; the `#NNN` above is provenance, not the reference).
