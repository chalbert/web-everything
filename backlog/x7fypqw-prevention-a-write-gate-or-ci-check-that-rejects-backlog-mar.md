---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/check-standards-rules.mjs", "we:scripts/__tests__/check-standards-rules-content-lint.test.mjs", "we:scripts/check-standards.mjs", "we:scripts/__tests__/check-standards-scoped-file-scan.test.mjs", "we:backlog/4199-wip-page-per-card-activity-panel-listing-sessions-and-jobs-r.md"]
dateOpened: "2026-10-01"
preparedDate: "2026-10-02"
preparedAgainstSha: "9022027b3338d274e023296ea23aeebb908f5f36"
tags: []
---

# Prevention — reject agent self-talk and review-defense phrases in backlog markdown

Add a deterministic backlog content check for the review-defense phrases identified by the approval of chalbert/web-everything#3397. The accepted change left this prevention debt outstanding; its original example is we:backlog/4199-wip-page-per-card-activity-panel-listing-sessions-and-jobs-r.md.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3397@48d2111e7c40e470b4429310033e5407f5df707f

## Progress

- **Old premise/scope:** the mechanically filed card named only we:backlog/4199-wip-page-per-card-activity-panel-listing-sessions-and-jobs-r.md, although its goal requires an executable guard. **Corrected premise/scope:** that card is the regression specimen and cleanup target; the implementation belongs in the existing standards gate and its pure content rules, with matching tests. The cited card still contains both reported phrases in its Test plan and Done when sections. Its actual product feature remains outside this prevention task.
- **Source evidence:** we:scripts/check-standards-rules.mjs exports `findHarnessScaffoldingMarkers` and `scanHarnessScaffolding`, which detect harness tags/tool instructions, not the reported prose. The `6f-i-b` sweep in we:scripts/check-standards.mjs demonstrates fenced-example handling, file-attributed errors and scoped local scans. we:scripts/__tests__/check-standards-rules-content-lint.test.mjs covers content detectors; we:scripts/__tests__/check-standards-scoped-file-scan.test.mjs guards local file selection. The required aggregating test job in we:.github/workflows/ci.yml already runs `npm run check:standards`.
- **Calibration:** a case-insensitive repository search for the two reported strings found only the original example card and this prevention card. A search of the current gate/rules and supporting libraries found no detector for them. The existing harness leak check is adjacent infrastructure, not delivery of this goal. This preparation uses symbol/section references rather than unstable line citations.

## Design

1. Add a separate pure backlog-prose detector in we:scripts/check-standards-rules.mjs. Start with the two observed phrase signatures below, matched case-insensitively with word boundaries and whitespace normalization. Join prose continuation lines for matching while retaining physical line positions for diagnostics. Return a stable rule identifier, starting line and matched phrase. This is a finite regression vocabulary, not a classifier for arbitrary writing quality.

   ```text
   does not implement or claim that proof
   Preparation itself does not execute
   ```

2. Scan markdown body text, excluding frontmatter and fenced code examples. Follow the existing harness check's backtick/tilde fence convention, including matching fence character and minimum closing length. Inline backticks and blockquotes remain checked; documenting the rejected strings uses a fenced example as above. Preserve original line numbering after frontmatter removal. Do not reject ordinary words such as “preparation”, “proof” or “review” alone, or factual test-result statements.
3. Wire a dedicated error-level backlog-only sweep into we:scripts/check-standards.mjs. Use `scopedReaddir` for markdown selection: full corpus in the normal CI gate, only selected cards under local file-scoped invocation. Emit one file-attributed diagnostic per occurrence, with a useful instruction to replace author/reviewer commentary with requirements or observed evidence. Do not add a new workflow, model call or dependency. Read/detector failures must fail the check rather than produce a clean result.
4. Remove the two self-referential sentences from we:backlog/4199-wip-page-per-card-activity-panel-listing-sessions-and-jobs-r.md when implementing the guard. Preserve its technical requirements, concrete proof steps and explicit distinction between planned tests and observed results. No change to that card's frontmatter or product design is needed.

## MVP

Deliver the two-signature detector, standards-gate integration, regression tests and cleanup together. Full CI must reject either phrase in ordinary backlog prose; fenced documentation must remain valid. Use the existing gate rather than adding a second enforcement route. Detection covers these known recurring phrases; broader semantic self-talk detection, automatic rewriting, other documentation corpora and editor hooks are outside this slice.

## Test plan

- In we:scripts/__tests__/check-standards-rules-content-lint.test.mjs, add table-driven tests for each reported phrase, sentence prefixes/suffixes, case variations, repeated whitespace, wrapped paragraphs, multiple hits and exact source line numbers. Include realistic excerpts of the original card as inline fixture strings.
- Preservation cases in the same suite: factual “tests were not run” statements, unrelated proof requirements, empty body, frontmatter-only matches and fenced examples pass. Cover backtick and tilde fences, longer opener/shorter non-closing delimiter, unclosed fences, inline-code and blockquote hits. Require clean behavior on the cleaned example card without depending solely on a fixed corpus count.
- In we:scripts/__tests__/check-standards-scoped-file-scan.test.mjs, extend the existing wiring checks for the new section: it calls the detector, uses the scoped backlog listing, emits error-level file-attributed findings and does not scan reports. Keep the existing scope guards intact.
- Run the two targeted Vitest suites in run mode, then the normal standards gate. The source/test pairs are we:scripts/check-standards-rules.mjs → we:scripts/__tests__/check-standards-rules-content-lint.test.mjs and we:scripts/check-standards.mjs → we:scripts/__tests__/check-standards-scoped-file-scan.test.mjs. The example-card edit is exercised by the corpus gate and the detector regression excerpts.

## Proof plan

1. Before implementation, add the regression assertions and record their failure against the current detector surface. After implementation, record both targeted suites passing. Commands run from the WE repository; source paths above identify the exact suites.
2. In a disposable checkout, append one unfenced reported phrase to a clean backlog card and run `npm run check:standards`. Capture the nonzero exit and new diagnostic naming that card and line. Remove the injected phrase, rerun, and verify the diagnostic disappears; separately put the phrase inside a fenced example and verify it is accepted. Record unrelated baseline failures separately so they cannot masquerade as evidence of this rule.
3. Repeat with local file selection: an included bad card must fail, an excluded bad card must not be scanned by this section, and the normal full scan must still catch it. Observe actual CLI output as well as the source-wiring assertions.
4. Mutation check: disconnect the detector from the gate and repeat the injected-card probe; the expected new diagnostic must disappear and the wiring test must fail. Restore the implementation. Run the full standards gate on the final clean tree and retain its exit status/output with the implementation revision.

## Follow-ups

- Add further phrase signatures only with observed examples and clean counterexamples; do not silently expand this check into a general tone policy.
- A shared write-time hook can reuse the detector later if same-turn rejection is needed. The present delivery closes the requested CI-check alternative.
- Keep legitimate test/proof limitations stated as facts. Removing editorial self-talk must never turn an unrun test into a claimed passing result.

## Done when

1. The two targeted Vitest suites pass and each signature has a regression assertion that failed before implementation.
2. A real standards-gate invocation rejects an injected unfenced occurrence with its file and line, accepts the fenced example, and respects local file selection without weakening the full CI scan.
3. The cited example card no longer contains the two self-referential sentences; its requirements and proof obligations remain intact. The clean-tree `npm run check:standards` passes.
