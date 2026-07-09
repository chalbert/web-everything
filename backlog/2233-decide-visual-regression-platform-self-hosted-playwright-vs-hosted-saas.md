---
kind: decision
size: 3
status: resolved
dateOpened: "2026-07-04"
dateStarted: "2026-07-09"
dateResolved: "2026-07-09"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#visual-regression-substrate"
preparedDate: "2026-07-04"
parent: "2232"
tags: [ci, visual-regression, decision, playwright, tooling]
---

# Decide the visual-regression platform: self-hosted Playwright-in-container vs hosted SaaS

Before rebuilding the visual gate (#2232) we pick the substrate everything downstream targets: keep it
**self-hosted on Playwright** (baselines are committed PNGs, diffs reviewed in-PR) or adopt a **hosted
visual-review SaaS** (Chromatic / Percy / Argos) that stores baselines off-repo and provides a hosted diff
UI + approval workflow. The choice shapes #2234–#2240 (where baselines live, how review happens, whether a
vendor sees our rendered pages). This item is prepared to ready-to-ratify with a bold default below.

## Forks

**Fork 1 — platform.**
- **(default) Self-hosted Playwright in a pinned container.** Baselines are committed `-linux` PNGs
  generated in `mcr.microsoft.com/playwright:vX-jammy`; review is the PR's rendered image diff (#2238). No
  new vendor, no per-snapshot cost, no third party sees the pages, and it fits the repo's self-contained /
  non-lock ethos. Cost: we own the diff-review UX (GitHub's image diff is decent but not a dedicated
  approval console) and baseline storage bloats git a little.
- Hosted SaaS (Argos / Chromatic / Percy). Best-in-class diff UI, cross-browser matrices, and a real
  approval workflow out of the box. Cost: a paid dependency, screenshots leave the repo to a third party,
  and CI needs a token/secret — friction against the self-hosted ethos. **Argos** is the closest fit if we
  go hosted (open-source core, Playwright-first, self-hostable).

**Fork 2 — optional diff-review UI on top of the default.** Even if we stay self-hosted, we can layer
**Argos** purely as the diff-review surface while keeping baselines in-repo. Default: **not now** — start
with in-PR image diffs; revisit only if PR-diff review proves too coarse in practice.

## Recommendation

Take the defaults: **self-hosted Playwright in a pinned container with in-PR baseline review.** It is the
top-tier setup for a repo like this (deterministic, vendor-free, auditable) and unblocks #2234 immediately.
Ratify to proceed; downstream slices assume this default.

## Ruling (ratified 2026-07-09)

**Self-hosted Playwright wins both forks.** Fork 1 → self-hosted Playwright in a pinned container,
baselines = committed `-linux` PNGs, review = in-PR image diff. Fork 2 → **not now** (no hosted diff-review
UI yet).

Grounding that decided it: **self-hosted Playwright is already the incumbent**, not a greenfield pick —
`@playwright/test` + `check:visual` + committed baselines under `tests/visual/` are live, and every slice
of parent #2232 (#2234 container-pin, #2235 linux-baselines, #2236–2240) is already scoped on Playwright.
Zero Argos/Chromatic/Percy anywhere in the repo. So the real question was *keep the incumbent vs rip it out
for a vendor mid-epic*, and the incumbent holds.

Red-team of the default (steelman: adopt Argos): coarse in-PR review UX, the OSS/self-hostable Argos
partly dissolving the ethos objection, and committed-PNG git bloat that #1967 already wants to escape. The
attack failed on **timing/leverage, not merit**: migrating now discards the incumbent and plumbs a vendor
token for a review-UX gain that **Fork 2 can add later without migrating** (Argos as review-surface-only,
baselines stay in-repo), and #1967's churn concern is explicitly evidence-gated ("when churn weighs") — a
later call, not a reason to pick SaaS up front. No principle violated; native-first/self-contained favors
the default.

**Escape hatches kept live:** Fork 2 (layer Argos as diff-review-only if in-PR review proves too coarse)
and #1967 (graduate baselines off committed PNG when churn weighs). Revisit either on evidence, not now.

Downstream slices #2234–#2240 are unblocked and may assume this substrate. `graduatedTo: none` (a substrate
ruling, no new entity).
