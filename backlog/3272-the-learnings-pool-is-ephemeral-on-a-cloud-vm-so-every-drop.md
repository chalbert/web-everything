---
bornAs: xq6420r
kind: story
size: 3
status: open
dateOpened: "2026-08-25"
tags: []
---

# The learnings pool is ephemeral on a cloud VM, so every drop made there is lost before any harvest reads it

The pool is machine-fixed at `$LEARNINGS_POOL || ~/.claude/conveyor/learnings` — deliberately outside any
repo, so a drop can never leak into a PR. That design assumes a durable `$HOME`. On a cloud VM `$HOME` is
`/root` inside a container reclaimed on idle, so the pool dies with the box. Collection and adjudication are
split on purpose (#2984): sessions only emit, `/harvest` judges later. On a VM there is no later — the write
side works, the read side never runs, and the split silently becomes a discard.

## Why this is not just "remember to harvest before closing"

Harvest is deliberately periodic and cross-session: its whole value is seeing what RECURS across many
sessions, which is also the ranking signal (`--session` exists so the pool can count distinct sessions). A
VM session harvesting its own four entries defeats that — it adjudicates a sample of one, which is the
judgment `/close` is explicitly forbidden from making. So "just harvest at close" is not the fix; it trades
a silent loss for a bad decision.

## Observed

This session (2026-08-25) ran ~9 PRs to merge and dropped nothing until asked point-blank whether learning
had been captured — the pool directory did not exist. Four entries were then written to
`/root/.claude/conveyor/learnings/`, where they will be destroyed when the container is reclaimed. Filing
this item and quoting the entries into it is the workaround, and it is the wrong shape: a backlog item is
the adjudicated output, not the collection buffer.

## The shape question

Three candidate homes, in rough order of how much they preserve the existing design:

1. **A durable path the VM already has.** Nothing under `$HOME` qualifies. The only durable surface on a VM
   is a git ref, which is exactly what the pool is designed not to be.
2. **A dedicated ref, not a working file** — e.g. append to a `refs/notes/learnings` or an orphan branch
   pushed on drop. Keeps drops out of every PR diff (the actual privacy requirement) while making them
   durable. The scrub boundary (`ALLOWED_KEYS`, `FIELD_CAPS`, #3015's `we:scripts/lib/secret-scrub.mjs`) already exists and
   is what makes publishing survivable; this reuses it rather than relaxing it.
3. **Drop-time forwarding** — the VM's pool stays local, and `we:scripts/conveyor/learnings-drop.mjs` additionally posts each
   entry somewhere durable when it detects an ephemeral host (the same `we:scripts/bootstrap-session.mjs` detection).

(2) looks strongest: it is one push per drop, needs no new service, and inherits the scrub. (3) splits the
truth across two stores. (1) does not exist. The call belongs to whoever owns #2984's collection/judgement
split, not to this item.

## Interim rule, until this lands

On an ephemeral host, drops are not durable. Either quote the entries into a backlog item or a PR body
before the session ends, or accept that they are lost — but say which, rather than reporting "captured".
The failure here was not the missing drops; it was that a drop LOOKS like capture and on this host is not.

## Done when

1. **Executable** — a learning dropped on an ephemeral host survives the container: a test drops an entry,
   simulates the reclaim (a fresh `$HOME`), and a subsequent `we:scripts/conveyor/learnings-harvest.mjs` still reads it.
2. **Executable** — the durable write carries the same scrub boundary as the local append: a test pins that
   an entry with a key outside `ALLOWED_KEYS`, or a field over `FIELD_CAPS`, is rejected on the durable path
   too, not just locally.
3. **Executable** — `we:scripts/conveyor/learnings-drop.mjs` never silently reports `✓ dropped` when the write cannot be made
   durable on an ephemeral host; a test pins the warning.
4. The four entries preserved below are recovered from this item into whatever the durable pool becomes —
   or explicitly written off.

## The four entries, verbatim

Quoted here because this file is the only durable copy. They have NOT been adjudicated — that is
`/harvest`'s job and this item must not pre-empt it; they are transcribed as dropped, with one mechanical
edit — the doc-gap suggestion's VM-page filename carries a `we:` locus prefix here, which `check:standards`
requires of every code path in a backlog body and the pool schema does not.

| kind | area | summary | suggestion |
| --- | --- | --- | --- |
| doc-gap | docs/agent + durable-fix rule | A tooling fix that supersedes a documented hand-workaround left the doc still prescribing it; the stale instruction survived two sessions and was caught by luck, not by process. | When a box-local unblock moves into tooling, grep the docs that prescribed it and correct them in the SAME PR. Add that as a step to the durable-fix rule table in `we:docs/agent/vm-sessions.md`, so row one is not considered done until row two is checked. |
| friction | verification harnesses | Verified a guard with a harness that misread its return type (decide() returns a reason STRING, not an object); it reported allow for every case including known-deny ones. Nearly wrote a false claim into a backlog item. | Always include a KNOWN-DENY and a KNOWN-ALLOW control case in any ad-hoc guard harness, and check the controls before trusting any other row. A harness reporting uniform results across contradictory inputs is broken, not informative. |
| friction | review loop | Pushed a commit to a PR already at review:accepted, invalidating the verdict against the reviewed sha and costing a full re-review plus a label round-trip. | Fold every late edit — doc/backlog polish and a base merge included — into the branch BEFORE running review-pr. If the head must move after an accept, budget the re-review rather than treating the old verdict as still standing. |
| improvement | we:scripts/guard-bash.mjs | `we:scripts/guard-bash.mjs` contains a literal NUL byte in a comment, so grep and ripgrep classify the file as binary and skip it without `-a`. Silently hides matches during search. | Replace the literal NUL in the sentinel comment with an escaped representation. Consider a check:standards rule rejecting NUL bytes in tracked text sources, since the failure mode is silent — a search returns nothing rather than erroring. |
