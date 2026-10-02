---
kind: story
size: 3
status: open
scope: ["we:scripts/__tests__/merge-ai-prs-acceptance-restamp-and-review-coverage.test.mjs"]
dateOpened: "2026-10-02"
tags: []
---

# Prevention — Add a wiring assertion that the decideDrainReviewGate and reconcileDrainReviewPending call sites pass l… (from chalbert/web-everything#3590 review)

Filed mechanically by the unattended review loop (#2749) — every finding below reduced chalbert/web-everything#3590's review (reviewed head `8f3620a76219844260f71209e50ba4d75f7535a8`) to prevention-outstanding by naming a guard neither captured nor filed:

1. `we:scripts/__tests__/merge-ai-prs-acceptance-restamp-and-review-coverage.test.mjs:378` — Add a wiring assertion that the `decideDrainReviewGate` and `reconcileDrainReviewPending` call sites pass `local: isLocalRepo(...)` and a `cwd` derived from `siblingCloneDir` or `escCwd`. Better still, drive the sweep through an injected-exec seam with a sibling-repo PR and assert that no git command runs in the process cwd.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
