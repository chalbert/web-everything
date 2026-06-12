---
type: idea
workItem: story
size: 5
status: open
blockedBy: ["288"]
dateOpened: "2026-06-11"
tags: [access-control, authorization, guard, route-guard, render-gate, feature-flags, security]
---

# Author the two-surface access-control member (route guard + render gate, deny-family + authority-kind taxonomy) on the Guard seam

Author the access-control member as the entry member of the Guard protocol (#288) — two surfaces sharing one authz provider: a routing entry guard (deny → navigation outcome) and a rendering access gate (deny → render-or-hide a subtree). The deny-family UX vocabulary is `hide | redirect | forbid | cloak` (403-vs-404 decided behind the provider); feature-flags resolve as an authority *kind* alongside `authorization` / `process` / `validity`, taxonomy defaulting to most-permissive; the front-end gate is a UX mirror, back-end authoritative. Ratified in #178 (Forks A-D): two surfaces, one provider, inherited trust boundary — no new enforcement contract. Blocked on #288.
