---
kind: epic
size: 21
status: open
scope: ["we:scripts/check-standards.mjs", "we:scripts/check-standards-rules.mjs", "we:scripts/lib/verify-lane-gate.mjs", "we:scripts/readiness/claimScope.mjs"]
dateOpened: "2026-09-25"
tags: []
---

# check:standards lane gate: run on changed + linked files, not the whole repo

The lane gate's check:standards (we:scripts/check-standards.mjs, invoked by we:scripts/verify-lane.mjs via we:scripts/lib/verify-lane-gate.mjs) costs ~16s of one fully-busy core per run (measured 2026-09-25: 12.5s user + 3.7s sys, 1.2GB RSS, zero block I/O; top costs: backlog load 2.7s, statute/anchors 1.5s, citation scan 1.5s, secret sweep 1.4s, verdict-totality 1.1s). It holds one of the 2 host-wide heavy-admission slots (we:scripts/readiness/heavy-admission.mjs, cap deliberately kept at 2) while 8+ lanes queue behind it. Key finding: --local --files=... saves NO time today — all ~50 sections run over the whole repo and findings are only demoted AFTERWARD (we:scripts/check-standards.mjs Local/per-lane gating section). Direction ratified in conversation 2026-09-25: instead of skipping checks, run each check on the changed files plus the files LINKED to them (outgoing and incoming references), found via git grep per changed id (no maintained index; a shared per-origin/main cached index only if git grep proves slow). CI's full unscoped check:standards (we:.github/workflows/ci.yml) stays the authority; lanes touching backlog/, gate-self/policy-core paths, or with a dirty tree keep the full run (unchanged). A replay proof over ~50 recent lane diffs (full vs scoped findings, restricted to lane-own files) gates the scoped mode. Target: typical lane ~16s -> a few seconds, so slots free faster at the same cap of 2. Related: we:backlog/3774-docs-only-changes-run-the-full-local-test-suite-give-backlog.md, #3372 (the unit-test half of the same shrink).

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
