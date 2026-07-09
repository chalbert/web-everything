---
kind: story
size: 3
parent: "2289"
status: open
dateOpened: "2026-07-09"
tags: []
---

# JIT numbering strands a hash on the normal pr-land drain land route (not just --fallback-git)

A second JIT-numbering bypass route, distinct from the --fallback-git one #2322 closed. This session scaffolded a fresh hash-id item mid-decision-session and landed it via the NORMAL we:scripts/pr-land.mjs enqueue then drain path (PR #262); it landed on main STILL hashed (xcm3iam), tripping the #2319 hash-on-main invariant gate and forcing a manual we:scripts/backlog.mjs number-stranded (→ #2347, PR #264). So the drain's numberPendingHashes did not number a hash born outside the batch/manifest flow. Fix: number at land on EVERY route (scan the landing diff for non-numeric leading ids, not just a pending registry), or assert pre-merge in pr-land so a hash never reaches main. Repro: this session. relatedTo #2288, #2319, #2322.
