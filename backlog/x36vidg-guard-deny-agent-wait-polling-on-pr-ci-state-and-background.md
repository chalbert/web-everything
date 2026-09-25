---
kind: story
size: 3
status: resolved
scaffoldedBy: "guard-bash-wait-polling"
dateScaffolded: "2026-09-25"
scope: ["we:scripts/guard-bash.mjs", "we:skills-src/conveyor"]
dateOpened: "2026-09-25"
dateResolved: "2026-09-25"
tags: []
---

# Guard: deny agent wait-polling on PR/CI state and background task output

~600 transcripts since 2026-09-24 show ~17h of idle wait-polling: lane workers loop sleep around gh pr view mergedAt/labels/gh pr checks (drain owns merge+CI), and review/lane agents sleep-poll their own tasks/<id>.output after Claude Code auto-backgrounds >2min gating commands. Extend we:scripts/guard-bash.mjs to deny both loop shapes in dispatched sessions (warn/allow interactive), and fix the auto-background trigger at source: worker briefs run gating commands in the foreground with explicit timeout, dispatcher sets BASH_DEFAULT_TIMEOUT_MS/BASH_MAX_TIMEOUT_MS.

## Done when

1. **Executable** — `npx vitest run we:scripts/__tests__/guard-bash-wait-poll.test.mjs` passes (fails before: no
   `waitPollKind` export). Real transcript commands are denied for a subagent / dispatched payload and only warned
   for the interactive session; one-shot `gh pr view`, `gh pr checks`, and non-PR poll loops pass.
2. **Live replay** — of 17,677 Bash commands in the 2026-09-24/25 transcripts, the classifier flags 372 (all
   genuine PR/CI or background-output polls: ~9.5h + ~12h wall time), with one extra hit, a real
   `gh pr checks --watch`.
3. **Source of the 2-min trigger** — worker briefs (delivery, fix, ci-heal, dispatched-agent system prompt,
   /workflow lane brief) say FOREGROUND + explicit `timeout: 600000` and report-and-exit; the /workflow brief no
   longer says to background `pr-land` and passes `--timeout-min=9`; `we:scripts/operations/dispatch-lane-io.mjs`
   passes `BASH_DEFAULT_TIMEOUT_MS`/`BASH_MAX_TIMEOUT_MS=600000` in every dispatch's `--settings` env.

## Follow-ups (not in this item)

- `we:scripts/operations/review-dispatch.mjs` should adopt `resolveDispatchSettingsEnv` (left alone: it is being
  replaced concurrently). Review sessions were the biggest background-output pollers (135 of 282 hits) and carry no
  `agent_id`/`WE_DISPATCH_KIND`, so today they only get the warning.
- `open-pr` has no `timeoutMin` input, so the delivery brief cannot bound `pr-land`'s 15-min check wait under the
  10-min Bash ceiling the way the /workflow brief now does.
- A poll written as a `python3 - <<EOF` heredoc (2 hits) is not caught — heredoc bodies are data to this guard.
