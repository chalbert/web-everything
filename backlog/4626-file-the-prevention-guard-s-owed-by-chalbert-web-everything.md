---
bornAs: xtpnwj3
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/git-already-done.mjs", "we:scripts/lib/__tests__/git-already-done.test.mjs", "we:scripts/lib/__tests__/gh-cost-git-paths.test.mjs", "we:scripts/lib/gh-throttle.mjs", "we:scripts/lib/__tests__/gh-throttle.test.mjs", "we:scripts/lib/pr-limit.mjs", "we:scripts/lib/__tests__/pr-limit.test.mjs", "we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/operations/__tests__/dispatch-lane-io.test.mjs", "we:scripts/operations/__tests__/dispatch-lane-defaults.test.mjs", "we:scripts/lib/github-remote-identity.mjs", "we:scripts/lib/__tests__/github-remote-identity.test.mjs", "we:scripts/lib/approval-prevention-guards.mjs", "we:scripts/lib/__tests__/approval-prevention-guards.test.mjs", "we:scripts/check-standards.mjs", "we:scripts/__tests__/check-standards.test.mjs"]
dateOpened: "2026-09-30"
preparedDate: "2026-10-02"
preparedAgainstSha: "db98be3296929218431ced01a9ca0982b5f8f5c5"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3103's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval"). Preserve the six owed protections: bookkeeping-safe local negatives; real Git ancestry/rename fixtures; duplicate-query-safe GraphQL classification with an exemption regression gate; shared remote identity with an anti-duplication lint; stacked-merge safety; and undefined-name detection. The approval was not blocked by this debt.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3103@ddf54d52bdeef81f03c00c6aa7883afacc9dcb0c

## Progress

Preparation research against the acquired checkout (no preparation stamp applied):

- **Validation repair — old scope:** the dispatch source mapped only to existing `we:scripts/operations/__tests__/dispatch-lane-defaults.test.mjs`. **Corrected scope:** also include planned `we:scripts/operations/__tests__/dispatch-lane-io.test.mjs` for the two default-wrapper identity and stacked-fallback regressions. Source evidence: both wrappers live in `we:scripts/operations/dispatch-lane-io.mjs`; the existing defaults suite imports both, but no matching dispatch-lane-io suite exists yet. Preserve the existing defaults coverage alongside the planned suite.

- **Old premise/scope:** six review suggestions with historical line numbers, three runtime modules and four test paths. **Corrected premise/scope:** the protections remain owed, but implementation also needs the actual fallback owner, a shared identity helper, and executable lint integration, each with matching tests in scope. `we:scripts/lib/__tests__/git-already-done.test.mjs` is planned, not an existing suite. Existing coverage lives in `we:scripts/lib/__tests__/gh-cost-git-paths.test.mjs`; its Git executor is mocked, so it does not establish real ancestry or rename behavior.
- Replace historical `we:scripts/lib/git-already-done.mjs:17`, `:44`, and `:49` citations with the current `readGitAlreadyDone` branches: remote parsing at line 20, first-parent log at line 43, one-parent ambiguity at lines 49–53, and custom-merge ancestry at lines 56–60. The parser still matches an unanchored host substring; the reader still excludes lane heads from its other-base guard and only traverses first parents. Commit 5388156ec added the non-main-base fallback, not the stacked-lane regression or identity protection.
- The two fallback parsers are in `we:scripts/operations/dispatch-lane-io.mjs:2963` and `we:scripts/operations/dispatch-lane-io.mjs:3065`. They must share validation with the reader. Expected repo metadata already exists in `we:scripts/lib/constellation-repos.mjs`.
- `we:scripts/lib/gh-throttle.mjs:307` owns `classifyGhWrite`; lines 322–327 inspect only the first separated raw query and miss attached body flags. Direct imported-function probes returned false for both a safe query followed by a typed mutation query and an attached mutation field. These are observed missing guards, not already-delivered work.
- A direct injected-Git probe returned null for `drain: mark card 4453 resolved on land (#2748)` and a checked negative for an unrelated item under an `evilgithub.com` remote. Real first-parent subjects are available at 79ae244c8 (JIT numbering) and 8acdb4dc2 (mark-card). Their producers are `we:scripts/lane-drain.mjs:957` and `we:scripts/lane-drain.mjs:1200`.
- The historical `we:scripts/lib/pr-limit.mjs:181` citation no longer identifies a missing import. `fetchPrCommits` currently calls imported `readGitPrCommits` and `meteredPrCommits`; the owed work is prevention, not asserting that the old undefined-name failure still exists. Neither `we:package.json` nor `we:scripts/check-standards.mjs` currently wires a no-undefined-name guard. TypeScript is already a direct development dependency.
- The original “dispatch-plan test already builds one” hint is not a usable Git-fixture citation: the relevant temporary directory in `we:scripts/readiness/__tests__/dispatch-plan.test.mjs` holds an authorship cache. Build a self-contained Git repository fixture in the planned reader suite instead.

## Design

1. Keep the reader's tri-state contract: a proven negative is `{ done: false, pr: null, checked: true }`; uncertainty is null and invokes the existing host fallback. Exempt recognized drain bookkeeping subjects from the one-parent ambiguity check only when their changed paths are backlog bookkeeping. Unknown `drain:` subjects and source-changing lookalikes remain uncertain. Replay the actual JIT-number and mark-card forms, including multiple aliases. Preserve implementation/squash and body-disclaimer safety.
2. Detect relevant implementing merges reachable through second-parent ancestry. Inspect merge commits outside the first-parent chain with the same alias normalization and candidate filter; return null for a potentially implementing nested PR. Do not infer a definitive positive from an incomplete Git PR body. This closes the case where an implementing PR entered a lane base and main later received that lane under an unrelated title, even if the lane branch has been deleted.
3. Normalize all field spellings in `classifyGhWrite` before granting the GraphQL read exemption: separated -f/-F/--field/--raw-field, attached short values, and long equals forms. Count every query key; only one visible inline query with no mutation is exempt. Duplicate queries, hidden file/input bodies (including equals forms), malformed values, and mutation bodies stay writes. Preserve explicit GET/HEAD behavior and existing metered-read argv behavior.
4. Add `we:scripts/lib/github-remote-identity.mjs` with a pure remote-plus-expected-slug validator. Accept anchored GitHub HTTPS, SSH URL, and SCP forms with an optional .git suffix; reject lookalike hosts, credentials disguising a foreign host, extra path components, and wrong owner/repo. Pass the expected slug through the reader and both dispatch wrappers, using the existing WE default from `we:scripts/lib/constellation-repos.mjs` and allowing an explicit constellation slug. Invalid identity cannot produce a local checked negative or select an attacker-derived API repo; return unchecked from the wrappers. Preserve existing subprocess bounds.
5. Add pure guards in `we:scripts/lib/approval-prevention-guards.mjs`, invoked by `we:scripts/check-standards.mjs`: reject ad-hoc remote parsing in the three protected consumers; require named duplicate-key regression cases for each declared GraphQL read exemption; and detect unresolved identifier references in the protected runtime modules. Use the installed TypeScript compiler's JavaScript semantic diagnostics for undefined names (including shorthand-property/name-suggestion variants), without enabling unrelated type/style checks. Exercise the scanner against controlled missing-import fixtures. Report file-attributed findings so scoped standards checks retain their existing semantics. The exemption gate checks case enrollment; Vitest proves behavior rather than treating a test-name match as proof.

## MVP

Deliver all six owed protections together. Add the identity helper and guard module; update the reader, classifier, both fallback wrappers, and standards integration. Retain `we:scripts/lib/pr-limit.mjs` in the guarded source set and fix any undefined references the new scan actually demonstrates. No repository-wide style migration or alternate dispatch policy is needed.

Source-to-test mapping (new files are explicitly planned):

- `we:scripts/lib/git-already-done.mjs` → planned `we:scripts/lib/__tests__/git-already-done.test.mjs` plus existing `we:scripts/lib/__tests__/gh-cost-git-paths.test.mjs`.
- `we:scripts/lib/gh-throttle.mjs` → existing `we:scripts/lib/__tests__/gh-throttle.test.mjs`.
- `we:scripts/lib/pr-limit.mjs` → existing `we:scripts/lib/__tests__/pr-limit.test.mjs`, plus planned undefined-name fixtures in `we:scripts/lib/__tests__/approval-prevention-guards.test.mjs`.
- `we:scripts/operations/dispatch-lane-io.mjs` → planned `we:scripts/operations/__tests__/dispatch-lane-io.test.mjs` for both wrappers’ identity and stacked-fallback regressions, plus existing `we:scripts/operations/__tests__/dispatch-lane-defaults.test.mjs`.
- Planned `we:scripts/lib/github-remote-identity.mjs` → planned `we:scripts/lib/__tests__/github-remote-identity.test.mjs`.
- Planned `we:scripts/lib/approval-prevention-guards.mjs` → planned `we:scripts/lib/__tests__/approval-prevention-guards.test.mjs`.
- `we:scripts/check-standards.mjs` → existing `we:scripts/__tests__/check-standards.test.mjs` integration coverage.

## Test plan

- Build temporary bare origin and working repositories with deterministic authors, dates and merge graphs; execute real Git commands. Use a narrow injected transport shim for origin identity/fetch routing to keep the fixture offline while exercising actual log, diff and merge-base behavior. Isolate reader TTL state with unique directories and remove fixtures in teardown.
- Replay a pinned real first-parent slice containing numbering and mark-card subjects, preserving ordering and parent counts. Record source SHAs inside the test. Assert a checked negative without a host call; assert that a source-changing drain lookalike and a squash implementation still fall back.
- Place a nonstandard merge before item birth (negative remains provable), then after birth (fallback). Repeat with an xhash birth and later numbered-card rename; use graph ancestry despite deliberately misleading timestamps.
- Merge an implementing PR into a lane base, then merge that base into main under an unrelated title. Cover both present and deleted lane refs. Assert null locally, and a positive result through both wrappers with a stubbed authoritative host response. Never assert a checked negative for that graph.
- Table-drive every pair/order of field flag spellings, duplicate read/read and read/mutation values, file values, equals-form input, missing values, one ordinary query, one typed inline query, and explicit methods. Re-run metered argv coverage to prevent loss of the intended read exemption.
- Test identity acceptance and lookalike rejection at the helper and both real default-wrapper branches; mock the throttled transports at module boundaries so injecting an alternate executor does not accidentally bypass those branches. Assert no foreign-repo API request and preserve timeout/kill-signal options.
- Mutate scanner fixtures: add an unregistered exemption, remove its duplicate-query case, insert an ad-hoc remote regex, and remove a referenced import. Each produces the expected file-attributed failure; valid imports, local bindings, standard Node globals and shared-helper use pass. Check scoped and full standards integration.

## Proof plan

The implementer first lands the regression assertions locally and records failing output against the unchanged runtime, then records passing output after the guards. Run focused Vitest on every test path in scope, followed by `npm run check:standards`. `we:vitest.config.ts` already includes the planned test locations, so the normal test gate must discover them without a new runner. Record test counts and commands, the pinned historical slice SHAs, and Git-versus-host call counts for local negatives and stacked fallbacks. Use only temporary repositories and stubbed host responses; no production mutation or live API dependency is needed. A green mocked-log test alone is insufficient evidence for ancestry correctness.

## Done when

All six protections have executable coverage. The focused suites fail on the original classifier/identity/history defects and pass with the implementation; deliberate missing-import, remote-parser and exemption-enrollment mutations fail the standards guard. Both dispatch entry points retain conservative fallback behavior, and the normal standards and affected-test gates pass.

## Follow-ups

No part of the six owed protections is deferred. Broader adoption of the identity helper or undefined-name scan beyond these protected consumers can be separate work after this bounded guard is proven. Keep the original approval idempotency key so automation does not file this same debt again.
