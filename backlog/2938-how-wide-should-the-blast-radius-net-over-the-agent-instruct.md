---
bornAs: xzsnnta
kind: decision
status: open
dateOpened: "2026-08-05"
tags: []
scope: ["we:scripts/lib/review-escalation.mjs", "we:scripts/lib/__tests__/review-escalation.test.mjs", "we:scripts/lib/review-policy.contract.json"]
---

# How wide should the blast-radius net over the agent-instruction surfaces be — enumerate named paths, or invert the we:.claude/ anchor to default-deny?

A named-path blast-radius list is correct only while someone remembers to register each future behaviour-defining surface, and three regressions proved that memory unreliable. This decides whether to keep enumerating or invert the we:.claude/ anchor to default-deny with an exemption list, and settles the same question for we:AGENTS.md, we:CLAUDE.md and non-statute we:docs/agent/.

Carved out of **#2939** (the build item), which now `blockedBy`-waits on this call. #2939 enumerates *which* surfaces are unregistered and proves each scores `false`; this item is the one design question that enumeration cannot answer for itself — **how the net decides about a surface nobody has enumerated yet.** Filed separately because #2939 is `kind: task`: an agent claiming it would otherwise hit this question mid-lane and either stall or rule on it unratified.

## Why this is a fork and not a preference

The branches genuinely cannot coexist. A *list* fails **open** on an unregistered name (the surface scores nothing until someone adds it); an *inverted anchor* fails **closed** (an unregistered surface escalates on the day it appears, until someone exempts it). One default has to be picked, because a path that matches neither rule must land somewhere, and the two rules disagree about exactly that path. This is not cost-vs-benefit — the two branches differ in which direction the *unknown* case errs, which is a correctness property, not an effort one.

## The measurement (verified at PR #1048's head)

`isBlastRadiusPath` returns `false` for every one of: `we:.claude/settings.json` (registers the `PreToolUse(Edit|Write)` write-gate hooks), `we:.claude/commands/`, `we:AGENTS.md`, `we:CLAUDE.md`, and non-statute `we:docs/agent/`. #2939 carries the full table and what each surface controls.

The recurrence pattern is the actual evidence: this class was closed **one surface at a time** — PR #1040 / PR #1043 / PR #1045 (the agent-memory corpus, unregistered) → #2909 (the two agent-behaviour trees, both spellings) → PR #1048's own round-4 review (the files the required check's *resolution* depends on — now carved out to [#2935](/backlog/2935/), still unregistered). Three rounds of the same review found three different unregistered surfaces. Each fix was correct and none of them predicted the next.

## Fork 1 — how the blast-radius net treats a surface nobody registered

**Fork-existence justification:** case (b), a real either/or — a path that matches no named pattern must score *something*, and the branches assign it opposite values (`false` = merge unreviewed, `true` = escalate). No composition supports both.

- **(a) Enumerate wider.** Register the named paths #2939 lists and keep the list a list. Cheapest, and the narrowest possible over-escalation. Fails **open** again the next time a behaviour-defining file appears under a name nobody predicted — which is the documented recurrence, not a hypothetical.
- **(b) Invert to default-deny (recommended default).** Anchor `(^|\/)\.claude\/` **whole** as blast-radius, with a short commented EXEMPTION list for the genuinely inert entries. An unregistered surface then fails **closed** the day it appears: a new `we:.claude/agents/` or a new hook file escalates with nobody having filed anything. The cost is over-escalation on the exempt-but-unlisted tail — the safe direction by the roster's own stated policy ("basename match … can only ever over-escalate … the safe direction, by policy"). Note the scope limit: this covers only `we:.claude/`. `we:AGENTS.md`, `we:CLAUDE.md` and `we:docs/agent/` sit outside that anchor and need Fork 2's answer regardless.
- **(c) A hybrid — invert `we:.claude/` and keep everything else enumerated.** Formally (b) for one directory and (a) for the rest. Worth stating explicitly so a ruling of "(b)" is not read as also inverting `we:docs/agent/`.

**Bold default: (b)** — it is the only branch whose correctness does not depend on a future editor remembering this item exists, and the recurrence record is that they do not.

## Fork 2 — the volume-sensitive half: non-statute `we:docs/agent/`

**Fork-existence justification:** case (b) — registering the whole tree and registering a router subset produce different scores for the same file, and a file cannot hold both.

- **(a) Register the whole `we:docs/agent/` tree.** Consistent and unforgettable. Escalates every prose touch-up in a large, frequently-edited directory, and every escalation parks a PR awaiting a review — the one place the over-escalation cost is not obviously cheap.
- **(b) Register a narrower predicate — the *router* files only (recommended default).** `we:AGENTS.md`, `we:CLAUDE.md`, and the named Tier-1 docs that route behaviour, not every reference under the tree. Keeps the volume cost off the tail while covering what actually re-routes a session.
- **(c) Leave `we:docs/agent/` unregistered beyond the existing statute patterns.** Status quo. Stated for completeness; it is the branch the recurrence record argues hardest against.

**Bold default: (b)** — the volume objection is real and specific to this tree, and a named router set answers it without giving up coverage of the files that actually change routing.

## A lint gap this item is on record about

The buried-fork lint (`findBuriedForkSections` in [`we:scripts/check-standards-rules.mjs`](scripts/check-standards-rules.mjs)) matches a **fixed phrase list**, `FORK_HEADING_TERMS` — `open design`, `open decision`, `open question`, `open fork`, `design tension`, and the `… to settle` forms. This fork originally lived inside #2939 under the heading *"The open call — enumerate wider, or invert to default-deny"*, which contains none of those phrases, so the lint did **not** fire on a `kind: task` item carrying a live unresolved fork with three options and a preferred candidate. Round 4 of PR #1048's review caught it by reading, not by gate. Widening the phrase list (or replacing it with a shape test — a section whose body is an option list with a bold default) is a real follow-up; it is deliberately **not** bundled into PR #1048, whose scope was frozen. Recorded here so the weakness is on the record rather than in a review transcript.

## Done when

- Both forks are ruled and the ruling codified (statute or `we:docs/agent/*.md`, per the resolve gate for a `kind: decision`).
- The ruling states, in one line, what happens to a surface **nobody has enumerated** — that sentence is the whole point of the call, and a ruling that only lists paths has not answered it.
- #2939 can then be built: its `blockedBy` edge to this item clears, and its Done-when bullets become mechanical.
