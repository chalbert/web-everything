---
bornAs: x8evojh
kind: story
size: 2
status: open
relatedTo: ["3149", "3153"]
dateOpened: "2026-08-17"
tags: [operations, permissions, observability]
---

# Permission-surfacing query: show current effective allow/deny state on demand

There is no live way to ask "what is currently allowed" without opening `we:.claude/settings.json` (or the
operator's personal home-level settings file, or a lane's own copy) and reading the array by hand. Every
widening landed today (`we#1418`, `we#1422`, `we#1435`) is genuinely visible — checked into git, independently
reviewed, in PR history — but that's visibility *after the fact*, by reading a diff. There's no on-demand
summary.

## Why this is a real gap, not a nicety

Surfaced 2026-08-17 while diagnosing a permission-prompt stall: figuring out what's currently allowed
required manually reading three separate settings files (project `we:.claude/settings.json`, project-local
`we:.claude/settings.local.json`, and the operator's personal home-level settings file) by hand each time,
across multiple incidents in the same session. That's the same shape of gap `#3149` (surface stuck
background-agent permission prompts) closes for *live* blocked sessions — this is the static/pull
counterpart: "would this be blocked" as a query, not just "is something blocked right now."

## Shape

A small operation (or CLI script, doesn't need the full operations-engine ceremony given its size) that:
reads the project settings file, the project-local settings file (if present), and the operator's home-level
settings file; merges them per Claude Code's own precedence rules; and reports, for a given tool + optional
path, whether it's allowed, denied, or would prompt — plus which layer's rule decided it. Not a generator
(that's `#3153`'s job, for architecture docs specifically) — this is read-only introspection over permission
state specifically.

## Done when

1. **Executable** — a query against a fixture set of the three settings layers reports the correct
   allow/deny/prompt verdict and the deciding layer for a handful of test cases (a rule in project settings
   only, a rule in user settings only, a conflict between layers, no matching rule anywhere).
