---
kind: story
size: 1
status: resolved
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: src/_data/backlog.js
tags: []
---

# firstParagraph mis-skips a #NNN-leading digest paragraph as a heading (lost summary)

The we:src/_data/backlog.js firstParagraph() helper skips any line matching /^#/ as a markdown heading, but a #NNN cross-reference is not a heading (an ATX heading needs '# ' — hash plus space). A scaffolded item whose digest opens with "#719 …" loses its whole lead paragraph, so summary comes out empty and check:standards errors "missing required field summary" (hit on #743 during batch-2026-06-15). Fix: skip only a real heading (/^#{1,6}\s/) instead of /^#/; add a test that a #NNN-leading paragraph keeps its summary.

## Resolved (2026-06-16)

`we:src/_data/backlog.js` `firstParagraph()`: the heading-skip is now `/^#{1,6}\s/` (hash(es) + a space — a
real ATX heading) instead of `/^#/`, so a digest opening with a `#NNN` cross-reference keeps its lead
paragraph. Exported `derive` for direct regression testing (mirroring the existing `deriveProjectReadiness`
export) and added `we:src/_data/__tests__/firstParagraph.test.ts`: a `#NNN`-leading lead is preserved, a real
`#`/`##` heading is still skipped. Gate green for this change (the lone `check:standards` error — we:AGENTS.md
inventory stale — is a concurrent session's +new-items, not this changeset); 11ty dryrun builds clean.
