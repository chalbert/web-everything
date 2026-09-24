---
name: failure-is-a-product-improvement
description: Every failure is an opportunity to improve the product (daemons, tooling); never resolve it by manual intervention.
metadata:
  type: feedback
---

When a daemon, script, or piece of tooling fails on a real case — refuses, stands down, gets stuck, or mis-routes — treat that as a product gap to close, not a one-off problem to patch around by hand. Propose and ship the mechanical fix (the daemon/tooling change) so the class of failure stops recurring, rather than reaching for a manual intervention that clears this one instance and leaves the next one to hit the same wall.

**Why:** operator, 2026-09-24 ~7 AM ET, verbatim: "go, we always take failure as an opportunity to improve our product, never as a problem that needs manual intervention." Same standing instruction stated earlier and more tersely: "no manual fixes, improve the daemon if needed."

**How to apply:** when a daemon/script fails on a real case, propose the daemon/tooling change that fixes the class of failure, prove it on the live case with a real before/after (per [[worker-brief-requires-live-before-after-proof]] — reproduce the failure first, fix, then show the same real probe now succeeds), and let the IMPROVED daemon resolve the instance itself rather than hand-clearing it. Manual fixes are reserved for labelled emergencies only, and even then the follow-up is still to close the daemon/tooling gap that made the emergency necessary.
