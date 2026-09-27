---
kind: task
parent: "4075"
status: open
scope: ["we:skills-src/review/SKILL.md"]
dateOpened: "2026-09-27"
tags: []
---

# review skills-src SKILL doc's documented manual advisory-note call omits headSha, producing an unrecognizable note

Still-open Codex advisory finding from chalbert/web-everything#2781's FINAL review round (codex-correctness/correctness, [CONFIRMED]), never acted on before merge (2026-09-27). Re-checked against origin/main @5e6c2868e2 (2026-09-27) — still applies.

FINDING: we:skills-src/review/SKILL.md's documented manual conversion step (around its worked example for posting a converted advisory note) shows calling the note-rendering helper with only repo/pr/acceptComment/escalation/targetedCheckAnswer — it never names headSha in that example call. The rendering function defaults a missing headSha to an empty string, which renders a "Net basis: .." line with nothing after either dot. A session following the documented example literally posts a note that the machine reader (parseAdvisories / hasConvertedAdvisoryNote) cannot recognize as a converted advisory at all, since those readers key off the rendered head. review:awaiting-advisory still gets cleared per the doc's own instruction, but the note it clears it with is invisible to every downstream automated reader.

EVIDENCE: read we:skills-src/review/SKILL.md directly off origin/main — the documented worked-example call to the note-rendering helper still omits headSha from the object literal shown to the reader.

PREVENTION (from the reviewer, still owed): require a valid nonempty headSha before rendering (fail loudly rather than silently defaulting to empty), and add a deterministic test asserting the documented example, followed literally, produces a head-recognized advisory note.

Priority: not HIGH (a documentation gap that can produce one unrecognizable note for a session that follows the doc literally by hand; the normal automated path is unaffected, so this does not itself close/resolve the wrong PR, lose data, or suppress healing forever).

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
