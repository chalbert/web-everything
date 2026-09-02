---
bornAs: xqyyoje
kind: story
size: 3
parent: "3383"
status: resolved
dateOpened: "2026-08-31"
dateResolved: "2026-09-02"
tags: []
scope:
  - we:scripts/operations/
  - we:skills-src/conveyor/
---

# Give a dispatched delivery agent a static system-prompt identity, separate from its per-item brief

claude --bg already supports --append-system-prompt / --append-system-prompt-file (confirmed against claude --help), completely unused by the current dispatch (we:scripts/operations/dispatch-lane-io.mjs's buildAgentArgv sends only --bg, --session-id, -n, extraArgs, and the trailing prompt). Right now the ENTIRE we:skills-src/conveyor/delivery-agent-brief.md -- both the standing procedure (acquire lane, build, gate, review, PR, exit) and the per-item specifics -- gets substituted into one prompt string per dispatch. That file is 488 lines with PLACEHOLDER tokens interleaved into command examples throughout the whole document, not cleanly split into a static block and a dynamic one -- so a full restructuring into two files is a real rewrite with its own risk, out of scope here. What IS small and directly targets a concrete, live-observed failure: tonight's #3416 live-fire re-verification dispatched a real agent (conveyor-3412) that read its own fully-substituted, real brief and WRONGLY concluded it was just a template with no instruction attached -- then asked a free-form question instead of proceeding, with nobody there to correct it. A short, static system-prompt (via --append-system-prompt, sourced from a new small file, not folded into the per-item brief) stating plainly that a dispatched agent's prompt IS a real, fully-substituted work order -- never a template artifact to second-guess -- directly targets that exact misjudgment, cheaply and testably, without touching the large, well-tested brief-filling machinery.

## Landed

**`we:scripts/operations/dispatch-lane-io.mjs`'s `buildAgentArgv`** gained an optional `systemPromptFile`
parameter: when given, inserts `--append-system-prompt-file <path>` ahead of `extraArgs` and the prompt.
Stays PURE (no fs, no implicit path) — the new `DISPATCHED_AGENT_SYSTEM_PROMPT_FILE` constant resolves the
real path by script location, and `createDispatchSinks`'s real dispatch call now always passes it. New file
`we:skills-src/conveyor/dispatched-agent-system-prompt.md` — short, static, present on every dispatch
unchanged — states plainly that a dispatched agent's prompt is a real, fully-substituted work order, never a
template artifact, and that a genuine blocker gets one of the prompt's own structured returns (`not-ready`,
`blocked-on-infra`, …), not a free-form question.

1. **Done — argv-level, proven two ways.** `we:scripts/operations/__tests__/dispatch-lane.test.mjs` gained a
   unit test pinning the exact argv shape with and without `systemPromptFile`, plus the existing full-argv
   pin updated to include the flag (a real dispatch always carries it now).
   `we:scripts/operations/__tests__/dispatch-spawn-live.test.mjs` and its
   `we:scripts/operations/__tests__/helpers/fake-claude.mjs` shim were extended to parse and accept
   `--append-system-prompt-file` the way a commander-style CLI does — the same fidelity bar this file already
   holds every other dispatch flag to — so this is proven ACCEPTED by a CLI that parses like the real one,
   not merely spelled correctly. `claude --help` (CLI 2.1.251) independently confirms the flag itself is
   real. 33 test files / 1225 unit tests + the integration-tier live-spawn suite (7 tests) green;
   `check:standards` 0 errors.
2. **Not claimed, and honestly can't be by a mutation test: whether this actually stops a dispatched agent
   from misjudging a real brief as a template, the way `conveyor-3412` did tonight.** That is a behavioral
   claim about what a live agent does with its own system prompt, not a deterministic argv shape — the same
   epistemic line that same live-spawn test file's own docblock already draws ("does not run a model, spend
   a token, or prove an agent does useful work"). Worth watching on the next real dispatch, not asserted here.
