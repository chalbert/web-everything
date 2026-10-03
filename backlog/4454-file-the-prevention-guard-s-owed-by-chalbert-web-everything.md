---
bornAs: xxnf8w5
kind: story
size: 3
parent: "4075"
status: resolved
scope: ["we:scripts/lib/citation-check.mjs", "we:scripts/check-standards.mjs", "we:scripts/__tests__/citation-check.test.mjs"]
dateOpened: "2026-09-28"
dateStarted: "2026-10-01"
dateResolved: "2026-10-01"
preparedDate: "2026-09-30"
preparedAgainstSha: "bc9db934c4b93158341ba01a74dccb71583765fc"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2840's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4349-a-finished-delivery-wrapper-never-settles-its-run-record-or.md:19` — No deterministic gate can verify an English claim about runtime behavior; the practical guard is a review habit (or a lightweight cite-checker script) that re-greps each line reference a backlog card cites and confirms the surrounding control flow (including any later reassignment of the same property) before treating a snippet as load-bearing evidence.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2840@e1b72674f10a9d059bb6fd3b10b33579f6911cf9

## Progress

- Prepare pass 2026-09-30. Premise: not delivered. `git log --grep` for `4454` / `4454` shows only the JIT-numbering commit; no cite-content gate exists.
- Scope corrected. Old `scope:` named the cited card (`we:backlog/4349-…md`), which is evidence, not the work. New scope is the three files the guard lives in (citation gate lib, its wiring, its test). Evidence: `we:scripts/lib/citation-check.mjs` (`findDanglingLoci`, gate 5) and `we:scripts/check-standards.mjs` (gate 6f-ii, 6f-ii-b…d).
- Cited line is itself an example: `we:backlog/4349-a-finished-delivery-wrapper-never-settles-its-run-record-or.md:19` is a blank line on current `main`. Gate 5 passes it today (file exists, 19 <= EOF).

## Design

Gate 5 (`findDanglingLoci`, `we:scripts/lib/citation-check.mjs`) only bounds-checks a `we:<path>:<line>` cite: file exists and line <= EOF. A cite into a file that was edited stays green while it points at unrelated text. A deterministic gate cannot judge an English claim about control flow, so the practical, mechanical slice is the cheapest drift signal: **the cited line is blank**. A blank line is never what a card meant to point at. This is only the cheapest slice of the owed guard: a cite that drifts onto unrelated NON-blank text stays green, so the content-aware check in Follow-ups is the real guard. Baseline measured in review: of 4841 distinct in-repo `we:` loci in the scanned dirs, 247 (about 5%) land on a blank start line, so expect about 250 WARN lines on first run.

Add a pure `findBlankLineLoci(text, { fileExists, readLines })` next to `findDanglingLoci`. It reuses the same locus regex and the same skips (cross-repo loci, absolute or `..` paths, per-text dedupe). For each in-repo locus whose file exists and whose start line is in range, it reports `{ locus, path, line }` when that line is empty or whitespace-only. For a range `a-b` it checks the start line `a` only (a range may legitimately span blanks); range starts ARE checked and are part of the 247 baseline. Lines come from splitting the file text with the same trailing-newline handling as `countSourceLines` (the final `\n` is a terminator, not an extra empty line), and any line past that count yields no finding (gate 5 owns out-of-range).

Wire it as a new gate 6f-ii-e in `we:scripts/check-standards.mjs`, after 6f-ii-d. It is deliberately OUTSIDE the Rust-port branch (same reasoning as 6f-ii-b/c/d: a new detector the port doesn't know must never silently not-run, and `findDanglingLoci` stays byte-identical for the parity test). It scans `backlog/`, `docs/agent/`, `reports/` and `agent-memory-src/` through `scopedReaddir` (per-file, stateless, so safe under `--local --files`). Emit is WARN via the existing `CITATION_GATES_ENFORCED` switch, because the historical corpus carries pre-gate hits. File reads go through a memoized line reader so a popular file is read once.

## MVP

Musts:
1. `findBlankLineLoci` in `we:scripts/lib/citation-check.mjs`, pure, exported.
2. Gate 6f-ii-e in `we:scripts/check-standards.mjs`, WARN via `CITATION_GATES_ENFORCED`, outside the Rust branch.
3. Unit tests in `we:scripts/__tests__/citation-check.test.mjs`.

Out of scope (see Follow-ups): the review-habit half, content-aware checks (identifier or symbol still present near the line), flipping the family to enforced.

## Test plan

In `describe('findBlankLineLoci')`, with an injected fake tree. Each case is RED before the fix because `findBlankLineLoci` is undefined (the call throws "not a function").
- Flags a cite whose line is empty — asserts one finding `{ locus, path, line }`.
- Flags a whitespace-only line (`"   "`) — asserts the same.
- Passes a cite on a non-blank line — asserts zero findings.
- Range `a-b`: blank start `a` flags; blank end `b` alone passes.
- Skips `fui:` / `plateau:` loci, absolute and `..` paths, and missing files (the dangling gate owns those) — asserts zero findings and that a spy `readLines` is never called for them (same pattern as the existing `..` test).
- Dedupes a locus cited twice in one text — asserts one finding.
- A cite exactly one line past EOF of a newline-terminated file yields no finding (the trailing terminator must not read as a blank line); a cite far past EOF likewise.
- Structural: in `we:scripts/__tests__/check-standards-scoped-file-scan.test.mjs`, assert the 6f-ii-e block uses `scopedReaddir`, as it does for 6f-ii-b. RED before the gate exists.

## Proof plan

Before/after on the live corpus: run `npm run check:standards -- --local --files=<this card>` with the gate not wired (no 6f-ii-e warning) and again with it wired (warning names `we:backlog/4349-a-finished-delivery-wrapper-never-settles-its-run-record-or.md:19`, a real blank-line cite in this card). Record the corpus warning count (expect about 250). Then run the full `npm run check:standards` and confirm the new family only adds WARN lines, no new errors, and the Rust parity test still passes.

## Follow-ups

Known limits, accepted for the MVP: (a) a blank-line hit depends on the CITED file, so editing a cited file can create a hit in an untouched citing card, which `--local --files` skips; the full run catches it. (b) This card cites `we:backlog/4349-a-finished-delivery-wrapper-never-settles-its-run-record-or.md:19` as its live example, so it will keep warning on that one cite after landing; that is one of the baseline hits.

- The review-habit half of the finding: add "re-grep each cited line and read the surrounding control flow, including later reassignment of the same property, before treating a snippet as load-bearing" to the independent-review checklist (candidate home `we:skills-src/review/SKILL.md`). To be filed as its own backlog card by the builder; wording is a judgment edit.
- A content-aware cite check (for example the cited line no longer contains an identifier named in the same sentence). Needs a design pass on false positives.
- Flip `CITATION_GATES_ENFORCED` once the historical hits are cleaned.

## Done when

1. **Executable** — `npm run check:standards -- --local --files=<this card>` prints a 6f-ii-e warning naming the blank-line cite `we:backlog/4349-a-finished-delivery-wrapper-never-settles-its-run-record-or.md:19`, and `npx vitest run citation-check` passes the new `findBlankLineLoci` cases. Both fail before this item lands.
