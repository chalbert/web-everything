---
kind: story
size: 3
status: open
scope: ["we:scripts/merge-ai-prs.mjs", "we:scripts/__tests__/merge-ai-prs-acceptance-restamp-and-review-coverage.test.mjs", "we:scripts/__tests__/merge-ai-prs.test.mjs"]
dateOpened: "2026-10-02"
tags: []
---

# Prevention — Extract a single 'is pending still owed beside this accept' predicate used by both reconcile and decide… (from chalbert/web-everything#3590 review)

Filed mechanically by the unattended review loop (#2749) — every finding below reduced chalbert/web-everything#3590's review (reviewed head `8f3620a76219844260f71209e50ba4d75f7535a8`) to prevention-outstanding by naming a guard neither captured nor filed:

1. `we:scripts/merge-ai-prs.mjs:573` — Extract a single 'is pending still owed beside this accept' predicate used by both reconcile and decideReviewGate. Add a property-style test that runs reconcile and then the gate over the label/engineTier/deviation matrix and asserts the gate never re-adds a label reconcile just removed.
2. `we:scripts/__tests__/merge-ai-prs-acceptance-restamp-and-review-coverage.test.mjs:383` — Add a wiring test asserting both call sites pass `local: isLocalRepo(...)` and the per-repo clone dir. Better, make `local` and `cwd` required parameters, or derive them inside one shared helper that takes the repo, so a caller cannot get the guard wrong by omission or by passing a constant.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
