---
kind: decision
size: 3
status: open
dateOpened: "2026-07-04"
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
