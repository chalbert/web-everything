---
kind: task
status: resolved
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: none
tags: []
---

# capability worked-example artifact stale — worked-example-artifact test red on HEAD

The committed `we:src/_data/capabilityWorkedExample.json` no longer matches what the #213 resolver
computes (`we:capabilities/workedExample.ts`), so `we:capabilities/__tests__/worked-example-artifact.test.ts`
fails on a clean tree. The drift is in the `customizable-select` capability tiers (capability-hard/polyfill-ok
committed vs native-ok computed) — fallout from the #291 native-first work. Computed-not-authored (#213), so
the fix is a regen: `UPDATE_WORKED_EXAMPLE=1 npx vitest run worked-example-artifact`. Surfaced during the
#1047 close gate; unrelated to the plug repoint.

## Progress

- Ran the documented regen (`UPDATE_WORKED_EXAMPLE=1 npx vitest run worked-example-artifact`) → re-emitted `we:src/_data/capabilityWorkedExample.json` from the #213 resolver (`we:capabilities/workedExample.ts`). The committed artifact had drifted (fallout from the #291 native-first tier work).
- Recomputed delta: the `customizable-select` worked example now reflects the corrected eligibility (`3/4 impls eligible` + "native wins the tie") and gained the `floating-ui` candidate row the resolver computes. Computed-not-authored (#213) — no hand edits.
- `npx vitest run worked-example-artifact` green WITH and WITHOUT the update flag (the committed artifact now matches the resolver on a clean tree).
