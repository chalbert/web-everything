---
bornAs: xq2sk5f
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/git-already-done.mjs", "we:scripts/lib/gh-spend.mjs", "we:scripts/lib/gh-throttle.mjs", "we:scripts/lib/pr-limit.mjs", "we:scripts/lib/__tests__/git-already-done.test.mjs", "we:scripts/lib/__tests__/gh-spend.test.mjs", "we:scripts/lib/__tests__/gh-throttle.test.mjs", "we:scripts/lib/__tests__/pr-limit.test.mjs", "we:scripts/lib/__tests__/gh-cost-git-paths.test.mjs"]
dateOpened: "2026-09-30"
preparedDate: "2026-10-02"
preparedAgainstSha: "7c984d08a012092f5e6a16cd7090251425ded810"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3103's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

The remaining guards cover local already-done evidence and caching, GraphQL write classification, spend-report interpretation, and undeclared identifiers. Current implementation details and corrected acceptance criteria follow below.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3103@db48eb4d75fd94d5c0b35b310e431b9710679415

## Progress

Preparation research against `7c984d08a012092f5e6a16cd7090251425ded810` (not a preparation stamp).

- **Old premise/scope:** seven review notes cited historical line numbers in four source modules and assumed four matching test files existed. They requested a negative git answer for a drain fixture, per-window caching, caller/gap reconciliation or disclosure, two overlapping GraphQL guards, rebase equivalence, and static undeclared-name prevention.
- **Corrected premise/scope:** retain all seven obligations, combine the two classifier guards, and add the existing shared regression suite to scope. `we:scripts/lib/__tests__/git-already-done.test.mjs` is planned, not existing. Existing git coverage lives in `we:scripts/lib/__tests__/gh-cost-git-paths.test.mjs:110`; its assertion that unrelated one-parent messages prove a negative must change alongside the new rebase guard. Other named test files exist.
- **Git evidence:** `we:scripts/lib/git-already-done.mjs:22` caches successful fetches only; alias and first-parent scans at lines 37 and 43 repeat for every item. The one-parent branch at line 49 checks item text only. It cannot exclude a rebase PR whose title names the item but whose commits do not. A drain-only fixture may prove a negative only when the remaining relevant history is provable; a real arbitrary main slice is not automatically complete evidence. Real drain exemplar: commit `79ae244c806cec868e627b428157875f10050946`, subject “drain: JIT-number xdg3k9p→#4686, xzv8r3e→#4687 at land (#2288)”.
- **Spend evidence:** `we:scripts/lib/gh-spend.mjs:172` deliberately records full response costs for callers while clipping gap attribution to observed movement. The agreement comment at line 176 is stale; `renderSpendReport` at line 529 does not disclose non-reconciliation. Preserve this behavior and implement the original disclosure alternative, with a regression proving the distinction.
- **Classifier evidence:** `we:scripts/lib/gh-throttle.mjs:307` still uses the first query field and exact-token payload flags. A direct Node probe returned `false` for both a read query followed by a typed mutation query and equals-form hidden input. `scanGhApiFlags` at line 377 already recognizes more spellings, but does not expose field values; extend/reuse that scanner rather than create a competing parser.
- **Static-gate evidence:** `we:scripts/lib/pr-limit.mjs` imports `writeAllSync` now; this is prevention, not a claim that the old undeclared reference survives. `we:scripts/lib/__tests__/pr-limit.test.mjs` has behavioral tests but no undeclared-name gate. TypeScript is already a dependency in `we:package.json`; use its semantic checker inside the existing test suite without adding a repository-wide lint migration.

## Design

1. **Evidence-safe git index.** In `we:scripts/lib/git-already-done.mjs`, cache the parsed first-parent records and complete number-to-alias map per fetch key for the existing 60-second window. Cache failed refreshes as unavailable for that same window; never serve an expired successful snapshot after a failed refresh. Keep injected git clients isolated so tests cannot share stale entries. Item birth and filter results remain item-specific. Return `null` whenever missing PR metadata prevents a negative answer, including unrelated squash/rebase messages after item birth or when birth is unknown. Exempt only the exact anchored drain-numbering message grammar, not any message containing “JIT-number”; retain ancestry checks for older history. Do not convert uncertainty into `{ done: false }`.
2. **Spend disclosure.** In `we:scripts/lib/gh-spend.mjs`, state in the report header that caller/op columns are response costs and can exceed bucket-attributed totals under overlapping observations. Correct the contradictory agreement comment. Preserve the existing bucket conservation equation: attributed + estimated + unattributed = bucketUsed. No accounting-policy change or persistence migration.
3. **Conservative GraphQL classification.** In `we:scripts/lib/gh-throttle.mjs`, reuse the flag scanner with additive field-value metadata. Grant the inline GraphQL read exemption only for exactly one query field, in the already-supported raw-field form, with no hidden input/file value and no mutation keyword in any field value. Duplicate, typed-query, missing, malformed, or hidden payloads stay writes. Cover separate, equals, attached-short and clustered-short spellings. Preserve explicit GET/HEAD semantics and use the scanner's effective last method for repeated method flags; retain the stricter independent personal-read routing contract.
4. **Undeclared-name prevention.** Add a TypeScript compiler-API check in `we:scripts/lib/__tests__/pr-limit.test.mjs`, using JavaScript checking with Node/ES-module globals, restricted to semantic undeclared-name diagnostics in `we:scripts/lib/pr-limit.mjs`. Include both missing-name and suggested-name diagnostic forms. A mutated in-memory copy with an undeclared identifier must be rejected, including in a branch never executed by tests; the unchanged module must pass. Avoid unrelated type/style enforcement or blanket diagnostic suppression.

## MVP

- Add the planned `we:scripts/lib/__tests__/git-already-done.test.mjs`, with an inline, provenance-labelled real drain log excerpt and deterministic injected git/clock fixtures. Implement snapshot/failure caching and conservative metadata fallback together; update the contradictory existing expectation in `we:scripts/lib/__tests__/gh-cost-git-paths.test.mjs`.
- Extend `we:scripts/lib/__tests__/gh-throttle.test.mjs` with the payload/method matrix and implement the shared scanner changes in `we:scripts/lib/gh-throttle.mjs`.
- Add an overlapping-cost example and report-header assertion in `we:scripts/lib/__tests__/gh-spend.test.mjs`, then update `we:scripts/lib/gh-spend.mjs`.
- Add the static semantic gate and its positive/negative controls to `we:scripts/lib/__tests__/pr-limit.test.mjs`. Change `we:scripts/lib/pr-limit.mjs` only if that gate reveals an actual undeclared name.

## Test plan

- Git: N different IDs in one clock window cause one fetch, one numbering scan and one first-parent scan; crossing the TTL refreshes once. A failed fetch is attempted once per window and yields `null` throughout; next-window recovery works. Exercise separate repositories/injected clients, malformed logs, alias resolution and ancestry failures.
- Git evidence: exact real drain grammar alone does not force fallback; near-matching/non-drain one-parent commits do. Pair a host fixture with a matching PR title and nonmatching rebase commit messages: local result must be `null`, permitting the host's positive result. A negative drain fixture must explicitly supply complete, otherwise provable relevant history. Keep shallow/other-base and body-uncertainty guards covered.
- Classifier: table-test duplicate query fields in both orders, mixed raw/typed fields, mutation text in a later field, separate/equals hidden input and file values, attached/clustered payloads, malformed fields and repeated methods. Retain ordinary inline read-query positives and existing read-routing tests.
- Spend: construct overlapping observations with explicit response costs; assert caller totals can exceed gap attribution, each gap conserves observed movement, and the header explains why. Keep baseline/stale-counter and installation-isolation tests green.
- Static analysis: assert zero undeclared-name diagnostics on the real module; inject an undeclared name in a cold branch and assert detection, with a declared-local control. Use the existing TypeScript dependency, not a string/regex name search.

## Proof plan

Implementation proof runs the targeted Vitest suite with these repository-relative arguments (strip the `we:` locus prefix when executing): `we:scripts/lib/__tests__/git-already-done.test.mjs`, `we:scripts/lib/__tests__/gh-cost-git-paths.test.mjs`, `we:scripts/lib/__tests__/gh-spend.test.mjs`, `we:scripts/lib/__tests__/gh-throttle.test.mjs`, and `we:scripts/lib/__tests__/pr-limit.test.mjs`. Command shape: `npx vitest run <the five paths>`. Run the remaining existing `we:scripts/lib/__tests__/gh-throttle*.test.mjs` suites for scanner-consumer regressions, then `npm run check:standards` through the repository's normal admission workflow.

Capture red results for the new behavioral assertions against the pre-change implementations, then green results after implementation. For the static gate, capture the mutated-source rejection and unchanged-source acceptance. Report exact spawn counts at both sides of the TTL and the overlapping-spend fixture's caller versus bucket totals. No live GitHub calls, rate-limit spending, or operator-state writes are needed. These are delivery checks, not claims that implementation passed during preparation; the runner owns preparation checks and stamping.

## Done when

All seven review obligations have executable coverage or the expressly allowed spend-header disclosure with a regression test. The five-suite command above passes after implementation, with recorded pre-change failures for the missing guards. Every source module has its matching test in scope, the shared git expectation is corrected, and no unprovable git negative is introduced to satisfy the drain test.

## Follow-ups

No separate follow-up is required to complete this card. Repository-wide static analysis rollout, persistent cross-process git caching, and changes to spend-attribution policy are outside this bounded prevention work. Do not defer any of the seven owed guards to those broader projects.
