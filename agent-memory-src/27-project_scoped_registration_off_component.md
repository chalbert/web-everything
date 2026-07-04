---
name: project_scoped_registration_off_component
description: "#854 ruling: scoped registration lives OFF <component> (a build-time transform); it's a runtime declared-registry + IDREF + binding-behavior concern, resolved at moment-2 on a dom-less declaration"
metadata: 
  node_type: memory
  type: project
  originSessionId: dc85c84c-a4a1-40f2-b135-77e2ba9c2193
---

#854 (resolved 2026-06-18) ruled the author-facing spelling of scoped custom-element registration lives **OFF `<component>`** — dissolving the item's title premise. **Two reasons, either sufficient:** (1) `<component>` is a *build-time AST transform* (gone by runtime, like JSX) so it structurally **cannot host a runtime registry object** — a `scope=` attribute on it can carry only static keywords; (2) separation — native scoping binds to *any* shadow host, not just components, so a component-only attribute is under-general.

**The model (option F, primary):** a runtime **declared registry** (`<script type="registry" id="…">`, the Tier-1.5 no-build mirror of #278's `<script type="injector">`) + **local DOM IDREF association** (`registry="id"`-style, mirrors `injector="id"` — collision-safe document-scoped ids, native idiom like `for`/`aria-labelledby`, **NOT** a global namespace) + **IDREF `extends` composition** (WE's own `extends: CustomElementRegistry[]`) + a **`CustomAttribute` binding behavior** that resolves the ref and scoped-defines at **MOMENT 2** (declaration/registration time, on a **dom-less declaration node** the transform emits — the one seam where registry objects exist but `define()` hasn't run; instance-time is too late, build-time has no objects). Trigger is an explicit registration scan (not the connect `MutationObserver` — dom-less nodes never connect); if the registry ref isn't ready the declaration sits **pending → lazy-queue, not a race** (DSD/SSR sidesteps via `shadowrootcustomelementregistry` + `initialize()`).

**F is load-bearing, not just consistent:** it's the ONLY option that gets compose-multiple-foreign-bases into pure HTML (transform can't, imperative leaves HTML, native has no definition-placement form). **E** (`scope="{{ expr }}"` via webexpressions, [[project_webexpressions_binding_layer_exists]]) is demoted to the **raw-foreign-object escape-hatch** (a lib exporting a bare JS registry). The string `scope="<id>"` (the title's spelling) is **excluded** — it rebuilds the global namespace scoping removes.

**Reusable boundary rule:** *subtree-context declarations (bind a registry, injector-`provide` an impl) are runtime sibling declarations + behaviors sharing one engine — never folded into the compile-time `<component>`.* Injector and registry are **two typed facades over one machine** (`InjectorRoot.extends` ∥ `CustomElementRegistry.extends`, both shadow-root-bound via `getRootNode()`): injector resolves `@domain`(Protocol)→impl, registry resolves tag→class. The **keyword DSL** (`provide/consume … in/as/from`) stays **Tier-3 documented-as-intended per #279** (biggest lock-in surface, not built); F is **Tier-1.5** (no new lock-in). Native scoped registries are real+shipped (whatwg/dom#1341, Chrome/Edge 146 + Safari, Firefox pending — 2-of-3, new 2025); `shadowrootcustomelementregistry` is a **native boolean** (can't name a registry); `extends` is WE's own.

Supersedes prepared default B (its object-identity core survives, its "on-component" home doesn't). Carves: **#900** (association attribute NAME — `scope` overloaded → likely `registry=`), **#901** (build the mechanism), **#902** (reconcile #242 `RegistryScope.id?: string`→object + `component.njk` Tier-2 scope presumption). Related: [[feedback_impl_is_not_a_standard]], [[feedback_bias_separation_decoupling]], [[project_npm_scope_mirrors_layer]].

**Codified:** the canonical rule is `docs/agent/platform-decisions.md#component-dc` (the statute is source-of-truth; the `#NNN` above is provenance, not the reference).
