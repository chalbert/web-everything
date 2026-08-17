---
kind: story
size: 3
status: open
parent: "3029"
dateOpened: "2026-08-17"
tags: [operations, epic-3029, documentation, observability]
---

# Architecture-artifact drift checker, then generator: keep target-architecture docs code-visible

Surfaced 2026-08-17: an external design artifact ("One operation, every caller") describing the operations
engine's target architecture had drifted materially out of date — its "not yet built" footer was false,
6 operations existed that it never named, and a risk it flagged as unresolved had actually been resolved in
code 9 days after the artifact was written. Finding and fixing this required manually fetching the artifact,
dispatching a 3-agent committee, and hand-patching it — real cost, and nothing about the process would repeat
automatically next time the code moves.

## Why "I'll remember to check it" isn't the fix

That's the same blind spot as `#3149`'s stuck-permission-prompt bug: a standing promise to remember is not a
mechanical trigger, so it fails silently the same way. The fix has to be something triggerable, not something
relying on anyone's memory.

## Shape — two bars, not one

**Interim (cheap, buildable now):** a script that pulls load-bearing facts straight from code — the
`we:scripts/operations/run.mjs` OPERATIONS registry (names, step composition), an epic's child-item status —
and diffs them against what a given artifact/doc currently claims. Triggerable on demand or on a schedule, not
dependent on anyone remembering to ask.

**Target (the actual goal):** generate the factual tables/diagrams directly from the operations registry and
backlog data, the same way `we:AGENTS.md`'s inventory count already does in this repo (`npm run gen:branding`
is the same pattern, one repo over, in `plateau:package.json`). If the artifact's operation catalog and
step-composition tables are generated rather than hand-typed, drift becomes structurally impossible rather
than merely checked less-badly. The "four step kinds
are exhaustive" design intention could become a real lint (error if any operation declares a step kind outside
compute/judge/confirm/effect) rather than a stated intention nobody enforces.

Build the interim script first; let what it needs to check inform exactly what the generator has to produce.

## Done when

1. **Executable** — a script that, given a target doc/artifact and a set of factual claims to check (starting
   with the operations registry and one epic's child-status), reports which claims are stale; a test with a
   deliberately-stale fixture doc asserts it's flagged, and a fresh one asserts it's clean.
