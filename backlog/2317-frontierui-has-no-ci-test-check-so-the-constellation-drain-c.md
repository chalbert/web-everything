---
kind: story
size: 3
status: resolved
scaffoldedBy: "batch-2026-07-06-2313-2314"
dateScaffolded: "2026-07-06"
dateOpened: "2026-07-06"
dateResolved: "2026-07-07"
graduatedTo: "frontierui:.github/workflows/ci.yml"
tags: []
---

# frontierui has no CI test check, so the constellation drain can never auto-land its lanes

Frontierui has no .github/workflows at all — zero CI checks on every PR. The constellation drain (we:scripts/merge-ai-prs.mjs) gates on a green required 'test' check, so its isRequiredCheckGreen returns false for every frontierui PR and the drain skips it with 'required check test is not green'. Observed 2026-07-06 finishing #10/#11, which had to be manually squash-merged (the batch-integrator path). Fix: add a real 'test' workflow to frontierui so the drain can gate it like WE lanes (preferred), OR make classifyPr treat a repo with no required-check configured as an explicit, deliberate case rather than a silent skip. Impl lives in the frontierui repo. Relates #2153.
