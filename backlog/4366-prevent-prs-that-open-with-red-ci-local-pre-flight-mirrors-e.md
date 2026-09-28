---
bornAs: xdm775e
kind: story
size: 8
status: open
blockedBy: ["4365"]
scope: ["we:scripts/operations/open-pr.mjs", "we:scripts/operations/open-pr-io.mjs", "we:scripts/operations/__tests__/open-pr.test.mjs", "we:scripts/operations/preflight-ci-mirror.mjs", "we:scripts/operations/__tests__/preflight-ci-mirror.test.mjs", "we:scripts/conveyor/ci-red-on-open-classify.mjs", "we:scripts/conveyor/__tests__/ci-red-on-open-classify.test.mjs", "we:scripts/conveyor/ci-red-on-open-watch.mjs", "we:scripts/conveyor/__tests__/ci-red-on-open-watch.test.mjs", "we:scripts/conveyor/conflict-postmortem-store.mjs", "we:scripts/lib/verify-lane-gate.mjs", "we:scripts/lib/pr-events.mjs", "we:scripts/lib/soak-gate-merge-base-diff.mjs", "we:scripts/progress-board.mjs", "we:.github/workflows/ci.yml", "we:.github/workflows/soak-replay-gate.yml", "we:.github/workflows/review-gate.yml"]
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
| `we:.github/workflows/soak-replay-gate.yml` | non-test | `node we:scripts/soak-replay-gate-cli.mjs --base-sha=<mergeBaseSha> --head-sha=<headSha> --title=<effectiveTitle> --body="$(cat <the bodyFile `open-pr` is about to submit>)"` — the SAME `--base-sha`/`--head-sha` mode `we:.github/workflows/soak-replay-gate.yml` itself already calls (per `we:scripts/soak-replay-gate-cli.mjs`'s own header, "This is now the mode … actually calls"), which computes its own merge-base diff via `we:scripts/lib/soak-gate-merge-base-diff.mjs#computeSoakGateNameStatus` rather than a hand-built, unquoted `--files-status=$(git diff …)` string (see the corrected soak-replay-gate design below — the first pass's command was unsafe as written). `effectiveTitle` is NOT `input.title` verbatim — see the corrected title derivation below |
| `we:.github/workflows/review-gate.yml` | non-test | N/A, and EXCLUDED from the red-on-open KPI, not merely un-mirrored — `open-pr` defaults a fresh PR to `review:pending` and this check deliberately fails on any review hold, so it is EXPECTED red the moment a PR opens (requiring it green before opening would be circular: review cannot finish before the PR exists) |
| `test-shard`/`test`, `daemon-soak-scope`/`soak-shard`/`daemon-soak`, `visual` | test | excluded by design — mirroring these IS the unscoped full suite `we:docs/agent/platform-decisions.md#local-gate-never-full-suite-by-default` just forbade as a default |
| `smoke`'s "Build WE docs" step | non-test | `npm run build:docs` — cheap, catches a broken 11ty template before CI does |
| `smoke`'s Playwright interaction lane | test | excluded, same reason as the shard jobs |
| `test-selection-measure` | measurement-only, no gate | not mirrored — it has no pass/fail verdict |
| Coverage merge + 80% bar (inside `test`) | test | excluded — approximating it locally would mean running the full suite, the exact default this card must not reintroduce |
| "affected tests" (not a CI job — this card's own addition) | test, but SCOPED | **The actual executable seam, corrected below** — `we:scripts/readiness/test-selection.mjs#decideLocalSelection` is only a PURE decision (`{mode, relatedFiles}`), never an executor; its own CLI (`we:scripts/readiness/test-selection.mjs:531`, `runCli`) calls the separate CI-policy path `selectTests` and only PRINTS the decision — it never runs anything. The real seam that both decides AND executes is `we:scripts/lib/verify-lane-gate.mjs#resolveDefaultGate`, already wired to `decideLocalSelection` (line 149) and already composing (`composeGate`, line 82) and running the real `npx vitest related <targets> --run --passWithNoTests` / `npm run test:unit` command `we:scripts/verify-lane.mjs` executes today — this preflight check reuses THAT function's vitest-half command (not `check:standards`, which this card's own preflight already runs separately), never re-derives test execution from the bare CLI |

## Design

**`open-pr` gets one new refusal, `ci-red`, decided by a new pure planner — never a bespoke check hand-rolled inside `we:open-pr.mjs` itself:**

`we:scripts/operations/preflight-ci-mirror.mjs#planPreflight({changedFiles, mergeBaseSha, headSha, title, body})` → `{checks: [{name, command, status: 'pass'|'fail'|'skipped', reason?, fix?}], allGreen: boolean}`. PURE decision over INJECTED results — this module decides which checks apply and how to report them; it does not itself shell anything (mirrors `we:scripts/operations/scaffold.mjs`'s own pure-plan/impure-io split). The IO shell (`we:preflight-ci-mirror-io.mjs`, follow-up naming TBD at build time, same split as every other operation here) actually runs `check:standards`, the soak-replay-gate CLI, `build:docs`, and the scoped test-selection command, and feeds their pass/fail + stdout tail back in.

`we:scripts/operations/open-pr.mjs` gains a new refusal reason `ci-red`, distinct in MEANING from the existing
`check-red` (in `HOME_REASONS`, `we:scripts/operations/open-pr.mjs:286` — a required CI check went red AFTER the
PR opened — this card's new reason covers a check that would have gone red BEFORE the PR is ever submitted).

**The actual seam, named against the real operation shape (resolves the first pass's "no push step to gate"
gap).** `we:scripts/operations/open-pr.mjs#openPrOperation` (line 189) is exactly two steps today: `plan`
(`compute`, PURE — reads `input.*`, calls `planOpen`) then `submit` (`effect` — reads `verdict`, hands
`we:scripts/pr-land.mjs` the argv `planOpen` computed). The operation engine's closed 4-kind vocabulary
(`we:scripts/operations/step-kinds.mjs`) has no fifth kind for "run local commands and decide" — a preflight
that actually executes `check:standards`/the soak gate/`build:docs`/the scoped test command is IO, so it cannot
live inside `plan` (a `compute` step is contractually pure). It is wired as a NEW `effect` step, `preflight`,
inserted BEFORE `plan`, whose effect payload runs the four local commands via
`we:scripts/operations/preflight-ci-mirror.mjs`'s IO shell.

**Reading the effect's result — corrected against the engine's real shape (second-pass correction: the first
attempt assumed `findings.preflight` WAS `{allGreen, checks}` directly, which is wrong).**
`we:scripts/operations/engine.mjs#effectFinding` (`:191`) always wraps a step's result as `{applied: boolean,
effects: [{type, status, result, error}]}`, keyed by ordinal, never the bare returned value. Since the
`preflight` step declares exactly one effect, `planOpen` reads
`findings.preflight?.effects?.[0]?.result` (guarded on `findings.preflight?.applied` and
`effects[0]?.status === 'applied'` — an effect that failed to APPLY at all, e.g. a crashed IO shell, is treated
as `allGreen: false` with reason `'preflight-did-not-run'`, never silently treated as green). `findings` is one
of the three roots `compute` steps may legally read (`we:scripts/operations/step-kinds.mjs`'s `READ_ROOTS`).
`planOpen`'s signature widens to accept `preflight: {allGreen, checks} | null` and, when `!allGreen`, pushes a
`ci-red` problem onto the SAME `problems` array its existing ref-shape/empty-body checks already populate
(`we:scripts/operations/open-pr.mjs`'s `planOpen`, the "checked here because they are cheap … restated as a
pre-flight" pattern its own docblock already states) — so `verdictFrom: 'plan'` (unchanged) refuses the WHOLE
run before `submit`'s effect ever executes, exactly like every other `planOpen` refusal today. Reports the
FIRST failing check's `name` + `fix` text verbatim so the caller acts on the exact command that failed, never a
generic "CI would fail."

**Effective title, not the raw input (second-pass correction: `input.title` alone is not what actually ships).**
`we:scripts/pr-land.mjs` derives `derivedTitle = TITLE ?? (source commit's own subject) ?? \`land ${REF}\``
(`:737`) whenever the caller's `--title` is empty — the SCHEMA default for `we:scripts/operations/open-pr.mjs`'s
own `input.title` (`:203`, `default: ''`). Passing the bare (usually empty) `input.title` to the soak-replay-gate
mirror would therefore mirror a DIFFERENT title than the one CI actually evaluates — exactly the false-green the
first pass's own command already had for a different reason. The preflight IO shell computes the SAME derivation
locally (`input.title || git log -1 --format=%s <sha> || \`land ${ref}\``, mirroring `we:scripts/pr-land.mjs:737`
exactly) before calling the soak-replay-gate CLI, never the bare `input.title`.

**Scope caveat on the explicit-`sha`/non-`main`-`base` path (second-pass addition, not solved further — a
named, honest limitation rather than a silent gap).** `we:scripts/operations/open-pr.mjs` supports an explicit
source `sha` and non-`main` `base` (`:218`), and `we:scripts/pr-land.mjs` resolves and pushes exactly that commit
(`:730`) — but `we:scripts/lib/verify-lane-gate.mjs#resolveDefaultGate`'s own diff/selection machinery is built
for the WORKING TREE, not an arbitrary historical `sha` (its own docblock, "the changed set is the WORKING TREE
… not HEAD's committed diff", `:141-149`). When `input.sha`/`input.base` name something OTHER than the ordinary
"HEAD, against `main`" case, the preflight's four checks still run against the CURRENT working tree (a
best-effort approximation, not a fresh checkout of the explicit `sha`) and each `CheckResult` carries an
explicit `scopeCaveat: 'ran against the working tree, not the explicit --sha/--base being published'` rather
than silently claiming full coverage of a commit it never actually inspected. Building a real per-`sha` preflight
(a scratch worktree checkout) is left for a follow-up if this path proves to matter in practice — the ordinary
case (an agent's own lane opening its own PR at HEAD against `main`) is unaffected and gets the full guarantee.

**Dry-run degrades gracefully, never crashes (second-pass addition).** `input.bodyFile` is legitimately empty on
a `dryRun` call (`we:scripts/operations/open-pr.mjs:97`, `:211` — the schema's own conditional-requirement
comment). The preflight IO shell reads `input.bodyFile || ''` explicitly (an absent body becomes `''`, matching
what an actual push with no body would send) rather than failing to read a file that may not exist — the four
checks still run and still report a real `allGreen` verdict on a dry run, which is useful rehearsal information,
not a case this card can skip.

**What actually OBSERVES a red-on-open result and calls the classifier (resolves the first pass's "nothing names
the poller/webhook/recovery path" gap).** "Red-on-open" is precisely defined first: the check conclusions
attached to the PR's INITIAL head sha — the sha `pull_request.opened` itself carries — never a LATER
`synchronize`d head (a fresh push starts a fresh episode, unrelated to whether the PR opened red). The observer
is a NEW consumer of the SAME webhook feed x7qre1u's ruling already names as the sanctioned signal source,
`we:scripts/lib/pr-events.mjs` (#2812) — never a `gh pr list` poll. A new module,
`we:scripts/conveyor/ci-red-on-open-watch.mjs` (naming mirrors `we:scripts/conveyor/parked-pr-conflict-watch.mjs`),
is invoked the SAME way every other role already is — wrapped by
`we:scripts/lib/pr-events.mjs#withPrEvents` inside the daemon tick loop, never a bespoke standalone poller — and
adds one more `ROLE_RELEVANCE` entry filtering `pull_request.opened` + the matching-sha `check_suite`/`check_run`
events.

**What the feed can and cannot actually tell the observer (second-pass correction: the feed is thinner than
the first draft assumed).** `we:scripts/conveyor/pr-events-worker/core.mjs#parseGithubEvent` (`:83-93`) stores
only `{sha, conclusion, app|name}` per check event — no run/attempt id, no failure detail, and its `at` timestamp
is the WORKER'S OWN RECEIPT time, not the PR's real `opened_at`. This is enough for `job`/`preflightRan`/
`rerunPassed` (a job is identified by `name` on a given `sha`, and a rerun is a SECOND event for the SAME
`(sha, name)`), but NOT enough for `failureShape` (timeout/resource vs. a deterministic assertion failure) —
that needs the check run's own detail, which the feed never carries. The observer makes ONE targeted `gh`
read (the failing check's own output, e.g. `gh api repos/{repo}/check-runs/{id}`) at the moment it is ABOUT to
classify a red episode — never a bulk poll loop, the same "feed wakes it, THEN it does its own bounded read"
pattern the review/fix daemons already use once `we:scripts/lib/pr-events.mjs` wakes them. `openedAtMs` uses the
feed's receipt timestamp as a close-enough proxy for the real open time (the feed's own latency is seconds, not
minutes) — stated as an approximation, not claimed exact.

**Reader gaps (`reset`/`gap`) never silently corrupt the denominator.** A fresh reader, or one that fell behind
past the feed's retention window, gets `{reset: true}` or `{gap: true}` (`we:scripts/lib/pr-events.mjs`'s own
`pollEvents` shape) — meaning the feed alone cannot prove it saw every `pull_request.opened` in the window. The
observer's `openedCount` is therefore reconciled, not trusted from the feed alone: it is cross-checked against
`we:scripts/progress-board.mjs`'s own existing live open/recent-PR listing over the SAME trailing window (a
floor the board already reads for its other derived lines) — a feed gap under-counts at worst, never silently
over- or under-reports without the board's own independent count to compare against.

**Finalization happens ONCE, not provisionally then updated (second-pass correction: resolves the "append-only
store rejects a later reclassification" contradiction).** The append-only discipline this store already commits
to (4365's own "written once, at resolution" rule) means the observer must not write a row the moment INITIAL
checks resolve and then try to "correct" it after a rerun — it WAITS for finalization first: initial checks
resolve, AND (if any went red) either a rerun signal arrives or a bounded finalization window elapses with no
rerun, THEN it classifies ONCE and appends ONCE. A red episode with a rerun still pending is simply not yet
final — the observer holds it (in memory / re-derivable from the feed's own cursor, no new durable state) rather
than writing a premature `unclassified` row it would later need to mutate.

**Classification of a red-on-open result** — `we:scripts/conveyor/ci-red-on-open-classify.mjs`, a pure function
`classifyRedOnOpen({job, preflightRan, preflightPassed, rerunPassed, failureShape})` (one consistent name,
`failureShape`, replacing the first pass's inconsistent `loadSignal`/`failureShape` split), with an explicit
`unclassified` fallback (never a guess) for a case none of the four name — a deterministic failure after a
passing mirror, a failure never rerun, or a non-test failure with no mirror at all:
1. `missing-pre-flight-check` — the failing CI job has a local mirror in the table above and `preflightRan` is false OR the mirror's own coverage did not include the failing file (a mirror that exists but was not run, or was run against the wrong diff base). #2852 and #2854 are this class.
2. `test-not-selected` — the failing job is test-classified, the scoped preflight's `we:scripts/lib/verify-lane-gate.mjs#resolveDefaultGate` run passed locally, and CI's broader run failed on a file the scoped selection excluded. Distinguishes a genuine selection-narrowing miss from an unrelated flake.
3. `flaky` — an immediate CI re-run of the SAME commit, no code change, passes. Requires the re-run signal; never asserted from a single red run.
4. `environment` — a re-run fails again but for a load/capacity/resource reason (timeout under concurrent load, OOM, disk) rather than a deterministic assertion failure — #4309's build is this class, distinguished from `flaky` by the FAILURE SHAPE (timeout/resource vs. a repeatable-then-not assertion), not by re-run alone.
5. `unclassified` — none of the above four inputs resolve the case (e.g. a deterministic failure after a passing mirror, or a failure with no rerun signal at all) — an honest "don't know" value, never asserted from partial evidence.

**Shared storage — including a GREEN row, not only red ones (second-pass correction: the first draft's five
classes describe failures only, but the denominator needs every opening).** `classifyRedOnOpen`'s verdict is
appended to 4365's `we:scripts/conveyor/conflict-postmortem-store.mjs` store as a row with `mode:
'ci-red-on-open'` (a THIRD `mode` value alongside that item's `main-base`/`stacked-rebase`) — the operator's own
instruction to share storage, and consistent with that item's `Row` shape already carrying a `mode`
discriminator built to be extended, not a parallel store. Every PR-opened episode this observer finalizes gets
EXACTLY ONE row, keyed by `episodeId = ${prNumber}:${openedAtMs}` (the SAME episode-id shape 4365 introduces):
`redOnOpen: boolean` (true for any of the five failure classes, false when every required check finalized
green), `class: <one of the five>|null` (`null` only when `redOnOpen` is false — a green PR was never
classified, never forced into `unclassified`). `openedCount` = every row in the window regardless of
`redOnOpen`; `redOnOpenCount` = rows where `redOnOpen` is true — both durable counts, neither a live re-derived
snapshot. `classifyRedOnOpen` recurring on the SAME job feeds the CI inventory table above the same way 4365's
roll-up feeds the prepare checklist: a class recurring past threshold is a candidate pre-flight ADDITION (a job
with no mirror today that keeps failing red-on-open earns one), read off the roll-up, never auto-applied.

**Red-on-open KPI on the plan page.** `we:scripts/progress-board.mjs` already classifies every open/recent PR into one bucket via `classifyPr`, including `ci-red` — but that is a LIVE snapshot (re-read every refresh), not a durable "was this PR red the MOMENT it opened" fact, which can flip to green after a fix before anyone looks. The KPI therefore reads the DURABLE `mode: 'ci-red-on-open'` rows from the shared store (this card, not `classifyPr`'s live read) over a trailing window, reported as `redOnOpenRate = redOnOpenCount / openedCount` for the same window (both counts include every finalized episode, green and red alike, per the corrected Row shape above), added as one more DERIVED (live, free) line in the board's existing derived section — no hand-maintained number, matching that file's own "never hand-typed" discipline.

## Interfaces

- `we:scripts/operations/preflight-ci-mirror.mjs`
  - `planPreflight({changedFiles: string[], results: {checkStandards, soakReplayGate, buildDocs, scopedTests}: {ran: boolean, passed: boolean, output?: string}})` → PURE, `{checks: CheckResult[], allGreen: boolean}`. `scopedTests` is populated by running `we:scripts/lib/verify-lane-gate.mjs#resolveDefaultGate`'s vitest-half command and reading its exit code — never the bare `we:scripts/readiness/test-selection.mjs` CLI, which only prints a decision (see the CI-inventory table's corrected "affected tests" row above).
  - `CheckResult = {name: 'check:standards'|'soak-replay-gate'|'build:docs'|'affected-tests', status: 'pass'|'fail'|'skipped', reason?: string, fix?: string}`. `fix` is the exact command to re-run, always present on `fail`.
- `we:scripts/operations/open-pr.mjs` — new refusal reason `'ci-red'` added to `HOME_REASONS`' local-refusal vocabulary (alongside the existing `check-red`, `empty-body`, etc. — corrected: `SUBMIT_OUTCOMES` is the three-element `opened|refused|unrun` outcome array, not the refusal-reason table, per the first pass's own naming correction). Wired as a NEW `effect` step, `preflight`, inserted before the existing `plan` step in `openPrOperation` (`we:scripts/operations/open-pr.mjs:189`); `plan`'s `compute` step reads the new `findings.preflight` (a legal `READ_ROOTS` entry) and `planOpen` folds `!allGreen` into its existing `problems` array as `ci-red`, refusing before `submit`'s effect ever runs. Message includes the first failing `CheckResult.fix` verbatim.
- `we:scripts/conveyor/ci-red-on-open-watch.mjs` — the observer (NEW, resolves the first pass's "nothing calls the classifier" gap): wrapped by `we:scripts/lib/pr-events.mjs#withPrEvents` inside the daemon tick loop (a `ROLE_RELEVANCE` consumer, never a bespoke poller), watching `pull_request.opened` + the matching-sha `check_suite`/`check_run` events, keyed by `${prNumber}:${openedAtMs}`; holds a red episode until FINALIZED (rerun observed or its bounded window elapses) before classifying; reconciles `openedCount` against `we:scripts/progress-board.mjs`'s own live PR listing on every `reset`/`gap` read.
- `we:scripts/conveyor/ci-red-on-open-classify.mjs`
  - `classifyRedOnOpen({job, preflightRan, preflightPassed, rerunPassed, failureShape})` → PURE, `'missing-pre-flight-check' | 'test-not-selected' | 'flaky' | 'environment' | 'unclassified'`.
  - Writes through 4365's `appendConflictPostmortem` with `mode: 'ci-red-on-open'`, `redOnOpen: boolean`, `class` taking one of the five values above when `redOnOpen` is true, else `null` (that item's `Row.class` enum is widened to accept these five alongside its own five — a single `class: string|null` field, discriminated by `mode`, never two parallel enums), `episodeId = ${prNumber}:${openedAtMs}` — one row per FINALIZED PR-opened episode, including a green one.
- `we:scripts/progress-board.mjs` — one new derived line, `redOnOpenRate = redOnOpenCount / openedCount` (both counts over every finalized episode, green and red), reading `0/0` as "nothing opened in window" when the store is genuinely empty for that window, computed from the shared store's `mode: 'ci-red-on-open'` rows over the board's existing trailing window, alongside the existing PR-status and output-mix derived sections.

## Tasks

1. `we:scripts/operations/preflight-ci-mirror.mjs` (pure planner) + tests: each of the four checks reported pass/fail/skipped correctly from injected results; `allGreen` false when any check fails; the CI-inventory table's own N/A rows (review-gate, deploy, etc.) never appear as checks.
2. The IO shell that actually runs the four local commands: `check:standards`, the soak-replay-gate CLI via its `--base-sha`/`--head-sha` mode (real title/body from `input.title`/`input.bodyFile`), `build:docs`, and the scoped test command by running `we:scripts/lib/verify-lane-gate.mjs#resolveDefaultGate`'s own vitest-half command and enforcing its exit code — each with a bounded timeout.
3. Wire `we:scripts/operations/open-pr.mjs`'s new `preflight` effect step + `planOpen`'s `ci-red` refusal ahead of `submit`; test that a failing preflight refuses with the exact `fix` text and pushes nothing.
4. `we:scripts/conveyor/ci-red-on-open-watch.mjs` (the pr-events observer) + `we:scripts/conveyor/ci-red-on-open-classify.mjs` (all five classes, including `unclassified`) + tests, plus the shared-store write (`mode: 'ci-red-on-open'`) reusing 4365's `appendConflictPostmortem` — this task is `blockedBy` 4365 landing first (the store/record module must exist before this item's write can compile against it).
5. Triage this week's #2835/#2839/#2843/#2845 through the built classifier as its first real fixture batch (not asserted by hand above), plus #2852/#2854/#4309 as known-answer regression fixtures.
6. `we:scripts/progress-board.mjs`'s new `redOnOpenRate` derived line + a test that it reads the shared store, never `classifyPr`'s live snapshot.

## Delivery shape

Two PRs in practice, one item here: this card is `blockedBy` 4365 (the shared store must land first). Within this card, land incrementally — the preflight planner and `open-pr` wiring first (useful standalone, gates every PR regardless of classification), then the classifier + shared-store write, then the progress-board KPI last (purely additive, reads a store that may still be empty).

## MVP cut

Per the operator's prepare-rule ruling (full design stays above; only the MVP builds now): **the MVP is local
`soak-replay-gate` + `check:standards` before `open-pr`, refusing on failure.**

**Must (MVP):**
- `we:scripts/operations/preflight-ci-mirror.mjs#planPreflight`, narrowed to TWO checks —
  `check:standards` and the soak-replay-gate CLI's `--base-sha`/`--head-sha` mode (with the effective-title
  derivation and structured argv fixes already folded into Design above) — never the `build:docs` or scoped-test
  checks (Could, below).
- The IO shell running those two commands with a bounded timeout (Task 2, narrowed); before running
  `check:standards` specifically, it checks `git status --porcelain` and attaches an honest `scopeCaveat` to
  that `CheckResult` when the tree is dirty (see the MVP-blocking classification below — `check:standards`, unlike
  the soak-replay-gate CLI, has no `--base-sha`/`--head-sha` mode of its own).
- `we:scripts/operations/open-pr.mjs`'s new `preflight` effect step + `planOpen`'s `ci-red` refusal (Task 3,
  unchanged — the refusal wiring is check-count-agnostic).
- Fixtures: #2852 (no soak-break scenario) and #2854 (statute-lint miss) both refused locally, matching Task 1's
  own two named fixtures (both are covered by the two MVP checks alone — neither needed `build:docs` or the
  scoped-test check to catch).

**Could (follow-up, already designed above — not built now):**
- `build:docs` and the scoped-test (`we:scripts/lib/verify-lane-gate.mjs#resolveDefaultGate`) checks in the
  preflight planner (Task 1/2's remaining two checks).
- The entire `ci-red-on-open` observer/classifier/KPI half of this card:
  `we:scripts/conveyor/ci-red-on-open-watch.mjs`, `we:scripts/conveyor/ci-red-on-open-classify.mjs`, and the
  `we:scripts/progress-board.mjs` `redOnOpenRate` line (Task 4, 5, 6) — this is the whole "classify + KPI" half
  the four remaining blockers below concern; none of it is needed for "refuse a bad push locally," only for
  measuring what slips past it.
- The shared-store integration with #4365's `mode: 'ci-red-on-open'` row.

**Size:** the MVP is 1 of the original 6 tasks in substance (the preflight planner narrowed to 2 checks + the
`open-pr` wiring) — well under this rule's ~1.5× budget against the card's own size-8 basis; the observer/
classifier/KPI half is real, separately-sized follow-up work, not a hidden remainder of THIS size.

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

**Handling:** items 1–8 are now resolved in the second design pass folded into the CI-inventory table, Design,
Interfaces, Tasks, and `scope:` above (2026-09-28, ahead of this item's own scheduled combined Codex re-review
with 4364/4365):
1. resolved (unchanged from the first correction).
2. resolved — the CI-inventory table's "affected tests" row and Design/Interfaces/Tasks now name the real
   executable seam, `we:scripts/lib/verify-lane-gate.mjs#resolveDefaultGate` (already wired to
   `decideLocalSelection` and already executing `npx vitest related … --run` for `we:scripts/verify-lane.mjs`
   today), never the bare `we:scripts/readiness/test-selection.mjs` CLI.
3. resolved — the soak-replay-gate mirror command now uses the CLI's own `--base-sha`/`--head-sha` mode (the
   SAME mode CI's workflow calls, per that CLI's own header) with real `--title`/`--body` sourced from
   `input.title`/`input.bodyFile` (already in hand before push) — never a hand-built, unquoted `--files-status=`
   string. The gate code itself runs from the candidate branch (the lane's own checkout), consistent with every
   other preflight check this card adds (`check:standards`, `build:docs` also run from the local tree) — CI's
   separate `ref: main` checkout is its own bootstrap-safety concern, not one this local preflight needs to
   replicate.
4. resolved — `HOME_REASONS` (not `SUBMIT_OUTCOMES`) is now named as the refusal-reason table; `ci-red` is
   named distinct from `check-red`; the submission boundary is now concrete — a new `preflight` `effect` step
   ahead of `openPrOperation`'s existing `plan`/`submit` steps, `findings.preflight` read by `plan`'s `compute`.
5. resolved — the observer is `we:scripts/conveyor/ci-red-on-open-watch.mjs`, a new `we:scripts/lib/pr-events.mjs`
   consumer; "red-on-open" is defined as the initial-head's check conclusions; denominator/dedupe both use the
   `${prNumber}:${openedAtMs}` episode id.
6. resolved (unchanged from the first correction).
7. resolved — `episodeId` + the `mode`-scoped rollup filter (folded into 4365's own Interfaces) give the shared
   store a real discriminated-union shape: 4365's `Row` fields (`prA`/`prB`/`files`/`hotFile`) apply to
   `main-base`/`stacked-rebase` rows, this card's fields (`opposingPrNumbers`/`handle`/`evidenceComplete`) are
   read the same regardless of `mode`, and `rollupConflictPostmortems` excludes `mode: 'ci-red-on-open'` rows
   from its conflict-shaped aggregates.
8. resolved — `classifyRedOnOpen`'s signature is one consistent name (`failureShape`), gains an explicit
   `unclassified` fifth value, and the CI-inventory table above now names exactly which existing signal
   (`resolveDefaultGate`'s own pass/fail) backs `test-not-selected`.

This card is now presented for the ONE combined read-only Codex re-review this session runs across 4364/4365/4366
together; see "Independent plan review — second pass" below for that outcome.

## Independent plan review — second pass (Codex, read-only, 2026-09-28)

Confidence **High**, build-ready **No** — the first pass's fixes above introduced NEW gaps, found and resolved
directly in Design/Interfaces above rather than left open:

1. **[blocker, resolved above]** The soak mirror still did not always receive the EFFECTIVE PR title:
   `input.title` defaults empty, and `we:scripts/pr-land.mjs` derives an omitted title from the commit subject —
   passing the bare input could mirror a different title than the one CI evaluates. Corrected: the preflight
   computes the SAME derivation locally before calling the CLI.
2. **[blocker, resolved above]** The preflight was not bound to the tree actually being published — `open-pr`
   supports an explicit `sha`/non-`main` `base`, but the test/build seam runs against the working tree. Corrected
   with an honest, scoped limitation: full coverage on the ordinary HEAD-against-`main` case, a stated
   `scopeCaveat` (not silent) on the explicit-`sha` path.
3. **[blocker, resolved above]** The named webhook consumer's feed does not carry run/attempt identity, failure
   detail, or a true opening timestamp, and gap/reset recovery was unnamed. Corrected: the feed's real fields are
   named explicitly, a targeted supplementary `gh` read supplies `failureShape`, and `openedCount` reconciles
   against `we:scripts/progress-board.mjs`'s own live listing on every gap.
4. **[blocker, resolved above]** The shared CI row had no green-row shape, so the denominator (every opening,
   not just red ones) was undefined. Corrected: every finalized episode gets a row (`redOnOpen: boolean`, `class`
   nullable), never only the red ones.
5. **[blocker, resolved above]** Classifier evidence and finalization were incompatible with the append-only
   store: appending at initial-checks-resolved would need a later `flaky`/`environment` update the store forbids.
   Corrected: the observer holds a red episode until FINALIZED (rerun observed or its window elapses), classifies
   once, appends once.
6. **[major, resolved above]** The effect-result shape was misstated — an effect's result lands at
   `findings.<step>.effects[].result`, not directly at `findings.<step>`. Corrected against
   `we:scripts/operations/engine.mjs#effectFinding`'s real shape.
7. **[major, resolved above]** Supported dry runs (`bodyFile` legitimately omitted) were unaddressed by the new
   preflight. Corrected: the IO shell reads `input.bodyFile || ''` explicitly rather than assuming a file exists.
8. **[minor, resolved above]** `resolveDefaultGate` builds a command, it does not execute it — the description
   now says the IO shell runs that command and enforces its exit code, not that the function itself executes.

## Done when

1. **Executable** — `we:scripts/operations/preflight-ci-mirror.mjs`'s planner fails (reports `allGreen: false`) against a fixture reconstructing #2852's diff (no soak-break scenario, no waiver) and against #2854's diff (the flagged statute wording), and passes against a clean fixture — before this item lands there is no such planner to run at all.
2. `open-pr` refuses to push when any mirrored check fails, reporting the exact local command to re-run; it still opens cleanly when every mirrored check passes, proven by a test for each of the four checks failing individually.
3. `classifyRedOnOpen` correctly classifies #2852 → `missing-pre-flight-check`, #2854 → `missing-pre-flight-check`, a synthetic load-timeout fixture modeled on #4309 → `environment`, a same-commit-passes-on-rerun fixture → `flaky`, and a fixture with no rerun signal and no matching mirror → `unclassified` (never a guessed class).
4. `we:scripts/progress-board.mjs` reports a non-fabricated `redOnOpenRate` sourced from the shared store, `0/0` (not a crash, not a fabricated 0%) when the store is empty.
5. No change to `we:review-gate.yml`/`we:deploy.yml`/etc — this item only adds a NEW local pre-flight step and a NEW classifier; it does not touch or re-trigger any existing CI workflow.

## Independent plan review — re-review (Codex, read-only, 2026-09-28)

Confidence **High**, build-ready **No** — **4 blockers remain**, found against the second-pass fixes above:

1. **[blocker, OPEN]** Even the ordinary HEAD-against-`main` case (where this card claims full coverage, no
   caveat needed) does not actually guarantee the preflight covers what gets published: `we:scripts/lib/verify-lane-gate.mjs`'s
   selected gate runs against the WORKING TREE (staged, unstaged, AND untracked content, `:184`), while
   `we:scripts/pr-land.mjs` publishes the resolved SOURCE COMMIT (`:730`) — an uncommitted local fix can make the
   preflight pass while the actual published `sha` stays broken. **Open — the `scopeCaveat` this pass added only
   covers the explicit-`sha` path; the ordinary path needs its own honest statement (or a commit-first
   requirement) before "full coverage" is a true claim.**
2. **[blocker, OPEN]** `we:scripts/lib/pr-events.mjs#withPrEvents` (the wrapper this pass names as the
   observer's integration point) does not deliver individual events to a consumer at all — its `sleep` method
   (`:217`, `:233`, `:270`) discards the polled event payload and returns only wake metadata; forwarding actual
   events needs a separate callback/consumer this card's design never wires. **Open — `we:scripts/conveyor/ci-red-on-open-watch.mjs`
   needs a real integration point named, not just "wrapped by `withPrEvents`."**
3. **[blocker, OPEN]** The reconciliation this pass added (cross-check `openedCount` against
   `we:scripts/progress-board.mjs`'s live listing on a feed gap) cannot actually reconstruct the promised
   denominator: that board reads at most ~30 open + ~6 recently-merged PRs (`:599`, `:646`), excludes
   closed-but-unmerged PRs entirely, and keeps no opening timestamp or initial sha — while a fresh/reset feed
   cursor starts at the CURRENT head with no history (`we:scripts/conveyor/pr-events-worker/core.mjs:138`). Any
   in-flight unfinalized episode across a gap is simply unrecoverable by either source. **Open — needs either a
   real durable "episode in flight" record (a small addition, not zero new state) or an honest statement that a
   gap can silently drop episodes from the denominator.**
4. **[blocker, OPEN]** `failureShape` is still not actually available from the named inputs:
   `we:scripts/conveyor/pr-events-worker/core.mjs#parseGithubEvent` (`:83`) records no local-preflight evidence,
   no selected-vs-failed test identity, and no check-run id — the "one targeted `gh` read" this pass added has
   no id to read BY (the feed never captures one). **Open — the feed needs to capture the id (a real, small
   change to `parseGithubEvent`, currently out of `scope:`), or the observer needs a different way to name which
   check to fetch.**

MINOR (also open): the effective-title derivation (`input.title || …`) preserves a whitespace-only title, while
`we:scripts/operations/open-pr.mjs`'s own submission path trims and omits it (`:123`) — a cosmetic mismatch, fix
at next touch.

## MVP-blocking classification (per the operator's prepare-rule ruling)

Per this repo's new prepare rule (full design stays above; a plan-review finding blocks the stamp ONLY when it
breaks an MVP Must or names real harm — everything else is SCOPE-GROWTH, an already-designed follow-up, never
silently dropped):

1. **Working-tree-vs-published-commit binding — MVP-BLOCKING for `check:standards`, resolved directly (this
   session's own re-review correctly caught this session's own first-draft classification as FALSE: `we:check-standards.mjs`
   reads checkout files straight off disk (`readFileSync`, no `--base-sha`/`--head-sha` mode at all —
   verified against the real script, whose flags are `--json`/`--local`/`--files=` plus `--scope=`/`--mine=`
   — a same-machine SESSION-ownership partition of the SAME whole-checkout read, not a commit-scoped diff mode)
   — it is NOT
   git-diff-scoped the way the soak-replay-gate CLI is; only that ONE of the two MVP checks was ever safe from
   this gap.** Real, honest fix (not deferred): the preflight IO shell checks `git status --porcelain` is empty
   (working tree matches HEAD) before running `check:standards`; when clean, the check gives FULL coverage of
   what `we:pr-land.mjs` will actually publish (no gap — HEAD is what's checked and what ships); when dirty, the
   `CheckResult` for `check:standards` carries the SAME `scopeCaveat` field the card's own Design already defined
   for the explicit-`sha` path ("ran against the working tree, which has uncommitted changes not reflected in
   the published commit"), never silently claiming full coverage. The ordinary case this repo's own lane
   workflow produces (commit, then verify/open-pr) is unaffected — the caveat fires only on a genuinely dirty
   tree, an honest, cheap, already-buildable check, not a follow-up.
2. **`we:scripts/lib/pr-events.mjs#withPrEvents` has no per-event delivery — FOLLOW-UP, not MVP-blocking.** This
   applies only to the `ci-red-on-open` OBSERVER, entirely cut from the MVP above. Filed as a follow-up slice
   (name the real integration point before building the observer).
3. **Gap-recovery denominator is unrecoverable across a feed gap — FOLLOW-UP, not MVP-blocking.** Same observer,
   same cut. Filed as a follow-up slice (a real durable in-flight-episode record, or an honest gap-drop
   statement).
4. **`failureShape` has no check-run id to read by — FOLLOW-UP, not MVP-blocking.** Same classifier, same cut.
   Filed as a follow-up slice (capture a check-run id in `we:scripts/conveyor/pr-events-worker/core.mjs#parseGithubEvent`).

## Independent plan review — MVP re-review (Codex, read-only, 2026-09-28)

This session's own one permitted re-review round, confined to the MVP cut + classification above. **1 blocker
found, resolved directly above:**

1. **[blocker, resolved above]** This session's own first-draft classification claimed `check:standards` takes
   an explicit `--base-sha`/`--head-sha` mode like the soak-replay-gate CLI does — verified FALSE against the
   real `we:check-standards.mjs` (reads checkout files directly, no diff-scoped mode at all). **Resolved**: the
   preflight now checks `git status --porcelain` before running `check:standards` and attaches an honest
   `scopeCaveat` on a dirty tree, mirroring the caveat mechanism the card's own Design already built for the
   explicit-`sha`/non-`main`-`base` path — the ordinary clean-tree case (this repo's own commit-then-verify lane
   workflow) is unaffected and gets full coverage.
2. **[scope-growth, confirmed correct]** All three remaining findings (pr-events delivery, gap-recovery
   denominator, missing check-run id) concern only the `ci-red-on-open` observer/classifier/KPI, entirely cut
   from the MVP — confirmed they name no risk reaching the two-check preflight itself.
3. **[not-an-issue, confirmed]** No technical dependency between the MVP and `#4365`'s shared store — confirmed
   against Interfaces (the MVP's `preflight`/`ci-red` refusal path never reads or writes that store).

**Round 2 (this session's cap, confirmation-only) result: confirmed resolved**, with one minor factual
correction folded in above (`we:check-standards.mjs` also accepts `--scope=`/`--mine=`, a same-machine
session-ownership partition of the same whole-checkout read — not a commit-scoped diff mode, so the core
finding stands; only the "only three flags" phrasing was incomplete).

**MVP has no remaining blocker.** `node we:scripts/backlog.mjs prepare-stamp 4366` is appropriate.
`blockedBy: ["4365"]` stays as-is at the card level (the card's full design, Could items included, still needs
4365's store) — a caveat worth a human's attention if this card is ever dispatched for its MVP slice alone
before 4365 lands, since the MVP itself has no real dependency.
