---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/citation-check.mjs", "we:scripts/__tests__/citation-check.test.mjs", "we:scripts/lib/__tests__/citation-check*.test.mjs"]
dateOpened: "2026-10-01"
preparedDate: "2026-10-03"
preparedAgainstSha: "afb711055c4f300be8c01a8e32eef92ec8c71733"
tags: []
---

# Prevention — Test source-line parity and unreadable-target memoization

Filed mechanically ON APPROVAL from chalbert/web-everything#3343: the accepted review left two prevention guards owed. Preserve both: property-style coverage of `splitSourceLines(text).length === countSourceLines(text)`, and deterministic coverage of throwing reads, cached null results, and detector skipping.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3343@a07676a1b8ae9d2bd5aae6c0d0c15082dc8e86ba

## Progress

- Prepare-validation repair: retain the existing test suite in scope and add the runner-required narrow matching-test pattern `we:scripts/lib/__tests__/citation-check*.test.mjs`. No current file matches that pattern; it reserves the permitted library-local test scope without changing the implementation plan below, which extends `we:scripts/__tests__/citation-check.test.mjs`.

- Original premise/scope: the review cited line 1172 of `we:scripts/__tests__/citation-check.test.mjs` and line 509 of `we:scripts/lib/citation-check.mjs`, and scope additionally named `we:scripts/lib/__tests__/citation-check.test.mjs`. It suggested an exported-function test-reference lint as broader prevention.
- Corrected premise/scope: the library-local test file does not exist. The existing matching suite is `we:scripts/__tests__/citation-check.test.mjs`; keep it paired with `we:scripts/lib/citation-check.mjs` in scope. This is missing regression coverage of existing behavior, with no production change expected. The old test citation now falls before the relevant describe block; use the symbol/block references below instead.
- Source evidence: `countSourceLines` at `we:scripts/lib/citation-check.mjs:442` and `splitSourceLines` at `we:scripts/lib/citation-check.mjs:488` both split on LF and discard only the final terminator. `makeMemoizedLineReader` at `we:scripts/lib/citation-check.mjs:501` catches read errors and caches null; `findBlankLineLoci` at `we:scripts/lib/citation-check.mjs:531` skips non-array reader results.
- Coverage evidence: the count cases start at `we:scripts/__tests__/citation-check.test.mjs:266`; the throwing-reader test at `we:scripts/__tests__/citation-check.test.mjs:548` exercises `makeMemoizedLineCounter`, not `makeMemoizedLineReader`. The blank-line detector block at `we:scripts/__tests__/citation-check.test.mjs:1176` calls `splitSourceLines` indirectly but supplies no throwing memoized reader. A search of test files under `we:scripts/` found no direct parity assertion or line-reader test.
- Preparation probe: a direct Node assertion run passed parity for 14 edge inputs (including empty, LF, repeated LF, CRLF, bare CR and non-strings), and confirmed a throwing reader returns null twice, remains at one raw read, and yields no detector findings for two distinct citations. The behavior exists; the requested durable tests remain missing. No delivery or full-suite validation is claimed.

## Design

Extend `we:scripts/__tests__/citation-check.test.mjs` using its existing Vitest harness and injected-reader convention. Import `makeMemoizedLineReader` from `we:scripts/lib/citation-check.mjs`. No new dependency, filesystem permission fixture, API, or lint policy is required.

For parity, enumerate all token sequences of length zero through four over a small fixed alphabet containing ordinary text, LF, CR and whitespace. Assert the equality for every generated string with a diagnostic showing the input. Supplement with explicit expected arrays/counts so two implementations sharing the same mistake cannot satisfy the entire guard. LF is the separator: CRLF retains CR in line content; bare CR does not create another line. Empty and non-string inputs produce an empty array and zero count.

For memoization, inject a counting reader that throws for one target and returns readable text containing a blank line for another. Verify null caching directly and through `findBlankLineLoci`. Report the target as existing so the test reaches the reader instead of passing through the missing-file shortcut. Use multiple distinct line citations to defeat detector locus deduplication as an accidental explanation for a single read. Include a readable blank-line finding as a positive control.

## MVP

1. Add a focused parity describe block with deterministic generated inputs and explicit boundary expectations in `we:scripts/__tests__/citation-check.test.mjs`.
2. Add direct tests for `makeMemoizedLineReader`: a thrown read returns null, repeat calls do not retry, and distinct paths have independent cache entries. Cover non-string reader returns and an empty readable file separately (null versus empty array).
3. Add detector integration coverage using the same memoized reader, repeated scans and distinct citations of the unreadable target, plus a readable blank-line target. Assert exact findings and per-path read counts.
4. Keep production semantics unchanged. The source entry in scope identifies the behavior under test; its matching test entry is the existing suite above.

## Test plan

- Parity matrix: empty string; ordinary text with/without a trailing LF; leading/interior/repeated blank lines; whitespace-only lines; CRLF; bare CR; Unicode text; and representative non-string inputs (`undefined`, null, numbers, booleans, arrays and objects). Add the bounded generated corpus described above without random seeds or timing dependencies.
- Expected-value anchors: empty text yields zero lines; one LF yields one empty line; two LFs yield two empty lines; a terminal LF adds no phantom line; bare CR remains within one line.
- Reader assertions: each unreadable path returns null and invokes the raw reader once across direct calls and detector scans; a separate readable path is read once and retains its own result. Non-string returns cache null; empty string caches an empty array.
- Detector assertions: existing-but-unreadable targets produce no blank-line finding or exception; a readable blank second line produces the exact expected locus/path/line record. Multiple distinct citations and repeated scans leave the unreadable read count at one.
- During implementation, run the focused Vitest suite at `we:scripts/__tests__/citation-check.test.mjs`, then `npm run check:standards`. The runner owns preparation checks and stamping.

## Proof plan

The unmodified implementation already satisfies the requested behavior, so an honest baseline is green; do not promise that merely adding these tests makes the current code fail. Prove regression sensitivity with temporary, individually applied mutations of `we:scripts/lib/citation-check.mjs` during implementation:

1. Retain the trailing empty split element: the new parity/expected-value tests must fail.
2. Stop honoring cached null reads: the raw-read-count assertions must fail.
3. Return an empty array instead of null after a thrown read: the direct null assertion must fail.
4. Remove the detector's non-array skip: the unreadable-target integration test must fail.

Restore each mutation before the next, then run the complete focused suite and standards gate on the final unmutated tree. Record commands, exit codes and the failing test for each mutation. Review the diff to ensure no mutation remains. Do not count a failed test discovery or import as behavioral proof.

## Done when

- Both review guards exist as durable tests in `we:scripts/__tests__/citation-check.test.mjs`, including parity, null result, no retry and detector skipping assertions.
- The focused suite and standards gate pass on the final tree, and each temporary mutation above fails its intended test.
- No change to unreadable-target policy, line-ending semantics, or production API is introduced.

## Follow-ups

The review's suggested lint requiring every exported library function to be referenced by a test is broader optional prevention, not an acceptance condition for these two guards. A reference alone does not establish behavioral coverage (the splitter is already referenced). Evaluating that lint's usefulness and scope belongs to separate work; do not add a repository-wide rule here. No further work is required to implement the two concrete guards.
