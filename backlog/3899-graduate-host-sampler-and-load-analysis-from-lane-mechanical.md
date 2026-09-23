---
bornAs: x6j8mi0
kind: story
size: 8
parent: "3443"
status: open
blockedBy: ["3898", "3895", "3854", "3487"]
scope: ["we:scripts/operations/__tests__/host-sampler-attribution.test.mjs", "we:scripts/operations/__tests__/host-sampler-capacity.test.mjs", "we:scripts/operations/__tests__/host-sampler-classes.test.mjs", "we:scripts/operations/__tests__/host-sampler-episodes.test.mjs", "we:scripts/operations/__tests__/host-sampler-extras.test.mjs", "we:scripts/operations/__tests__/host-sampler-install.test.mjs", "we:scripts/operations/__tests__/host-sampler-large-file.test.mjs", "we:scripts/operations/__tests__/host-sampler-retention.test.mjs", "we:scripts/operations/__tests__/host-sampler-rollup.test.mjs", "we:scripts/operations/__tests__/host-sampler.test.mjs", "we:scripts/operations/__tests__/load-analysis.test.mjs", "we:scripts/operations/__tests__/load-review.test.mjs", "we:scripts/operations/host-sampler-attribution.mjs", "we:scripts/operations/host-sampler-calibrate.mjs", "we:scripts/operations/host-sampler-classes.mjs", "we:scripts/operations/host-sampler-episodes.mjs", "we:scripts/operations/host-sampler-extras.mjs", "we:scripts/operations/host-sampler-install.mjs", "we:scripts/operations/host-sampler-retention.mjs", "we:scripts/operations/host-sampler-rollup.mjs", "we:scripts/operations/host-sampler-selfcheck.mjs", "we:scripts/operations/host-sampler-tail.mjs", "we:scripts/operations/host-sampler.mjs", "we:scripts/operations/load-analysis.mjs", "we:scripts/operations/load-report-cli.mjs", "we:scripts/operations/load-review.mjs", "we:scripts/operations/__fixtures__/load-analysis/runner-audit.jsonl"]
dateOpened: "2026-09-22"
tags: []
---

# Graduate host sampler and load analysis from lane/mechanical-dispatcher to main

Ports 14 files (we:scripts/operations/host-sampler.mjs, we:scripts/operations/host-sampler-attribution.mjs, we:scripts/operations/host-sampler-calibrate.mjs, we:scripts/operations/host-sampler-classes.mjs, we:scripts/operations/host-sampler-episodes.mjs, we:scripts/operations/host-sampler-extras.mjs, we:scripts/operations/host-sampler-install.mjs, we:scripts/operations/host-sampler-retention.mjs, we:scripts/operations/host-sampler-rollup.mjs, we:scripts/operations/host-sampler-selfcheck.mjs, we:scripts/operations/host-sampler-tail.mjs, we:scripts/operations/load-analysis.mjs, we:scripts/operations/load-review.mjs, we:scripts/operations/load-report-cli.mjs) plus their tests. Ordered after E3 because it was still being built on 09-20/21; porting it later avoids porting it twice. Faithful port, same as every slice. Graduation slice of epic #3443 (see its Slice procedure). FAITHFUL PORT: no behaviour change while porting; the branch code lands as-is (operator, 2026-09-22). Port from snapshot 600acc14f of origin/lane/mechanical-dispatcher. For every file main has changed since the merge base ca7e68b71 (check with git log ca7e68b71..origin/main -- <file>), apply the branch diff onto main's current file; never copy the branch file over it. Add only this slice's own lines to we:scripts/operations/run.mjs and the we:scripts/operations/__tests__/http-adapter.test.mjs pin (append-only, so parallel slices merge cleanly). Full gate on main's tree: check:standards, test, smoke. HOLD: do not dispatch until the operator confirms agent routing works (2026-09-22). Filed with --queue=false.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
