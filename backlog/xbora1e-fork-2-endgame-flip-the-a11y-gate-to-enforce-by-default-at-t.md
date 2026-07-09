---
kind: story
size: 3
parent: "777"
status: open
blockedBy: ["867"]
dateOpened: "2026-07-09"
tags: []
---

# Fork-2 endgame: flip the a11y gate to enforce-by-default at the drained milestone

Per #867 Fork 2 (b): once ENFORCED_ROUTES equals the derived set and the lane is green, invert the gate to build-blocking-unless-in an explicit WARN_ROUTES opt-out set (per repo). This item owns: the posture inversion (we:tests/a11y/rendered-site-a11y.spec.ts), making a sitemap-fetch failure hard-fail (the ENFORCED_ROUTES fallback dies with the set), and rewriting the 'FORCED INVARIANT (#774)' headers in both gate files plus a we:docs/agent/platform-decisions.md entry recording the #774 rider-(ii) supersession lineage. Triggered by the drain meta-check shipped with the promotion item.
