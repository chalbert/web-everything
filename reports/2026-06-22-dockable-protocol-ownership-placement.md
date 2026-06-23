# Dockable layout-tree Protocol — ownership / placement (prep for #1653)

> Prepares decision [#1653](/backlog/1653-which-project-owns-the-dockable-layout-tree-protocol-1437-ru/),
> which **blocks** [#1486](/backlog/1486-mint-the-dockable-layout-tree-interchange-protocol-core-sche/) (mint
> the dockable layout-tree Protocol). #1486's convergence gate is already satisfied
> ([#1627](/backlog/1627-build-a-dockview-adapter-that-round-trips-the-dockable-core-/), the dockview adapter,
> is conforming impl family #2), so the mint is unblocked on convergence — but it hits an **ownership gap
> #1437 left open**. This survey grounds where the Protocol lives.

## The gap

[#1437](/backlog/1437-decision-docking-tiling-dockable-window-management-placement-/) ratified two rulings
that, as authored, cannot both stand once you go to mint the Protocol:

- **Fork 1 (RULED a):** the whole dockable family is an **"intent + composing block, no project"** — mirroring
  #1384's forced-ratify A. The `dockable` intent (we:src/_data/intents/dockable.json), like every #1384
  sibling (`resizable`, `arrangeable`, `reorder`), carries **no `ownedByProject`** — intents are
  structurally project-less in WE.
- **Fork 2 (RULED a):** the serialized layout tree **is a first-class WE Protocol** —
  `node = {type: row|column|stack, children|tabs, size}` core + an open extension slot.

The collision is mechanical, not philosophical: a WE Protocol entry (we:src/_data/protocols/*.json) **requires**
an owning project. `validateProtocol` at we:scripts/check-standards-rules.mjs:772 lists
`ownedByProject` and `anchor` in its required-fields loop; lines 777-779 reject any `ownedByProject` that does
not resolve in we:src/_data/projects.json; lines 783-789 require the owning project's partial
we:src/_includes/project-<id>.njk to carry a `<section id="protocol-<id>">` anchor. **All 39 current protocol
entries have an owner — there is no project-less escape hatch.** So a Protocol that honours #1437 Fork 1's
"no project" needs *something* to give: mint a project, attach to an existing one, or relax the rule.

## Prior art — how project-less / cross-cutting interchange formats are homed

The real question this prep answers: **must an interchange Protocol always have an owning Project, or is a
project-less protocol (owned by its intent + block) a legitimate model?** Surveyed how the wider standards
world homes an interchange format that is *not* the property of a single product.

- **glTF (Khronos).** glTF is a runtime 3D-asset interchange format owned by **The Khronos Group**, governed
  specifically by the **Khronos 3D Formats Working Group**, and published through the **Khronos glTF
  Registry** (registry.khronos.org/glTF). The format is deliberately *not* owned by any one rendering engine
  (Unity, Babylon, and the WebGL engines all merely *conform*); it is homed in a **dedicated host/registry
  body** that exists to own the schema, mint extensions, and run conformance. The owner is a *registry
  surface*, not a product.
- **OpenAPI (Linux Foundation).** OpenAPI was donated by SmartBear in 2015 into the **OpenAPI Initiative**, a
  Linux-Foundation collaborative project with a Technical Steering Committee. Again: the interchange schema
  is owned by a **purpose-built host organization**, not by Swagger-the-tool or any single API gateway. The
  vendors (Postman, Stoplight, gateways) conform; the OAI owns.
- **The docking incumbents themselves.** dockview (`api.toJSON/fromJSON`), FlexLayout
  (`Model.fromJson/toJson`), golden-layout (`LayoutConfig`) **each serialize the same logical
  `row→column→stack-of-tabs` tree** — but there is **no shared interchange standard and no coordinating body**
  between them. Each library owns its own JSON; a project that saves a dockview layout cannot load it into
  FlexLayout. That is precisely the lock-in WE's protocol stance exists to break — and it means there is **no
  external owner to point at**; if WE wants a portable dockable layout, WE itself has to home and own the
  schema.

**Cross-cutting reading.** The consistent pattern is *the opposite* of project-less: a serious interchange
format is homed in a **registry/host surface whose job is to own the schema and run conformance** (Khronos WG,
OAI). Nobody ships a registry-less, owner-less interchange format and expects portability. WE's
`validateProtocol` invariant (every protocol has an owning project + a catalog anchor) is the same instinct:
the owner *is* the catalog/registry surface where the schema, its status, and its conformance live. Relaxing
that to "owned by its intent + block" would make the dockable tree the **one protocol with no catalog home** —
a hole in the very surface that makes a protocol discoverable and escapable.

## The three options weighed (merit only)

The fork is **ownership of the Protocol** — three coherent, mutually-exclusive homes. Cost/effort
("broader schema change", "more to maintain") is *not* a merit axis here; each downside below is re-expressed
as lock-in / correctness / catalog-surface integrity / fidelity-to-#1437.

### (a) Mint a host project to own the Protocol — RECOMMENDED (~70%)

Stand up a thin **registry/host project** (e.g. `weblayout`) whose only job is to own the dockable layout-tree
Protocol and expose its catalog anchor (`<section id="protocol-dockable-layout-tree">` in
we:src/_includes/project-weblayout.njk). This is the **glTF/Khronos / OpenAPI-Initiative shape**: the
interchange format gets a dedicated home that is a *registry surface*, not a product or an orchestration
domain.

- **Merit — catalog-surface integrity:** the Protocol renders in the protocol catalog with a real owning
  surface, the same as the other 39. No special-case in the data model.
- **Merit — honours #1437 Fork 1, reframed:** Fork 1 ruled out an *impl/orchestration* project for the
  **intent/block family** (no "docking domain" that owns behaviour). A host project that owns **only the
  interchange schema** is a different category — it owns the *Protocol*, not the dockable *family*. The intent
  and block stay project-less; only the schema gets a registry home. This is the cleanest reading that lets
  both #1437 rulings stand verbatim.
- **Merit — lock-in:** the schema is escapable and discoverable; conformance (round-trip) has a named home.
- **Residual / skeptic surface:** does a host project secretly re-introduce the "project" #1437 Fork 1
  rejected? Only if `weblayout` accretes impl/orchestration. Scope it explicitly as a **protocol-host** (owns
  the schema entry + anchor + conformance vectors, nothing behavioural) and the #1437 ruling is honoured —
  the *family* still has no project, only the *interchange schema* does.

### (b) Attach to an existing adjacent project — REJECTED (placement stretch → mis-homing)

- `webpositioning` is floating-element **anchoring** (tooltips/popovers/menus) — a different concern; the
  dockable tree is not a floating element.
- `webblocks` ("interoperable modules") is broad enough to *technically* hold it, but it never named layout
  interchange; homing it there is a catch-all dump that erodes what `webblocks` means.
- `webintents` owns the declarative profiles (and the `dockable` *intent* relates to it) — but a Protocol is
  an interchange schema, a different entity class from an intent; attaching the schema to the intents project
  conflates the two layers #1437 deliberately separated.
- **Merit cost (correctness, not effort):** every candidate is a project that never owned this concern.
  Picking one mis-files the schema under a surface whose meaning then blurs — a catalog-integrity regression,
  not just "a stretch."

### (c) Relax the protocol model to allow a project-less Protocol — REJECTED for the default, kept as the sub-fork escape-hatch (~30%)

Amend `validateProtocol` to make `ownedByProject` optional when an `ownedByIntent`/`ownedByBlock` is present,
and skip the project-anchor probe in that case.

- **Merit FOR:** honours #1437 Fork 1's "no project" with zero new surface; the schema is owned by exactly the
  intent + block that produce it.
- **Merit AGAINST — catalog-surface integrity:** this makes the dockable tree the **one protocol with no
  catalog home**. The project partial's `<section id="protocol-...">` anchor *is* the rendered protocol page's
  home in the catalog; remove it and the protocol either renders nowhere or needs a parallel
  intent/block-anchored rendering path built just for it. The prior art is uniformly against this — Khronos
  and the OAI both home interchange formats in a *dedicated owner surface*; nobody ships an owner-less
  interchange format and expects discoverability/conformance to work.
- **Merit AGAINST — touches every protocol's invariant:** the amendment relaxes a rule all 39 protocols
  currently satisfy, to serve one. Per *minimize lock-in* the protocol IS the escapable lock — weakening the
  invariant that every protocol is discoverable+conformant is a structural regression on the one surface WE
  most needs to keep crisp.

## Recommendation (to ratify in #1653)

**Mint a thin `weblayout` protocol-host project (option a), confidence ~70%.** It is the glTF/OpenAPI shape: an
interchange schema gets a dedicated registry/host home, while the dockable *family* (intent + block) stays
project-less exactly as #1437 Fork 1 ruled. This requires **no re-open of #1437 Fork 1** (a protocol-host owns
the schema, not the family) and **no relaxation of the protocol model** (the 39-protocol invariant stays
intact). The do-not-reopen reading is the load-bearing claim: a host project that owns *only the schema* is a
different category from the impl/orchestration project Fork 1 rejected.

**Residual / sub-fork.** If the deciding agent judges that "even a schema-only host project violates the spirit
of #1437 Fork 1's no-project ruling," the fallback is **(c) relax the model** — and that becomes its own
sub-decision over the escape-hatch schema: make `ownedByProject` optional iff `ownedByIntent` resolves, and
add an intent-anchored rendering path so the protocol still has a catalog home. Recommend (c) only if (a) is
rejected on the reopen objection, because (c) pays a permanent catalog-integrity cost to avoid a thin project.

## Why not just leave #1486 blocked

#1486's convergence gate is genuinely clear (#1627 is family #2). The only thing standing between it and a
mint is *where the entry's `ownedByProject` points*. That is a one-field decision with three coherent answers
— a real fork, ratifiable now that the prior art is in hand.
