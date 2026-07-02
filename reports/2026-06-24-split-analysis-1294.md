# Backlog split analysis — #1294 relocate WE-resident logic reference runtimes to FUI

**Date:** 2026-06-24
**Focus:** `/slice 1294` — relocate the ~10 WE-resident logic reference runtimes (webpolicy enforcement/proof + the #1078 subsystems) to FUI.
**Verdict:** **COULD NOT SPLIT — the epic's un-park gate is still unmet.** No slices carved.

## Context

#1294 (`kind: epic`, `size: 8`, `status: open`, `childlessReason: parked`) is a **parked, childless
epic**. It is downstream of the zero-implementation rule (#1282): WE must hold no delivery runtime, but
~10 logic reference runtimes still live in WE in violation — `we:webpolicy/enforcement.ts` +
`we:webpolicy/proof.ts` (consumed by `we:demos/webpolicy-conformance-demo.ts` via a build-time local
import) plus the #1078 subsystems. The intended move: relocate each to FUI, leaving WE the **contract +
conformance vectors** only.

The epic's own body documents the gate and an explicit **un-park condition**:

> Un-park when: (a) FUI hosts each runtime, AND (b) the website can surface FUI for headless logic
> (a mode-C runtime bundle path **or** the #899 runner is built).

## Re-verification (2026-06-24)

The park rationale was last verified 2026-06-20 (4 days ago). #899 has since flipped to `resolved`, so I
re-checked the gate rather than trusting the stale note. Both legs are **still unmet**:

| Gate leg | Claim at park (2026-06-20) | State 2026-06-24 | Met? |
|---|---|---|---|
| (a) FUI hosts each runtime | `fui:webpolicy/` does not exist; no `@frontierui/webpolicy` | Still MISSING — no `fui:webpolicy/` dir, no `@frontierui/webpolicy` package (grep'd all FUI `fui:package.json`) | ❌ |
| (b) website can surface FUI headless logic | #899 designed-not-built; no mode-C bundle path | #899 is **resolved as a *decision*** (ratified 2026-06-18), **not a built runner** — its own Graduation section lists "FUI reference backend", vector schema, corpus, verifier as builds *still to spawn*. No mode-C bundle path exists. | ❌ |

**Key trap avoided:** #899's `status: resolved` is a *resolved decision*, not delivered runner code
(`[[feedback_resolved_blocker_can_be_false_edge]]`). The decision ratified that vectors stay WE and the
runtime driver moves to FUI — but the FUI reference backend has not been built. So leg (b)'s "#899 runner
is built" is **false**.

## Could not split — which condition failed

The three proposed per-subsystem slices in the epic body each fail the split-safety rubric:

- **(a) stand up the FUI home** — fails *real home*: there is no `fui:webpolicy` package or plan to land
  it in. This slice is not "stand up a known home", it is "decide & create a home that does not yet
  exist" — design work, not an agent-ready `size ≤ 3` task.
- **(b) repoint the WE-website conformance demo to surface FUI** — fails *real home* and *independence*:
  the surface mechanism (mode-C runtime bundle path **or** the #899 FUI runner) does not exist. There is
  nothing to repoint *to*.
- **(c) delete the WE runtime, retaining contract + vectors** — fails *valid demoable state*: deleting
  `we:webpolicy/enforcement.ts`/`we:webpolicy/proof.ts` today strands the live `webpolicy-conformance-demo`
  (23 tests), replacing WE's executable conformance proof with nothing, because FUI cannot yet run the
  vectors.

Slices (a) and (b) are blocked on artifacts that **must be built first** and are not themselves slices of
*this* relocation — they are upstream foundations. The epic correctly captures this as a single parked
unit rather than premature children.

## The action that would unblock a future split

Un-park (and re-run `/slice 1294`) once **both** hold:

1. **A FUI home exists for headless logic runtimes** — a `@frontierui/webpolicy` (and per-subsystem)
   package landed, so slice (a) becomes "move code into an existing home".
2. **The website can surface FUI headless logic at runtime** — either the **#899 FUI reference
   backend/runner is actually built** (resolved-decision → shipped code), or a **mode-C runtime bundle
   path** for the WE-website demo to load FUI headless logic exists. Then slice (b) has a real target and
   slice (c) leaves a valid demoable state (FUI runs the retained WE vectors).

When both land, the per-subsystem carve (webpolicy first — it has the live demo + 23 tests, then the
remaining #1078 subsystems) becomes a clean DAG with real homes. No backlog mutation today.
