---
bornAs: x5ig5om
kind: task
status: open
parent: "3029"
relatedTo: ["3037"]
scope: ["we:scripts/operations/review-pr.mjs", "we:scripts/lib/judge-spawn.mjs"]
dateOpened: "2026-08-17"
tags: [operations, epic-3029, review-pr, bug]
---

# review-pr operation: judge-spawn refuses a tool-bearing juror with no cwd flag to supply one

At least 3 independent reviewers on 2026-08-17 hit the same error trying to use the `review-pr` operation
directly (not via the `JUDGE_LANE_CWD` env-var workaround dispatch prompts have been threading through
manually all day): `judge-spawn: refusing to spawn a TOOL-BEARING juror — no cwd was supplied`, and the
operation exposes no `--cwd` flag to supply one. One reviewer additionally found `--model` isn't a valid
CLI flag on `review-pr` at all (it only accepts `--pr/--repo/--lens/--aim/--actor`), so a dispatch prompt
written with `--model=sonnet` fails outright. Every reviewer who hit this fell back to a fully manual review
instead — the operation works, but only when invoked via an undocumented environment-variable side channel
external callers wouldn't know to use.

## Why this matters

This isn't cosmetic — it's the direct, load-bearing evidence for why "declare once, generate every caller"
(epic #3029) matters. A CLI adapter that silently requires an env var no `--help` output mentions is exactly
the kind of hand-wiring gap the whole epic exists to eliminate; every reviewer today had to independently
rediscover the same workaround by reading dispatch prompts rather than the tool's own interface.

## Done when

1. **Executable** — `node we:scripts/operations/run.mjs review-pr --pr=<N> --repo=<R> --lens=<tool-requiring-lens>`
   succeeds without `JUDGE_LANE_CWD` set, using a `--cwd` flag (or equivalent) the CLI adapter documents in its
   own `--help` output; a test invoking a tool-bearing lens without a manually-threaded env var passes.
2. `--model` either becomes a real accepted flag or is removed from every dispatch-prompt example that
   currently references it, so the two stop diverging.
