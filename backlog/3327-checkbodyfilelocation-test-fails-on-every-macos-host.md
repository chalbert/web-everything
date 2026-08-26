---
bornAs: x7kopnm
kind: story
size: 2
status: open
dateOpened: "2026-08-26"
tags: []
---

# checkBodyFileLocation test fails on every macOS host

we:scripts/__tests__/review-set-label.test.mjs "accepts /tmp on a host whose OS temp dir is somewhere else entirely" computes TMP from realpathSync of the OS temp dir, which on macOS is a /var/folders hash path — matching neither root it then passes. It fails on main, on any Mac, unrelated to any change. Found independently by three separate agents today, each spending time ruling it out of their own work before reporting it. A test that reddens for everyone and belongs to no one is worse than a missing test: it trains every reader to discount a red suite.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
