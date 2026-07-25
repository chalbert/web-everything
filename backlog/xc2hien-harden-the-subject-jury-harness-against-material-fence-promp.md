---
kind: story
size: 2
parent: "2649"
status: open
scope: ["we:skills-src/jury/"]
dateOpened: "2026-07-25"
tags: []
---

# Harden the subject-jury harness against material-fence prompt-injection

The subject-agnostic jury harness ([we:skills-src/jury/subject-jury.workflow.js](skills-src/jury/subject-jury.workflow.js)) drops the untrusted subject material between literal triple-backtick fences in `jurorPrompt` with no delimiter-collision handling. A material payload bearing its own fence line can break out and feed instructions to a juror, so every lens returns no findings and the panel can reduce to `accept` — defeating the review the jury exists to run. Harden it: a guarded or randomized fence delimiter, plus explicit material-is-untrusted framing that tells the juror to ignore any instructions found inside the material.

This is a general property of all LLM-based review and is inherited from the accepted reference [we:scripts/workflows/review-parked-prs.mjs](scripts/workflows/review-parked-prs.mjs) (same fence-around-content pattern) — so hardening it here is worth carrying to the reference too. The harness is advisory (applies no label, posts no comment, merges nothing), which is why the /review of PR #722 (WE #2658, F1) recorded this as a noted known-limitation, not a blocker.

Rolls up two simplicity nits surfaced in the same review:

- Drop the unused `export`s on `parseFlags` / `resolveJuryRoster` in [we:skills-src/jury/resolve-roster.mjs](skills-src/jury/resolve-roster.mjs) — nothing imports them and there is no test that would.
- Have the resolve shim return each adapter's `subjectNoun` instead of the harness re-hardcoding the `SUBJECT_NOUN` map (avoids drift; the code comment already flags the duplication).
