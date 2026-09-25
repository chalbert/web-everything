---
bornAs: xulvi8k
kind: story
size: 8
parent: "4075"
status: open
scope: ["we:scripts/merge-ai-prs.mjs"]
dateOpened: "2026-09-24"
tags: []
---

# Drain pass: dedupe the context vs candidate PR listing (double gh pr list per repo)

Investigating we:xNNN (why the drain pass is slow) found a real, evidenced double network cost in we:scripts/merge-ai-prs.mjs's sweepOnce(): whenever RECONCILE is on (true on every resident-daemon pass — it always passes --label=ready-to-merge), collectContext() already runs an UNSCOPED gh pr list --json number,title,body,labels,statusCheckRollup,headRefName,headRefOid across every constellation repo (the label/only-blind open-PR context), and then the very next step runs a SECOND, --label-scoped gh pr list --json number,title,body,headRefName,headRefOid,baseRefName,mergeable,mergeStateStatus,statusCheckRollup,labels across the SAME repos for the candidate set — two full gh pr list round-trips per repo per pass where one (widened to the superset --json field list) would do. NOT a safe drop-in: classifyPr's own certified = certifyLabel || aiGenerated || humanCleared means simply removing the server-side --label filter and reusing the unscoped context listing verbatim would let an AI-generated-but-unlabelled PR (one pr-land --label-on-green has not yet confirmed green) enter the candidate set — a real regression of the CI-gate the ready-to-merge label enforces. A correct fix reuses collectContext()'s already-fetched openPrContext.prsByRepo (widening its --json fields to the candidate superset, which is free on the same call) and re-applies the --label/--base match CLIENT-SIDE with the exact same semantics gh's own --label/--base flags have, verified against we:scripts/merge-ai-prs.mjs's existing narrowPrsByRepo/buildDrainVerdicts test suites (9 files, ~530 tests) plus new tests pinning the client-side label/base filter to gh's semantics. Scoped out of we:xNNN itself for lack of session budget to verify it as rigorously as a correctness-critical listing/certification path deserves; do this ONLY with real before/after pass-timing evidence (from we:xNNN's new result.timings) showing 'listing' actually dominates a real pass — don't guess.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
