# Grounding for #3801 (the #3717 routing build's five choices) and #3768 (prototype branch health)

Session `prepare-3801-and-3768`, 2026-09-21. Preparation only: nothing here rules either card. Both cards were
read on `main` and re-grounded on the prototype tip `5ab89f87b` (`origin/lane/mechanical-dispatcher`), checked
out in a lane clone. The branch itself was not touched. Research topics:
`/research/dispatch-routing-build-review/` and `/research/prototype-branch-health-gate/`.

## Part 1 — #3801

### Method

- Read `we:scripts/lib/dispatch-contracts.mjs`, `we:scripts/lib/dispatch-task-type.mjs`,
  `we:scripts/lib/provider-routing.mjs`, `we:scripts/operations/dispatch-lane-io.mjs`,
  `we:scripts/operations/dispatch-lane.mjs`, `we:scripts/operations/dispatch-providers/build.mjs` and
  `we:scripts/operations/delivery-agent-marker.mjs` at the branch tip. These files exist only on the branch.
- Ran the branch's own `decideDispatchRoute` on seven sample dispatches, twice: once with the branch's
  `we:scripts/conveyor/run-scorecards.json`, once with `main`'s. The script imports the real module; nothing
  was stubbed.
- Counted sized and unsized cards on the branch by kind and status.

### Results of the route simulation

| dispatch | branch trials | `main`'s trials |
| --- | --- | --- |
| `fix`, size 2, one script path | claude / sonnet, full | **codex / gpt-6-astra, spot-check** |
| `fix`, cause `conflict`, size 2 | claude / sonnet, full | **antigravity / gemini-3.8-flash-low, spot-check** |
| `build`, size 2 | claude / sonnet, full | claude / sonnet, full |
| `build`, size 1, docs only | claude / opus, full | claude / opus, full |
| `build`, no size | claude / opus, full (`sized: false`) | claude / opus, full |
| `fix`, no size | claude / opus, full (`sized: false`) | claude / opus, full |
| `fix`, size 2, override `codex` | routed codex, model null, full | routed codex, model null, spot-check |

The two `spot-check` values come from the dispatch path's placeholder risk thresholds
(`thresholdsForRisk`, low risk: streak 2, no positive control). Called directly with the router's
`DEFAULT_BACKDOWN_THRESHOLDS`, `selectSupervisionLevel` returns `full` for both triples.

With `main`'s trials and enforcement switched on:

- an override to `antigravity`, `gemini` or `claude` records `spot-check`, the level `codex`'s triple earned;
- a size-2 `build` is held: "computed supervision level is `full` and this dispatch names no supervisor".

### Trial data on each side

- Branch: 18 records (16 `advisory-review`, 2 `fix`), none with a `taskType` or an `outcome`.
- `main`: 26 `session-delegation` records.
  - codex: bugfix 7, other 6, doc-fix 2, conflict-resolution 1, self-fix 1.
  - antigravity: conflict-resolution 5, other 3.
  - claude-native: other 1.
- The 26 landed on `main` on 2026-09-18 and 09-19, after the 2026-09-14 merge base.

### Card sizes on the branch (frontmatter)

| kind | open, sized | open, unsized | closed, sized | closed, unsized |
| --- | --- | --- | --- | --- |
| story | 439 | 0 | 1797 | 0 |
| task | 0 | 202 | 0 | 431 |
| decision | 15 | 65 | 259 | 219 |
| epic | 3 | 103 | 1 | 127 |

`we:docs/agent/backlog-workflow.md:171`: the validator errors if "a task has one" (a size).

### Other code facts

- `routeDispatch`'s story stage forces Claude (`:427-430`). `STORY_KINDS` (`:53`) and `STORY_KIND_RUNGS` (`:89`)
  list `fix` and `ci-heal` beside `build`.
- `decideDispatchRoute` passes `stage: 'task'` (`:842`), overwrites `routed` with an override (`:847`), writes
  the constant `executed` (`:856`, `EXECUTABLE_PROVIDER` at `:759`), and keeps the router's `supervision`
  (`:859`).
- The override is read from `WE_DISPATCH_PROVIDER_OVERRIDE` / `WE_DISPATCH_OVERRIDE_REASON` as default
  parameters of the IO read (`we:scripts/operations/dispatch-lane-io.mjs:229-230`). The route is computed at
  `:365-373`, with `cause: null` from the tick.
- The `build` provider reads the item's `deliveryAgent:` marker and passes `--provider=<vendor>`
  (`we:scripts/operations/dispatch-providers/build.mjs:117-121`).

## Part 2 — #3768

### Reproduction

- A lane clone was set to `origin/lane/mechanical-dispatcher` at `5ab89f87b`, and `npm run check:standards` run
  there: `1 error(s), 1814 warning(s)`, exit 1.
- The error: `backlog/3383-…` carries an opaque token. The segment is the Prototype Tracker Artifact's short id,
  in three `claude.ai/artifact/<id>` URLs added by tracker note `ebaf4a149` (2026-09-21 09:17).
- `main`'s copy of the #3383 card has no such URL. On `main`, 35 artifact URLs of the older
  `claude.ai/code/artifact/<uuid>` form pass, because their hyphens split the segment.

### What happened to the 15

| group | count | cause | fixed by |
| --- | --- | --- | --- |
| A, duplicate ids | 4 | drift: both drains numbered cards | `6df1cb317` |
| B, hand-picked ids | 3 | drift: heal commit renamed the other way | `63e5d82ef` |
| D, dead cites | 4 | drift: a symptom of B | `63e5d82ef` |
| C, locus prefixes | 2 | branch-only | `6f5578531` (scripted) |
| E, real-mechanism tests | 2 | branch-only | `6f5578531` |

The tracker note `1cd50e7ca` records "check:standards 11 to 0 errors" on operator approval, 2026-09-20.

### Gate facts

- `poc-land` requires a passing `verify-lane` (`we:scripts/operations/poc-land.mjs:208`).
- `verify-lane`'s default gate includes `check:standards` (`we:scripts/verify-lane.mjs:29`).
- `main`'s CI runs `check:standards` (`we:.github/workflows/ci.yml`).
- `.githooks/pre-push` runs `we:scripts/guard-git-push.mjs` and `we:scripts/guard-prototype-tracker.mjs`.
- A whole-tree `check:standards` run took 11.5 s on this machine.

### Drift

- `git rev-list --left-right --count origin/main...origin/lane/mechanical-dispatcher`: 497 and 256.
- `git merge-tree --write-tree --name-only origin/main <tip>`: 59 conflicting files.
- A local trial merge with `-X ours` (never pushed; the lane was reset afterwards) produced a tree where
  `we:scripts/readiness/heavy-admission.mjs` throws `ReferenceError: admissionBypassReason is not defined` and
  `we:scripts/operations/review-pr.mjs` does not parse (line 2402 of the merged file). So `check:standards` cannot run on a naive merge,
  and the post-catch-up error count was not measured.
- Card 3475's 3 warnings: the card is identical on both sides; `we:scripts/conveyor/session-reaper.mjs` is 323
  lines on the branch and 488 on `main`.

## Prior art (fetched 2026-09-21 unless marked)

- Kubernetes, Limit Ranges: defaults apply only to containers "that do not set compute resource requirements".
- Twelve-Factor, Config: "stores config in environment variables".
- GitHub Actions, `workflow_dispatch`: declared, typed, required inputs bound to one run.
- Chromium, Tree Sheriffs: "keep the Chromium main and branches green … and open".
- git, githooks: a non-zero pre-push exit aborts the push.
- Betterer README: incremental improvement, only new violations fail.
- Graydon Hoare, the not rocket science rule: not fetched (403); quoted from a secondary citation.
- LaunchDarkly individual targeting: fetched, no citable line on precedence; not relied on.

## Skeptic and screen

A refute-only skeptic agent attacked every default on four axes: classification, merit, statute overlap and
citation scope. A separate fresh-context agent screened every fork for implementation detail and for
prioritisation posing as a fork. Each card carries the per-fork `Skeptic:` and `Screen:` lines. What changed:

- **#3801 Fork 4, REFUTED and flipped** from "a task reads as 80 lines" back to the build's 900. The "a task = 2"
  rule is a batch-budget floor, not a size estimate. The dispatch path still promotes to `spot-check` on
  placeholder thresholds. 112 of 192 open tasks have no scope, and the reconcile path passes no size. The
  task row is now a config value, set later by a batched finding.
- **#3801 Fork 5, amended.** The marker now needs a required `deliveryAgentReason:`. The second process-wide
  variable, `DELIVERY_AGENT_PROVIDER`, is retired too. Rule 4's own fields stay the source.
- **#3801 Forks 1 to 3, amended.** The Claude converge editor is now recorded on the trial row. Two G1
  defaults that still produce `other` are removed. The role record carries the `STORY_KIND_RUNGS` tier, and
  the rejection of a role stage is split by kind.
- **#3768 Fork 2, REFUTED and flipped.** `check:standards` reads `origin/main`, so `main` moving creates
  errors on the branch with no push. Ownership is now split by cause: a push owns errors in its own files;
  drift reconciliation owns the rest.
- **#3768 Fork 3, amended.** The push guard checks the pushed commit's own files. A runner-tick probe is part
  of the default, because the hook can be skipped.
- **#3768 Fork 1, amended.** The `verify-lane` citation now names the real mechanism: a scoped gate that falls
  back to the whole tree because of `backlog/` files. The overlap with `#gate-on-merged-tree-lane-fast-fail`
  is reconciled.
- **Screen fixes.**
  - #3801 Fork 1 now rules the contract, not the stage argument.
  - #3768 Fork 3 now rules the contract, not the hook.
  - #3768's "order with the catch-up" fork was sequencing only. It became two requirements, plus a new
    Fork 4 on its one merit question (reword the note, or exempt the URL in the detector).
- **Measured counts corrected.** 192 tasks, not 202, have `status: open` (202 includes active and parked). There
  are 381 open stories.
