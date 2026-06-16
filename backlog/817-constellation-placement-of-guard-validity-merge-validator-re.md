---
type: decision
workItem: story
size: 3
status: open
blockedBy: []
dateOpened: "2026-06-16"
relatedReport: reports/2026-06-16-730-capability-manifest-validation-generation-placement.md
tags: [constellation, plugs, port, frontierui, standard-impl-boundary]
---

# Constellation placement of guard / validity-merge / validator-resolution subsystems under the FUI plug port

The #725 plug port (webguards/webvalidation → FUI) has a **five**-subsystem import closure, but #730 only
ruled on two of them (`capability-manifest/`, `validation-generation/`, exported by #814). The remaining
three — `guard/` (#288/#289), `validity-merge/` (#212), `validator-resolution/` (#214) — are imported by
the plugs (verified: `plugs/webguards/index.ts:23-31` → `guard/{provider,registry}`;
`plugs/webvalidation/index.ts:17-57` → `validity-merge/{provider,registry}` +
`validator-resolution/{provider,registry,index}`) yet are **unplaced**: #730's scope explicitly excluded
them and #814 exported no `@webeverything` surface for them. Decide where each lives — the same A1/B1 axis
#730 applied to capability-manifest — **before** #725 copies anything, so a strategy-plane *contract* isn't
silently duplicated into the impl repo (npm-scope-mirrors-layer + impl-is-not-a-standard).

## The fork

The distinguishing test is #730's own: **code that *defines* a contract → WE standard; code that
*implements/generates against* it → FUI.** Apply it per subsystem. The three are provider+registry
*strategy planes* — and the #730 report (`reports/2026-06-16-730-…-placement.md`, and #730 body line ~44)
explicitly cites `validity-merge` (#212) and `validator-resolution` (#214) as the *precedent planes that
capability-manifest is structured like* — i.e. the very shape that was ruled **A1 (stays WE, FUI imports
from `@webeverything`)**. That precedent pulls hard toward "contract → WE" for at least the provider/registry
SoT of each.

- **Fork 1 — `guard/` (#288/#289 guard-protocol provider+predicate seam).** Imported by `webguards`.
  - **Default — split like #730 B1:** `provider.ts` (the guard-protocol contract/vocabulary) + `registry.ts`
    (resolution SoT) stay WE and gain an `@webeverything/guard` export (extend the #814 surface); any
    concrete predicate/runtime impl ports to FUI. Mirrors the capability-manifest A1 + validation-generation
    B1 rulings already made.
  - Alt A2 — whole subsystem ports to FUI as impl (treat the provider+registry as swappable runtime).
    *Risk:* leaks a strategy-plane contract into `@frontierui`, the exact drift #649/#170 exist to kill.
- **Fork 2 — `validity-merge/` (#212 strategy plane).** Imported by `webvalidation` (`provider`, `registry`).
  Same default: contract (`provider`/`registry`) → WE export `@webeverything/validity-merge`; concrete merge
  strategy impls → FUI.
- **Fork 3 — `validator-resolution/` (#214 async-resolution plane).** Imported by `webvalidation`
  (`provider`, `registry`, `index`). Same default: contract → WE export
  `@webeverything/validator-resolution`; the `AsyncValidationRunner` runtime + concrete resolvers → FUI.

**Recommended ruling — Fork 1/2/3 all split by the #730 axis (B1-shaped): provider/registry contract →
WE (+ three new `@webeverything/*` exports added to the #814 surface), concrete strategy/runtime impl →
FUI.** This is the only option consistent with the already-ratified capability-manifest A1 and
validation-generation B1, and with the #730 report's characterization of these three as the precedent
contract planes. The alternative (wholesale port to FUI) is defensible only if a plane's contract half is
vestigial — needs per-plane verification that it is not (capability-manifest's was the bulk, so the prior
suggests these are too).

## Unblocks

#725 (`blockedBy: 817` added). Once ruled, the export-surface delta (the new `@webeverything/*` entries)
is a small #814-style follow-up, and #725 resumes copying only the genuinely-impl half + importing the
WE-resident contract — the same shape it already has for capability-manifest/validation-generation.

## Evidence (verified 2026-06-16, batch-2026-06-16)

Import closure traced from the plug sources, not the (stale, two-subsystem) #635 audit:
- `plugs/webguards/index.ts:23-31` → `../../guard/{provider,registry}`
- `plugs/webvalidation/index.ts` → `validity-merge/{provider,registry}` (`:17,:18,:19,:24,:25,:52,:57`),
  `validator-resolution/{provider,registry,index}` (`:19,:20,:23,:24,:34,:40`)
- #814 export surface (`capability-manifest/package.json`, `validation-generation/package.json`) covers
  only those two subsystems; `guard/`, `validity-merge/`, `validator-resolution/` have no package.json /
  exports map and no FUI tsconfig/vite alias.
