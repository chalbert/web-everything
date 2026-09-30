---
bornAs: xokyo8z
kind: story
size: 3
parent: "4075"
status: active
scope: ["we:scripts/conveyor/lease-reaper.mjs", "we:scripts/conveyor/__tests__/lease-reaper.test.mjs", "we:scripts/check-standards-rules.mjs", "we:scripts/__tests__/check-standards-rules-content-lint.test.mjs"]
dateOpened: "2026-09-27"
dateStarted: "2026-09-30"
preparedDate: "2026-09-30"
preparedAgainstSha: "e529529a0e57d7e62bb1f8b69120296d0175803b"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2833's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4311-lane-concurrency-ceiling-counts-stale-unreleased-leases-as-a.md` — Require an executable resolver regression with an active, clean holder beyond the quiet window, and gate early reclamation on holder-liveness or renewable ownership evidence rather than acquisition age alone.
2. `we:backlog/4311-lane-concurrency-ceiling-counts-stale-unreleased-leases-as-a.md:386` — Separate capability tests that must fail on the base from preservation tests that must pass on both versions; validate preservation tests against targeted unsafe mutations when implementing the story.
3. `we:backlog/4311-lane-concurrency-ceiling-counts-stale-unreleased-leases-as-a.md:169` — A design-review gate requiring that every logical condition (e.g., handling the 'closed' PR state) explicitly written into a design snippet has a corresponding and complete test case defined in the Test Plan.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2833@5eea927705613f8858e443003b3d6e7d9ee44e4f

## Premise check (current `main`, 2026-09-30)

All three guards are still owed — no commit names #4332, and #4311 is resolved (its fix landed in #2833). The card's old `scope:` pointed at the #4311 *card*; corrected above to the files the work really touches. Line numbers in the list drifted; real anchors are below. Guard 1 is a real code gap, not just a missing test: `resolveLeaseItemNum` (`we:scripts/conveyor/lease-reaper.mjs:576`) corroborates a branch-derived merged PR from `laneQuietSincePr` alone (clean tree + HEAD contained + 30-min quiet window anchored to `max(mergedAt, acquiredAt)`), and `classifyReap` (`:632`) then reaps on `pr-merged` unconditionally. Meanwhile `main()` already computes `ownerAlive = ownerSessionAliveForLease(...)` (`:1343`) — but only threads it into `sessionGoneForLease`, never into the PR-terminal axis. So an adopted, clean holder that is reading/planning/running tests (no new commit yet) more than 30 min after the merge is reaped while its declared occupant is provably alive. Guards 2 and 3 are review-process rules with no home in code today (`lintBacklogItemRendering`, `we:scripts/check-standards-rules.mjs:954`, has no Test-plan check).

## Design

1. **Liveness veto on the branch fallback (guard 1).** Add an optional `ownerAlive` (`boolean|null`) option to `resolveLeaseItemNum` (`we:scripts/conveyor/lease-reaper.mjs:576`). When it is exactly `true`, the branch-derived merged/closed verdict is NOT trusted: skip the `laneQuietSincePr` corroboration and leave `itemNum`/`itemNumSource` at their pre-corroboration `null` — the veto sits INSIDE the `merged||closed` branch (never the `else`, which would yield `'branch-uncorroborated'` and still reap) — so a proven-live occupant is never reaped on `pr-merged` off acquisition age alone. Bound, stated honestly: it protects only the window between the 30-min quiet period and the 4-hour TTL; `ttl-stale`/`pid-dead` in `classifyReap` still apply. `false`/`null`/absent behave exactly as today (fail-open to the existing quiet-window gate — `ownerAlive` is a veto only, never a reap signal, matching its "override" role in `sessionGoneForLease`). Extract `main()`'s `signalsFor` (`:1321-1349`) into an exported builder `buildLeaseSignalsFor(ctx)` that `main()` and the tests both call (the test file's hand-copied `buildSignalsFor` at `:1411` would otherwise never exercise the wiring); inside it, compute `ownerAlive` before `resolveLeaseItemNum` and pass it in. `deadLeasePlan` in `we:scripts/lane-pool.mjs` has no agent listing, so it passes nothing (unchanged); that acquire-side path is a Follow-up.
2. **Test-plan lint (guards 2 + 3).** Add a pure `findTestPlanGaps(body)` to `we:scripts/check-standards-rules.mjs` and compose it into `lintBacklogItemRendering` as a WARNING for open/active cards carrying a `## Test plan` section (never errors, never on resolved cards — the corpus predates the rule). Two deterministic checks over the Test-plan section's bullet cases:
   - *Classification (guard 2):* every case bullet must state whether it is a capability case (marker `Red today` / `fails … before` / `RED`) or a preservation case (marker `GREEN on today` / `preservation` / `passes on both` / `regression guard`), and a preservation case must name its mutation proof (`mutation`) — the exact convention `we:backlog/4338-*.md` already uses. A bullet with neither marker is reported.
   - *Condition coverage (guard 3):* every quoted state literal compared in a fenced code block of the `## Design` / `## Interfaces & protocol` sections (`=== 'closed'`, `state: 'merged'`, `case 'x':`) must appear (as the same word) somewhere in the Test-plan section, else it is reported as an untested condition.
   The scan works on the frontmatter-stripped body (`we:scripts/check-standards.mjs` strips only frontmatter), so `findTestPlanGaps` parses the code fences itself and only looks inside the named sections. To avoid a false-positive flood it collects only literals compared against a `state`/`status` identifier or property (not `kind === 'story'` etc.). Capability markers: `Red today`, `RED`, `fails … before`; preservation markers: `GREEN today`, `GREEN on today`, `passes on today`, `guards a regression`, `regression guard`, `preservation`, `passes on both`. Before landing, run it over the open cards that carry a `## Test plan` and widen/narrow until every well-formed one (e.g. 4338, this card) is silent.

## MVP

Musts: the `ownerAlive` veto + its wiring in `signalsFor`; the two lint checks as warnings with unit tests. Deliberately OUT (→ Follow-ups): the same veto in `lane-pool`'s `deadLeasePlan`; promoting the lint from warning to error; auto-running mutation checks on preservation tests (guard 2's "validate against mutations" stays a human/reviewer step — the lint only requires the case to *name* its mutation proof).

## Test plan

- `we:scripts/conveyor/__tests__/lease-reaper.test.mjs` — *live clean holder beyond quiet window is kept*: `resolveLeaseItemNum` (and `reapPlan` driven by the exported `buildLeaseSignalsFor`, so the `main()` wiring is covered — deleting the `ownerAlive` argument fails it) for a `Mac:12345`-shaped lease, branch → MERGED PR older than `QUIET + 1h`, clean tree, contained HEAD, `ownerAlive: true` → `itemNum` null, lease kept. RED today: no such option, lease is reaped `pr-merged`.
- Same file — *preservation*: identical fixture with `ownerAlive: false` and `null` still reaps `pr-merged` (`itemNumSource: 'branch-corroborated'`). GREEN on today's code; red proof is a mutation (make the veto fire on `!== true`) → fails.
- Same file — *session-kind untouched*: `conveyor-4306` lease with `ownerAlive: true` still resolves `itemNumSource: 'session'` (the veto applies to the branch fallback only). GREEN today; mutation: apply the veto before the session lookup.
- `we:scripts/__tests__/check-standards-rules-content-lint.test.mjs` — `findTestPlanGaps`: (a) a case bullet with no capability/preservation marker is reported (RED today: function absent); (b) a preservation bullet with no `mutation` mention is reported; (c) a Design fence containing `state === 'closed'` whose Test plan never says `closed` is reported; (d) a fully-marked plan with every literal covered returns `[]`; (e) no `## Test plan` section returns `[]`; (f) via `lintBacklogItemRendering`: warning for an open card, silent for a `resolved` card. Preservation cases (d)/(e)/(f-resolved) are GREEN on the empty-function base; mutation: make the resolved-skip a no-op → (f) fails.

## Proof plan

- `npx vitest run lease-reaper check-standards-rules-content-lint` (name filters for we:scripts/conveyor/__tests__/lease-reaper.test.mjs and we:scripts/__tests__/check-standards-rules-content-lint.test.mjs): new capability cases red on `main` (stash the code), green after.
- Live before/after on real git: a `node -e` script builds a temp repo on branch `lane/4000-x`, calls `resolveLeaseItemNum` with a merged-PR fixture beyond the quiet window and `ownerAlive: true` vs `null`, printing `itemNumSource` (`null` vs `branch-corroborated`); run against `main` code (option ignored → `branch-corroborated` both times) and after.
- Also a CLI `--dry-run --json` probe of we:scripts/conveyor/lease-reaper.mjs against a temp pool holding one adopted lease with a live `workerSession` on a merged-branch lane: kept after, would-reap before. The same dry-run still runs and reports the same reap/keep set as before on the live pool (no regression for non-adopted leases).
- Live lint probe: `npm run check:item -- 4311` (resolved → silent) and against `4338` (open, well-formed plan → silent); `npm run check:standards` green, and its warning count over the corpus reported so noise is visible.

## Follow-ups

- Thread a liveness signal into we:scripts/lane-pool.mjs's acquire-side `deadLeasePlan` so the acquire reaper gets the same veto.
- Promote `findTestPlanGaps` from warning to error once the open-card corpus is clean; add a mutation-run harness for preservation tests.
- A "renewable ownership" heartbeat on the lease (guard 1's second clause) — needs a decision on who renews and how often.

## Done when

1. **Executable** — `npx vitest run lease-reaper check-standards-rules-content-lint` passes; the new live-holder and `findTestPlanGaps` capability cases fail on pre-change code, and each preservation case fails under its stated mutation; `npm run check:standards` is green.
