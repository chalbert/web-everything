---
name: worker-brief-requires-live-before-after-proof
description: Every bug-fix brief (my Sonnet workers AND the conveyor fix agents) must demand a live before/after proof on the real system, not just unit tests; the report must carry the evidence.
metadata:
  type: feedback
---

Every brief that asks an agent to fix a bug must demand proof that the fix works on the REAL system. Green unit tests are not that proof. Required shape:

1. **Reproduce first.** Before changing code, show the failure on the real surface (a read-only probe, dry-run, or live query against the actual daemon/PR/pool), and write a test that fails for the same reason.
2. **Fix, then re-run the same probe** with the fixed code (from the lane, read-only or dry-run) and show the failure is gone.
3. **Report the evidence**: the before output and the after output, not "tests pass".

**Why:** 2026-09-23, operator: "make sure the agent that fix bugs actually test it so we know it works." The same day, one worker reported a wrong root cause (it read stale log lines, and the unit tests passed anyway), and several fixes merged with unit tests only while the live PRs stayed stuck. Rule 129 (prove before claiming fixed) already existed, but the briefs never asked for it, so workers never did it.

**How to apply:** paste a PROOF section into every worker brief. After a worker reports, spot-check its evidence live before relaying "fixed". The conveyor's own fix brief (`we:skills-src/conveyor/fix-agent-brief.md`) carries the same requirement. Links: [[index-verif]], rule 129.
