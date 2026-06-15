---
type: idea
workItem: story
size: 3
parent: "666"
status: open
blockedBy: ["690"]
dateOpened: "2026-06-15"
tags: [self-driven-project, artefact-contract, protocol, everything-as-code, no-lock-in]
---

# Self-Driven Project tool-agnostic artefact contract (everything-as-code, no-lock-in Protocol)

The load-bearing decoupling foundation (per #665 invariant): codify the methodology as tool-agnostic, version-controlled, declarative artefacts — autonomy level, tolerance/risk envelope, per-step gate definitions, value/risk dimensions, run evidence — so a third-party PM/CI tool could read and drive the same files. Register as a concept Protocol in protocols.json + a first-cut spec report; prior art GitOps/OSCAL/SPDX + the work-tracker white space (report §7.4). Non-blocking consumers only (control plane, dev-browser).

## Surfaced prerequisite (2026-06-15 — claim-time pre-flight, batch-2026-06-15)

Claimed during a batch, then released on a closer read: **registering the Protocol needs an owning
project that does not yet exist.** `protocols.json` hard-requires an `ownedByProject` that resolves in
`projects.json` *and* a `src/_includes/project-<owner>.njk` partial containing the protocol's anchor
(`check-standards-rules.mjs` §6b). No self-driven-project / methodology project exists (the constellation
is all `web*` platform-standard projects), and #665's ratified framing names "the no-lock-in artefact
Protocol" but **not an owning project**. So a real decision precedes this build: **is the self-driven-project
methodology a first-class constellation project** (its own `web…` project + npm scope + layer, per the #091
managed-offering/layering pattern) **and what owns this Protocol?** That is a #091-class design call, not a
mechanical `size·3` materialization — and not something to settle with a quiet in-build call. Blocked on
that decision (likely a `type:decision` under epic #666); the spec-report half can ride along once the
owning project is settled. Surfaced and left for the self-driven-project epic owner (an area under active
concurrent authoring this session — #665/#666/#684/#685).
