---
kind: story
size: 5
parent: "xq5ggfh"
status: open
blockedBy: ["xy1ml9m"]
scope: ["we:scripts/check-standards.mjs", "we:scripts/readiness/claimScope.mjs"]
dateOpened: "2026-09-25"
tags: []
---

# check:standards --local actually skips work: sections see the scope before running

Today --local --files=... in we:scripts/check-standards.mjs runs all ~50 sections over the whole repo and only demotes findings afterward (partitionLocal, we:scripts/readiness/claimScope.mjs), so a scoped lane run costs the same ~16s as a full one. Introduce a scope context (changed-file set + local flag) that sections read BEFORE running. Slice 1 uses it for the pure-waste case: sections whose findings --local always demotes (path-less GLOBAL/RELATIONAL findings and descriptor.global ones) do not run at all in --local mode — identical verdict, less work. Full no-flag run (CI, close-out) byte-identical. Done when the replay proof (xy1ml9m) shows zero lane-own misses and a measured wall-time drop.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
