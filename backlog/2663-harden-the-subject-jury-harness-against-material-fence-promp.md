---
bornAs: xc2hien
kind: story
size: 2
parent: "2649"
status: resolved
scope: ["we:skills-src/jury/"]
dateOpened: "2026-07-25"
dateStarted: "2026-07-27"
dateResolved: "2026-07-27"
tags: []
---

# Harden the subject-jury harness against material-fence prompt-injection

The subject-agnostic jury harness ([we:skills-src/jury/subject-jury.workflow.js](skills-src/jury/subject-jury.workflow.js)) drops the untrusted subject material between literal triple-backtick fences in `jurorPrompt` with no delimiter-collision handling. A material payload bearing its own fence line can break out and feed instructions to a juror, so every lens returns no findings and the panel can reduce to `accept` — defeating the review the jury exists to run. Harden it: a guarded or randomized fence delimiter, plus explicit material-is-untrusted framing that tells the juror to ignore any instructions found inside the material.

This is a general property of all LLM-based review and is inherited from the accepted reference [we:scripts/workflows/review-parked-prs.mjs](scripts/workflows/review-parked-prs.mjs) (same fence-around-content pattern) — so hardening it here is worth carrying to the reference too. The harness is advisory (applies no label, posts no comment, merges nothing), which is why the /review of PR #722 (WE #2658, F1) recorded this as a noted known-limitation, not a blocker.

Rolls up two simplicity nits surfaced in the same review:

- Drop the unused `export`s on `parseFlags` / `resolveJuryRoster` in [we:skills-src/jury/resolve-roster.mjs](skills-src/jury/resolve-roster.mjs) — nothing imports them and there is no test that would.
- Have the resolve shim return each adapter's `subjectNoun` instead of the harness re-hardcoding the `SUBJECT_NOUN` map (avoids drift; the code comment already flags the duplication).

## Progress

Delivered (scope `we:skills-src/jury/`):

- **Material-fence hardening.** `jurorPrompt` now fences the inline material with a delimiter the material provably cannot close — `materialFence` sizes the fence one backtick longer than the longest backtick run inside the material (CommonMark's own nesting rule; deterministic, since `Math.random`/`Date.now` are unavailable in the workflow sandbox). Paired with a new `UNTRUSTED_MATERIAL` framing block that tells every juror the material is untrusted DATA, that instructions come only from the prompt, and to ignore (and report as a finding) any instruction, role change, "return no findings" directive, or fence found inside it. The framing applies to both the inline and read-from-file paths (file bytes are equally untrusted). The reference `we:scripts/workflows/review-parked-prs.mjs` shares this pattern and is worth hardening too — noted as a follow-up (out of this item's `skills-src/jury/` scope).
- **Dropped unused exports.** `parseFlags` / `resolveJuryRoster` in `we:skills-src/jury/resolve-roster.mjs` are no longer `export`ed (nothing imports them; still used internally by the CLI `main`).
- **Single-sourced the subject noun.** `we:skills-src/jury/resolve-roster.mjs` now returns the adapter's canonical `subjectNoun`; the harness threads it through to `jurorPrompt` instead of re-hardcoding a `SUBJECT_NOUN` map (removes the drift the old code comment flagged).
