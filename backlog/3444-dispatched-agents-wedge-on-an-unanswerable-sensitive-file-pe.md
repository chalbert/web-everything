---
bornAs: x6vqcow
kind: task
parent: "3383"
status: resolved
dateOpened: "2026-09-01"
dateStarted: "2026-09-03"
dateResolved: "2026-09-03"
relatedTo: ["3149", "3435"]
scope: ["we:skills-src/conveyor", "we:skills-src/review"]
tags: [conveyor, dispatch, permissions]
---

# Dispatched agents wedge on an unanswerable "sensitive file" permission prompt when writing scratch files to their own job tmp dir

Found live 2026-09-01, closing out this same session. Four separate dispatched background sessions
(`prepare-3438`, `prepare-3435`, `prepare-3441`, `conveyor-3442`) independently got stuck in
`claude agents --json`'s `state: blocked` / `waitingFor: permission prompt`, each asking the operator to
approve a Bash command touching that session's OWN private job scratch directory
(`~/.claude/jobs/<session-id>/tmp/...`), flagged "a sensitive file". Two exact commands seen via
`claude logs <id>`:

1. `mkdir -p ~/.claude/jobs/59fc54a1/tmp && cat > ~/.claude/jobs/59fc54a1/tmp/3438-commit-msg.txt <<'EOF' ...`
2. `mkdir -p ~/.claude/jobs/6200d873/tmp; npm run check:standards > ~/.claude/jobs/6200d873/tmp/check.log 2>&1; echo "EXIT=$?"`

Both are completely benign — a dispatch writing its own scratch files before committing, or capturing its
own gate output to read back. Nobody is present to answer these prompts for an unattended dispatch, so each
session sits blocked indefinitely — the exact "awaiting-permission … three sessions held one for 211.4
hours" hazard `we:scripts/conveyor/reconcile-core.mjs`'s own docblock already documents, and the same failure
class `#3149` exists to *surface* — this item is the *prevention* half `#3149` explicitly does not attempt
("the runtime detection that doesn't replace" a config-side widening).

## Root cause (verified against the actual current code and config, not guessed)

**A settings-level fix was tried tonight and failed to close the gap.** The operator's own personal, global
Claude Code configuration (stored under `~/.claude`, outside any repo) already had two exact Bash-prefix
allow rules added for these two shapes, plus `~/.claude/jobs` added as a trusted additional directory. This
did **not** stop the second command above (`conveyor-3442`) — a different command shape reaching the same
directory. Separately, **this repo's own committed** `we:.claude/settings.json` already allow-lists bare
`"Bash"`, `"Edit"`, `"Write"` outright — a session started with this repo as its cwd should inherit that
blanket grant — and the prompts still fired. Two independent, differently-shaped permission grants (one
narrow/prefix-based, one blanket) both failed to suppress the same prompt class. That is strong evidence the
"sensitive file" categorization sits **above** ordinary allow-list/permission-mode resolution — a hard-coded
Claude Code protection, not a gap in this repo's config, and not something a wider allow-list can close (Bash
allow rules match by literal command **prefix**, and there is no way to enumerate every possible command
shape a dispatched agent might use to write into its own scratch dir).

**The dispatch tooling's reachable knob doesn't close it either.** `we:scripts/operations/dispatch-lane-io.mjs`
already has exactly the mechanism the task brief asked to check: `AGENT_ARGS_ENV` /
`WE_DISPATCH_AGENT_ARGS` → `agentArgsFromEnv()` → `extraArgs` → `buildAgentArgv()`, read at the
`we:scripts/operations/run.mjs` binding (`createDispatchSinks({ extraArgs: agentArgsFromEnv() })`) and
reused verbatim by `we:scripts/operations/review-dispatch.mjs`. `#3383`'s own session log (its "3412"
section) already root-caused a *different* stuck-prompt class this same epic hit — `acceptEdits` does not
suppress prompts for a `--bg` dispatch, but `--permission-mode dontAsk` does — and recorded a real successful
dispatch using `WE_DISPATCH_AGENT_ARGS='["--permission-mode","dontAsk"]'`. That fix is real for *ordinary*
tool-permission prompts. It is **not proven** against the sensitive-file class this item is about: nothing
in tonight's evidence shows `dontAsk` (or any permission mode short of `bypassPermissions`) was in effect for
the four stuck sessions, and — per the same `#3383` finding — `bypassPermissions`
(`--dangerously-skip-permissions`) requires a real TTY and cannot be scripted, so it is not an option for a
headless `--bg` dispatch regardless. `claude --help` (checked directly, `claude 2.1.x`) confirms there is no
third, narrower flag between the two: `--permission-mode <acceptEdits|auto|bypassPermissions|manual|dontAsk|plan>`
and `--allowedTools`/`--disallowedTools` are the whole permission-shaping surface; nothing lets a caller mark
one specific directory as categorically non-sensitive at spawn time. **If a Claude Code product change ever
adds such a knob, it would be the cleaner fix — today it does not exist, so this item does not rely on one.**

**The actual mechanism creating the exposure:** every Claude Code session (interactive or `--bg`) is handed a
per-session scratchpad path in its own system prompt; for a background job that path is
`~/.claude/jobs/<session-id>/tmp/`. Neither `we:skills-src/conveyor/delivery-agent-brief.md` (step 8's
`<msgfile>`, step 5's captured gate output) nor `we:skills-src/conveyor/dispatched-agent-system-prompt.md`
(the standing identity appended to every conveyor dispatch — build, prepare, and prepare-decision, via
`createDispatchSinks`'s `systemPromptFile: DISPATCHED_AGENT_SYSTEM_PROMPT_FILE`) tells the agent *where* to
put an ephemeral file it needs on disk. Left unspecified, a dispatched agent naturally reaches for the
harness-provided scratchpad — the one path that turns out to be the one Claude Code itself treats as
sensitive. **The dispatched agent already has a normal, already-trusted, already-fully-permitted place for
this: the lane clone it acquires in its own first step.** A lane clone is an ordinary git-tracked project
directory this dispatcher already grants full Edit/Write/Bash access to (it's where the agent does the
entire build); nothing about it resembles the dot-directories-under-home-directory shape that appears to
trigger the sensitive-file heuristic. Note: `dispatchReview` (`we:scripts/operations/review-dispatch.mjs`)
does **not** currently pass `systemPromptFile` to `buildAgentArgv` at all, so a dispatched review has no
standing identity file today — out of this item's scope to fix (that's a pre-existing gap in `#3383`'s own
system-prompt wiring), but it means the fix below must also land directly in
`we:skills-src/review/review-agent-brief.md`'s own prose, not only in the standing-identity file, or a
review dispatch won't see it.

## The fix

1. **`we:skills-src/conveyor/dispatched-agent-system-prompt.md`** (present on every build/prepare/
   prepare-decision dispatch) — add an explicit, standing rule: never write a scratch/temp file to the
   harness's own job-scratch directory or to `/tmp`; create and use a scratch location **inside the lane
   clone acquired in step 1** (e.g. a gitignored subdirectory) for anything ephemeral — a commit-message
   file, captured command output, a PR-body file. State plainly *why*: a write to the harness's own
   job-scratch path can be categorized as touching a sensitive file and produce an unanswerable permission
   prompt with nobody watching, which is the exact failure this standing identity exists to keep a dispatched
   agent out of.
2. **`we:skills-src/conveyor/delivery-agent-brief.md`** — step 8's `<msgfile>` and step 5's gate-log capture
   are the two concrete places this item was actually observed; point both at the lane, not an unstated
   location, so the brief models the behavior the system prompt now mandates rather than leaving it to be
   inferred.
3. **`we:skills-src/review/review-agent-brief.md`** — add the same one-line rule directly in the brief's own
   prose (not only relying on the standing-identity file), since `dispatchReview` does not currently pass a
   `systemPromptFile` at all (see Root cause above).
4. Do **not** treat widening permission config — personal or repo-level, a narrow prefix rule or a blanket
   grant — as the primary fix here; tonight's evidence is that neither reliably suppresses this prompt class.
   Setting a non-prompting `--permission-mode` (e.g. `dontAsk`, per `#3383`'s existing finding) remains a
   reasonable *general* hygiene default for a dispatch, but must not be relied on as the fix for *this* gap.

## Done when

1. **Executable** — a test asserts `we:skills-src/conveyor/dispatched-agent-system-prompt.md` contains a
   rule naming the job-scratch directory shape as a location a dispatched agent must not write scratch files
   to, and that it directs scratch writes into the lane clone instead. Mirror the assertion for
   `we:skills-src/conveyor/delivery-agent-brief.md`'s two concrete write sites and for
   `we:skills-src/review/review-agent-brief.md`'s own prose — a grep-shaped test is sufficient; these are
   markdown prompt templates, not executable code.
2. Re-read this card's own evidence against the *live* code before building (per the task's own instruction
   this card was born from) — confirm the two brief files and the standing-identity file still read the way
   they were found here; a landed sibling item in this same epic (`#3383` has several open in-flight cards
   touching `we:skills-src/conveyor/`) could have already changed one of them.
