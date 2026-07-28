---
kind: story
size: 2
status: open
dateOpened: "2026-07-27"
tags: []
---

# Apply the content-preserving renumber guard to the lane base-id-reuse heal (nnn-collision-heal)

we:scripts/lib/nnn-collision-heal.mjs rewrites inbound refs and re-files yielded files with the SAME rewriteRefs to writes to refile pattern the drain heal uses, but has NO content-preservation guard, so it carries the identical blank-on-rewrite / data-loss risk #2546 just hardened the drain path against. Wrap its writes with the shared assertContentPreserved (exported from we:scripts/backlog/renumber-collisions.mjs) so a rewrite that blanks or corrupts a file fails loudly instead of writing empty/partial content. Add a regression test mirroring the #2546 one.
