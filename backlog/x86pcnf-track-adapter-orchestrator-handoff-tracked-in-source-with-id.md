---
kind: story
size: 5
parent: "3740"
status: open
blockedBy: ["xa5m4cy", "x6549sd", "xkbcdq0"]
scope: ["we:scripts/operations/track-source-handoff.mjs", "we:scripts/operations/__tests__/track-source-handoff.test.mjs", "we:.claude/commands/handoff.md", "we:.claude/commands/continue.md"]
dateOpened: "2026-09-20"
tags: []
---

# track adapter: orchestrator handoff, tracked in source, with id-less lines rejected

The orchestrator handoff is a file outside the repository that the handoff command overwrites each time, and that command is not tracked in source today. This slice brings the handoff and continue commands under source control, defines the id-carrying line form for planned work in the handoff, and adds the adapter that ingests any handoff line with no card id. An id-less planned-work line is a hard failure from day one. Design-first, uncleared.

Slice of epic #3740 (design points 4, 5 and 6, the handoff source). Filed uncleared: a design review comes before any build. It carries the per-source table row for this source: trigger is the handoff command, input is the plan and waiting-decision sections of the handoff file, enforcement is hard from day one for id-less planned-work lines.

## Design

**Settled (read from the files, 2026-09-20).**

- The handoff is a single file in the user's Claude directory, outside the repository, that the handoff command overwrites wholesale each time. Its contents are set by the command: the goal, environment gotchas, the plan as a compact list of pull request, disposition and status, what is in flight, decisions waiting on the operator, standing rules.
- The command itself is not in the repository. The session bootstrap reports the handoff and continue commands as stale at the deploy target because they are not tracked in source (`we:scripts/bootstrap-session.mjs`), while the repository holds the other commands under `we:.claude/commands/`. So the first step is to bring both commands under source there; nothing about the handoff format can be enforced until the command that writes it is reviewable.
- Planned work in the handoff is the plan list and the waiting-decisions list. A line there that names work but carries no card id is the leak this epic exists to close, and it is a hard failure from day one.
- A hash id counts as an id (see the landing slice), so a card filed a moment ago satisfies the rule before its number exists.
- Provenance comes from the real path of the handoff file, through the line contract.

**Open (settle in the design review).**

1. Generate versus validate. The handoff is composed by a model from live state each time, and it is overwritten, so a card id written back into it disappears on the next handoff. The reliable fix is to generate the planned-work part of the handoff from the unified planned list by script (the same list card 3736 shows in the wip report), so the model never composes an id-less line. The weaker option is to validate after writing and refuse to report done on a failure. Leaning generate.
2. Where the hard failure is enforced for a file outside the repository: the command's own last step runs the reconcile check and refuses to finish on a failure, or an edit hook on that path. The first works in every session; the second only where hooks load.
3. Whether the handoff counts as orchestrator or as non-operator provenance (open in the line contract slice). It changes nothing about clearing, because the engine always files uncleared.
4. The `continue` command reads the handoff back; its expected shape must change with the writer, so both commands move together in this slice.

## Done when

1. **Executable** — `node --test we:scripts/operations/__tests__/track-source-handoff.test.mjs` passes against a fixture handoff: two plan lines carrying card ids are yielded as matched references and file nothing; one plan line with no id is reported as a hard failure, and the check over the fixture exits 1.
2. **Executable** — the same suite proves idempotency (a second run over the same fixture files nothing) and the pre-flight (a secret-shaped line fails the whole batch).
3. **Executable** — the same suite asserts that `we:.claude/commands/handoff.md` and `we:.claude/commands/continue.md` exist in source and that the handoff command names the id-carrying rule, so the command cannot drift back out of the repository or drop the rule.
