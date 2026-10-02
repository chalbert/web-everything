---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:src/wip/progress-read.ts", "we:src/wip/wip-api.ts", "we:src/wip/wip-source.test.ts", "we:src/wip/wip-view.ts", "we:src/wip/wip-view.css", "we:src/wip/__tests__/progress-read.test.mjs", "we:src/wip/__tests__/wip-api.test.mjs", "we:src/wip/__tests__/wip-view.test.mjs"]
dateOpened: "2026-10-01"
tags: []
---

# Prevention — Add a contract test that feeds an old-mtime plan through readWip and asserts sources.policy.status is not '… (from chalbert/plateau-app#189 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:src/wip/progress-read.ts:136` — Add a contract test that feeds an old-mtime plan through readWip and asserts sources.policy.status is not 'stale' and observedAt is within one tick of nowMs. Separately, pass an explicit observedAt (now) into readPolicy instead of deriving it from mtimeMs.
2. `we:src/wip/progress-read.ts:105` — Have the plan author mark the published region explicitly (e.g. a `&lt;!-- publish --&gt;` fence), or add a deny-list/secret-pattern check on each published section. Add a fixture test with non-ATX section markers.
3. `we:src/wip/wip-api.ts:57` — Pass an AbortSignal to exec so the timeout kills the child process, and cap concurrent orphaned reads. A lint or review lens for 'Promise.race timeout without cancellation' would catch this class.
4. `we:src/wip/wip-source.test.ts:43` — Extract one shared contract fixture and add a deterministic duplicate-large-fixture check to check:standards; this guard remains a future backlog item.
5. `we:src/wip/wip-view.ts` — Add a deterministic renderer regression test using the existing moving-and-held contract fixture, asserting that the held count, description, owner, and next step are visible.
6. `we:src/wip/progress-read.ts:26` — A strict TDD gate or semantic review that requires every explicitly documented behavioral edge case (such as handling duplicate data) to have a matching test assertion.
7. `we:src/wip/wip-view.css:144` — A standard CSS linter (e.g., stylelint) configured to reject duplicate properties within the same declaration block.

Idempotency key (do not edit): approval-prevention-key:chalbert/plateau-app#189@cb0c434e395bd347dcbf7709b50526d3197ffe77

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
