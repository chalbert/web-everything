---
kind: story
size: 5
status: resolved
blockedBy: ["288"]
dateOpened: "2026-06-11"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: intent:access-control
tags: [access-control, authorization, guard, route-guard, render-gate, feature-flags, security]
---

# Author the two-surface access-control member (route guard + render gate, deny-family + authority-kind taxonomy) on the Guard seam

Author the access-control member as the entry member of the Guard protocol (#288) — two surfaces sharing one authz provider: a routing entry guard (deny → navigation outcome) and a rendering access gate (deny → render-or-hide a subtree). The deny-family UX vocabulary is `hide | redirect | forbid | cloak` (403-vs-404 decided behind the provider); feature-flags resolve as an authority *kind* alongside `authorization` / `process` / `validity`, taxonomy defaulting to most-permissive; the front-end gate is a UX mirror, back-end authoritative. Ratified in #178 (Forks A-D): two surfaces, one provider, inherited trust boundary — no new enforcement contract. Blocked on #288.

## Progress (2026-06-13) — resolved

#288 resolved (the `guard` seam: provider + `assertGuardDecision` trust boundary). Authored the member in two layers, restating the #178 ruling (Forks A–D), not re-deciding it:

- **Runtime model** — new [we:guard/accessControl.ts](../guard/accessControl.ts) on the seam (exported from [we:guard/index.ts](../guard/index.ts)): `evaluateAccess(provider, region, policy, opts)` evaluates the **entry** event via the shared provider (async, server-authoritative, `assertGuardDecision` at the boundary) and on deny layers the member's outcome. **Two surfaces, one provider** (`OUTCOMES_BY_SURFACE`: `route` → redirect/forbid/cloak, `render` → hide/forbid/cloak; a surface/outcome mismatch throws). **403-vs-404 behind the provider**: `resolveDenyOutcome` applies a provider-owned `disclosure` (default `conceal`, RFC 9110) that downgrades a requested `forbid` → `cloak`, so the UX author never forces existence disclosure. **Authority taxonomy** (`authorization | feature-flag | process | validity`, default `authorization`); feature-flag is a first-class kind through the same provider.
- **UX intent** — added the `access-control` intent to [we:intents.json](../src/_data/intents.json) (parallel to the sibling `exit-guard`): dimensions `surface` / `deny` / `authority`, the trust-boundary restatement, and the #178 prior-art survey. Renders at `/intents/access-control/`.

11 unit tests (surface validity, conceal/reveal disclosure, both surfaces allow/deny, feature-flag authority, hostile-provider rejection); typecheck clean; `check:standards` green (we:AGENTS.md inventory regenerated for the new intent). Trust boundary restated, never re-decided: front-end UX mirror, back-end authoritative, revocable; the route surface composes the Navigation API intercept, inventing no blocking mechanism.
