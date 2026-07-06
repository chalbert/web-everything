---
kind: story
size: 3
status: open
dateOpened: "2026-07-06"
tags: []
---

# frontierui has no CI test check, so the constellation drain can never auto-land its lanes

Frontierui has no fui:.github/workflows at all — zero CI checks on every PR. The constellation drain (we:scripts/merge-ai-prs.mjs) gates on a green required 'test' check, so its isRequiredCheckGreen returns false for every frontierui PR and the drain skips it with 'required check test is not green'. Observed 2026-07-06 finishing #10/#11, which had to be manually squash-merged (the batch-integrator path). Fix: either add a real 'test' workflow to frontierui so the drain can gate it like WE lanes, or make classifyPr treat a repo with no required-check configured as an explicit, deliberate case rather than a silent skip. Relates #2153.
