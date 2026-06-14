---
type: idea
workItem: story
size: 8
parent: "382"
status: resolved
dateOpened: "2026-06-13"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: none
relatedReport: reports/2026-06-13-design-ref-vision-pipeline.md
tags: [design-reference, corpus, vision, vlm-as-judge, capture-gate, quality-control, autoconsent]
---

# Build vision-gated capture QC client for the design-ref corpus (per #475 ruling)

Implement the vision-gated capture-QC client ruled in [#475](475-design-ref-vision-gated-capture-qc-candidate-surface-quality/):
a thin, swappable vision-client seam in `scripts/design-refs.mjs` that classifies each captured frame
before corpus admission and replaces the brittle hand-authored `readySelector` gate as the general
path. Generalises QC to any target and fixes the known failures (Photopea marketing splash, Grafana
error panel) the deterministic gate let through. Bound by #475's **no-leakage invariant**: the client
calls a vision model directly for now and is repointed at the Plateau vision service when it lands —
nothing leaks into any `@webeverything` published artifact.

## Spec (per #475 ruling — all four forks accepted)

- **Verdict (Fork 3):** `classifyCandidate(frame) → verdict ∈ {app, obstructed, marketing, error,
  blank, non-app}`. `app` → admit (`reviewState: confirmed`); `obstructed` → DuckDuckGo **autoconsent**
  dismiss + bounded re-shoot (cap 2, config) → else quarantine; all else → quarantine to
  `needs-review.json`.
- **Placement (Fork 2):** final-frame admission only; pre-capture probe deferred.
- **Coexistence (Fork 4):** keep `readySelector` as a free fast-path, but let vision **override** a
  selector-pass that's actually an error page (the Grafana case); cache the verdict by `contentHash`
  so idempotent re-runs don't re-pay vision.
- **Seam (Fork 1):** thin swappable client, no provider name in core; repoint to the Plateau service later.

**Acceptance:** re-run the two known-bad targets and confirm Photopea quarantines and Grafana admits a
real dashboard (or recovers via remediation); idempotent re-run re-pays no vision.

## Progress

- **Status:** resolved 2026-06-13.
- **Done:**
  - `scripts/design-refs/vision.mjs` — the vendor-free seam: 6-verdict taxonomy + `ungated` sentinel,
    pure `decideAdmission` (admit/remediate/quarantine), `reviewStateFor`, a provider **registry** with
    only the null `manual` provider built in, and `resolveVisionProvider` that loads an external provider
    module by env (`DESIGN_REFS_VISION_PROVIDER` / `…_MODULE`) — no vendor name in the core (no-leakage).
  - `scripts/design-refs.mjs` — wired the gate into `collect()`: selector fast-path (`confirmed` skips
    vision; `--vision-verify` cross-checks it for the Grafana override), final-frame classify → admit /
    bounded `obstructed` remediation (`dismissOverlays`, cap 2) / quarantine, verdict cache by
    `contentHash` (`verdicts.json`), `meta.visionVerdict`. Default `manual` provider ⇒ behaviour
    unchanged unless opted in (offline/CI-safe).
  - `scripts/design-refs/__tests__/vision.test.mjs` — 16 tests: taxonomy, gate mapping, registry/seam,
    and the acceptance scenarios (Photopea→quarantine, Grafana error→quarantine override, clean→admit,
    obstructed→remediate-then-admit) via an injected **mock provider**.
- **Gate:** full vitest **2543 pass** (16 new); `check:standards` **0 errors**.
- **Notes / honest scope:** acceptance is proven at the **seam + mock** level (no network/model in CI).
  Live end-to-end needs the interim reference provider → **#485**. `dismissOverlays` is a heuristic
  fallback; full autoconsent CMP wiring → **#486**.
