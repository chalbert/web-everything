---
kind: story
size: 5
parent: "4075"
status: open
dateOpened: "2026-09-27"
tags: []
---

# Run rating: cross-model judge rating (Codex rates Claude runs and vice versa)

Slice (b) of run rating & efficiency (parent #4075). Slice 1 (mechanical grading,
`we:scripts/conveyor/run-rating.mjs`) never reads whether a run's actual CODE was good — only tool-call hygiene, wall time, and
tokens. This item adds a real judge pass on top: Codex judges a sample of Claude-dispatched runs' diffs/
transcripts against a rubric, and Claude judges a sample of Codex-dispatched runs, so the judge is never the
same provider as the worker. Append the judge verdict onto the same scorecard row (`run-scorecard-store`)
alongside slice 1's mechanical grade, never replacing it.

## Done when

1. **Executable** — a command rates N sampled runs' diffs with the OTHER provider as judge and appends a
   `judgeScore`/`judgeFindings` field onto their existing scorecard rows, runnable against a fixture and
   against at least one real recent PR.
