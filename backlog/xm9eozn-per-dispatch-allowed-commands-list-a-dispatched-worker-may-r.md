---
kind: story
size: 5
parent: "3383"
status: open
relatedTo: ["3730", "3752", "3227", "3748", "3149"]
scope: ["we:scripts/operations/dispatch-task.mjs", "we:scripts/operations/dispatch-task-io.mjs", "we:scripts/operations/land-advance-tools.mjs", "we:scripts/guard-bash.mjs"]
dateOpened: "2026-09-21"
tags: []
---

# Per-dispatch allowed-commands list: a dispatched worker may run declared operations only

Operator target (2026-09-21): a dispatched worker's allowed commands are DECLARED OPERATIONS ONLY, from a committed, reviewed allow-list per dispatch kind, passed by `dispatch-task` to the CLI as `--allowedTools`. Extends #3730 (the `dispatch-task` operation) and #3752 (the dispatch prompt and subscription). Design-first and deliberately not cleared for the conveyor: settle the design section, then clear it (the `add` command of we:scripts/conveyor/queue.mjs).

## FOUND (2026-09-21)

- **The CLI has the flags.** `claude --help` lists `--allowedTools, --allowed-tools <tools...>` and `--disallowedTools, --disallowed-tools <tools...>` (run 2026-09-21).
- **The pass-through exists and nothing feeds it.** `dispatch-task` (built 2026-09-21 for #3730; exists only on `origin/lane/mechanical-dispatcher`, absent on main) takes an optional `allowedTools` input, default empty. `allowedToolsArgs` in we:scripts/operations/dispatch-task.mjs emits ONE token `--allowedTools=<list>`, never two, because the CLI declares the option variadic and a second token would swallow the prompt. The input's comment states this card's end state. No caller passes a list.
- **A per-kind table already exists for one caller.** `ALLOWED_TOOLS_BY_KIND` and `allowedToolsArg(kind)` in we:scripts/operations/land-advance-tools.mjs (prototype branch only) give `review`, `fix`, `build`, `ci-heal` and `conflict-fix` their own lists, used by we:scripts/conveyor/session-verdicts.mjs for a stop-and-redispatch. It is close to the target for `review` (declared operations plus `gh pr view/diff/list` and `gh api --method GET`) and far from it for `build`/`fix`, which still grant raw `git add/commit/push/status/diff/log/fetch/rev-parse`, `gh pr create/view/edit` and any `node` script under `we:scripts/`. Two tables would drift, so this card must extend this one, not add a second.
- **What is missing before raw git and gh can be dropped.** Commit, push to a lane ref, fetch and the read helpers have no declared operation. #3227 (open) is the card for the working-tree operations (commit, push, lane-sync); this card depends on it or on a scoped slice of it.
- **The draft list.** The orchestrator built a draft (Tier 1 read-only, Tier 2 scoped repo work, Tier 3 never) from 36 worker transcripts and 5 classifier denials; the operator ruled it acceptable as a TEMPORARY stance. Its contents, as the orchestrator described them: read-only git and grep tools; `git add`, `commit` and `push` to lane refs; `npm ci` and `check:standards`; `npx vitest`; `node we:scripts/operations/run.mjs`; never `--no-verify`, `--force`, `--no-require-verified`, `claude stop`, or settings edits. The list itself is kept in the orchestrator's local notes, not in the repo, and I could not re-derive the 36 and 5 counts, so writing it into a committed file is the first deliverable.
- **Today's enforcement is a denylist by hook.** `dispatchedAgentVerificationReason` in we:scripts/guard-bash.mjs denies the verification set to an agent whose environment carries `WE_DISPATCH_KIND` (build/fix/ci-heal). It blocks named commands; it does not say what a worker MAY run.
- **Trust caveat.** #3748 (open): dispatch clones start untrusted, so the committed permission allow-list is ignored there. Not verified: whether a CLI `--allowedTools` flag is honored in an untrusted checkout.

## DESIGN TO SETTLE

1. **Where the list lives.** Settings permissions, or one committed data file per dispatch kind read by `dispatch-task`. Leaning: one committed file, extending the existing table, because settings are per-checkout and ignored when untrusted. A sibling decision card may be filed for this; keep a single owner.
2. **Which raw commands must become operations first**: commit, push to a lane ref, fetch, read helpers. Reuse #3227; do not declare a second commit operation.
3. **Auto mode and the allow-list.** Does an allowed tool skip the auto-mode classifier, and does an unlisted command prompt (a stall nobody answers) or deny? Needs one live probe; not measured here.
4. **Granularity and review.** Which dispatch kinds get a list (build, prepare, review, task, fix, ci-heal, conflict-fix), and who reviews a change to one: a normal PR, or the statute or leash path.
5. **Fail closed.** A kind with no committed list: refuse the dispatch, or fall back to an empty list.
6. **Migration.** Ship the temporary tiers first as the committed file, then shrink by operation until raw git and gh are gone.

## Done when

1. **Executable** — `npx vitest run we:scripts/operations/__tests__/dispatch-task.test.mjs` passes, with new cases that fail today: for every dispatch kind the operation loads its committed list and puts exactly one `--allowedTools=<list>` token in the spawn argv; a kind with no committed list is refused before any spawn; and no list entry grants a never-item (`--no-verify`, `--force`, `--no-require-verified`, `claude stop`, a settings edit).
2. **Probed live** — one worker launched through `dispatch-task` with its kind's list runs a listed operation, and a raw `git push` it attempts is refused without stalling on a prompt nobody can answer; the probe's output is recorded on this card. This also answers the auto-mode question in the design section.
