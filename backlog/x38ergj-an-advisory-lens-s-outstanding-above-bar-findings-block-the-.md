---
kind: story
size: 3
parent: "3318"
status: open
dateOpened: "2026-08-26"
tags: []
---

# An advisory lens's outstanding above-bar findings block the panel verdict

#3314 ruled `claim-accuracy` advisory with a scoped blocking sub-class — `impact >= PREVENTION_IMPACT_BAR`.
`derivePanelVerdict` already blocks on an advisory lens's findings, but only for **resolved** ones owing an
uncaptured guard; an **outstanding** above-bar finding rides the accept at any impact. Add the third scan,
gated by an explicit `BLOCKING_ADVISORY_LENSES` set holding `claim-accuracy` alone. Until this lands, #3314's
ruling behaves identically to plain advisory.

## Shape

In `we:scripts/lib/jury-core.mjs`, alongside the existing prevention scan in `derivePanelVerdict`:

- Export `BLOCKING_ADVISORY_LENSES` — frozen, `['claim-accuracy']`. **Explicit, never `ADVISORY_LENSES`**:
  generalizing the bar to every advisory lens is a separate ruling (`#x2iwy8f`).
- Scan the panel's findings for `isFindingOutstanding(f) && blocksAcceptance(f, { bar })` whose originating
  lens is in that set → `changes`.
- Order it **after** the mandatory-lens `needs-human`/`changes` checks and **before** the prevention scan: a
  real mandatory defect still outranks it, and an outstanding defect outranks a missing guard.
- Provenance comes from `buildPanelFindings`, which prefixes `category` with the lens (`claim-accuracy/…`) —
  match on that prefix, and add a test pinning the coupling so a change to the prefix format fails loudly
  rather than silently un-blocking the sub-class.
- The lens brief in `we:scripts/lib/review-core.mjs` must tell a `claim-accuracy` juror how to pick an
  `impact` level, with #3314's two worked examples (a wrong acceptance criterion is `broken`; a wrong figure
  no criterion depends on is `cosmetic`). Without that the typed field is discretion wearing a type.

## Done when

1. **Executable** — `npx vitest run we:scripts/lib/__tests__/jury-core.test.mjs` passes with a new case
   proving an **outstanding** `claim-accuracy` finding at `broken` drives `derivePanelVerdict` to `changes`
   while the same finding at `cosmetic`, and the same `broken` finding from `simplicity`, both still
   `accept`.
