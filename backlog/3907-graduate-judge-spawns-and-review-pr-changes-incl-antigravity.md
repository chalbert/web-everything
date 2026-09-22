---
bornAs: xgacnhr
kind: story
size: 5
parent: "3443"
status: open
blockedBy: ["3901", "3893", "3897"]
scope: ["we:scripts/lib/__tests__/antigravity-judge-spawn.integration.test.mjs", "we:scripts/lib/__tests__/antigravity-judge-spawn.test.mjs", "we:scripts/lib/__tests__/codex-judge-spawn.test.mjs", "we:scripts/lib/__tests__/judge-panel.test.mjs", "we:scripts/lib/__tests__/judge-spawn.test.mjs", "we:scripts/lib/__tests__/review-core.test.mjs", "we:scripts/lib/__tests__/review-escalation.test.mjs", "we:scripts/lib/antigravity-judge-spawn.mjs", "we:scripts/lib/codex-judge-spawn.mjs", "we:scripts/lib/judge-panel.mjs", "we:scripts/lib/judge-spawn.mjs", "we:scripts/lib/jury-core.mjs", "we:scripts/lib/review-core.mjs", "we:scripts/lib/review-escalation.mjs", "we:scripts/lib/review-render.mjs", "we:scripts/merge-ai-prs.mjs", "we:scripts/operations/__tests__/review-loop-cli.test.mjs", "we:scripts/operations/__tests__/review-pr-io.test.mjs", "we:scripts/operations/__tests__/review-pr.test.mjs", "we:scripts/operations/cli-adapter.mjs", "we:scripts/operations/record-verdict-io.mjs", "we:scripts/operations/review-loop-cli.mjs", "we:scripts/operations/review-pr-io.mjs", "we:scripts/operations/review-pr.mjs", "we:skills-src/review/review-agent-brief.md", "we:scripts/operations/__tests__/judge-provider-port.test.mjs", "we:scripts/operations/__tests__/judge-provider-selection.test.mjs", "we:scripts/operations/__tests__/juror-flags.test.mjs", "we:scripts/operations/__tests__/record-verdict-cli.test.mjs", "we:scripts/operations/__tests__/helpers/fake-claude.mjs", "we:scripts/lib/__tests__/fixtures/panel-mandate.correctness.pre-3094.txt"]
dateOpened: "2026-09-22"
tags: []
---

# Graduate judge spawns and review-pr changes (incl. antigravity-judge-spawn) from lane/mechanical-dispatcher to main

Ports 17 files (we:scripts/lib/antigravity-judge-spawn.mjs, we:scripts/lib/codex-judge-spawn.mjs, we:scripts/lib/judge-spawn.mjs, we:scripts/lib/judge-panel.mjs, we:scripts/lib/jury-core.mjs, we:scripts/lib/review-core.mjs, we:scripts/lib/review-escalation.mjs, we:scripts/lib/review-render.mjs, we:scripts/operations/review-pr.mjs, we:scripts/operations/review-pr-io.mjs, we:scripts/operations/record-verdict-io.mjs, we:scripts/operations/review-loop-cli.mjs, we:scripts/operations/cli-adapter.mjs, we:scripts/merge-ai-prs.mjs, we:scripts/lib/model-capability-ratings.mjs, we:scripts/lib/model-capability-ratings.json, we:skills-src/review/review-agent-brief.md) plus their tests. we:scripts/operations/review-pr.mjs, we:scripts/operations/cli-adapter.mjs and we:scripts/lib/codex-judge-spawn.mjs were also changed on main: diff-merge. Main also changed these files, so each gets a diff-merge: we:scripts/operations/review-pr.mjs, we:scripts/operations/cli-adapter.mjs, we:scripts/lib/codex-judge-spawn.mjs. Graduation slice of epic #3443 (see its Slice procedure). FAITHFUL PORT: no behaviour change while porting; the branch code lands as-is (operator, 2026-09-22). Port from snapshot ff1618065 of origin/lane/mechanical-dispatcher. For every file main has changed since the merge base ca7e68b71 (check with git log ca7e68b71..origin/main -- <file>), apply the branch diff onto main's current file; never copy the branch file over it. Add only this slice's own lines to we:scripts/operations/run.mjs and the we:scripts/operations/__tests__/http-adapter.test.mjs pin (append-only, so parallel slices merge cleanly). Full gate on main's tree: check:standards, test, smoke. HOLD: do not dispatch until the operator confirms agent routing works (2026-09-22). Filed with --queue=false.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
