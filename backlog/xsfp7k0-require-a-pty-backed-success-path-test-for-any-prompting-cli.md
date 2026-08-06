---
kind: task
status: open
relatedTo: ["2895"]
dateOpened: "2026-08-06"
scope:
  - we:scripts/lib/read-terminal-line.mjs
  - we:scripts/check-standards-rules.mjs
  - we:scripts/__tests__/check-standards-rules.test.mjs
tags: [gate, testing, cli, prevention]
---

# Require a pty-backed success-path test for any prompting CLI, and single-source the terminal line read

PR #1056's clearance prompt could never succeed because a hand-rolled readFileSync(0) after touching process.stdin threw EAGAIN, and every test targeted the pure decider, so the impure read had no coverage at all.

Prevention (a) of three carved out of the round-1 review of **PR #1056** (#2895's implementation), from finding
**B1**. Filed rather than fixed there because it is a repo-wide rule, not a change to that PR's file set.

## The class

A CLI that prompts a human has two halves: a pure decision over what was typed, and an impure read. #1056
tested the pure half exhaustively and the impure half not at all — and the impure half was **completely
broken**, in a way no refusal-only test could distinguish from working. Two specific footguns produced it:

1. Reading `process.stdin.isTTY` instantiates Node's lazy `tty.ReadStream` on fd 0 and puts that descriptor in
   NON-BLOCKING mode. Every later synchronous read of fd 0 throws `EAGAIN`. Use `isatty(fd)` from `node:tty`.
2. `readFileSync(0)` / `readFileSync('/dev/stdin')` reads to **EOF**, not to a newline, so the operator must
   press Ctrl-D. "Read one line" means `readSync` until `\n`.

## The two guards

- **A pty-backed SUCCESS-path test** for any CLI under `we:scripts/` that prompts. Refusal-only end-to-end runs
  prove nothing: a refusal looks identical whether the gate works or is dead. The working shape is
  [`we:scripts/__tests__/review-clear-human-pty.test.mjs`](scripts/__tests__/review-clear-human-pty.test.mjs)
  — `script(1)` under `sh -c 'cat | script …'`, waiting for the prompt before typing. Reuse it; do not re-derive
  the pty plumbing (the socketpair/`tcgetattr` trap costs an hour every time).
- **A `check:standards` rule** banning a hand-rolled `readFileSync(0)` / `readFileSync('/dev/stdin')` /
  `process.stdin.isTTY` prompt under `we:scripts/`, in favour of ONE shared line-read helper that
  [`we:scripts/review-set-label.mjs`](scripts/review-set-label.mjs)'s `readTerminalLine` graduates into.
  Deterministic and script-decidable, so it is a hook, not a rule an agent has to remember (memory rule #51).

## Done when

- The terminal line read is single-sourced in a helper, and [`we:scripts/review-set-label.mjs`](scripts/review-set-label.mjs)
  uses it rather than its own copy.
- `check:standards` errors on a new hand-rolled stdin prompt under `we:scripts/`, with a message naming the
  helper and the `EAGAIN` reason.
- The rule that a prompting CLI needs a pty-backed success-path test is written where an author will meet it
  ([`we:docs/agent/testing.md`](docs/agent/testing.md)), citing #1056 B1 as the instance.
