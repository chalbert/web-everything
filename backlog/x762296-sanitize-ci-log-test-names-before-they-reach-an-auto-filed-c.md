---
kind: story
size: 2
status: open
scope: ["we:scripts/operations/ci-heal-pr-dispatch.mjs", "we:scripts/operations/__tests__/ci-heal-pr-dispatch.test.mjs"]
dateOpened: "2026-10-02"
preparedDate: "2026-10-03"
preparedAgainstSha: "eb0677e86b2a5a17c060b7f6c6566e990bfaad83"
tags: []
---

# Sanitize CI-log test names before they reach an auto-filed card digest

Follow-up from the #3559 advisory (operator approved #3559, 2026-10-02). The timeout follow-up builder in `we:scripts/operations/ci-heal-pr-dispatch.mjs` inserts CI-log-derived failure fields into a generated backlog digest without display sanitization. Sanitize those fields at the digest boundary and add a regression check that catches bypasses.

## Progress

- Original premise: `we:scripts/operations/ci-heal-pr-dispatch.mjs:451` interpolates free-text names from `parseTimeoutFailures`; original scope contains that source and `we:scripts/operations/__tests__/ci-heal-pr-dispatch.test.mjs`.
- Corrected premise: the live interpolation is in `fileTimeoutFollowup` at `we:scripts/operations/ci-heal-pr-dispatch.mjs:495`, with the digest passed to `planScaffold` at line 501. All three failure fields (`path`, `name`, `kind`) enter the displayed row. The parser actually lives at `we:scripts/conveyor/reconcile-pass.mjs:1177`; it removes ANSI colour and transport timestamps, bounds logs and lines, and requires a complete failure inventory, but retains markup in names. Classification at `we:scripts/conveyor/reconcile-pass.mjs:1280` checks timeout kinds and dependency evidence and includes original names in the signature.
- Observed during preparation: a direct invocation of the real parser with a complete one-failure timeout log retained an HTML image tag, bold markup and a Markdown link in the name, returning `complete: true`. This proves parser retention; it does not establish browser script execution or successful downstream filing of every possible payload.
- Corrected scope: retain the two existing scoped files. Implement display protection in the dispatcher and exercise the real parser from dispatcher tests; no parser, signature, eligibility, scaffold-wide policy or standards-checker change is necessary. The matching existing test file is `we:scripts/operations/__tests__/ci-heal-pr-dispatch.test.mjs`, whose retry fixtures begin at line 538 and currently count cards without checking hostile digest content.
- Persistence constraint: `we:scripts/operations/ci-heal-pr-dispatch.mjs:490` constructs a payload only when no saved card exists; lines 504–515 reuse its identity and bytes on retry. This item protects newly constructed payloads and their replays; it does not silently rewrite historical saved cards.

## Design

Add a small pure display sanitizer in `we:scripts/operations/ci-heal-pr-dispatch.mjs` and use it on each failure field before constructing the digest row. Keep the original evidence, signature and scope paths intact: presentation cleanup must not alter dependency lookup, retry identity or the machine-readable scope.

The sanitizer produces plain, single-line text with a maximum of 200 Unicode code points per field, including any truncation marker. Remove ANSI escape sequences, C0/C1 controls and Unicode format controls; replace line separators and whitespace runs with one space; remove HTML tags and Markdown delimiter characters (including backticks, brackets, parentheses, angle brackets, emphasis, heading, list, table and escape markers). Remove ampersands so entity-encoded markup cannot be reintroduced when rendered. Trim, then truncate by code point, using a final ellipsis within the limit. Use a fixed `unnamed` fallback when cleanup leaves nothing. Retain readable Unicode letters and digits. Apply the same helper to `path`, `name` and `kind` display values, keeping the builder's own bullet and punctuation outside it.

Centralize row construction so tests can exercise the exact production digest route. Add a focused regression check in `we:scripts/operations/__tests__/ci-heal-pr-dispatch.test.mjs` that drives parsed hostile fields into the generated scaffold content and fails if any field bypasses sanitization. This is a behavioral sink check, not a claim to implement general static taint analysis. Sanitization removes formatting/control injection; plain prose remains untrusted CI evidence, not an instruction or proof of flakiness.

## MVP

1. Implement and document the bounded display helper and route all three failure-row fields through it in `we:scripts/operations/ci-heal-pr-dispatch.mjs`.
2. Extend `we:scripts/operations/__tests__/ci-heal-pr-dispatch.test.mjs` using the existing temporary state directory, injected GitHub effects and `fileFollowup` seam. Assert generated content, original scope and durable replay behavior.
3. Keep existing retry budgets, stale-head refusals, card allocation and content-conflict checks unchanged. No live GitHub requests or production card writes are needed for these tests.

## Test plan

- Table-test ordinary names, HTML tags, Markdown links/images/fences/headings, ampersand entities, ANSI sequences, CR/LF/tabs, C0/C1 and Unicode direction/line controls, empty-after-cleanup input, and long Unicode text. Assert a nonempty single line of at most 200 code points, deterministic output and preserved readable text.
- Parse a complete hostile timeout log with the real `parseTimeoutFailures` from `we:scripts/conveyor/reconcile-pass.mjs`, feed its failures into the existing two-confirmed-retry harness, and inspect the captured scaffold payload's content. Assert sanitized display fields and exact original scope. Include independently hostile path/name/kind values through the injected evidence seam to catch bypasses for each field.
- Make the first filing attempt fail, flush the owed follow-up, and assert identical sanitized bytes and one card identity on replay; assert original persisted evidence is unchanged. Retain the existing concurrency, retry-cap and stale-evidence cases.
- All new cases belong in `we:scripts/operations/__tests__/ci-heal-pr-dispatch.test.mjs`; the parser is a read-only dependency, not an additional implementation scope entry.

## Proof plan

Run the focused Vitest suite for `we:scripts/operations/__tests__/ci-heal-pr-dispatch.test.mjs` before and after implementation. The new hostile-content regression must fail against the current raw interpolation and pass with the sanitizer. Temporarily bypass each field's sanitizer locally to confirm the regression detects all three omissions, then restore the implementation. Record the focused suite result and a captured generated-content assertion demonstrating bounded single-line fields with unchanged scope and evidence. Run `npm run check:standards` as the delivery gate. These are implementation proofs; preparation has only run the parser-retention probe described above.

## Done when

1. The focused suite for `we:scripts/operations/__tests__/ci-heal-pr-dispatch.test.mjs` passes, including a regression demonstrated red against the unsanitized builder.
2. Every CI-derived failure field displayed in a newly generated digest crosses the same bounded sanitizer; formatting originates only from the trusted row template.
3. Saved sanitized payloads replay with identical identity and content; original evidence, scope, classification and retry budget semantics remain unchanged.
4. `npm run check:standards` passes.

## Follow-ups

Historical persisted payload inspection or remediation is separate operational work: do not change already allocated card bytes or bypass the existing content-conflict protection here. A repository-wide static taint checker, protection for unrelated digest producers, and defenses against plain-language prompt injection are outside this bounded formatting-sanitization item. No additional work item is required to deliver this MVP.
