---
bornAs: xyoz01e
kind: story
size: 3
parent: "2649"
scope: ["we:skills-src/jury/"]
status: resolved
dateOpened: "2026-07-25"
dateResolved: "2026-07-25"
tags: [jury, harness, dogfood]
---

# Jury harness: meta must be a pure literal (blocks Workflow launch) + accept a material-file

A live dogfood run of `/jury` (pr-diff on PR #719) surfaced two bugs the unit tests + adversarial review missed.

(1) **BLOCKING:** [we:skills-src/jury/subject-jury.workflow.js](../skills-src/jury/subject-jury.workflow.js)'s
`meta.description` and `meta.whenToUse` are built with string concatenation (`'...' + '...'`), but the Workflow
runtime requires `meta` to be a PURE LITERAL — launching via `Workflow({scriptPath})` fails with
`meta must be a pure literal: BinaryExpression`, so the harness cannot run at all. Fix: make description/whenToUse
single string literals (no `+`).

(2) **Usability:** the harness only accepts `material` inline, so a real multi-hundred-line diff can't be juried
without pasting it — add a `materialFile` arg (a path the resolve step / a juror reads) so a caller can point at a
diff/design/prose file.

Reference: dogfood on 2026-07-25.
