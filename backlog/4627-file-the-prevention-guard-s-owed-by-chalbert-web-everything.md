---
bornAs: xq4m9jj
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/citation-check.mjs", "we:scripts/__tests__/citation-check.test.mjs", "we:scripts/lib/__tests__/citation-check*.test.mjs"]
dateOpened: "2026-09-30"
preparedDate: "2026-10-02"
preparedAgainstSha: "db98be3296929218431ced01a9ca0982b5f8f5c5"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3127's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/citation-check.mjs#findDanglingMarkdownLinks` — Add a deterministic regression test accepting an existing relative destination containing balanced parentheses, and parse destinations with balanced-delimiter handling.
2. `we:scripts/lib/citation-check.mjs#findDanglingMarkdownLinks` — Add unit test coverage for all valid Markdown link title formats (single quotes, parens) to ensure the regex captures them.
3. `we:scripts/lib/citation-check.mjs#findDanglingMarkdownLinks` — Use a real Markdown AST parser (like remark) for link extraction instead of regexes, or explicitly regex-strip 4-space indented lines before link matching.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3127@7bf08ac16905690343640b6f55d3812b1fcbfe5c

## Progress

Preparation premise check: the original scope named the detector and the nonexistent
`we:scripts/lib/__tests__/citation-check.test.mjs`; the original source citations pointed at
lines 1154/1157. The detector now starts at `we:scripts/lib/citation-check.mjs:1222`,
with code stripping at lines 1225–1227 and link matching at line 1229. The corrected
scope keeps that source and pairs it with the existing matching test file,
`we:scripts/__tests__/citation-check.test.mjs`; its gate-5e suite begins at line 1137.
The review's prevention goal remains undelivered, not merely missing documentation.

Direct Node probes of the exported detector observed all three gaps: an existing
relative filename containing balanced parentheses was truncated at its first closing
parenthesis and reported missing; a missing destination with a single-quoted or
parenthesized title produced neither a finding nor an existence lookup; a four-space
indented link to a missing destination produced a finding. The double-quoted title
control correctly produced a missing-file finding. These probes used injected existence
lookups, matching the existing test harness, and did not modify source or tests.

The current suite covers ordinary relative links, traversal, excluded targets, fenced
and inline code, deduplication, and gate wiring, but lacks the three owed regressions.
`we:scripts/check-standards.mjs:1714` calls the same detector from the prose scan and
emits citation-markdown-link findings. No caller or Rust-port change is needed: this
scan runs outside the Rust-port branch. Source references above replace the stale
line citations; the scope correction is solely the actual location of the matching tests.

## Design

Keep the public `findDanglingMarkdownLinks(text, { fromDir, exists })` contract and its
finding shape in `we:scripts/lib/citation-check.mjs`. Replace the destination-matching
regex with a bounded character scanner: recognize angle-delimited destinations and
bare destinations with balanced parentheses, honor escaped delimiters, and require a
complete closing link delimiter before yielding a destination. Separate destination
parsing from optional title parsing. Accept double-quoted, single-quoted, and
parenthesized titles separated from the destination by whitespace; exclude title text
from both lookup paths and findings. Do not accept a truncated prefix of malformed input.

Use the original review's explicitly permitted lightweight code exclusion: strip lines
beginning with four spaces before matching links, alongside the existing fenced/inline
code exclusions. This is a deliberately bounded line filter, not a claim of full
CommonMark block parsing; nested-list indentation remains outside this item. No AST
package or dependency changes are required for these three prevention guards.

Feed extracted destinations through the existing resolution pipeline: preserve URL,
repo-prefix, site-absolute and fragment exclusions; query/fragment removal; percent
decoding; normalization; deduplication; and refusal to call `exists` for root escapes.
Decode escaped destination delimiters for filesystem lookup while retaining the authored
destination in the finding's `link` field. Keep scanner helpers local to this module.

## MVP

1. Extend the gate-5e suite in `we:scripts/__tests__/citation-check.test.mjs` with the
   three owed regressions, asserting both findings and exact existence-lookup arguments.
2. Implement balanced destination and optional-title parsing in
   `we:scripts/lib/citation-check.mjs`, retaining the existing resolver behavior.
3. Add the four-space line exclusion and paired prose controls in the same source/test
   pair. Preserve all current gate-5e tests and the public caller contract.

## Test plan

Use `we:scripts/__tests__/citation-check.test.mjs` for every source change in scope.
Add table-driven cases for existing and missing balanced-parenthesis destinations,
including nesting, escaped parentheses, angle-delimited destinations and fragments.
An existing destination must yield no finding and one exact full-path lookup; a missing
one must report the full destination, never a truncated prefix.

For each of the three title delimiters, test both existing and missing destinations.
Assert missing-file findings and lookups explicitly so silently skipping a titled link
cannot pass. Combine a balanced destination with each title form. Include escaped title
delimiters and malformed/unclosed destinations or titles, which must not produce partial
lookups; a following valid link must still be checked.

Add four-space and deeper-indented code lines that cause neither findings nor lookups,
with a neighboring unindented missing-link control that still reports. Retain fenced
and inline-code coverage. Re-run the existing exclusion, traversal-without-lookup,
deduplication and wiring cases to catch resolver regressions.

## Proof plan

From the WE checkout, run `npx vitest run` with
`we:scripts/__tests__/citation-check.test.mjs` as the file argument (remove the `we:`
repository notation when executing). First run the new regressions against unchanged
source and record their assertion failures for all three owed guards; then apply the
implementation and require the whole file to pass. Preserve exact lookup assertions as
proof that passing cases were checked rather than silently ignored.

Run `npm run check:standards` after implementation and inspect citation-markdown-link
output. Record unrelated failures separately rather than treating them as evidence
about this detector. Preparation itself only probes current behavior and authors this
card; the runner owns stamping and preparation checks.

## Done when

The regression command in Proof plan fails on the new owed cases before the source
change and passes afterward. Balanced relative destinations resolve intact, all three
title formats retain missing-file detection, and four-space code examples are ignored
without suppressing neighboring prose. Existing resolver and gate-wiring tests pass,
and the standards-gate result is recorded.

## Follow-ups

No additional prevention item is required for these three guards. Full Markdown AST
extraction, reference-style links and context-sensitive nested-list/code parsing are
outside this bounded inline-link repair; this item does not claim those capabilities
or change citation enforcement policy.
