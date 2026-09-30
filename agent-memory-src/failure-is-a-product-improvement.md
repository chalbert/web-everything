---
name: failure-is-a-product-improvement
description: Every failure is an opportunity to improve the product (daemons, tooling); never resolve it by manual intervention.
metadata:
  type: feedback
---

When a daemon, script, or piece of tooling fails on a real case — refuses, stands down, gets stuck, or mis-routes — treat that as a product gap to close, not a one-off problem to patch around by hand. Propose and ship the mechanical fix (the daemon/tooling change) so the class of failure stops recurring, rather than reaching for a manual intervention that clears this one instance and leaves the next one to hit the same wall.

**Why:** operator, 2026-09-24 ~7 AM ET, verbatim: "go, we always take failure as an opportunity to improve our product, never as a problem that needs manual intervention." Same standing instruction stated earlier and more tersely: "no manual fixes, improve the daemon if needed."

**Root cause, never a retry or a way around (operator, 2026-09-30 ~7:30 AM ET: "For every failure we have to go to root problem and solve it, not just retry or go around").** A retry loop, a cooldown that re-offers the item, a fallback route that stays on, or a timed probe back is NOT a fix. It hides the cause and lets the same failure recur. Diagnose the actual cause from the evidence (run records, logs, transcripts), fix that, and release the instance only by citing the fix that removed its cause. Only a proven-transient infrastructure failure (rate limit, network) may retry automatically, within a bound. An unknown cause is recorded and becomes a card, never retried blindly. Live miss that prompted it: I first dispatched "prepare holds expire after 60 min and retry" plus "timed probe back from the Claude fallback", then stopped both and replaced them with a per-item root-cause diagnosis.

**How to apply:** when a daemon/script fails on a real case, propose the daemon/tooling change that fixes the class of failure, prove it on the live case with a real before/after (per [[worker-brief-requires-live-before-after-proof]] — reproduce the failure first, fix, then show the same real probe now succeeds), and let the IMPROVED daemon resolve the instance itself rather than hand-clearing it. Manual fixes are reserved for labelled emergencies only, and even then the follow-up is still to close the daemon/tooling gap that made the emergency necessary.
