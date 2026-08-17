---
bornAs: x6v3qq6
kind: story
size: 2
status: resolved
relatedTo: ["2614", "2610", "2774"]
scope: ["we:.claude/commands/", "we:skills-src/"]
dateOpened: "2026-08-07"
dateStarted: "2026-08-16"
dateResolved: "2026-08-17"
graduatedTo: none
tags: [skill, learnings, discoverability]
---

# Give the learnings pool a human-facing way in — a /note command and a capture skill

The learnings pool has a well-marked exit and an unmarked entrance. `/harvest` carries rich trigger
phrases ("harvest the learnings", "triage the feedback pool"), but the append side —
`we:scripts/conveyor/learnings-drop.mjs` — is reachable only from the closing-session skill and the
conveyor agent briefs. An operator who says "note this" or "save that as feedback" mid-session routes
nowhere: the lesson is written to the wrong home (a scratch file, a backlog item, agent memory) or
lost. For a pool whose value depends on things being put into it, the write path must be at least as
discoverable as the read path. Ship a `/note` command and a capture skill, both routing to the
existing CLI.

## Why this is a real gap, not a nicety

Observed live on 2026-08-07. The operator asked to "save as feedback the same way" and the only reason
it worked is that the session had spent twenty minutes reading the pool's internals. A cold session
would not have found the CLI. Verified by grep: `learnings-drop` appears in
`we:skills-src/closing-session/SKILL.md` and the `we:skills-src/conveyor/` agent-brief files, and
nowhere else — not `we:AGENTS.md`, not `we:docs/agent/`, not agent memory, not `we:.claude/commands/`.
The word "note" appears as a trigger in zero places.

The asymmetry survives the pending harvest work. That change adds "**Any agent can emit, at any
time**", but the sentence lives inside the closing-session skill, which only loads at close — so an
agent hitting friction mid-task still never sees it.

## Two entrances, because "reliable" means two things

- **A slash command always fires.** `/note <whatever you noticed>` is the guaranteed path, and the one
  that gives the capability a discoverable name.
- **A skill catches the conversational phrasing**, which is the actual observed failure mode — the
  operator wrote "save as feedback" inside a sentence, not as a command. The skill's `description`
  must carry every phrasing an operator really uses: *note this*, *save as feedback*, *remember this
  friction*, *log that*, *add to the pool*. The description is where discoverability lives; be
  generous, it costs nothing.

Not redundant, and the pairing is the repo's existing convention (`/backlog` → `next-backlog-item`,
`/close` → `closing-session`).

## Capture must never adjudicate

The skill accepts **everything** and routes **nothing**. If capture decides "this is a defect → backlog"
versus "this is a lesson → pool", adjudication moves back to collection time, which is exactly what the
close-emits/harvest-judges split exists to prevent. One owner adjudicates, at harvest. A practical
benefit: the operator can say "note this" about anything without first classifying it.

## The one piece of real work

`we:scripts/conveyor/learnings-drop.mjs` takes four fields — `kind` (one of `friction`,
`missing-convention`, `doc-gap`, `skill-gap`, `improvement`), `summary` (**≤240 chars**, enforced),
`area`, `suggestion`. An operator supplies one sentence. Synthesising four fields from one is judgment,
which is why this cannot be a command that pipes `$ARGUMENTS` at the CLI — the skill shapes the entry,
the command routes to the skill.

Worth surfacing the 240-char cap in the skill body: it is enforced at the CLI with a clear error, but
nothing warns before composing, so a first attempt that overruns makes the author write the lesson
twice (hit live while filing this item).

## Done when

- `we:.claude/commands/note.md` exists and routes to the skill, following the `we:.claude/commands/backlog.md`
  pattern.
- A capture skill exists whose `description` carries the operator phrasings above.
- Both shape a one-sentence input into a valid entry and shell `we:scripts/conveyor/learnings-drop.mjs`
  — no reimplementation of the append, the scrub, or the schema.
- Neither routes to `backlog/` or memory: capture only.
- A session that has never read the pool's internals can say "note this" and land an entry.

## Not this

The product-side multi-tenant feedback channel (#2610) and its capture slice (#2774) are a different
surface — end users of the product, a client-side send seam, an owner-review screen. This is the
operator/agent-side entrance to the internal pool. They share the scrub core; they do not share a UI.

## Placement

Natural home is alongside the harvest skill, since the two are the read and write halves of one thing.
Can land separately if the harvest work is still in review — nothing here depends on it, because
`we:scripts/conveyor/learnings-drop.mjs` is already on `main` and works today.
