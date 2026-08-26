---
bornAs: x2ra4b2
kind: story
size: 3
parent: "3318"
status: open
dateOpened: "2026-08-26"
scope:
  - we:scripts/lib/claim-sweep.mjs
tags: []
---

# Sweep a corrected claim across every site, and report the sweep

Correcting the quoted instance leaves the same claim standing elsewhere. This PR proved it three times, and a peer session reports it as the single defect class behind almost every bounce across 13 PRs in one day — instructing an agent to watch for it did not stop it recurring. Make it mechanical: grep every changed file plus the PR body and title for the claim, fix all sites, and emit the sweep so a reviewer can see it ran.

The three: r1 fixed the epic card and left the PR description; r2 fixed the description and left `we:scripts/lib/jury-core.mjs` and a sibling decision card; and one reported fix never applied at all, because a guard aborted the command chain containing it, so a stale body was uploaded and reported as done.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
