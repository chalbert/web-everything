---
name: feedback_distributed_placement_standalone_slices
description: "An analysis/triage epic resolved + a distributed (B) placement ruling → carve slices as STANDALONE items homed by relatedProject, no umbrella"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 88df76da-e5fa-4fee-950d-3411addcb28e
---

When an umbrella epic is really an **analysis/triage artifact** (produce reuse-vs-gap map +
ratify placement + carve list) and gets `status:resolved` (graduatedTo its report), carve the
resulting slices as **standalone backlog items homed by `relatedProject`** — NOT as children of the
resolved epic.

**Why:** open children under a resolved epic trip the ⚠ open-slice gate; and when the placement
decision ratifies **B (fully distributed — scatter contracts to their kin projects, no new project)**,
"no umbrella" *is* the ratified end-state, not an omission. Confirmed by user on the deck/slide carve
(#1173 resolved → #1175 ratified B → slices #1180–#1200 standalone + family epic #1179): "it's ok as
standalone."

**How to apply:** if the epic is resolved, drop `parent:` from the carved slices; keep lineage via
`blockedBy: ["<decision NNN>"]` (a resolved blocker still leaves them Tier A) + `relatedReport`.
Only parent slices to an epic that stays **open**. Distributed-placement rulings (B over A) → expect
scattered standalone items. See [[project_managed_offering_constellation_layering]] and the
#project-protocol-bar statute (mint a project only for a genuine cross-cutting domain with a provider
seam; "already homed" is a valid resolution).
