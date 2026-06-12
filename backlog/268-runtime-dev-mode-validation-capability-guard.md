---
type: idea
workItem: task
parent: "005"
status: resolved
blockedBy: ["266"]
dateOpened: "2026-06-10"
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
graduatedTo: capability-manifest/guard.ts
tags: []
---

# Runtime dev-mode validation-capability guard

A dev-mode runtime guard that warns when validation usage exceeds the active implementation's declared capabilities (the manifest from #266), the runtime sibling of the build-time check. Dev-only, stripped in prod. Independent of the build-time tool and report slices.

## Progress

**Resolved 2026-06-10.** Authored the guard at
[capability-manifest/guard.ts](../capability-manifest/guard.ts), re-exported from the
`capability-manifest` barrel and from [plugs/webvalidation/index.ts](../plugs/webvalidation/index.ts)
(alongside the #266 vocabulary). API:

- **`guardCapability(manifest, feature)`** — returns `true` if `feature` is out of capability (used but
  not declared); in dev emits a one-time `console.warn` naming the feature + the impl's conformance
  level/spec version; a malformed manifest is flagged and treated as supporting nothing.
- **`guardCapabilities(manifest, features)`** — bulk variant returning the out-of-capability subset
  (each warned once), over the shared `outOfCapability` diff (#270).

**Dev-only / prod strip:** the `console.warn` side effect is gated on
`process.env.NODE_ENV !== 'production'` (the repo's existing dev-gate idiom), so a prod bundle
dead-code-eliminates the warning path — the cheap capability diff still returns its boolean. **Warn-once**
dedup (a module Set, resettable via `__resetCapabilityGuardWarnings()` for tests) keeps a hot path from
spamming. **Independent** of #267/#269: it reuses only the #266 model and the #270 `outOfCapability`
diff.

Tests ([__tests__/guard.test.ts](../capability-manifest/__tests__/guard.test.ts), 6): in-capability is
silent, out-of-capability warns once, repeated use warns once, malformed manifest flagged, bulk variant
returns each #270 fixture's expected out-of-capability set, and the prod path computes the diff but emits
no warning. All 27 capability-manifest + 73 webvalidation tests pass; gate green.
