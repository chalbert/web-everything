---
kind: epic
parent: "866"
status: resolved
relatedReport: reports/2026-06-22-backlog-split-analysis.md
dateOpened: "2026-06-22"
dateResolved: "2026-06-27"
graduatedTo: none
tags: []
---

# Migrate WE-docs code-sample/code-frame surfaces to FUI blocks/code-view (transient-CE mount)

Umbrella for migrating the ~71 `<pre>`/code-sample/code-frame surfaces to FUI blocks/code-view (#924) via
the **transient-CE mount** (`<we-code-view>`, #1621 rule-7 model — the code-view counterpart to the
#1598/#1758 badge dogfood; the original "mode-C inline mount proven by #1598" framing was **stale**, #1598
was the badge migration that #1621 pivoted off mode-C). **2nd-level slice (2026-06-22, `/slice`, see
relatedReport)** — split by include-family (all ≤3):

- **#1785** — *foundational prerequisite:* the FUI `fui:embed/code-view-in-document.ts` transient-CE embed
  entry (`<we-code-view>`) + the shadow-DOM SSR/FOUC baseline · size 3. The three migration children
  `blockedBy #1785` (re-pointed from the retired `blockedBy #1598`, batch-2026-06-26).
- **#1604** — `we:src/_includes/block-descriptions/` (~34) · size 3 · blockedBy #1785
- **#1605** — `we:src/_includes/research-descriptions/` (~18) · size 2 · blockedBy #1785
- **#1606** — `we:src/_includes/project-*` + plug-descriptions + misc + top-level `we:src/*.njk` (~19) · size 2 · blockedBy #1785
