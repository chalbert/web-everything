---
name: delegate-work-to-codex-when-feasible
description: "Operator preference — actively look for opportunities to delegate real work to Codex (not just the personal use-codex escape hatch) as soon as the integration is genuinely feasible, not just theoretically wired."
metadata:
  type: project
---

**Operator (2026-09-12): "I want to delegate some work to codex as soon as feasible."**

Said while multiple Codex threads were in flight on the mechanical-dispatcher prototype (epic
#3383): Codex seated as a third, advisory-only judge on review-pr (built, prototype-branch only,
not yet on `main`); the Codex model-routing decision (`#3635`, ratified and merged to `main`,
pinning `gpt-6-astra`); and the pre-existing personal `use-codex` escape hatch (`codex-direct-task.mjs`,
explicitly walled off from the product's own dispatch pipeline).

**How to apply:** This is a standing forward-looking preference, not a one-off request — when
scoping future mechanical-dispatch or delivery work, actively look for a point where handing real
work to Codex (beyond the advisory judge seat and beyond the personal escape hatch) becomes
genuinely feasible, and treat that as worth pursuing rather than something to wait to be asked
about. "Feasible" means actually wired and proven, not just theoretically possible — check real
readiness (e.g. whether the relevant driver/dispatch machinery is stable enough, per
[[prototype-fix-what-you-find-by-default]] and the day's broader self-hosting-fragility lessons)
before treating a Codex-delegation opportunity as ready to act on, but don't wait indefinitely
either — surface it as soon as it's real.
