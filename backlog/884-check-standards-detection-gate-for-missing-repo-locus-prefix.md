---
type: issue
workItem: story
size: 5
parent: "880"
status: open
blockedBy: ["883"]
dateOpened: "2026-06-17"
tags: []
---

# check:standards detection gate for missing repo-locus prefixes (warn-level)

Add a check to scripts/check-standards.mjs that scans the existing raw backlog/*.md (:443) and reports/*.md (:591) loops for path-like tokens — regex [\w./-]+\.(ts|tsx|js|mjs|cjs|json|md|njk|css|html|yml|yaml)(:\d+(-\d+)?)? — and flags any lacking a <repo>: locus marker. False-positive carve-outs: fenced code blocks, @scope/pkg specifiers, URLs, and the relatedReport/graduatedTo/crossRef frontmatter fields (WE-relative by construction). Emits WARNINGS only so the build stays green on the un-migrated corpus; #885 flips it to error after migration. Slice B of #880, enforces the #883 convention.
