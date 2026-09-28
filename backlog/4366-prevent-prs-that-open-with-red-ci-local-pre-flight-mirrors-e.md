---
bornAs: xdm775e
kind: story
size: 8
status: open
blockedBy: ["4365"]
scope: ["we:scripts/operations/open-pr.mjs", "we:scripts/operations/open-pr-io.mjs", "we:scripts/operations/__tests__/open-pr.test.mjs", "we:scripts/operations/preflight-ci-mirror.mjs", "we:scripts/operations/__tests__/preflight-ci-mirror.test.mjs", "we:scripts/conveyor/ci-red-on-open-classify.mjs", "we:scripts/conveyor/__tests__/ci-red-on-open-classify.test.mjs", "we:scripts/conveyor/conflict-postmortem-store.mjs", "we:scripts/progress-board.mjs", "we:.github/workflows/ci.yml", "we:.github/workflows/soak-replay-gate.yml", "we:.github/workflows/review-gate.yml"]
dateOpened: "2026-09-28"
tags: []
---

# Prevent PRs that open with red CI: local pre-flight mirrors every non-test CI check

PRs open red on CI repeatedly this week (#2835/#2839/#2843/#2845/#2852/#2854, #4309's build) because nothing mirrors CI locally before push. The local gate must never default to the unscoped full suite (just ratified, we:docs/agent/platform-decisions.md#local-gate-never-full-suite-by-default), so we:scripts/operations/open-pr.mjs needs a NARROW pre-flight instead: the real non-test required checks (we:scripts/soak-replay-gate-cli.mjs, we:scripts/check-standards.mjs, review-gate) plus affected tests (we:scripts/readiness/test-selection.mjs), refusing with the exact fix on any failure. Red-on-open CI is classified and shares 4365's postmortem store; the rate becomes a delivery KPI.

## Evidence

- **#2852** — a daemon fix with no soak-break scenario and no waiver; `we:scripts/soak-replay-gate-cli.mjs`/`we:.github/workflows/soak-replay-gate.yml` caught it in CI. Class: `missing-pre-flight-check` — this exact CLI already exists and is cheap (`node we:scripts/soak-replay-gate-cli.mjs --files-status=...`); nobody ran it before push because `we:open-pr.mjs` never asked them to.
- **#2854** — `check:standards`' statute lint flagged "not yet" wording. Class: `missing-pre-flight-check` — `npm run check:standards` already runs this locally in ~seconds; the gap is the same as #2852's, a real local command that existed and was not required before push. (This same PR #2854 is where `we:docs/agent/platform-decisions.md#local-gate-never-full-suite-by-default` itself was ratified — the rule this card's design must respect.)
- **#4309**'s build — subprocess test timeouts under load. Class: `environment` (a load/capacity condition, not a deterministic test defect — distinct from `flaky`, below).
- **#2835/#2839/#2843/#2845** — red-on-open this week with no recorded cause yet. Left for the classifier itself to triage once built (Task 5): asserting a class for a PR nobody has inspected would be exactly the "confident wrong contract" the story-preparation checklist warns against. These four seed the classifier's first real fixture batch rather than a guessed-at classification here.

## CI inventory — which checks are non-test, and the local command for each

Read live from `we:.github/workflows/` (only three trigger on the PR's own `pull_request` event — `we:ci.yml`,
`we:soak-replay-gate.yml`, `we:review-gate.yml`. The rest are never triggered by the PR's own commits landing, though
not all are bare pushes: `we:apply-review-request.yml`/`we:stage-pr-view.yml` trigger on push to a named ops
branch with a request-path filter — PR-related automation, not a gate on the PR's own diff; `we:deploy.yml`
triggers on a COMPLETED `CI` workflow run against `main` (`workflow_run`) plus manual dispatch;
`we:publish-contracts.yml` triggers on a `contracts-v*` tag push plus manual; `we:release-please.yml` triggers
on push to `main`; `we:update-visual-baselines.yml` is manual-only. None of the six is a gate CI evaluates
against an open PR's own commits — out of scope, not "can't mirror," genuinely N/A):

| CI job (`we:.github/workflows/ci.yml` unless noted) | Kind | Local mirror |
| --- | --- | --- |
| Repo health gate (`test` job) | non-test | `npm run check:standards` (already includes the statute lint, #2854's own gap) |
| `we:.github/workflows/soak-replay-gate.yml` | non-test | `node we:scripts/soak-replay-gate-cli.mjs --files-status=$(git diff -M --name-status <merge-base> HEAD)`, merge-base computed exactly as `we:scripts/lib/soak-gate-merge-base-diff.mjs` does it — the same fix #4264/#4292 already made for CI's own false-positive |
| `we:.github/workflows/review-gate.yml` | non-test | N/A, and EXCLUDED from the red-on-open KPI, not merely un-mirrored — `open-pr` defaults a fresh PR to `review:pending` and this check deliberately fails on any review hold, so it is EXPECTED red the moment a PR opens (requiring it green before opening would be circular: review cannot finish before the PR exists) |
| `test-shard`/`test`, `daemon-soak-scope`/`soak-shard`/`daemon-soak`, `visual` | test | excluded by design — mirroring these IS the unscoped full suite `we:docs/agent/platform-decisions.md#local-gate-never-full-suite-by-default` just forbade as a default |
| `smoke`'s "Build WE docs" step | non-test | `npm run build:docs` — cheap, catches a broken 11ty template before CI does |
| `smoke`'s Playwright interaction lane | test | excluded, same reason as the shard jobs |
| `test-selection-measure` | measurement-only, no gate | not mirrored — it has no pass/fail verdict |
| Coverage merge + 80% bar (inside `test`) | test | excluded — approximating it locally would mean running the full suite, the exact default this card must not reintroduce |
| "affected tests" (not a CI job — this card's own addition) | test, but SCOPED | `node we:scripts/readiness/test-selection.mjs`'s existing `decideLocalSelection`, run against the merge-base diff — already falls back to full suite on its own when the diff can't be soundly narrowed (config/shared-helper changes, deleted files), which is the SOUND automatic fallback `we:docs/agent/platform-decisions.md#local-gate-never-full-suite-by-default` explicitly carves out as not governed by the "never explicitly default to full" rule |

## Design

**`open-pr` gets one new refusal, `ci-red`, decided by a new pure planner — never a bespoke check hand-rolled inside `we:open-pr.mjs` itself:**

`we:scripts/operations/preflight-ci-mirror.mjs#planPreflight({changedFiles, mergeBaseSha, headSha, title, body})` → `{checks: [{name, command, status: 'pass'|'fail'|'skipped', reason?, fix?}], allGreen: boolean}`. PURE decision over INJECTED results — this module decides which checks apply and how to report them; it does not itself shell anything (mirrors `we:scripts/operations/scaffold.mjs`'s own pure-plan/impure-io split). The IO shell (`we:preflight-ci-mirror-io.mjs`, follow-up naming TBD at build time, same split as every other operation here) actually runs `check:standards`, the soak-replay-gate CLI, `build:docs`, and the scoped test-selection command, and feeds their pass/fail + stdout tail back in.

`we:scripts/operations/open-pr.mjs` gains a new refusal reason `ci-red`, distinct in MEANING from the existing
`check-red` (which already means a required CI check went red AFTER the PR opened — this card's new reason
covers a check that would have gone red BEFORE the PR is ever submitted). The exact seam is still open (see the
Independent plan review below): `we:open-pr.mjs` has no push step of its own — its IO shell submits through
`we:pr-land.mjs` — so the refusal must gate that submission call, not a step that does not exist today. Reports
the FIRST failing check's `name` + `fix` text verbatim so the caller acts on the exact command that failed,
never a generic "CI would fail."

**Classification of a red-on-open result** — `we:scripts/conveyor/ci-red-on-open-classify.mjs`, a pure function `classifyRedOnOpen({job, preflightRan, preflightPassed, rerunPassed, loadSignal})`:
1. `missing-pre-flight-check` — the failing CI job has a local mirror in the table above and `preflightRan` is false OR the mirror's own coverage did not include the failing file (a mirror that exists but was not run, or was run against the wrong diff base). #2852 and #2854 are this class.
2. `test-not-selected` — the failing job is test-classified, the scoped `we:test-selection.mjs` run passed locally, and CI's broader run failed on a file the scoped selection excluded. Distinguishes a genuine selection-narrowing miss from an unrelated flake.
3. `flaky` — an immediate CI re-run of the SAME commit, no code change, passes. Requires the re-run signal; never asserted from a single red run.
4. `environment` — a re-run fails again but for a load/capacity/resource reason (timeout under concurrent load, OOM, disk) rather than a deterministic assertion failure — #4309's build is this class, distinguished from `flaky` by the FAILURE SHAPE (timeout/resource vs. a repeatable-then-not assertion), not by re-run alone.

**Shared storage.** `classifyRedOnOpen`'s verdict is appended to 4365's `we:scripts/conveyor/conflict-postmortem-store.mjs` store as a row with `mode: 'ci-red-on-open'` (a THIRD `mode` value alongside that item's `main-base`/`stacked-rebase`) — the operator's own instruction to share storage, and consistent with that item's `Row` shape already carrying a `mode` discriminator built to be extended, not a parallel store. `classifyRedOnOpen` recurring on the SAME job feeds the CI inventory table above the same way 4365's roll-up feeds the prepare checklist: a class recurring past threshold is a candidate pre-flight ADDITION (a job with no mirror today that keeps failing red-on-open earns one), read off the roll-up, never auto-applied.

**Red-on-open KPI on the plan page.** `we:scripts/progress-board.mjs` already classifies every open/recent PR into one bucket via `classifyPr`, including `ci-red` — but that is a LIVE snapshot (re-read every refresh), not a durable "was this PR red the MOMENT it opened" fact, which can flip to green after a fix before anyone looks. The KPI therefore reads the DURABLE `mode: 'ci-red-on-open'` rows from the shared store (this card, not `classifyPr`'s live read) over a trailing window, reported as `redOnOpenRate = redOnOpenCount / totalOpenedCount` for the same window, added as one more DERIVED (live, free) line in the board's existing derived section — no hand-maintained number, matching that file's own "never hand-typed" discipline.

## Interfaces

- `we:scripts/operations/preflight-ci-mirror.mjs`
  - `planPreflight({changedFiles: string[], results: {checkStandards, soakReplayGate, buildDocs, scopedTests}: {ran: boolean, passed: boolean, output?: string}})` → PURE, `{checks: CheckResult[], allGreen: boolean}`.
  - `CheckResult = {name: 'check:standards'|'soak-replay-gate'|'build:docs'|'affected-tests', status: 'pass'|'fail'|'skipped', reason?: string, fix?: string}`. `fix` is the exact command to re-run, always present on `fail`.
- `we:scripts/operations/open-pr.mjs` — new refusal reason `'ci-red'` in `SUBMIT_OUTCOMES`'s refusal table (alongside the existing `check-red`, `empty-body`, etc.), reads `planPreflight`'s `allGreen` before the push step; message includes the first failing `CheckResult.fix` verbatim.
- `we:scripts/conveyor/ci-red-on-open-classify.mjs`
  - `classifyRedOnOpen({job, preflightRan, preflightPassed, rerunPassed, failureShape})` → PURE, `'missing-pre-flight-check' | 'test-not-selected' | 'flaky' | 'environment'`.
  - Writes through 4365's `appendConflictPostmortem` with `mode: 'ci-red-on-open'`, `class` taking one of the four values above (that item's `Row.class` enum is widened to accept these four alongside its own four — a single `class: string` field, discriminated by `mode`, never two parallel enums).
- `we:scripts/progress-board.mjs` — one new derived line, `redOnOpenRate`, computed from the shared store's `mode: 'ci-red-on-open'` rows over the board's existing trailing window, alongside the existing PR-status and output-mix derived sections.

## Tasks

1. `we:scripts/operations/preflight-ci-mirror.mjs` (pure planner) + tests: each of the four checks reported pass/fail/skipped correctly from injected results; `allGreen` false when any check fails; the CI-inventory table's own N/A rows (review-gate, deploy, etc.) never appear as checks.
2. The IO shell that actually runs the four local commands (check:standards, the soak-replay-gate CLI with the real merge-base diff, `build:docs`, the scoped test-selection command), each with a bounded timeout.
3. Wire `we:scripts/operations/open-pr.mjs`'s new `ci-red` refusal ahead of its push step; test that a failing preflight refuses with the exact `fix` text and pushes nothing.
4. `we:scripts/conveyor/ci-red-on-open-classify.mjs` + tests for all four classes, plus the shared-store write (`mode: 'ci-red-on-open'`) reusing 4365's `appendConflictPostmortem` — this task is `blockedBy` 4365 landing first (the store/record module must exist before this item's write can compile against it).
5. Triage this week's #2835/#2839/#2843/#2845 through the built classifier as its first real fixture batch (not asserted by hand above), plus #2852/#2854/#4309 as known-answer regression fixtures.
6. `we:scripts/progress-board.mjs`'s new `redOnOpenRate` derived line + a test that it reads the shared store, never `classifyPr`'s live snapshot.

## Delivery shape

Two PRs in practice, one item here: this card is `blockedBy` 4365 (the shared store must land first). Within this card, land incrementally — the preflight planner and `open-pr` wiring first (useful standalone, gates every PR regardless of classification), then the classifier + shared-store write, then the progress-board KPI last (purely additive, reads a store that may still be empty).

## Proof plan (live, before/after)

**Before:** #2852/#2854/#4309, each red-on-open with no local mirror run first (Evidence above).
**After:** the next PR whose diff would have failed `check:standards`, the soak-replay-gate, or `build:docs` is refused by `open-pr` locally, before push, with the exact fix line — recorded in this item's own update note with the refused command and the PR that would have gone red. If no such case turns up within a week, re-run #2852's and #2854's own diffs (reconstructed via `git show`) through the built preflight and show it would have refused each, labelled as a reconstruction.

## Independent plan review (Codex, read-only, 2026-09-28)

Confidence **High**, build-ready **No**. Not stamped `preparedDate`. Corrections and open gaps:

1. **[correction, folded in above] The CI-inventory table's trigger claims were wrong beyond the PR-triggered
   three.** Verified against the actual `on:` blocks: `we:deploy.yml` triggers on a completed `CI` workflow run on
   `main` (`workflow_run`) plus manual dispatch, not a bare push; `we:publish-contracts.yml` triggers on
   `contracts-v*` tag pushes plus manual; `we:apply-review-request.yml`/`we:stage-pr-view.yml` trigger on push to their
   named ops branch WITH a request-path filter (they do PR-related work, just never via the `pull_request` event
   itself). The conclusion — none of the six is a gate CI evaluates against an open PR's own commits — still
   holds and needed no design change, but the table's phrasing ("never run against an open PR at all") overstated
   it; corrected to "never triggered by the PR's own `pull_request` event" above.
2. **[blocker] The "affected tests" step does not actually run affected tests as designed.** `we:scripts/readiness/test-selection.mjs`
   exports `decideLocalSelection`, but its own CLI entry point (`we:test-selection.mjs:531`) calls `selectTests`
   (the separate CI-policy path) and only PRINTS a decision — it does not execute the selected tests. Treating
   that command's exit code as "tests passed" would be a false green; following its CI-policy branch instead of
   the local gate could reintroduce a broad run, the exact regression `we:docs/agent/platform-decisions.md#local-gate-never-full-suite-by-default`
   forbids by default. **The INTENDED policy (exclude coverage enforcement, keep the sound automatic-fallback
   path) is still correct and unchanged** — what's missing is the actual executable seam: which existing local
   gate machinery runs the selected tests and enforces their exit code, including deleted-file inputs. Open.
3. **[blocker] The soak-replay-gate mirror command in the table is unsafe as literally written.** It omits
   `--title`/`--body`; the CLI defaults both to empty, which the evaluator can read as "no bug-fix signal" for a
   daemon-scoped change — the mirror could pass the exact case (#2852) it exists to catch. The unquoted
   `--files-status=$(git diff …)` also loses the tab-separated structure `we:soak-replay-gate-cli.mjs:93`'s
   parser expects. **Open — needs a structured argv (effective PR title/body, intact name-status data) or the
   CLI's base/head-sha mode, plus a decision on whether the gate code itself is read from the candidate branch or
   trusted `main` the way CI's own workflow does.**
4. **[major] `open-pr`'s refusal-table naming is wrong, and there is no push step to gate.** `SUBMIT_OUTCOMES` is
   the three-element outcome array, not the refusal-reason map (that's a different table, per `we:open-pr.mjs`
   line 277
   context); the EXISTING `check-red` means a required CI check went red AFTER the PR opened, not a verify-marker
   failure — this card's Design section had that backwards and is corrected above (the new refusal is `ci-red`,
   distinct in meaning from the existing `check-red`, not a "sibling" of it in the sense first written).
   `we:open-pr.mjs` itself has no push step — its IO shell submits to `we:pr-land.mjs`. **Open — the preflight
   effect and its refusal need to be defined against that actual submission boundary, and against `open-pr`'s
   existing inputs (explicit `sha`, non-main `base`, `dryRun`), before this is buildable.**
5. **[blocker] Nothing in the design names what actually OBSERVES a red-on-open CI result or calls the
   classifier.** A pure `classifyRedOnOpen` cannot discover a CI failure, capture the initial-head check
   conclusions, get rerun evidence, or append a row on its own — no task names the poller/webhook/recovery path
   that feeds it, or defines "red-on-open" precisely (the PR's INITIAL head's check conclusions, as opposed to a
   later synchronized head). The KPI's denominator (every PR opened in the window, including ones later closed)
   and its per-PR dedupe rule (multiple failed jobs on one PR) are also undefined; an empty store reporting `0/0`
   is not yet distinguishable from "never observed." **Open.**
6. **[major] `review-gate` red is EXPECTED for an ordinary just-opened PR and must be excluded from the KPI, not
   merely noted as N/A.** `open-pr` defaults a fresh PR to `review:pending`, and `we:review-gate.yml` deliberately
   fails on any review hold — requiring it green before a PR can open is a logical impossibility (review cannot
   finish before the PR exists). The pre-flight table already marks it N/A for mirroring; the KPI computation in
   Interfaces needs the same explicit exclusion, not just the table note. Corrected in the Interfaces section's
   intent above; the actual KPI query still needs to encode this filter when built.
7. **[blocker] The shared-storage design with 4365 is under-specified.** Card 1's row needs two PRs, colliding
   files, hot-file state, and conflict-shaped cost; this card's row needs one PR, failed job identity, and
   preflight/rerun evidence — "widen `mode` and `class`" does not by itself define which fields apply to which
   `mode` or how the rollup avoids blending a CI-red row into a conflict hot-file count (the exact
   cross-subject blending 4365's own design says must never happen). **Open — needs an actual discriminated
   union spec, and 4365's rollup needs a `mode`-scoped filter before this card's rows can land in the same
   store without corrupting its aggregates.**
8. **[major] The classifier's four classes are not exhaustive nor fully supported by their stated inputs.**
   `missing-pre-flight-check` needs real coverage/diff evidence; `test-not-selected` needs the selected vs. failed
   test identities, neither of which the signature carries. `loadSignal` (Design) and `failureShape` (Interfaces)
   name the same thing inconsistently. Several real cases (deterministic failure after a passing mirror; a
   failure never rerun; a non-test failure with no mirror) have no defined outcome. **Open — needs one
   consistent signature, an explicit precedence order, and an honest `unclassified` outcome.**

**Handling:** item 1 and the `review-gate` KPI-exclusion intent (item 6) and the `check-red`/`ci-red` naming
(item 4's naming half) are corrected directly in the sections above. The rest (2, 3, 5, 7, 8, and item 4's
submission-boundary half) are real open design work, not fold-in edits — this card stays `status: open`,
un-prepared (`preparedDate` withheld), `blockedBy` 4365 unchanged, until a second design pass closes them and
a follow-up independent review confirms it.

## Done when

1. **Executable** — `we:scripts/operations/preflight-ci-mirror.mjs`'s planner fails (reports `allGreen: false`) against a fixture reconstructing #2852's diff (no soak-break scenario, no waiver) and against #2854's diff (the flagged statute wording), and passes against a clean fixture — before this item lands there is no such planner to run at all.
2. `open-pr` refuses to push when any mirrored check fails, reporting the exact local command to re-run; it still opens cleanly when every mirrored check passes, proven by a test for each of the four checks failing individually.
3. `classifyRedOnOpen` correctly classifies #2852 → `missing-pre-flight-check`, #2854 → `missing-pre-flight-check`, and a synthetic load-timeout fixture modeled on #4309 → `environment`, and a same-commit-passes-on-rerun fixture → `flaky`.
4. `we:scripts/progress-board.mjs` reports a non-fabricated `redOnOpenRate` sourced from the shared store, `0/0` (not a crash, not a fabricated 0%) when the store is empty.
5. No change to `we:review-gate.yml`/`we:deploy.yml`/etc — this item only adds a NEW local pre-flight step and a NEW classifier; it does not touch or re-trigger any existing CI workflow.
