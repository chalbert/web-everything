---
bornAs: xus9wgs
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/ci-heal-escalation-mark.mjs", "we:scripts/conveyor/__tests__/ci-heal-escalation-mark.test.mjs", "we:scripts/lane-pool.mjs", "we:scripts/__tests__/lane-pool-acquire-lock-contention.test.mjs", "we:scripts/lib/acquirable-list-cache.mjs", "we:scripts/lib/__tests__/acquirable-list-cache.test.mjs", "we:scripts/lib/module-import-validation.mjs", "we:scripts/lib/__tests__/module-import-validation.test.mjs", "we:scripts/check-standards.mjs", "we:scripts/__tests__/check-standards-module-import-validation.test.mjs"]
dateOpened: "2026-09-30"
preparedDate: "2026-10-02"
preparedAgainstSha: "2c3fbe13ae553b425eda8d0ce7a21b25a8e412b6"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3186's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. Harden `buildCiHealEscalationComment` in `we:scripts/conveyor/ci-heal-escalation-mark.mjs`: bound and flatten the reason, redact URLs/credentials, and neutralize embedded comment markers. Cover a multiline 10 KB reason containing a fake marker.
2. Add deterministic caller-deadline coverage for the shared scan-lock wait in `we:scripts/lane-pool.mjs`, supplementing the existing subprocess test in `we:scripts/__tests__/lane-pool-acquire-lock-contention.test.mjs`.
3. Add static named-import/export validation to `check:standards` through `we:scripts/check-standards.mjs`, covering the escalation module and other local script ESM dependencies without executing those modules.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3186@8ea5f49a4291163851018d6af685155d068598d7

## Progress

- Premise checked against checkout `2c3fbe13a`. Original scope attributed the formatter to `we:scripts/operations/probation-heal-run.mjs:107`, cited `we:scripts/__tests__/lane-pool-acquire-lock-contention.test.mjs:98`, and placed the import guard at `we:scripts/conveyor/ci-heal-escalation-mark.mjs:237`.
- Corrected formatter locus: `we:scripts/conveyor/ci-heal-escalation-mark.mjs:76` defines it and line 91 interpolates the reason verbatim. The runner only forwards the reason through its escalation adapter at `we:scripts/operations/probation-heal-run.mjs:323`. A read-only invocation with a 10,330-character synthetic reason produced a 10,611-character comment retaining both URL credentials and an injected standalone system-fix field. This debt is not already delivered.
- Corrected deadline premise: `we:scripts/lane-pool.mjs:2946` owns the cache/lock loop; line 2977 already checks the caller deadline. The test beginning at `we:scripts/__tests__/lane-pool-acquire-lock-contention.test.mjs:85` now installs a live lock before launching five contenders, checks contention diagnostics and no scanning, then verifies acquisition after release. It still uses a real 500 ms wait and subprocess timeouts, not an injected clock. Preserve that integration coverage and add the missing deterministic deadline proof.
- Corrected gate premise: `we:scripts/conveyor/ci-heal-escalation-mark.mjs:237` is CLI usage handling, not a validation seam. Section 16 at `we:scripts/check-standards.mjs:2714` checks declared dependency comments, not whether target modules export imported names. The graduation checker in `we:scripts/graduation-import-check.mjs` checks dependency placement/existence, not named-export validity.
- Scope correction: remove the runner and its test from implementation scope; add the actual lane source, a planned extracted cache-loop module and matching tests, plus a planned static validator and gate-wiring test. Each source entry has an existing or planned matching test. No stamping or delivery is performed during preparation.

## Design

1. At the formatter boundary in `we:scripts/conveyor/ci-heal-escalation-mark.mjs`, normalize reason whitespace to a single line, redact credential-shaped values using the existing `redactCommandLine` from `we:scripts/operations/command-redact.mjs`, replace whole scheme URLs with a redaction placeholder, neutralize HTML comment delimiters, and cap the resulting reason at 1,000 characters including a truncation ellipsis. Apply redaction before the final cap so a credential crossing the boundary cannot leak a prefix. Keep the canonical first-line marker, outcome, head, optional system-fix, and auth diagnosis structure unchanged. Empty reasons remain omitted. Preserve ordinary short reason text, particularly reasons recognized by retry logic in the same module. Redaction covers explicit credential shapes, not arbitrary unlabeled secrets.
2. Extract the production cache/lock loop into planned `we:scripts/lib/acquirable-list-cache.mjs`, passing its existing filesystem/lock/scan operations plus clock and sleep as adapters from `we:scripts/lane-pool.mjs`. Do not import the CLI into unit tests: it dispatches at module evaluation. Preserve cache-hit, lock ownership, stale-owner takeover, release-in-finally, scan-budget, and contention-error semantics. The caller deadline bounds waiting behind another owner's lock independently of the owner's scan timeout; it does not cancel an owned scan. Clamp contention sleeps to the remaining caller budget and check expiration before another wait/fallback scan. Keep the null-deadline behavior for list callers.
3. Implement a static local ESM graph validator in planned `we:scripts/lib/module-import-validation.mjs`, wired into `we:scripts/check-standards.mjs`. Use the already installed TypeScript parser (existing precedent: `we:scripts/lib/multi-repo-scan.mjs`) rather than regex-only symbol extraction or runtime imports. Scan script ESM sources and tests for relative explicit-extension ESM dependencies; validate named imports and named re-exports against target export tables, including aliases, default-as-named imports, transitive star re-exports, and cycles. Star exports exclude default and ambiguous bindings must not satisfy an import. Missing local targets and syntax errors are findings with importer, specifier, and symbol context. Built-ins, packages, dynamic imports, CommonJS and non-JavaScript assets are explicitly outside this initial static named-export check. Preserve existing scoped-gate attribution; inspect transitive targets even when outside the changed-file set, and ensure changed exporters cause their importers to be revalidated. No module under inspection is executed.

## MVP

- Ship the three owed guards together: reason hardening with hostile-input regression coverage; the production loop adapter seam with deterministic deadline tests; and the static validator with executable standards-gate wiring.
- Retain the existing real-process lock-contention test in `we:scripts/__tests__/lane-pool-acquire-lock-contention.test.mjs`. Keep the extraction behavior-preserving except for bounding the last contention sleep by the caller's remaining budget.
- Add planned unit suites `we:scripts/lib/__tests__/acquirable-list-cache.test.mjs` and `we:scripts/lib/__tests__/module-import-validation.test.mjs`, plus planned wiring coverage in `we:scripts/__tests__/check-standards-module-import-validation.test.mjs`. Extend `we:scripts/conveyor/__tests__/ci-heal-escalation-mark.test.mjs` for formatter regressions. No new dependency or live GitHub write is needed.

## Test plan

- Formatter: a multiline 10 KB reason with CR/LF, a fake marker, an injected system-fix line, URL userinfo/query credentials, bearer/assignment credentials, and a secret crossing the cap. Assert one reason line, length at most 1,000, no raw secrets/URLs or executable comment delimiter from the reason, and correct trusted-author build/parse round-trip. Assert empty and short ordinary reasons, existing retry classifications, all three outcomes, and auth-diagnosis composition still work.
- Cache loop: fake time starts before a caller deadline, with a live foreign lock, no cache and a much longer scan deadline. The injected sleep advances time; assert expiration at the caller budget, the contention flag, no scan/takeover/release by the waiter, and no extra sleep. Repeat with different scan budgets and with the caller already expired; cover null deadline, cache success before deadline, stale lock takeover, and owned scan release on success/error. Keep real subprocess coverage for CLI error classification and post-release acquisition.
- Static validator: in-memory or temporary ESM graphs cover valid and missing named exports, missing target, aliases, default, direct and transitive re-exports, star ambiguity, cycles, parse errors, and comment/string decoys. Include a module whose top-level body would write a sentinel if executed; validation must leave it absent. Pin documented exclusions. Exercise changed-exporter reverse dependencies and scoped attribution.
- Gate wiring: run the actual gate against a disposable fixture checkout containing an import of a nonexistent export. Assert a nonzero result identifying importer/target/name; correct the export and assert that finding disappears. Do not settle for a source-text assertion that the validator is imported.

## Proof plan

- During implementation, run focused Vitest suites for the four test paths above plus `we:scripts/__tests__/lane-pool-acquire-lock-contention.test.mjs`. Record exact commands and results in this card, using repository-prefixed paths in prose (strip the locus prefix when passing paths to the shell).
- Capture before/after formatter output as assertions over synthetic credentials, not real logs. The preparation probe above establishes the current raw interpolation failure; the new test must fail against that behavior and pass after hardening.
- Demonstrate the fake-clock test fails when the production caller-deadline check is removed, and the gate-wiring test fails when validator invocation is disconnected. Restore each deliberate mutation before final verification.
- Run `npm run check:standards` after implementation and retain its exit status and relevant diagnostics. The runner owns preparation checks and stamps; preparation itself makes no implementation-pass claim.

## Done when

All three guards are implemented, the focused regressions pass, the negative probes demonstrably catch their respective defects, and `npm run check:standards` passes. The existing integration behavior and normal escalation parsing remain covered.

## Follow-ups

- Broader TypeScript, package-export, dynamic-import and CommonJS validation are outside this local ESM guard; expand only with concrete uncovered import failures. Do not label them covered by this MVP.
- Keep credential-redaction vocabulary in the existing shared helper; any newly observed unsupported credential shape needs a helper regression rather than a second competing credential matcher.
- No unresolved policy/design fork was found in these three requested prevention guards. If implementation reveals unrelated invalid imports in the scan corpus, record the exact findings and repair or separately scope them explicitly; do not hide them behind blanket exclusions or silently widen this card.
