---
type: issue
workItem: story
size: 8
status: resolved
dateOpened: "2026-06-11"
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
graduatedTo: "protocol:guard"
tags: []
---

# Author the guard protocol standard (provider+predicate seam)

Author the Guard protocol via new-standard, per the #272 ruling: protocolize **only** the provider+predicate seam (a predicate/policy attached to a region, resolved by a swappable provider — default → project override → custom plug — at a region lifecycle event). Do **not** unify deny-outcomes; each member intent owns its own. Resolve the three sub-questions #272 left open: (1) is the rendering Gate a distinct member or just conditional rendering bound to the authz provider; (2) does the forbid/cloak (403/404) enum live behind the provider, not the UX-only intent; (3) the authz provider's trust-boundary contract (async/server/revocable). Unblocks #273 and #178.
