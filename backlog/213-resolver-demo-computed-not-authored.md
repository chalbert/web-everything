---
type: idea
workItem: story
size: 2
parent: "203"
status: resolved
dateOpened: "2026-06-08"
dateStarted: "2026-06-09"
dateResolved: "2026-06-09"
graduatedTo: "capabilities/workedExample.ts (buildNativeFirstWorkedExample) + src/_data/capabilityWorkedExample.json (build-time artifact) + computed Native-branch section in src/capabilities.njk + capabilities/__tests__/worked-example-artifact.test.ts (drift guard)"
tags: [capability-provider, resolver, capabilities-page, drift-guard, native-first, demo]
crossRef: { url: /backlog/205-native-first-resolver/, label: "Follow-up from #205 (native-first resolver)" }
---

# /capabilities resolver worked-example is authored, not computed

The **Native-first resolution** section of [src/capabilities.njk](../src/capabilities.njk) walks the
droplist worked example (native branch → `base-select`, fallback → `face`) as **hand-authored prose**.
The resolver itself is TypeScript ([capabilities/resolver.ts](../capabilities/resolver.ts)) and 11ty
can't run it at build time, so the page restates the algorithm's conclusion rather than rendering it.

The resolver tests assert the same facts (`resolveSlot(provider, native-first, ['selection','anchor'])
=== base-select`), so the *outcome* is guarded — but the prose detail (cost counts, which capability is
the blocker) can drift from the matrix silently.

## Scope

- Emit the resolver's worked-example output into a **build-time JSON artifact** (a small script or an
  11ty `_data` generator that imports the compiled resolver, mirroring how the matrix table renders
  from `capabilityMatrix.json`), then render the page section from that artifact instead of prose.
- Or, lighter: a unit test that re-derives the page's claimed numbers from the resolver and fails on
  drift, keeping the prose but pinning it.
- **DoD** — the /capabilities native-first section can no longer disagree with the resolver; an
  intentional matrix edit that changes the resolution flips the page (or reddens a test).

Analogous to the #210 (proxy allowlist drift-guard) / #211 (detail pages) follow-ups filed from #204.

## Resolution (2026-06-09)

The native branch of the worked example is now **computed, not authored** — the part derived from the
shipped matrix, hence the part that could drift. Shipped:

- [capabilities/workedExample.ts](../capabilities/workedExample.ts) — `buildNativeFirstWorkedExample()`
  runs the real `createDefaultProvider` + `resolveSlot` over the droplist slot (`selection` + `anchor`)
  and emits the computed result (winner, per-impl eligibility / cost / blockers / tiers).
- [src/_data/capabilityWorkedExample.json](../src/_data/capabilityWorkedExample.json) — the committed
  build-time artifact 11ty reads (11ty can't run the TS resolver, so the resolver computes it once and
  commits it, mirroring how the matrix table renders from `capabilityMatrix.json`).
- [src/capabilities.njk](../src/capabilities.njk) — the "Native branch" box now renders winner + each
  impl's eligibility/cost/blockers from that artifact instead of hand-authored prose.
- [capabilities/__tests__/worked-example-artifact.test.ts](../capabilities/__tests__/worked-example-artifact.test.ts)
  — drift guard: recomputes from the resolver and asserts the committed artifact matches (regenerate
  with `UPDATE_WORKED_EXAMPLE=1 npx vitest run worked-example-artifact`). A matrix edit that changes the
  resolution makes the artifact stale → red, satisfying the DoD.

The **fallback branch** stays prose deliberately: it illustrates a *hypothetical* constrained provider,
not the shipped matrix, so there is nothing in shipped data for it to disagree with (its winner is
already pinned by `resolver.test.ts`).
