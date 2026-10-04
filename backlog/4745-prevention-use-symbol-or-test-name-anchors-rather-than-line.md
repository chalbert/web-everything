---
bornAs: x7s2d6i
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:docs/agent/conventions.md", "we:scripts/check-standards-rules.mjs", "we:scripts/__tests__/check-standards-rules-content-lint.test.mjs", "we:backlog/4672-file-the-prevention-guard-s-owed-by-chalbert-web-everything.md"]
dateOpened: "2026-10-02"
preparedDate: "2026-10-03"
preparedAgainstSha: "4ace970ea8709671b7acbf98cfd4cba168392deb"
tags: []
---

# Prevention — Use symbol or test-name anchors rather than line numbers for provenance references in backlog cards, or… (from chalbert/web-everything#3624 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4672-file-the-prevention-guard-s-owed-by-chalbert-web-everything.md` → Progress — Use symbol or test-name anchors rather than line numbers for provenance references in backlog cards, or add a card-lint rule that resolves we:path:line references against the file. Filing this is optional given the cosmetic impact.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3624@13f3590c8658e861a0136cc57708569873a885f5

## Done when

1. **Executable — Musts 1–3:** `npx vitest run -t '4745'` passes with a nonzero matched test count. The new warning cases fail against the preparation base and pass after implementation.
2. **Musts 1–3:** `npm run check:standards` passes; run the complete scoped content-lint test file as well. Demonstrate the warning through `lintBacklogItemRendering`, then replace the numeric-only citation with its named anchor and show that warning disappears.

## Progress

Preparation research (2026-10-03), without stamping:

- **Old premise/scope:** the mechanically filed item pointed only at a numbered line in `we:backlog/4672-file-the-prevention-guard-s-owed-by-chalbert-web-everything.md`. That card is provenance for the prevention request, not the implementation home for a reusable guard.
- **Corrected premise:** that card's Progress still cites implementation and tests by line number. The live sources it discusses include `GUARD_RELAXATION_HINT` and `renderItem` in `we:scripts/backlog/scaffold.mjs`, plus `findGuardRelaxationGaps`, `findNegativeClaimGaps`, and `lintBacklogItemRendering` in `we:scripts/check-standards-rules.mjs`. Its existing scaffold-preservation test is named “#4409 a freshly scaffolded, non-relaxing card has no gap (hint does not trigger)” in `we:scripts/__tests__/check-standards-rules-content-lint.test.mjs`. These are stable search targets; a line number alone does not identify the asserted behavior.
- **Source evidence:** the Repo-locus code-path references section of `we:docs/agent/conventions.md` explicitly permits line references. Its separate identifier-provenance rule excludes backlog cards. In `we:scripts/audit-backlog-health.mjs`, `resolveRef` strips a numeric suffix and tests file existence; `deadFileRefs` is not a line-content verifier. The existing `lintBacklogItemRendering` warning integration and its tests in `we:scripts/__tests__/check-standards-rules-content-lint.test.mjs` provide the narrower extension point.
- **Observed probe:** importing `lintBacklogItemRendering` and passing an open synthetic card citing `we:scripts/backlog/scaffold.mjs:999999` returned empty errors and warnings. The prevention is not already delivered.
- **Corrected scope:** document the anchor convention, add a bounded warning in the existing content lint with its matching test file, and migrate the motivating card's mutable implementation citations. The shared content-lint tests cover the convention's examples and a fixture reflecting that card. No runtime, health-audit implementation, or resolved-card migration is required.

## Design

Use the request's symbol/test-name anchor approach. A numeric coordinate can remain useful for navigation, but mutable provenance should identify what to search for. Document a machine-recognizable citation form in `we:docs/agent/conventions.md`: a locus-prefixed path followed by ` → ` and a backticked symbol, exact test title, or documentation heading on the same logical line. A hard-wrapped continuation belongs to that line until a blank line, heading, or next list item. This is a textual search anchor, not a promise of a rendered fragment link. Paths without numeric suffixes remain valid under the existing conventions.

Add a pure finder in `we:scripts/check-standards-rules.mjs` for numeric-only provenance citations. Examine standalone backticked locus-prefixed file paths outside fenced code; recognize `:N` and `:N-M` suffixes and the existing short/full repository aliases. If the reference has no following arrow and nonempty backticked anchor in its logical line, return its token and body line. A following second path is not an anchor. Wire findings into `lintBacklogItemRendering` warnings for non-resolved cards, advising a symbol, exact test title, or heading. Keep this advisory, consistent with adjacent content-quality warnings; no file reads, sibling-checkout dependency, symbol-existence claims, or semantic truth claims are added.

Update the mutable implementation references in the motivating `we:backlog/4672-file-the-prevention-guard-s-owed-by-chalbert-web-everything.md` to path-plus-anchor citations, checking each named symbol/test against source. Historical review quotations and the approval idempotency key retain their original meaning. A quote that retains its original numeric reference may acquire a following verified heading anchor without rewriting the quoted finding. Do not change that card's requirements or preparation metadata as part of implementation.

## MVP

- **Must 1:** the convention explains stable search anchors, optional numeric coordinates, and the warning's bounded syntax and limitations.
- **Must 2:** a pure detector and actual content-lint integration warn for unanchored numeric citations on non-resolved cards.
- **Must 3:** the motivating card's live implementation/test citations use verified names, with regression fixtures for those shapes.

Implementation/test mapping: `we:scripts/check-standards-rules.mjs`, the examples in `we:docs/agent/conventions.md`, and the migrated citation shapes from `we:backlog/4672-file-the-prevention-guard-s-owed-by-chalbert-web-everything.md` are covered by `we:scripts/__tests__/check-standards-rules-content-lint.test.mjs`. Documentation fixtures test the documented grammar rather than snapshotting entire cards.

## Test plan

Use 4745 in every added test name.

- **Capability — unanchored citations:** singles, ranges, repeated references, each repository alias/full name, and single-segment filenames produce precise findings. Include the observed impossible-line probe and the motivating card's old citation shapes. Red today: no corresponding warning exists.
- **Capability — integration:** an open card produces an actionable provenance warning through `lintBacklogItemRendering`; include active, preparing, and parked statuses. Red today: the entry point is silent.
- **Capability — incomplete anchor:** empty anchors, arrow-only suffixes, a second path used as an anchor, and an anchor on the next list item still warn. Red today: no detector checks them.
- **Preservation — named citations:** symbols, exact test titles, and headings clear the new warning, including a hard-wrapped continuation and a numeric range followed by a valid anchor. Include the verified scaffold test title. Mutation: remove anchor recognition; these fixtures fail.
- **Preservation — boundaries:** unnumbered paths, URLs, npm package names, executable command spans, fenced examples, and resolved cards receive no new warning. Mutation: scan fences/commands, drop the numeric-suffix requirement, or remove the resolved-status guard; the corresponding fixtures fail.
- **Preservation — file kinds and scope:** code, Markdown documentation, JSON data, and configuration citations follow the same grammar; tests exercise named anchors for each. Mutation: limit matching to JavaScript extensions; the unanchored non-JavaScript capability cases fail. Existing content-lint diagnostics remain unchanged; mutation: replace rather than append the warning collection and an existing diagnostic assertion fails.

## Proof plan

First add the focused fixtures and run the Done when selection against the base; record the failed capability assertions and matched count. Implement the guard and repeat, then run the entire `we:scripts/__tests__/check-standards-rules-content-lint.test.mjs` suite using its local filesystem path as the runner operand. Repository prefixes belong to documentation, not shell file arguments.

Replay the direct-import probe through `lintBacklogItemRendering` before and after, then attach the verified `GUARD_RELAXATION_HINT` anchor and observe removal of only the new warning. Replay representative migrated-card snippets through the same production entry point. Search the actual source/test files for every migrated name; a syntactically accepted anchor is not evidence that its surrounding claim is true.

Run `npm run check:standards`, inspect new warnings, and separate baseline failures from changes. Apply each named test mutation individually, observe the expected failure, and restore it. Preparation only authors this card; implementation, mutation runs, and runner-owned checks happen later.

## Follow-ups

- Resolving numeric ranges against file contents is the original request's alternative, not part of this anchor-based MVP. In-bounds coordinates alone cannot prove the cited behavior.
- Broader anchor existence checking, semantic claim verification, non-backticked citations, and repository-wide historical migration require separate evidence and scope. The existing health audit continues to own missing-file findings.
