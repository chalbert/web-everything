---
bornAs: x47hwpw
kind: story
size: 2
tier: pinned
parent: "3029"
status: open
dateOpened: "2026-09-06"
tags: []
---

# mutation-check operation has zero skill coverage — no session is told it exists

we:scripts/operations/mutation-check.mjs (#3219, resolved 2026-08-21) declares "does this guard actually fail when the bug it names comes back", built specifically to replace ad-hoc python heredocs patching a file, running vitest, and restoring by hand — a procedure its own header says was run a dozen times by hand in one stretch. No skill names it (checked every skills-src SKILL file for "mutation-check", "we:run.mjs mutation-check" and "operations/mutation-check" — zero hits). Every backlog item that asks a builder to prove a guard is mutation-checked (e.g. we:backlog/3224-check-standards-gate-a-skill-naming-a-raw-home-that-a-declar.md own Done-when) leaves HOW to do that to memory or re-derivation. Add it to whichever skill authors/verifies Done-when criteria (we:skills-src/next-backlog-item/SKILL.md and/or we:skills-src/batch-backlog-items/SKILL.md are the likeliest homes) with the actual invocation: `node we:scripts/operations/run.mjs mutation-check --find=<pattern> --replace=<pattern> --file=<path> --test=<vitest invocation>` (confirm exact flags from we:scripts/operations/mutation-check.mjs before writing the skill text).

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
