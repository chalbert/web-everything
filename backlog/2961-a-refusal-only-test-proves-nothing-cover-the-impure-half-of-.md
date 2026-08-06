---
bornAs: xsfp7k0
kind: task
status: open
relatedTo: ["2895"]
dateOpened: "2026-08-06"
scope:
  - we:scripts/check-standards-rules.mjs
  - we:scripts/__tests__/check-standards-rules.test.mjs
  - we:docs/agent/testing.md
tags: [gate, testing, cli, prevention]
---

# A refusal-only test proves nothing — cover the impure half of a CLI, and ban the hand-rolled stdin read

A gate that always refuses is indistinguishable from a gate that works if every test only ever exercises refusals, and the two stdin footguns that produced that state in PR #1056 are still un-gated and still have a live instance.

Prevention (a) of three carved out of the round-1 review of **PR #1056** (#2895's implementation), from finding
**B1**. **NARROWED after the ceremony was removed** — the original wording required a pty-backed success-path
test for "any prompting CLI", and #2895 ships no prompting CLI at all now (the terminal ceremony was deleted
when #2895 ruled the unforgeable actor signal deferred). What survives is the part that never depended on that
mechanism, and it survives with a live instance.

## The class

A CLI that gates on external state has two halves: a pure decision, and an impure read that feeds it. #1056
tested the pure half exhaustively and the impure half not at all — and the impure half was **completely
broken**: every clearance was refused because the read threw. **A refusal looks identical whether the gate
works or is dead**, so the two "verified end-to-end" runs in the PR description proved nothing, and neither did
any test in the suite. That is general: it applies to any read-then-decide seam, not just to prompts.

Two specific footguns produced that state, and both are deterministic and script-decidable:

1. Reading `process.stdin.isTTY` instantiates Node's lazy `tty.ReadStream` on fd 0 and puts that descriptor in
   NON-BLOCKING mode. Every later synchronous read of fd 0 throws `EAGAIN`. Use `isatty(fd)` from `node:tty`.
2. `readFileSync(0)` / `readFileSync('/dev/stdin')` reads to **EOF**, not to a newline.

**There is a live instance**: [`we:scripts/review-core-cli.mjs`](scripts/review-core-cli.mjs)'s `readJsonInput`
reads `process.stdin.isTTY` and then `readFileSync(0, 'utf8')` — the exact pairing from (1). It has not bitten
yet because the piped path usually wins, which is precisely why a rule beats a memory (rule #51:
script-decidable → hook).

## The guards

- **A `check:standards` rule** banning a hand-rolled `process.stdin.isTTY` + synchronous fd-0 read under
  `we:scripts/`, with a message naming the `EAGAIN` reason. Fix the
  [`we:scripts/review-core-cli.mjs`](scripts/review-core-cli.mjs) instance in the same change, or the rule
  lands red.
- **The testing rule, written where an author will meet it** ([`we:docs/agent/testing.md`](docs/agent/testing.md)):
  when a gate's impure half can fail closed, the suite must contain at least one test that gets *through* it.
  Refusal-only coverage is not coverage. Cite #1056 B1 as the instance.

## Done when

- `check:standards` errors on the `process.stdin.isTTY` + fd-0-read pairing under `we:scripts/`, and
  [`we:scripts/review-core-cli.mjs`](scripts/review-core-cli.mjs) no longer trips it.
- [`we:docs/agent/testing.md`](docs/agent/testing.md) carries the "a refusal-only test proves nothing" rule,
  with the #1056 instance.
- A test pins the rule against a fixture that reintroduces the pairing.
