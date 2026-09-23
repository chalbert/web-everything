---
bornAs: xjko7gy
kind: task
parent: "3963"
status: open
scope: ["we:scripts/lib/constellation-repos.mjs"]
dateOpened: "2026-09-23"
tags: []
---

# Multi-repo slice 1: a per-repo profile

Add repoProfile(keyOrSlugOrPrefix) to we:scripts/lib/constellation-repos.mjs returning key, slug, slugTag, expanded checkoutPath, lanePoolRepo, scopePrefixes, canonicalPrefix and capabilities {review, fix, ciHeal, build}, plus gateFor(repo) reusing verify's composeGate so there is ONE gate source. Move planReviewDispatch's laneRepo derivation into it. Foundation for every other slice under the multi-repo epic; see we:reports/2026-09-23-conveyor-multi-repo-gap-map.md.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
