---
kind: story
size: 3
status: open
scope: ["we:scripts/conveyor/reconcile-core.mjs", "we:scripts/conveyor/review-status-tag.mjs", "we:scripts/guard-bash.mjs", "we:scripts/conveyor/fix-procedure.mjs", "we:scripts/conveyor/__tests__/reconcile-core.test.mjs", "we:scripts/conveyor/__tests__/review-status-tag.test.mjs", "we:scripts/__tests__/guard-bash.test.mjs", "we:scripts/conveyor/__tests__/fix-procedure.test.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2821's independent review

Filed mechanically by the unattended review loop (#2749) — every finding below reduced chalbert/web-everything#2821's review (reviewed head `ed579aa5187987c1d2951583c27bcb9822b58856`) to prevention-outstanding by naming a guard neither captured nor filed:

1. `we:scripts/conveyor/reconcile-core.mjs:1348` — A unit test that dispatches twice for the same PR — once right after re-arm (expect altBranch present) and once for a later, unrelated bounce (expect altBranch absent) — would catch this; none of the existing tests assert absence of altBranch on a later tick.
2. `we:scripts/conveyor/review-status-tag.mjs:99` — A review-status-tag test that supplies both a live conflict-mode fix session AND a non-null fixClaim together, asserting the result stays `fixing-conflict` — i.e. an explicit precedence test whenever a new early-return branch is inserted ahead of existing state-producing branches.
3. `we:scripts/guard-bash.mjs:2994` — Add an integration-style regression test that runs the real decide()/reason() (not the pure resolvePushDestination alone) against a live throwaway git repo for `git checkout <claimed-lane-branch> && MAIN_PUSH_OK=1 git push` while a fix claim is held, asserting refusal; more durably, make the implicit-target resolution fail-closed by refusing any bare/argless push outright whenever ANY fix claim is live in the repo, rather than trying to resolve which specific branch it targets.
4. `we:scripts/conveyor/fix-procedure.mjs` — Add a deterministic destination-resolution test matrix covering push.default=matching and remote.<name>.push refspecs, requiring every potentially updated claimed branch to be checked.
5. `we:scripts/guard-bash.mjs:3752` — Add a deterministic hook integration test with two pushes to different repositories and a claim belonging only to the second destination; resolve and enforce claims separately for every push.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
