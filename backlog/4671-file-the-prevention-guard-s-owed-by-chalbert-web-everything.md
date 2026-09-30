---
bornAs: xig98vg
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/4670-standalone-prepare-runs-are-discarded-as-card-tampering-with.md"]
dateOpened: "2026-09-30"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3197's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4670-standalone-prepare-runs-are-discarded-as-card-tampering-with.md:12` — When the implementation lands, add a table-driven test in we:probation-build-run.test.mjs. It should assert that each lifecycle or gate key (status, dateStarted, dateResolved, and blockedBy removal) is refused, and that only additive `blockedBy` changes pass.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3197@9ccd27dcf31bfa7cb9964f74220d3d381b67c700

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
