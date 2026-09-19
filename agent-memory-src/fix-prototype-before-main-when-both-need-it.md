---
name: fix-prototype-before-main-when-both-need-it
description: Standing operational instruction — when a fix needs to land on both lane/mechanical-dispatcher and main, build/test/land the prototype-branch side first and never let the main-side work gate or slow it down.
metadata:
  type: feedback
---

When a fix needs to land on both `lane/mechanical-dispatcher` (the prototype branch) and `main`, the
prototype-branch side should be built, tested, and landed FIRST — with the main-side work never
allowed to slow it down or become a gating dependency. The normal flow is: fix and verify on the
prototype, land that PR, restart the live driver and confirm the fix is actually working — only
then (or in parallel, never blocking) handle the main-side PR.

**Why:** surfaced 2026-09-14 during epic #3383's incident-response chain (the verify-dispatch
timeout fix, PRs #2235/#2236). The live conveyor driver only ever runs code from
`lane/mechanical-dispatcher` — a fix that lands only on `main` has zero operational effect until it
separately reaches the prototype branch too (this exact gap caused a real incident earlier the same
night: PR #2232 merged to `main` while the driver kept running unpatched code for hours). Given
that, the prototype-branch side is the one with actual operational consequence; the operator's
explicit instruction was to make sure work on the `main` side never becomes a bottleneck for getting
the prototype side landed and live.

**How to apply:**
- When dispatching or reviewing a fix that spans both branches, sequence the prototype-branch PR's
  build/test/land/restart-and-verify as the priority thread.
- If both sides are being reviewed/landed concurrently, land and activate whichever is ready first —
  don't hold the prototype-branch side waiting on the main-side PR to also clear, even if they were
  dispatched together.
- This is about a fix (or other work) that must exist on both branches — it does not override the
  separate, still-open branch-strategy decision about which branch new work should target by
  default; that's a different question this note doesn't resolve.
