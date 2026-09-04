---
kind: story
status: open
size: 2
dateOpened: "2026-09-04"
tags: [personal-infra, tooling, out-of-scope-for-we]
---

# Personal cross-project Claude Code skills repo — migrate skills built into webeverything as a stopgap

**Scope flag: this is NOT a webeverything product feature, standard, or delivery-mechanism
improvement.** It is the operator's own (Nicolas's) personal infrastructure, captured here only
because webeverything happens to be the repo that is committed and backed up to a remote right
now. It is deliberately left **parentless** — it does not belong under epic
[#3383](/backlog/3383-a-background-mechanical-dispatcher-replaces-the-interactive.md) or any other
WE epic, since it is orthogonal to WE's own tree. (No precedent for a standalone personal-infra
card was found in the existing backlog on a sweep before filing this — if one turns up later, this
item should probably be re-parented or cross-referenced to it.)

## Why this card exists

On the night of 2026-09-04, two skills were authored into this repo's `skills-src/` —
[we:skills-src/mechanical-delivery-doctrine](../skills-src/mechanical-delivery-doctrine) (landed via
PR #1901) and an agent-health-inspection skill — that are genuinely generic Claude Code
orchestration utilities. Neither is specific to webeverything's own standards, backlog, or
delivery mechanics; both would be just as useful on a completely unrelated project.

The operator's own words when this came up in conversation:

> "I use the repo so it is committed and backed up on remote, but you are right this is
> temporary, we will have to use a personal ai skill repo at some point."

The need underneath that: a place for cross-project Claude Code skills, commands, and durable
personal instructions that isn't tied to any one project's repo. Today that content either lives
loose under `~/.claude/` (not backed up, not version-controlled in a real remote) or gets stuffed
into whichever project repo is open at the time — webeverything, tonight, as an explicit,
acknowledged stopgap.

## Candidate scope (not to be built now — captured for whenever this gets picked up)

1. **Stand up a new private repo** (GitHub or wherever the operator already hosts private repos)
   to hold personal Claude Code skills, commands, and instructions that apply across all projects —
   not tied to any one repo.
2. **Migrate the skills that were built into webeverything specifically because no better home
   existed yet.** At minimum: `we:skills-src/mechanical-delivery-doctrine` (if it is still generic
   by the time this is picked up — it may have grown webeverything/epic-#3383-specific content by
   then, in which case only the generic residue migrates) and the new agent-health-inspection
   skill. Both should be treated as having been marked "may migrate" at authoring time, even though
   neither skill file itself carries that literal marker today — this card is where that migration
   would actually happen.
3. **Open question — cross-project skill discovery/loading.** It is not established whether
   Claude Code today supports discovering or loading skills/commands from a location outside the
   current project (a second skills root, a symlink, a plugin-style reference, etc.), or whether
   that needs its own investigation/feature request first. Don't assume either way going in —
   resolving this question is itself part of the eventual work, not a prerequisite already known
   to be satisfied.

## Done when

This item is exploratory/planning in nature (a personal-infra migration, not a WE deliverable), so
"done" here means the above scope has been actually built and the two named skills have moved out
of webeverything, not just documented:

1. **Executable** — a private cross-project skills repo exists, `we:skills-src/mechanical-delivery-doctrine`
   and the agent-health-inspection skill (or their still-generic residue) no longer live in
   webeverything's `skills-src/`, and Claude Code sessions can load them from the new location —
   verified by running a session outside webeverything and confirming the migrated skill(s) are
   available.
