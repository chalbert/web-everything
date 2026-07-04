---
name: guard-bash-matches-push-substring
description: "guard-bash denies ANY Bash command whose text contains the literal git-push string — even inside a grep/echo/comment, not just a real invocation"
metadata: 
  node_type: memory
  type: project
  originSessionId: 8c4013ff-c791-483f-a509-feb273515ab1
---

`we:scripts/guard-bash.mjs` (the PreToolUse Bash guard, #2203 strict lock) blocks a command by matching the literal `git`+`push` string anywhere in the command text, not only a real push invocation. So a read-only `grep -E "git push" …`, an `echo`, or a heredoc/comment that merely mentions it is **denied outright** — the whole Bash call fails with the "direct push to `main` is blocked" message even though nothing pushes.

**Why:** the guard regexes the raw command string for the push verb; it has no parser to tell a real `git push origin main` from the same characters appearing in a search pattern or explanatory text.

**How to apply:** when inspecting push-related code/tooling, do NOT put the literal push phrase in a grep pattern or echo — search for a fragment instead (`grep "push origin"`, `grep "\.mjs.*push"`, or grep a different token), or split the words. If a benign command is unexpectedly blocked, check whether its text just *contains* the phrase. The sanctioned override is the `MAIN_PUSH_OK=1` env prefix, but for a read-only command the right fix is to reword, not override. Candidate backlog fix: tighten the guard to match actual `^git push`/`push`-subcommand invocations, not substrings. Related: [[parallel-workflow-blocked-by-git-guard]], [[never-push-guard-removed]].
