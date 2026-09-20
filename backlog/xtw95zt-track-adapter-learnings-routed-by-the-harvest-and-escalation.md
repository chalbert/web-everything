---
kind: story
size: 5
parent: "3740"
status: open
blockedBy: ["xa5m4cy", "x6549sd", "xkbcdq0"]
scope: ["we:scripts/operations/track-source-records.mjs", "we:scripts/operations/__tests__/track-source-records.test.mjs", "we:skills-src/harvest-learnings/SKILL.md", "we:scripts/converge-cli.mjs"]
dateOpened: "2026-09-20"
tags: []
---

# track adapter: learnings routed by the harvest, and escalation packets

Two structured, machine-written sources need no free-text parsing, only a mapping to intake lines. The learnings source is the harvest routing step, so adjudication stays with the harvest and the raw pool is never ingested. The escalation source is the converge escalation packet, which today is printed rather than kept, so a durable form is settled first. Wip findings are deliberately not a slice here: card 3736 already owns them. Design-first, uncleared.

Slice of epic #3740 (design point 5, the learnings and escalation rows). Filed uncleared: a design review comes before any build. The epic listed these among "the ingest adapters per source"; they are grouped here because both are structured records that map to intake lines with no free-text parsing, and both have an upstream owner that must not be bypassed.

## Design

**Settled (read from the code).**

- Learnings. The pool is machine-local, untracked JSONL (`we:scripts/conveyor/learnings-drop.mjs`), and capture never adjudicates. The harvest (`harvestPool`, `we:scripts/conveyor/learnings-harvest.mjs:251`, driven by `we:skills-src/harvest-learnings/SKILL.md`) dedups across sessions, verifies each note's quoted turn, red-teams the ranked candidates, and only then routes survivors to backlog items or memory. So the track source for learnings is the harvest's routing step, never the raw pool: adjudication stays with the harvest, and track receives only what the harvest has already decided is worth filing.
- Escalation packets. `buildEscalationPacket` (`we:scripts/lib/converge-core.mjs:638`) is pure and its own comment says the caller renders or persists it. The converge command builds it at two points (`we:scripts/converge-cli.mjs:374` and `:432`) and attaches it to a printed instruction. Nothing keeps it, so there is no file an adapter could read. A durable form has to be settled before an adapter exists.
- Both sources are non-operator, so every card they yield carries a non-operator provenance and is filed uncleared.
- Wip findings are not a slice of this epic. Card 3736 already owns them (its part 2: every Attention finding becomes a queued item, deduplicated by rule plus target), and the wip report code it changes lives on the dispatcher branch, not on main. This slice must not duplicate that and cannot cite main files for it. One conflict is recorded for that card's review: it says its findings become queued items, and this epic's rule is that a card from non-operator provenance is filed uncleared. That has to be reconciled there (a finding filed through track, uncleared, then cleared by a decision) and is not settled here.

**Open (settle in the design review).**

1. Kind mapping. The learnings pool uses its own kinds (friction and the like) and four fields; track's kinds are fix, build, decide and note. A small table maps one to the other, and an unmapped kind falls to the default (a card, flagged).
2. Escalation: persist the packet to a per-run file that the adapter reads, or have the converge command hand the packet to track at the moment it escalates. The packet already carries its reason, and an escalation is by definition a call a person has to make, so it maps naturally to a `decide` line. Leaning the second, since it needs no new file to keep in sync.
3. How the harvest files today. If its routing step composes cards by hand, that step is switched to track; if it already goes through `file-item`, this slice only adds the key and the uncleared rule. Read `we:skills-src/harvest-learnings/SKILL.md` first in the design review.
4. Whether escalation packets belong in the first cut at all, given their input form does not exist yet. Cheap to defer to a follow-up card if the review wants a smaller slice.

## Done when

1. **Executable** — `node --test we:scripts/operations/__tests__/track-source-records.test.mjs` passes. A fixture harvest survivor yields one intake line with a non-operator provenance and a mapped kind; a raw pool entry that the harvest has not routed is refused by the adapter.
2. **Executable** — the same suite proves the escalation mapping: a fixture escalation packet yields one `decide` line whose summary carries the packet's reason and whose key derives from the run, so a second run over the same packet files nothing.
3. **Executable** — the same suite proves the pre-flight: a record whose text carries a secret-shaped value fails the whole batch.
