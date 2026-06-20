---
kind: story
size: 8
status: resolved
relatedProject: webcompliance
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "project:webcompliance"
tags: []
---

# webcompliance WE-layer build: own the PoC impl + spec layers (Gates/Waivers/Audit/Retrofit)

Surfaced by the #991 audit (§8): a webcompliance PoC impl exists (we:webcompliance/ — gate/waiver/audit/platform-default, 10 ts) but is unowned by any item and unlinked to the spec; the only owner #966 is a parked hosted-product question. Own + complete the WE-layer spec layers: Gates, Waivers, Audit/Web-Reporting emit, and retrofit existing check:standards/check:readiness gates as declared policies. Separate from the deferred hosted product. Link relatedProject webcompliance + the PoC tree.

## Progress

**Right-sized on claim (#608 stale-premise fix).** #1039 was scaffolded by #1006 on the premise the
PoC impl is "unowned… declared spec layers have no build item." That premise was stale: the four layers
are ALL BUILT and their build items are ALL RESOLVED — Gates #437, Waivers #438, Audit/Web-Reporting
emit #439, Retrofit check:standards/readiness #440, plus platform-default VCS conventions #579. The
impl tree `we:webcompliance/` (`we:webcompliance/gate.ts`, `we:webcompliance/waiver.ts`, `we:webcompliance/audit.ts`, `we:webcompliance/policies/platform-default.ts`, `we:webcompliance/conventions/vcs.ts`) is green: 36 unit tests pass. So the genuine residual was the **linkage + status**,
not a rebuild:
- Relabelled webcompliance `concept`→`poc` in `we:src/_data/projects.json` (impl + tests exist; mirrors
  the #1063 webreporting relabel).
- Rewrote the Status section of `we:src/_includes/project-webcompliance.njk` to record the PoC is built,
  link the impl tree, mark all four layers + #579 resolved, and point the deferred *hosted* product at
  the parked #966 (kept distinct per the item).
- `relatedProject: webcompliance` set on this item (the ownership link the body asked for).

No new build was needed — the WE-layer is complete. The hosted-product question stays parked (#966).
