---
kind: epic
parent: "866"
status: open
relatedReport: reports/2026-06-22-backlog-split-analysis.md
dateOpened: "2026-06-22"
tags: []
---

# Migrate WE-docs code-sample/code-frame surfaces to FUI blocks/code-view (mode-C mount)

Umbrella for migrating the ~71 `<pre>`/code-sample/code-frame surfaces to FUI blocks/code-view (#924) via
the mode-C inline mount proven by #1598. **2nd-level slice (2026-06-22, `/slice`, see relatedReport)** —
split by include-family (all ≤3), each child `blockedBy #1598`:

- **#1604** — `we:src/_includes/block-descriptions/` (~34) · size 3
- **#1605** — `we:src/_includes/research-descriptions/` (~18) · size 2
- **#1606** — `we:src/_includes/project-*` + plug-descriptions + misc + top-level `we:src/*.njk` (~19) · size 2
