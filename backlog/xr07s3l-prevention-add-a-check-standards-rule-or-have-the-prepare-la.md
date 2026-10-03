---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/probation-build-run.mjs", "we:scripts/operations/__tests__/probation-build-run.test.mjs", "we:scripts/readiness/proof-plan-test-selection.mjs", "we:scripts/readiness/__tests__/proof-plan-test-selection.test.mjs"]
dateOpened: "2026-10-01"
preparedDate: "2026-10-03"
preparedAgainstSha: "cb5f9612ac20f8d1e4905e6e70cd1ec0af2a9bec"
tags: []
---

# Prevention — Add a check:standards rule, or have the prepare launcher validate it, that every test path in a backlog… (from chalbert/web-everything#3281 review)

Filed mechanically on approval of chalbert/web-everything#3281. Preserve the owed prevention: preparation must catch a Proof plan that names a test under a command whose config excludes it. The review's separate wording note remains author/reviewer discipline: planned coverage **will cover** an invariant; it is not observed coverage.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3281@b3bbd9759cb035cae947863984770fc073748424

## Progress

- Old premise/scope: edit only we:backlog/4405-file-the-prevention-guard-s-owed-by-chalbert-web-everything.md, citing its former lines 62 and 58; add a standards rule or launcher validation, possibly using `vitest list`. Those historical line anchors no longer identify the owed guard. The current source is that card's **Proof plan**, whose first command combines default-unit tests with we:scripts/__tests__/lane-pool-reap-on-acquire.test.mjs.
- Corrected premise: we:vitest.config.ts explicitly excludes that acquire test, while we:vitest.integration.config.ts includes it. A real read-only `createVitest`/`globTestFiles` probe returned zero selected files for the default config and the exact acquire test for the integration config. A combined command can therefore run some tests successfully while silently omitting another named test. Check membership of **each** path, not merely a nonempty combined result.
- Installed CLI observation: Vitest reports 1.6.1 and its help has no `list` subcommand. The suggested command is not an implementation recipe for this checkout. The installed discovery API exposes `createVitest`, `globTestFiles`, and project `isTargetFile`; the latter checks resolved include/exclude patterns and can classify a planned path without creating a file.
- Corrected scope: implement the explicitly offered prepare-launcher option at we:scripts/operations/probation-build-run.mjs, immediately before `stampPrepare` in the existing preparation-validation branch. That branch currently checks matching test scope and nonempty sections, but not test/config selection. Put the reusable validator and CLI in planned we:scripts/readiness/proof-plan-test-selection.mjs with planned matching we:scripts/readiness/__tests__/proof-plan-test-selection.test.mjs; extend existing we:scripts/operations/__tests__/probation-build-run.test.mjs for the caller. The source card is evidence, not the prevention mechanism, and leaves implementation scope.
- No implementation or stamp is performed by this preparation. This is a bounded launcher guard, not a change to test routing, config includes/excludes, or the definition of standards-gate green.

## Design

Add a validator accepting card text and checkout root, returning `{ ok, diagnostics }`. Each diagnostic identifies the Proof plan command, test path, resolved config and reason. Parse only the actual level-two Proof plan section, respecting Markdown fences and section boundaries. Recognize inline and fenced commands; ignore historical quotations and ordinary explanatory prose. Extract literal test paths from supported Vitest commands and associate every path with its own command.

Support `npx vitest run`, direct `vitest run`, and the current npm test scripts in we:package.json (including the heavy-admission wrapper): default unit, integration and soak. Resolve explicit `--config` and `--config=` arguments. Normalize `we:` and `webeverything:` on paths; require paths/configs to remain inside the checkout. Tokenize declaratively: never execute card text, shell substitutions, pipelines or npm scripts. Unsupported commands containing test paths, ambiguous config flags, unresolvable scripts and unavailable cross-repo roots return actionable validation errors rather than a false verified result. Commands without test paths, such as the standards gate, require no test-selection check.

Use the installed Vitest discovery API with watch disabled, cache one context per config, and close every context in `finally`. For existing files require the exact normalized path in discovery results, not substring or aggregate matches. For a missing path explicitly marked **planned** in the card's Test plan, check the resolved project's include/exclude membership with `isTargetFile`; report it as planned routing only, never discovered or passing coverage. Reject an unmarked missing file. Do not create placeholder tests or execute test bodies. Config-load errors and timeouts must produce failure diagnostics; bound the discovery subprocess and terminate it on timeout. The real IO adapter runs only the validator with structured arguments, not the authored commands.

Integrate after scope/section checks and before `stampPrepare`, using the existing one-repair-attempt path to return diagnostics to the worker. A failure must never call the stamp operation; a successful validation proceeds through the existing stamp and gate flow. Keep shape-only observation in we:scripts/conveyor/prepare-result.mjs unchanged.

## MVP

1. Implement command extraction, path normalization, supported npm-script resolution and per-path discovery in planned we:scripts/readiness/proof-plan-test-selection.mjs. Provide a read-only CLI taking a card path and checkout root, with JSON diagnostics and nonzero exit on failure.
2. Add an injectable validation IO seam in we:scripts/operations/probation-build-run.mjs. Route errors through the existing preparation retry before stamping; build/resolve mode remains unaffected.
3. Add parser/discovery tests and launcher control-flow assertions in the two scoped test files. Use the current source card's mixed default-config command as a regression fixture, not as a file to edit.

## Test plan

- Planned we:scripts/readiness/__tests__/proof-plan-test-selection.test.mjs will cover inline/fenced commands, section boundaries, explicit/default configs, npm aliases, repository prefixes, quoting, duplicate paths, and several tests under one command with one excluded member.
- The same suite will cover exact-path checks despite Vitest substring filtering, planned missing paths that match or fail config patterns, unmarked missing files, invalid config, unsupported command forms, path traversal, shell metacharacters treated as data, timeout and context cleanup. Discovery fixtures will use temporary configs and tests whose bodies throw if executed, proving that validation does not run them.
- Existing we:scripts/operations/__tests__/probation-build-run.test.mjs will cover validation failure preventing any stamp, diagnostics reaching the repair brief, a corrected second attempt reaching stamp once, repeated failure using the existing failure outcome, and non-prepare mode avoiding this guard. Retain scope and section refusal assertions.
- Test fixtures will distinguish planned routing from actual discovery and actual execution. The wording review note has no deterministic gate.

## Proof plan

Implementation proof commands below use repository-prefixed paths for attribution; strip the repository prefix when invoking from the WE checkout.

1. Run `npx vitest run we:scripts/readiness/__tests__/proof-plan-test-selection.test.mjs we:scripts/operations/__tests__/probation-build-run.test.mjs` using default we:vitest.config.ts. Both scoped test locations match its scripts-unit include pattern.
2. Run the new validator CLI against a temporary copy of we:backlog/4405-file-the-prevention-guard-s-owed-by-chalbert-web-everything.md. Its current mixed command must fail specifically for we:scripts/__tests__/lane-pool-reap-on-acquire.test.mjs under default we:vitest.config.ts, even though another test is selected. In the temporary copy only, move that path to an explicit we:vitest.integration.config.ts command; the mismatch must disappear. Planned missing tests remain distinctly reported as routing checks.
3. Prove the launcher boundary with injected IO: before the implementation, the mismatched fixture reaches the stamp spy; afterward it fails validation and never reaches that spy. Do not stamp a real card to prove this.
4. Mutate the validator to accept any nonempty combined discovery result; the mixed-selection regression must fail. Restore it, then bypass the caller validation and confirm the launcher regression fails. Record the failing assertions and final green results.
5. Run `npm run check:standards` during implementation delivery. Record command, exit status and diagnostics; do not claim that config membership proves tests pass.

## Done when

1. Preparation refuses a Proof plan command that excludes any named Vitest test before stamping, including the partially selected mixed-command case.
2. Planned files receive explicit config-routing validation without fabricated discovery or coverage claims; unsupported or failed validation cannot silently pass.
3. Focused tests, read-only source-card reproduction, launcher boundary proof, mutation controls and standards checks have recorded outcomes.

## Follow-ups

Extending this guard to other preparation entrypoints or a repository-wide standards rule is separate work; this slice implements the card's launcher option. Supporting additional test runners or cross-repo discovery requires their own adapters and fixtures. Keep the review-lens wording note as manual discipline, with planned coverage described as “will cover.” No runtime config changes or broad backlog rewrite are needed for this guard.
