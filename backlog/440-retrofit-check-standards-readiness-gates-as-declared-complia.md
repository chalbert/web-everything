---
type: idea
workItem: story
size: 3
parent: "351"
status: resolved
blockedBy: ["436", "437"]
dateOpened: "2026-06-12"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: none
tags: []
---

# Retrofit check:standards + readiness gates as declared compliance policies

Re-express the existing hard CI gates — check:standards and the readiness gates — as declared, severity-tagged policies extending the platform default, rather than scattered hardcoded scripts. They are already compliance (hard gates); this folds them in as the seed policy set so the gate set is data. Phase 5 of #351; needs the policy model (#436) and the gate runner (#437).

## Progress

Delivered the seed baseline policy [webcompliance/policies/platform-default.ts](../webcompliance/policies/platform-default.ts) + [test](../webcompliance/__tests__/platform-default.test.ts) (5 cases; full webcompliance suite 23/23, tsc clean, check:standards green) — 2026-06-13:

- **`platformDefaultPolicy`** — the root `CompliancePolicy` (extends nothing) every project policy `extends`. Three declared rules re-expressing today's enforcement as data:
  - `standards-conformance` (**block**) — `check:standards` reporting 0 errors (it exits non-zero on any error today).
  - `backlog-well-formed` (**block**) — the backlog-item structural validation `check:standards` folds in (enums, required fields, immutable NNN).
  - `readiness-structural` (**warn**) — the `check:readiness` scan, tagged warn because that script is **informational today** (exits 0); honest to current wiring, and a project can promote it to block via `extends` (proven in the test).
- **Measure convention** — the gate's `clears` is a *floor* (`measured >= threshold`); error-count gates are the inverse, so each is modeled as a **binary pass-signal** (producer emits `1` ⇔ zero errors), threshold `1`. Keeps "must pass" expressible as plain data with the default comparator — no per-rule override. Measure ids namespaced by producing check.

**Scope note:** this folds the gate set into *data* (the declared seed policy). Actually *wiring the check scripts to emit these measures and run through the gate runner* (replacing their inline `process.exit`) is the producer-side migration — same `.mjs`-producer shape noted on #435 — deferred there. The policy data is the contract those producers will target.
