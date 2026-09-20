---
bornAs: x71bytn
kind: story
size: 3
parent: "3740"
status: open
scope: ["we:scripts/prototype-tracker.mjs", "we:scripts/lib/prototype-tracker-data.mjs", "we:scripts/__tests__/prototype-tracker-data.test.mjs", "we:skills-src/prototype-tracker/SKILL.md"]
dateOpened: "2026-09-20"
tags: []
---

# append-note lint: a tracker note may reference card ids but never carry a free-text owed list

The tracker note command appends whatever body it is given to the epic 3383 card, which is how owed work ended up as prose instead of cards. Adds a lint to append-note that rejects a note body carrying an owed or to-do list of lines with no card id, pointing the caller at the track operation, so a note can only reference filed cards. Design-first, uncleared.

Slice of epic #3740 (design point 1, the note half, and its acceptance line that no tracker note carries an owed list). Filed uncleared: a design review comes before any build. No blockers: it rejects and points at the track operation, it does not call it.

## Design

**Settled (read from the code).**

- `cmdAppendNote` (`we:scripts/prototype-tracker.mjs:47`) takes the body from `--body-file` or stdin and hands it straight to `appendSessionUpdate` (`we:scripts/lib/prototype-tracker-data.mjs:205`). Nothing inspects the body, which is exactly how owed work became prose in the epic 3383 tracker instead of cards.
- The lint runs in `cmdAppendNote` before the write and only on the NEW body. The tracker is a 3000-line card full of legitimate prose, so history is never re-scanned.
- Version one rejects: exit code 1, a message that names the offending lines and points at the track operation. It does not convert. Converting a list into cards needs the ingest engine, which is a later slice; a lint that files cards from inside `append-note` would also bypass the one-operation rule this epic exists to enforce.
- A note may reference cards: a line that carries a card id (`#NNN` or an `xNNNNNN` hash) passes.
- The shared tracker tail is unchanged here. Concurrent appends to the end of one file is the merge-strategy question owned by the landing slice.

**Open (settle in the design review).**

1. What counts as an owed list. Candidate rule: a bullet or numbered list that sits under a heading or lead-in containing owed, to-do, remaining, follow-up or next steps, where at least one item has no card id. The risk is false positives on ordinary prose lists; the alternative is an explicit marker, which only catches writers who follow it, so it fails open. Needs a false-positive check against the real tracker's existing notes before the rule is chosen.
2. The bypass: a direct edit of the tracker card skips `append-note`. Options are a rule in `check:standards` over the newest session-update only, or accepting that `append-note` is the mechanised route and the guard hook (`we:scripts/guard-prototype-tracker.mjs`, today a push-time staleness check) is the place to extend.
3. Whether a reject needs an escape hatch. Leaning none: an override flag is the easiest way to keep leaking.

## Done when

1. **Executable** — `node --test we:scripts/__tests__/prototype-tracker-data.test.mjs` passes with new cases that fail today: a body containing an `## Owed` heading over two bullets with no card id is rejected with the track pointer in the message; the same bullets each carrying a card id pass; a plain prose body passes.
2. **Executable** — the CLI path, run against a fixture tracker with `--backlog-dir`: `node we:scripts/prototype-tracker.mjs append-note --summary='x' --backlog-dir=<fixture>` with the rejected body on stdin exits 1 and leaves the fixture byte-identical.
3. **Executable** — a corpus check in the same suite: the lint applied to each existing `## Session update` body of the real tracker card reports its false-positive count, and the test pins the number this design review accepts.
