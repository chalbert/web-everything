---
bornAs: x6rqye5
kind: task
parent: "4075"
status: open
dateOpened: "2026-09-24"
tags: [audit, incident-2026-09-24, emergency-manual-step]
---

# Audit log: emergency manual steps taken on 2026-09-24

Durable audit record of the manual interventions taken during the 2026-09-24 incident. Standing rule: a
failure improves the product and is never fixed by hand; a manual step is allowed only as a labelled
emergency. So each row below is **labelled emergency**, and each names the product change that should have
made it unnecessary. This card closes when every row's product change has landed (or is withdrawn with a
reason), not when the log is written.

| # | Emergency manual step | Product change that removes the need | State of that change |
| --- | --- | --- | --- |
| 1 | Hand reset of lanes 23, 85 and 999999 | Lane reclaim of finished lanes (4058, PR #2608; xer3jlp), litter allowlist (4084); lane 999999 is a test-fixture id reaching the real pool, the case 4005 / 3991 closed (PRs #2552, #2550) | #2608 open; 4084 filed |
| 2 | `LANE_POOL_TRIM_MAX=90` set by hand in the `lane-pool-health-watch-we` launchd plist | A pool hard cap owned by code, not an env var in a plist (#4014; trim from 4028, PR #2580) | #4014 open |
| 3 | 6 lanes provisioned by hand | Acquire grows the pool on no-free-lane (4037, PR #2606, merged); the health daemon's lane-starvation smell (4077) catches it next time | fix merged; smell filed |
| 4 | PR #2547 merged with break-glass | The reason for the break-glass is not recorded in this card's source; the operator adds it here. The health daemon (4065) should have surfaced the stall that led to it | reason to record |
| 5 | Overlays hand-loaded into the review daemon clone: PRs #2573, #2577, #2579, #2581, #2587, #2591, #2599, #2600, #2601, #2602, #2607 | Daemon fixes built and adopted by the conveyor (4060); overlay chain from #3681 (#4040–#4052); review-independence sub-question #4043 (4043) | decisions open |

## Done when

1. **Executable** — every "Product change" cell above names a card that is `status: resolved` or a PR that
   is merged, and row 4's break-glass reason is filled in.
