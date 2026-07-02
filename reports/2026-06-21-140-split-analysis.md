# Backlog split analysis — `/slice 140` (focused) — 2026-06-21

Focused slice request on **#140 — Dev-experience product surfaces × features** (`epic`, `status: open`).

## Verdict: COULD NOT SPLIT (wholesale) — by design

#140 is **explicitly a durable planning artifact, not a build** (body lines 84–94: "This is a planning
artifact, not a build"; "The 12-feature triage is **not funded yet** — revisit with real funnel data. This
card stays **open** as the durable planning artifact, not resolved."). Mechanically slicing it into 12
feature children would:

1. **Cost quality** — it would commit funding/scope to a triage the card deliberately defers pending real
   funnel data (soft-monetization treatment: never priced on a shifting category).
2. **Reproduce the exact anti-pattern the card documents avoiding** — line 85: the genuinely-new features
   are "captured here as rows first **to avoid 8 thin siblings**." Slicing now creates those thin siblings.

So the split-safety rubric fails: not provably safe, and it costs quality. **Recommended state:** mark
#140's decomposition gated (a `deferred` parked-reason, pending funnel data) rather than leaving the "slice"
nag — folded into #1392 below.

## What the real next steps actually are (filed, NOT as #140 children)

The product's missing next-step builds are **#141 successors / surface builds**, not rows of #140's matrix:

- **#1391 — Dev-browser shell build** (`epic`, filed this pass). The rightmost matrix column and #141's
  staged "browser shell later" successor — never filed until now. Homed in plateau (`plateau:src/dev-browser/`),
  reuses the built IDE-bridge substrate (#575/#576/#577/#676), embeds plateau-app panels (#141 Fork 4-A).
  `blockedBy: 140` (gated behind the funnel-data triage); **not funded to build yet** — it exists so the
  dependency is a real edge, which **unblocks-by-tracking #1083** (now `blockedBy: 1391`).
- **Extension / DevTools-panel MVP** (NOT yet filed — recommended next). #141's ratified "extension first"
  funnel step: pick ONE introspection feature from the #140 matrix (candidates: #6 state & action explorer,
  #3 in-context test status, #9 error replay) and prove "lights up on a conformant app." This is the genuine
  leading fundable build. Left unfiled pending a one-line feature pick — surfaced for decision.

## Could-split inventory

| Candidate | Outcome | Reason |
|---|---|---|
| #140 → 12 feature children | **No** | Planning artifact; triage unfunded; would create the thin-siblings it avoids |
| Dev-browser shell | **Filed #1391** | A #141 successor, not a #140 row; epic to slice when funded |
| Extension MVP | **Recommend file** | #141 "extension first"; needs a one-line feature pick first |

## Side effect filed

- **#1392 — Parked items must carry a strong machine-readable reason, surfaced as a pill** (`story`, size 5).
  Surfaced while re-pointing #1083 (was parked with only a prose "Blocked by #1082" note, no edge). Makes a
  recorded `parkedReason` mandatory + pilled for all parked items; backfills the ~35 current ones (incl. #140
  `deferred`).
