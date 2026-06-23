---
kind: decision
status: open
blockedBy: []
relatedProject: webintents
dateOpened: "2026-06-23"
tags: [dockable, protocol, project-placement, "1437", "1486"]
---

# Which project owns the dockable layout-tree Protocol (#1437 ruled the family project-less)

Blocks [#1486](/backlog/1486-mint-the-dockable-layout-tree-interchange-protocol-core-sche/) (mint the dockable
layout-tree Protocol). Surfaced mid-build in batch-2026-06-22-1627-1624-1597: #1486's protocol-bar gate
cleared (the dockview adapter #1627 is conforming impl family #2), so the mint is unblocked on *convergence*
— but it hits an **ownership gap #1437 left open**. A WE `we:src/_data/protocols/*.json` entry **requires** an
`ownedByProject` that (a) resolves in `we:src/_data/projects.json` and (b) has a `<section id="protocol-<id>">`
anchor in `we:src/_includes/project-<id>.njk` (enforced by `validateProtocol`,
`we:scripts/check-standards-rules.mjs:760`); there is **no project-less protocol escape hatch** (every one of
the ~40 protocol entries has an owner). Yet
[#1437](/backlog/1437-decision-docking-tiling-dockable-window-management-placement-/) Fork 1 ratified the
whole dockable family as **"intent + composing block, no project"** while Fork 2 ratified the layout tree as
**"a first-class WE Protocol"** — two rulings that can't both hold as-is. This is a real either/or, not
mechanical authoring, so #1486 cannot land until it is decided.

## What you have to decide

Where does the dockable layout-tree Protocol live, given the family has no project?

## The forks

- **(a) Mint a project to own it** (e.g. `webdocking` / `weblayout`). Gives the protocol a conformant home +
  catalog surface, but stands up a project surface #1437 Fork 1 deliberately avoided for this family — re-open
  that ruling, or scope a minimal "protocol-host" project distinct from the no-impl-project stance.
- **(b) Attach to an existing adjacent project.** No current owner fits cleanly: the composed intents
  (`resizable`/`tabs`/`reorder`, the #1384 spatial-manipulation family) are themselves project-less;
  `webpositioning` is floating-element anchoring, `webcomponents`/`webblocks` are broader. Picking a host that
  never owned this concern is a placement stretch.
- **(c) Relax the protocol model to allow a project-less protocol** owned by its intent + block (amend the
  `ownedByProject`-required rule + the project-anchor probe in `validateProtocol`). Honours #1437's "no
  project" ruling directly, but is a `webdecisions`/schema change broader than #1486 and touches every
  protocol's invariants — weigh against the catalog/anchor surface protocols currently rely on.

## Lineage

- #1437 Fork 1 (intent + block, **no project**) vs Fork 2 (layout tree **is a Protocol**) — the gap.
- The protocol-bar gate is already satisfied (#1627 = conforming impl family #2; #1486 no longer waits on
  convergence — only on this ownership call). Convergence survey:
  `we:reports/2026-06-21-docking-tiling-partition-tree.md`.
- **Not prepared** — surfaced cold mid-batch; needs the `/prepare` research pass (survey how other
  project-less standards expose an interchange schema) before it is ratify-ready.
