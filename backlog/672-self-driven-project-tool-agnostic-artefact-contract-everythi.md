---
kind: story
size: 3
parent: "666"
status: resolved
dateOpened: "2026-06-15"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: "protocol:self-driven-project-artefact-contract"
relatedReport: reports/2026-06-15-self-driven-project-artefact-contract-spec.md
relatedProject: webprocess
tags: [self-driven-project, artefact-contract, protocol, everything-as-code, no-lock-in]
---

# Self-Driven Project tool-agnostic artefact contract (everything-as-code, no-lock-in Protocol)

The load-bearing decoupling foundation (per #665 invariant): codify the methodology as tool-agnostic, version-controlled, declarative artefacts — autonomy level, tolerance/risk envelope, per-step gate definitions, value/risk dimensions, run evidence — so a third-party PM/CI tool could read and drive the same files. Register as a concept Protocol in we:protocols.json + a first-cut spec report; prior art GitOps/OSCAL/SPDX + the work-tracker white space (report §7.4). Non-blocking consumers only (control plane, dev-browser).

## Surfaced prerequisite (2026-06-15 — claim-time pre-flight, batch-2026-06-15)

Claimed during a batch, then released on a closer read: **registering the Protocol needs an owning
project that does not yet exist.** `we:protocols.json` hard-requires an `ownedByProject` that resolves in
`we:projects.json` *and* a `src/_includes/project-<owner>.njk` partial containing the protocol's anchor
(`we:check-standards-rules.mjs` §6b). No self-driven-project / methodology project exists (the constellation
is all `web*` platform-standard projects), and #665's ratified framing names "the no-lock-in artefact
Protocol" but **not an owning project**. So a real decision precedes this build: **is the self-driven-project
methodology a first-class constellation project** (its own `web…` project + npm scope + layer, per the #091
managed-offering/layering pattern) **and what owns this Protocol?** That is a #091-class design call, not a
mechanical `size·3` materialization — and not something to settle with a quiet in-build call. Blocked on
that decision (likely a `type:decision` under epic #666); the spec-report half can ride along once the
owning project is settled. Surfaced and left for the self-driven-project epic owner (an area under active
concurrent authoring this session — #665/#666/#684/#685).

## Unblocked — #690 ratified 2026-06-15

The prerequisite decision is **resolved ([#690](/backlog/690-is-the-self-driven-project-methodology-a-first-class-constel/))**:
**A first-class WE-constellation node owns this Protocol** (a bounded process-tier capstone, not a peer
platform standard). No separate brand; WE owns the open standard, Plateau is the optional configurator.
This build now carries:

- **Two layers (per #690).** **Layer 1 = this Protocol = the standard**: a *discoverable* file/metadata
  structure for requirements + methodology artefacts (everything-as-code), plus **composable meta-schemas**
  (autonomy-level registry, value/risk-ODD dimension registry, gate-def schema, step schema) each with a
  **default flavor**, + **one fully-defined default recipe** (config-extends-platform-default). Standardize
  the *shape*, not a fixed process (Web Intents lesson). **Requirement structure is *not* (re)defined here —
  it composes [#100 requirement-as-code](/backlog/100-requirement-as-code/)** (slice A = the requirement
  meta-schema + authoring/validation); this Protocol *references* requirement artefacts conforming to #100,
  alongside the other composed standards. **Layer 2 = recipes/config** is *not* this build's standard
  surface — it's authored in Plateau and is a consumer (WE's own usage = one recipe).
- **Scope:** web apps initially, but keep the **schema domain-general** (no hard-coded "web") so later
  generalization is free.
- **Node slug (shaped to DoR — pick at build; not a `type:decision`, no divergent end-state).** An
  internal node id, not a public brand; #690 already fixed the *scope* (process-tier capstone), so this is
  only which facet the label foregrounds:
  - **`webprocess`** *(default)* — foregrounds the build *process* / SDLC; matches #690's "process-tier"
    language; broadest, lowest-surprise.
  - `webdelivery` — foregrounds software *delivery*; industry-resonant (CD), but may read as deploy-narrow.
  - `webautonomy` — foregrounds the autonomy/ODD *dial* (the novel thesis); most distinctive, but narrows
    to the dial and underplays the gate + everything-as-code.

  Minting the node (we:projects.json entry + `project-<id>.njk` partial carrying the anchor) is part of this
  build, satisfying the we:protocols.json invariant. Reclassify if a real scope-divergence surfaces (then it
  becomes a `type:decision`); none is known.
- **Value framing:** lead on open / no-lock-in / composable everything-as-code + the ground-truth gate —
  not the (trodden) concept.

## Progress (2026-06-15, batch-2026-06-15) — node minted + concept Protocol registered + first-cut spec

Larger than the `size·3` label (project-mint scale, comparable to the webworkflows node) but **fork-free**
(the slug was settled at DoR, #690 ratified the scope) — so delivered the Layer-1 concept registration:

- **Minted the `webprocess` node** (default slug, "Web Process"): `we:src/_data/projects.json` entry
  (status `concept`), `src/assets/icons/webprocess.svg`, and `we:src/_includes/project-webprocess.njk` — mission,
  the artefact-contract Protocol section carrying the anchor `id="protocol-self-driven-project"` + the
  four-meta-schema table, composition, and status. Satisfies the we:protocols.json §6b invariant
  (`ownedByProject` resolves + the partial carries the anchor).
- **Registered the concept Protocol** in `we:src/_data/protocols.json`:
  `self-driven-project-artefact-contract` (status `concept`, owned by `webprocess`).
- **First-cut spec report**
  [we:reports/2026-06-15-self-driven-project-artefact-contract-spec.md](../reports/2026-06-15-self-driven-project-artefact-contract-spec.md):
  the everything-as-code discoverable file/metadata structure, the **four composable meta-schemas each with a
  default flavor** (autonomy-level registry [NEW], value/risk-ODD dimension registry [NEW], gate-definition
  schema [composes webcompliance+webpolicy], step schema [composes webworkflows]), the **one fully-defined
  default recipe** (config-extends-platform-default), and prior art (GitOps / OSCAL / SPDX + the work-tracker
  white space). Composes #100 for requirements (referenced, not redefined). Linked via `relatedReport`.
- **Two layers honored (#690):** Layer 1 (this standard) is registered; Layer 2 (recipes/config) is named as
  Plateau-authored, non-standard surface (WE's backlog = one dogfooded recipe).
- **Gate + render:** `npm run check:standards` 0 errors (after `gen:inventory`); `/projects/webprocess/`,
  its protocol anchor, and the `/protocols/` index all render on the 11ty build.
- **Follow-on (separately-prioritized builds, not this concept slice):** the full meta-schema registries, the
  default recipe as shipped config, and the Plateau recipe configurator (Layer 2). These are the bulk that
  makes the true size ≫ 3 — filed as the build-out beyond concept registration.
