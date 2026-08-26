---
kind: task
status: open
scope: ["we:scripts/check-standards-rules.mjs", "we:scripts/__tests__/check-standards-rules.test.mjs"]
dateOpened: "2026-08-25"
tags: []
---

# Lint the machine-coupled test shape: a production derivation helper called with its own DEFAULT real probe

A test that builds its EXPECTED value by calling a derivation helper with that helper's OWN default (real) `exists`/`realpath` probe, while driving the code under test through an injected fake, couples the assertion to the machine: it passes on a host that happens to have the directory or alias symlink and reddens on one that does not. Flag that shape in `check:standards`, or add the narrower rule that an orchestration test passes one explicit probe into BOTH the run and the expectation. Prevention owed by the PR #1566 review (2026-08-26), where exactly this shape hid in `we:scripts/__tests__/bootstrap-session.test.mjs`.

## Done when

1. **Executable** — `npm run check:standards` errors on a fixture test file that calls a production
   derivation helper (one whose signature ends in injected `exists`/`readdir`/`realpath` probes) with fewer
   arguments than the `io` double it drives the same code through, and stays silent on the same file once the
   probe is passed explicitly. Red before this item lands, green after.
2. The rule names the failure in its message — *the assertion is coupled to the machine, not to the code* —
   and points at the narrower escape hatch for a test that genuinely means to read real disk.
