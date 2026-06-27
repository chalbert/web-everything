---
name: project_design_system_assembler_plateau_owned
description: "#775 ruling — the design-system assembler is ONE Plateau-owned product spanning free+paid tiers; free/paid line = cost/hosting (not proprietary); FUI holds the floor via primitives+switcher only"
metadata: 
  node_type: memory
  type: project
  originSessionId: ffc3a15d-07f9-4923-81da-bc2381566783
---

**#775 ruling (RATIFIED 2026-06-17)** — open-core tiering of the design-system creator/assembler (authors the [[project_dogfood_we_site_on_fui_components]] #747 manifest):

- **Fork 3 → A: the assembler is ONE `plateau-app`-owned product spanning both tiers**, not a FUI-native free tool + separate Plateau paid tool. Free tier = no-sign-in + localStorage; paid unlocks **in place** (it's #751 extended *down* to a free tier). The earlier "simple FUI-native assembler" framing is **superseded** — FUI's contribution to the self-host floor is the **primitives + the #749 switcher** (apply-a-manifest runtime), NOT the authoring UI. Self-host floor is held by hand-authorable open #747 format + FUI primitives + switcher, so the assembler is a *convenience above the floor*.
- **Fork 1 → A: capability-cost line** is the partition rule. Free = deterministic, fixed-cost, locally-runnable, self-hostable. Paid = variable per-call cost (vision/AI) OR hosted/credential-holding/managed integration. Clause: "managed-vendor integration" = **hosted/credential-holding/per-call only**, never "anything proprietary."
- **Fork 2 → B: cost/hosting line for imports** — free = deterministic local parse of *any* format incl. Figma-variables-export **file**; paid = hosted Figma **sync** / per-call / vision. "Proprietary-vs-open" rejected as a price axis (shifting category — see [[feedback_monetization_soft_accepted_revisitable]]); free local Figma-file import is pro-open (adapter-normalization, helps escape into the open format).
- Forced invariants: two-tier split, manual-authoring-free, vision-paid (#475 no-leakage), persist/share-paid.

Successor builds (separately prioritized): #751 (full paid creator), #749 (live switcher), #754 (permalink). Consistent with [[project_managed_offering_constellation_layering]] (#091 open-core-by-usage) and [[reference_repo_constellation]] (product → plateau-app).
