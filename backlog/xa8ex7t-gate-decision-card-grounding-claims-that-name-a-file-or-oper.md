---
kind: story
size: 3
parent: "3318"
status: open
scope: ["we:scripts/review-corpus/gates.mjs", "we:scripts/review-corpus/__tests__/gates.test.mjs", "we:scripts/check-standards.mjs"]
dateOpened: "2026-09-09"
tags: []
---

# Gate decision-card grounding claims that name a file or operation as the sole live path

Prevention owed by the correctness/false-grounding-premise finding on PR #2027 (decision card #xoywo06): the card called we:scripts/operations/dispatch-lane.mjs 'confirmed the sole' conveyor dispatch surface and named four callers, none of which invoke it -- the live path is we:skills-src/conveyor/SKILL.md §3's main-session bridge Agent spawn, and the routing item #3096 is open behind open #3353. Nothing in the repo checks a decision card's factual premises before a human ratifies on top of them, so the whole recommendation rested on a claim a grep refutes. Wanted: a gate that flags any grounding claim in a kind: decision card calling a named file or operation 'sole' / 'the only path' / 'confirmed', and requires the card to cross-reference the skill doc that owns the named file, plus any OPEN backlog item in that file's declared-homes scope that would change the claim. Prototype it as a pure candidate gate in we:scripts/review-corpus/gates.mjs and score it against the mined corpus at that file's own declared bar before wiring it into we:scripts/check-standards.mjs. Short of automation, the fallback is a mandatory second-pass grounding review before a decision's status may move from open toward ratified.

## Done when

1. **Executable** — `npx vitest run we:scripts/review-corpus/__tests__/gates.test.mjs` covers the new gate,
   including a case built from this very card's own false claim (a `kind: decision` body asserting a named
   operation is the "sole" surface, with no cross-reference to the owning skill doc or to the open item that
   contradicts it) and a near-miss case that must NOT fire. It fails before this lands: the gate does not exist.
2. **Scored before it ships** — the gate is replayed against the mined corpus and clears
   `we:scripts/review-corpus/gates.mjs`'s own declared bar (catches at least 80% of its labelled class, fires
   zero times where no reviewer found anything). Below that bar it stays a candidate and is NOT wired into
   `we:scripts/check-standards.mjs`.
