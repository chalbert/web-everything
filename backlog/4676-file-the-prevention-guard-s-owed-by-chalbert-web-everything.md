---
bornAs: x48hufk
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/machine-pr-title.mjs", "we:scripts/operations/__tests__/machine-pr-title.test.mjs", "we:scripts/check-standards-rules.mjs", "we:scripts/__tests__/check-standards-rules-execfile-encoding.test.mjs", "we:scripts/check-standards.mjs", "we:scripts/__tests__/check-standards-execfile-encoding.test.mjs"]
scopeRationale: "The wrapper, minimal-context-provider and open-pr-items are read-only dependencies (the new rule only inspects the first two; none changes). we:scripts/check-standards.mjs is a one-line wiring change covered by the new check-standards-execfile-encoding test, so the broad we:scripts/__tests__/check-standards.test.mjs stays out of scope."
dateOpened: "2026-09-30"
preparedDate: "2026-10-02"
preparedAgainstSha: "a770bdad0ced4c8304349bd4476eeea4befd0f97"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3200's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval"). Preserve both prevention obligations: keep card display text from becoming machine identity, and catch implicit Buffer-returning subprocess calls before they reach string consumers.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3200@8a8a59c9f020a1705f602460b307435f3f601cc8

## Progress

- Original premise/scope: sanitize titles in `we:scripts/operations/machine-pr-title.mjs:7`, exercise extractors attributed to the nonexistent `we:lib/open-pr-items.mjs`, and add an encoding lint prompted by `we:scripts/operations/deliver-item-wrapper.mjs:2148`. The original scope listed only the title module, wrapper, and their two tests; it omitted the standards gate that the requested lint must change.
- Corrected premise: the extractors live in `we:scripts/lib/open-pr-items.mjs`. Its `declaredResolvedIdsFromPr` reads hash-only parentheses in titles (lines 432–439), subject to diff corroboration. `cleanTitle` in `we:scripts/operations/machine-pr-title.mjs:7` preserves those parentheses and hashes. A local Node probe generated `WE #4676: build — Guard (xabcdef)` and supplied a synthetic diff moving that hash card from open to active: numeric extraction and delivery returned only 4676, hash delivery returned null, but declared ride-along extraction returned xabcdef. With no corroborating diff the ride-along claim is rejected; do not describe this as unconditional resolution.
- Corrected subprocess locus: the historical wrapper line is no longer an executable subprocess call. `we:scripts/operations/deliver-item-wrapper.mjs:151` imports `run`; its metadata reads call that helper. `we:scripts/operations/minimal-context-provider.mjs:107` implements `run` with explicit UTF-8, and its git-root probe at line 56 also supplies UTF-8. Searching the wrapper found only comments mentioning `execFileSync`. The current default is already correct; the missing work is prevention, not restoring a missing encoding there.
- Corrected scope: change the title producer and its regression suite; add a pure encoding rule and gate integration with matching planned tests. Read the extractor and process helper as dependencies without changing their contracts. Bound the initial lint to the implicated delivery boundary: `we:scripts/operations/deliver-item-wrapper.mjs` and `we:scripts/operations/minimal-context-provider.mjs`. A repository-wide prohibition would additionally sweep intentional binary and ignored-output calls, including existing title-test setup, and is not required to guard this incident. The source/test pairs are all listed in scope; the two encoding test files are planned additions. No preparation stamp is authored here.

## Design

1. Use the review's explicitly offered producer-side prevention: remove ASCII parentheses from display text in `cleanTitle` in `we:scripts/operations/machine-pr-title.mjs`. Do not strip the actual item prefix or redesign the legacy extractors. Since the same cleaner currently participates in recognizing prevention-card formats, recognize those structured formats before stripping display parentheses; preserve the dedicated generated review-provenance suffix and its existing numeric-exclusion behavior. Keep ordinary subject words, Unicode bounds, and publication validation intact.
2. Extend `we:scripts/operations/__tests__/machine-pr-title.test.mjs` to send generated titles through all four title-reading extractors in `we:scripts/lib/open-pr-items.mjs`: numeric candidates, numeric delivery, hash delivery, and declared ride-along delivery. Exercise aggregate extraction through its public wrapper too. Use corroborating diffs so the ride-along regression cannot pass merely because evidence is missing. Legitimate body/diff delivery claims remain supported; subject sanitization is not a new policy for those claims.
3. Add a pure source rule in `we:scripts/check-standards-rules.mjs`, wired from `we:scripts/check-standards.mjs`, requiring an explicit encoding option on synchronous child-process calls in the two delivery-boundary files named in Progress. Use syntax-aware inspection, not a regex over comments: recognize imported aliases, namespace calls, and the local git probe's injected default alias. Missing options or an options object without encoding produces a file/line error. Explicit UTF-8 passes; explicit null denotes deliberate Buffer output and satisfies this explicitness rule. Resolve local options constants where statically available; report unprovable options rather than silently accepting them. This checks explicit intent, not general dataflow or whether callers can override the helper's default.
4. Integrate with the gate's existing full/local file selection. A full run inspects both boundary files; local runs inspect selected boundary files and do not silently skip the rule when its implementation changes. No repository-wide migration or runtime subprocess behavior change is part of this MVP.

## MVP

- Repair display sanitization while retaining prevention-card parsing, provenance, item identity, kind, and length limits.
- Add the extractor regression matrix in `we:scripts/operations/__tests__/machine-pr-title.test.mjs`.
- Implement and register the bounded encoding lint, with pure fixtures in planned `we:scripts/__tests__/check-standards-rules-execfile-encoding.test.mjs` and production-wiring coverage in planned `we:scripts/__tests__/check-standards-execfile-encoding.test.mjs`.
- Keep `we:scripts/lib/open-pr-items.mjs`, `we:scripts/operations/deliver-item-wrapper.mjs`, and `we:scripts/operations/minimal-context-provider.mjs` as read-only runtime dependencies unless implementation uncovers a new factual scope correction.

## Test plan

- Table-drive `(xabcdef)`, mixed-case hashes, multiple hashes separated by comma/plus/ampersand/and, nested parentheses, ordinary parentheses, numeric citations, and long subjects truncated near a marker. Test numeric and hash own identities, build and annotation kinds, and the legacy and descriptive prevention-card forms. Preserve each extractor's current distinction between citations, delivery, and annotation; numeric candidate extraction intentionally includes numeric citations and must not be redefined by this work.
- Assert no subject-only hash becomes a declared ride-along even when a synthetic card-status transition corroborates that hash. Include positive controls for real leading hash identity and legitimate body-declared ride-alongs. Exercise `machinePrTitle` and `publicationTitle`, retaining existing provenance and Unicode tests.
- Encoding fixtures: omitted options, empty options, multiline calls, imported aliases, namespace calls, injected git-probe alias, local option constants, comments/string literals containing fake calls, explicit UTF-8, explicit null, and unresolved dynamic options. Assert actionable file/line diagnostics and no comment/string false positives.
- Gate integration: in a disposable fixture/worktree, remove encoding from the real shared helper and separately introduce an unencoded call in the wrapper. Both mutations must fail full and applicable local checks; restored sources must pass. Do not execute mutated subprocess code.
- Run the focused Vitest suites for the three test files in scope, plus existing `we:scripts/lib/__tests__/open-pr-items.test.mjs` and `we:scripts/operations/__tests__/minimal-context-provider.test.mjs`. Run `npm run check:standards` after implementation.

## Proof plan

- Record a before/after execution of the exact parenthesized-hash probe described in Progress, including generated title, corroborating diff, and all four extractor outputs. Before: xabcdef is a declared ride-along. After: it is absent while the actual own identity still survives.
- Demonstrate each encoding mutation fails through the real standards-gate entry point, not only the pure helper. Capture command, exit status, and file/line diagnostic, then restore the fixture and demonstrate a pass.
- Record focused test totals and the standards-gate result. These are local deterministic checks; no live PR publication, delivery worker, or auto-resolution is necessary.

## Done when

Both prevention guards are executable: the title regression fails against the previous sanitizer and passes with the fix, and removing explicit encoding at either protected delivery boundary makes the real standards gate fail. Existing title/provenance and extractor semantics remain covered, and all focused tests and the standards gate pass.

## Follow-ups

- Repository-wide expansion of the encoding lint is separate work requiring an inventory of binary/ignored-output uses and their matching tests; this item protects the observed delivery boundary only.
- Do not broaden this item into changing ride-along evidence policy, removing legitimate structured claims from human-authored PRs, or replacing subprocess helpers. Any newly observed unrelated defect should be recorded separately during implementation.
