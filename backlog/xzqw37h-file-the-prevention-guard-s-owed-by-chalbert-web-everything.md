---
kind: story
size: 3
status: open
scope: ["we:scripts/operations/probation-heal-run.mjs", "we:scripts/lib/model-probation.mjs", "we:scripts/lib/probation-launcher.mjs", "we:scripts/operations/__tests__/probation-heal-run.test.mjs", "we:scripts/lib/__tests__/model-probation.test.mjs", "we:scripts/lib/__tests__/probation-launcher.test.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2819's independent review

Filed mechanically by the unattended review loop (#2749) — every finding below reduced chalbert/web-everything#2819's review (reviewed head `2c4ff2d2cbe0b19f606421cc2f7edec1d196762b`) to prevention-outstanding by naming a guard neither captured nor filed:

1. `we:scripts/operations/probation-heal-run.mjs:130` — Add a unit test in we:probation-heal-run.test.mjs asserting that dead-end outcomes (`gate-red`, `escalated-needs-human`) never call `io.appendScorecard`, mirroring the existing assertion that the mechanical/no-op path appends none — this is a deterministic, script-checkable gate on the same test file already covering the arc.
2. `we:scripts/operations/probation-heal-run.mjs:178` — Add a deterministic post-diff path gate alongside healDiffWithinEnvelope — reject/discard (same as an oversized diff) if any path in the worker's actual diff is isStatuteTierPath or in DISPATCH_MACHINERY_PATHS, or falls outside the dispatch's own declared scope — with a red test asserting a small worker diff touching we:docs/agent/platform-decisions.md is rejected pre-push.
3. `we:scripts/lib/model-probation.mjs:300` — Add a deterministic default-call regression test using otherwise qualifying evidence with a critical miss, and require either the real miss reader or a fail-closed missing-reader result.
4. `we:scripts/lib/probation-launcher.mjs:143` — Use machine-readable, NUL-delimited Git path output with explicit rename handling, and gate the launcher with a temporary-repository integration test covering a renamed file.
5. `we:scripts/operations/probation-heal-run.mjs` — A real-IO unit test for `discardChanges` that creates a new file, intent-adds it, and verifies the file is successfully removed from the working tree.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
