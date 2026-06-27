---
name: feedback_protocol_mint_requires_owning_project
description: "a Protocol mint isn't pure authoring — needs ownedByProject (resolves + project-njk anchor); verify the owner before batchable;"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5ac38e8e-5c23-4d1a-9ee8-1f68b38d3b31
---

A "mint the Protocol" / "author the `protocols/*.json` entry" item is **not** pure mechanical authoring,
even when its `#project-protocol-bar` convergence gate has cleared. A WE protocol entry has structural
requirements the gate-clearing doesn't satisfy: `ownedByProject` is a **required field** that must (a)
resolve in `we:src/_data/projects.json` and (b) carry a `<section id="protocol-<id>">` anchor in
`we:src/_includes/project-<id>.njk` — enforced by `validateProtocol` in
`we:scripts/check-standards-rules.mjs`. There is **no project-less protocol escape hatch** (every entry
has an owner).

**Why:** #1486 (mint the dockable layout-tree Protocol) cleared its convergence gate this batch (the
dockview adapter #1627 became conforming impl family #2) and read as "purely the build" — but the mint hit
an ownership fork #1437 left open: Fork 1 ruled the dockable family **"intent + composing block, no
project"** while Fork 2 made the layout tree **a first-class Protocol**, and no existing project is a clean
owner. Which project owns it (mint one / attach to an existing / relax the project-required rule) is a real
design call, not authoring → filed as decision #1653, #1486 re-pointed `blockedBy 1627→1653`.

**How to apply:** in pre-flight, treat any protocol-mint as **not batchable until the owning project is
verified to exist** (a project whose `project-<id>.njk` can host the anchor). If the intent/block family was
ratified project-less, the owner is an unresolved fork — surface it as a `kind: decision`, don't quietly
mint a project or attach to an arbitrary host. Convergence (the second impl) clearing is necessary but not
sufficient. Relates to [[feedback_prep_verify_mechanism_has_consumer]], [[project_protocol_first_class]]
([[feedback_protocol_first_class]]), [[feedback_catalog_auto_render]].

**Codified:** the canonical rule is `docs/agent/platform-decisions.md#protocol-host-project` (the statute is source-of-truth; any `#NNN` above is provenance, not the reference).
