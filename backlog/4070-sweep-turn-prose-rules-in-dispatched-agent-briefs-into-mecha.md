---
bornAs: xf8kork
kind: story
size: 5
parent: "4075"
status: resolved
scope: ["we:skills-src/conveyor/", "we:skills-src/review/"]
dateOpened: "2026-09-24"
dateStarted: "2026-09-29"
dateResolved: "2026-09-29"
tags: []
---

# Sweep: turn prose rules in dispatched agent briefs into mechanical code

2026-09-24 root cause, repeated: dispatched agents skipped prose rules in their briefs (write the completion record, use Edit not Bash for card files, never end a turn on a background wait). Sweep every brief under we:skills-src/conveyor/ and we:skills-src/review/, list each imperative, and for each script-decidable one file or build the hook, wrapper step or gate that enforces it (memory rule 51, hookable vs judgment). Composes with the brief-rule ledger check (pending card x446oxf, under epic #3593), which keeps new prose rules from appearing unenforced; this card converts the existing ones.

## Done when

1. **Executable** — a ledger lists every imperative line in the dispatched briefs with its enforcer (hook,
   wrapper step, gate) or a `judgment` mark; the three rules broken on 2026-09-24 (completion record, Edit
   not Bash for card files, no turn-end on a background wait) each name a code enforcer with a test that
   fails when the rule is broken.

## Progress

- **Ledger** — `we:skills-src/conveyor/brief-rule-ledger.json`, audited by `node we:scripts/conveyor/brief-rule-ledger.mjs`
  (`--json`, `--check`). It lists all 466 imperative lines in the 14 dispatched briefs and system prompts under
  `we:skills-src/conveyor/` and `we:skills-src/review/`, grouped into 49 rules: 116 lines enforced, 172 judgment,
  92 prose-only (16 rules, each naming its proposed enforcer), 86 descriptive (a rule word used to describe the
  system, not instruct the agent). A line that states several rules counts under the weakest one. The check is
  report-only; wiring it into `check:standards` is #4055's.
- **Completion record** — new Stop hook `we:scripts/guard-stop-completion-record.mjs`: blocks ending a turn once while
  this session's own completion record (matched by `sessionId`) or its `$DELIVERY_SESSION` report is still
  `started`. It is registered in the v2 delivery wrapper's hooks-only settings (`DELIVERY_HOOKS_SETTINGS.hooks.Stop`).
  **Not yet registered in `we:.claude/settings.json`**: the dispatched agent's permission layer refused that
  edit. Until someone adds it, review/fix agents are covered only by the reaper backstop. Test:
  `we:scripts/__tests__/guard-stop-completion-record.test.mjs`.
- **Edit, not Bash, for card files** — `we:scripts/guard-bash.mjs#corpusOverwriteTargets` now also denies the
  truncating writes the `>>`/`sed -i` arm missed: a `>`/heredoc redirect, `cp`/`install`, and a `mv` from
  outside the corpus onto a `backlog|reports/*.md`. Test: `we:scripts/__tests__/guard-bash-card-overwrite.test.mjs`.
- **No turn-end on a background wait** — already enforced by `we:scripts/guard-stop-passive-wait.mjs` and the
  guard-bash wait-poll arm; the ledger now tags it.
