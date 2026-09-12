---
kind: decision
parent: "3383"
status: open
scope: ["we:scripts/readiness/dispatch-plan.mjs", "we:scripts/conveyor/tick-core.mjs", "we:scripts/operations/dispatch-lane.mjs", "we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/lane-pool.mjs", "we:scripts/conveyor/branch-drift.mjs", "we:scripts/conveyor/branch-sync.mjs", "we:scripts/operations/open-pr.mjs", "we:skills-src/conveyor/runner.mjs", "we:docs/agent/backlog-workflow.md"]
dateOpened: "2026-09-12"
tags: []
---

# POC-branch delivery mode: how a dispatched lane lands on a prototype branch instead of main, and whether to build the one-branch bootstrap now or the N-branch shape first

The conveyor assumes ONE delivery target (`main`) and ONE landing transport (a merged GitHub PR). Epic #3383's
own prototype branch, `origin/lane/mechanical-dispatcher`, lives entirely outside that assumption — delivered
by direct pushes per doctrine rule 4 — so its own remaining work is not dispatchable by the conveyor at all.
This decides how a dispatched lane can instead fork FROM a POC branch and land back ON it, and whether
"which branch does this item deliver to" becomes a first-class delivery MODE the conveyor understands for N
such branches. Full design, options, and sequencing below.

## Background — where this came from

Two same-day inputs. First, the 2026-09-12 delegation audit recorded on `#3383` itself: of seven dispatch
launch kinds, only `review` is harnessed; the other six still run their own lifecycle from a brief. Second,
the operator's question — could the prototype branch build that remaining wiring into ITSELF, via a lane
forked from the prototype rather than from `main`, so the prototype does not break itself mid-work — framed
explicitly as one instance of a general capability: several POC delivery branches, each on a lighter
build strategy, as one of several delivery modes the conveyor natively understands.

An earlier same-day design review weighed three transports and recommended **B**:
**(A)** agents push straight to the POC branch — cheapest, but concurrent writers race, and collide with the
`we:scripts/conveyor/branch-sync.mjs` loop already running live against that branch;
**(B)** a short-lived staging ref plus ONE serialized lander that fast-forwards the branch after a direct-diff
review, no GitHub PR anywhere;
**(C)** keep real PRs but retarget `--base=<poc-branch>` — cheap, but seemingly keeps the PR/review tax the
idea exists to cut.

**That recommendation is reversed below.** A code survey done during this pass found one fact the earlier
review did not have — the dispatch completion signal is already base-agnostic — which moves the answer to a
sharpened C. The original framing is kept above so the change of mind is visible rather than quietly
overwritten.

## Part 1 — the bootstrap case: the prototype branch builds its own remaining wiring

The narrow instance. `origin/lane/mechanical-dispatcher` has six dispatch launch kinds still un-harnessed (the
2026-09-12 audit section on `#3383`). Those six fixes touch code that lives ONLY on the prototype branch, so by
this epic's own doctrine rule 4 they take the ceremony-free path — but "ceremony-free" has so far meant "a
human-driven session pushes straight to the branch", which is exactly what this epic exists to stop doing.

### What already works — verified 2026-09-12 against live code, not assumed

| Primitive | State | Evidence |
|---|---|---|
| Fork a lane from an arbitrary ref | **Works** | `we:scripts/lane-pool.mjs` `--base=<ref>` (#2386): `resolveBaseRef` at `:1293` tries `origin/<ref>` first then bare, then `checkout -B <branch> <baseRef> --force` at `:1230`. Refused together with `--no-reset` at `:1008` |
| Review a lane diff with no PR object | **Works** | `we:scripts/converge-cli.mjs init --base-ref=<ref>` (defaults `origin/main`); `laneChangedFiles` at `:144` is a plain `git merge-base HEAD <baseRef>` diff. `we:scripts/lib/judge-panel.mjs` / `we:scripts/lib/review-core.mjs` never take a PR |
| Nothing is lost by skipping CI | **True** | `we:.github/workflows/ci.yml` triggers only on push to `main` and `pull_request` against `main`. A non-`main` branch has never had CI |
| A serialized sole-writer lander | **Already exists** | `we:scripts/readiness/drain-lock.mjs` — a HOME-level, per-repo-keyed whole-process lease (`DRAIN_LEASE_PATH` + `localRepoSlug`, #3440) held by `we:scripts/merge-ai-prs.mjs` |
| A success signal for a non-`main` landing | **ALREADY WORKS — see below** | |

### The fact that reverses the earlier recommendation

The earlier same-day review assumed the dispatch completion signal is "the PR merged **to main**". **It is not.**
Traced end to end in `we:scripts/operations/dispatch-lane-io.mjs`:

- `createDispatchObservers` (`:1129`) Axis 1 calls `classifyDispatchPr` (`:1282`), which matches a PR to an
  entry **by item id over head refs** (`laneRefItemNum`), with an attempt-tag guard and a
  `mergedMs >= startedMs` staleness guard. It **never reads `baseRefName`**.
- `classifyPr` in `we:scripts/conveyor/pr-watch.mjs` (`:127`) is literally
  `if (state === 'MERGED' || pr.mergedAt) return 'merged';`. No base check.
- `PR_LIST_JSON_FIELDS` (`:650`) asks `gh` for `number,state,mergedAt,labels,headRefName` — `baseRefName` is
  not even fetched.

**So a PR merged into `lane/mechanical-dispatcher` would already resolve that dispatch `succeeded` today, with
zero observer changes.** "Merged to main" is the *doctrine*; the *code* says "merged".
`we:scripts/operations/dispatch-lane.mjs` and `we:scripts/operations/dispatch-lane-io.mjs` contain **zero**
hardcoded `main` references between them.

That removes the two expensive halves of option B at once — B needed a brand-new lander AND a brand-new
observer axis, and both already exist for the PR-shaped path. What is left of the "PR tax" is not CI (there is
none off `main`) and not landing (the drain already serializes it per repo); it is exactly one thing: the
**review-label / escalation gate** in `we:scripts/lib/review-escalation.mjs`, which scores the diff and can
park a PR for human review. That is the only part worth exempting, and it is exemptable by base.

### The revised recommendation: C+ for the bootstrap

**C+ = retarget the PR at the POC branch, and exempt registered POC bases from the escalation/review-label
gate, substituting a direct-diff `converge` review.** Concretely:

| Step | Mechanism | New code needed |
|---|---|---|
| Decide the target | `deliveryTarget:` on the item, read by `we:scripts/readiness/dispatch-plan.mjs` | small |
| Fork the lane from it | `we:scripts/lane-pool.mjs acquire --base=origin/lane/mechanical-dispatcher` | **none** |
| Agent edits + tests | unchanged | none |
| Review | `we:scripts/converge-cli.mjs init --base-ref=origin/lane/mechanical-dispatcher` | none |
| Open the PR | `we:scripts/operations/run.mjs open-pr --base=lane/mechanical-dispatcher` (`--base` already exists, `we:scripts/operations/open-pr.mjs:202`, default `main`) | **none** |
| Skip the human-review tax | base-keyed exemption in the escalation gate | small |
| Land it | `we:scripts/merge-ai-prs.mjs`, already lease-serialized, merges into the PR's own base | **none** |
| Report success | `classifyDispatchPr` → `succeeded` | **none** |

**A fifth argument for C+ that has nothing to do with cost.** `#3443` (graduating the branch to `main`) is hard
*precisely because* the branch has no PR history — doctrine rule 4 says so explicitly, and the 2026-09-04
reconciliation cost 40 minutes and 15 hand-resolved conflicts. Every increment landed via C+ arrives with a
reviewable diff, a recorded review verdict, and a `we:.lane-manifest.json`. C+ makes the branch **easier** to
graduate; A and B both make it harder, by adding more history that never went through a reviewable unit.

### Option B is not dead — it is the right shape for a branch that will never graduate

If a POC branch is genuinely throwaway (an experiment nobody intends to merge), the PR objects are pure
overhead and B's shape is correct: a staging ref `refs/poc-staging/<branch>/<item>`, one lease-held
fast-forward-only lander per branch, and a **third observer axis**:

```
succeeded  ⟺  git merge-base --is-ancestor <lane commit> origin/<targetBranch>
              AND the landing commit date >= entry.startedAt
```

That `startedAt` guard is not new thinking — it is the identical staleness refusal `classifyDispatchPr` already
makes, for the identical reason (re-dispatch is a designed path, and a predecessor attempt's landed commit
would otherwise resolve the new attempt). A lander-written receipt (same shape as
`we:scripts/operations/delivery-report-record.mjs`) is **evidence, never the verdict** — this repo already
ruled that dispatch status is checked against ground truth, not a self-reported record (`#3457`/`#3460`,
`we:docs/agent/platform-decisions.md#dispatch-status-ground-truth-check`). Git ancestry is that ground truth.

**Option A (agents push straight to the branch) stays rejected**, and not theoretically: a
`we:scripts/conveyor/branch-sync.mjs` loop already runs live against a checkout of that branch, and that file's
own header documents its predecessor failing silently for hours while a checkout drifted 53 commits behind.
Adding N concurrent writers to a branch that already has one automated writer is a failure mode this repo has
already paid for twice.

### Five real blockers the survey found, that any option has to clear

1. **`assertMainNotStale` refuses the dispatch.** `we:scripts/operations/review-dispatch.mjs:296` hard-refuses
   to dispatch when the dispatching checkout is behind `origin/main` (#3439). A dispatcher checkout sitting on
   the POC branch is *permanently* "behind `origin/main`" by construction. This must become "behind its own
   delivery target" before any POC-targeted dispatch can run at all. **This is the single most likely thing to
   silently block the bootstrap on day one.**
2. **The brief hardcodes the base.** `we:skills-src/conveyor/delivery-agent-brief.md:288` contains a literal
   `--base=main`. `fillBrief` in `we:scripts/operations/dispatch-lane.mjs` (`:440`) strictly refuses unknown
   placeholders, so a `{{DELIVERY_BASE}}` token has to be registered in `BRIEF_PLACEHOLDERS`, not just typed in.
3. **`lane-pool` does not persist the base.** The lease marker (`we:scripts/lib/lane-lease.mjs`) carries
   `workerSession`/`predictedScope`/`holder` and **no base field**; the base survives acquire only in the
   `--json` payload and one stderr line. Whatever dispatches must carry it forward itself, or it is lost.
4. **A lane based on a POC branch is still on a local branch named `main`.** `we:scripts/lane-pool.mjs:1230`
   does `checkout -B repo.branch <baseRef>` — content from the POC branch, branch *name* `main`. Anything that
   infers a target from the local branch name will get it wrong.
5. **`we:scripts/readiness/lane-manifest.mjs:143` validates `base` as a 7–64 hex SHA.** A branch *name* is
   rejected there, so the delivery target needs its own field rather than reusing that one.

## Part 2 — the generalization: N POC branches as a native delivery mode

### What is actually hardcoded, and what is not

The premise "`we:scripts/conveyor/branch-sync.mjs` / `we:scripts/conveyor/branch-drift.mjs` are hardcoded to
`lane/mechanical-dispatcher`" is **half wrong, and the wrong half is the good news:**

- `we:scripts/conveyor/branch-drift.mjs:52` has `DEFAULT_DRIFT_BRANCH = 'lane/mechanical-dispatcher'` — but the
  comment directly above it says both it and `DEFAULT_DRIFT_TARGET` are overridable via `--branch=`/`--target=`
  or `WE_BRANCH_DRIFT_BRANCH`/`WE_BRANCH_DRIFT_TARGET`, "so this stays a general tool, not a hardcoded one-off."
- `we:scripts/conveyor/branch-sync.mjs` is base-parametric: `DEFAULT_BASE = 'main'` at `:77`, with
  `base: typeof flags.base === 'string' ? flags.base : DEFAULT_BASE` at `:345`. It syncs a checkout against
  `origin/<base>` and names no prototype branch anywhere.
- `we:scripts/readiness/dispatch-plan.mjs` already anticipates this exact question in a live comment:
  `--drift-scope=<repo:path,...>` exists "**for a future second long-lived branch**."

**What is singleton is the INVOCATION.** `we:skills-src/conveyor/runner.mjs:269` calls
`we:scripts/conveyor/branch-drift.mjs sweep` with no arguments — one sweep, one default branch, once a tick.
And the drift constants are **duplicated, not imported**: `we:scripts/conveyor/branch-drift.mjs:52-53` and
again at `we:scripts/readiness/dispatch-plan.mjs:229-231`. A change to one silently does not reach the other —
a latent bug today, independent of this design.

So the generalization is: **one registry replacing two duplicated constants, and three singleton call sites
becoming loops.** Genuinely small.

### The design sketch

**A POC-branch registry** — one file (`we:config/poc-branches.json`), per branch: `branch`, `target` (what it
graduates into, normally `main`), `scope` (the paths it carries unreconciled — today's `DEFAULT_DRIFT_SCOPE`),
`syncCheckout`, `mode` (`pr` for C+ / `ff` for B), and `graduationItem` (`#3443` for today's one).

| Consumer | Today | Generalized |
|---|---|---|
| `we:scripts/readiness/dispatch-plan.mjs` | one `DEFAULT_DRIFT_BRANCH`; one `branch-drift-blocked` hold | per-branch drift verdicts; an item is held by drift of branches whose scope it overlaps, and (if POC-targeted) by its own target's drift |
| `we:skills-src/conveyor/runner.mjs` | one drift sweep per tick | one sweep per registered branch per tick |
| `we:scripts/conveyor/branch-sync.mjs` | one loop, one checkout | one loop per branch declaring a `syncCheckout` |
| Landing | one drain, `main`-shaped by convention | unchanged for `mode: pr` (the drain already merges into each PR's own base); one lease-held lander per branch for `mode: ff` |

**How an item declares its mode.** `deliveryTarget: lane/mechanical-dispatcher`, validated against the registry
at filing time (an unknown branch is a filing refusal, not a runtime surprise). Absent ⇒ `main` ⇒ today's
behaviour, byte-identical. **The survey found there is no closed frontmatter schema** — no allow-list, no
unknown-field rejection anywhere in `we:scripts/check-standards.mjs` or `we:src/_data/backlog.js`; unknown
fields round-trip untouched. So the field costs nothing to introduce and everything downstream is opt-in.

**How the tick loop plans differently per target.** `planTick` in `we:scripts/conveyor/tick-core.mjs` builds
its lists from cleared queue rows. The change is a **partition, not a rewrite**: group queued rows by
`deliveryTarget`, run the existing per-group planning unchanged. Capacity (`MAX_CONCURRENT_LANES`, `#3612`)
stays **global** — lanes are one shared physical pool regardless of base, and per-target capacity would be a
fiction. `blockedBy` ordering stays global too, since the backlog is global.

**Where the analogy breaks, and must not be papered over.** Under `mode: ff` a lander can only fast-forward;
two same-scope items produce a non-fast-forward it must escalate rather than resolve. Under `mode: pr` that
case is just a merge conflict the existing machinery already handles — another point for C+. And a caution
against adding a new long-lived daemon at all: `#3467` records that
`we:skills-src/conveyor/runner-lock.mjs`'s holder registers **no `SIGTERM`/`SIGINT` handler**, so its lease
survives a `kill` until the 15-minute TTL and operators have been deleting lock directories by hand. A second
resident lander would inherit that defect.

## Part 3 — sequencing: build the bootstrap, defer the registry. My honest read.

**Build the narrow bootstrap now, as C+. Do not build the registry yet.**

1. **There is no second POC branch to generalize FROM, and doctrine says there should not be.** Rule 10 of this
   epic's own standing doctrine: "the runner's normal operating mode is tracking `main` directly; a long-lived
   divergent branch is a temporary build tool, not the default steady state" — set after this very branch
   drifted 97 commits behind and cost a 40-minute, 15-conflict manual recovery. `#3443` tracks winding the one
   branch DOWN. Building a registry for N of a thing the repo has an explicit rule against accumulating is
   textbook speculative generality.
2. **The bootstrap is where the genuine unknowns are**, and they are identical for one branch and for N: is a
   direct-diff review trustworthy with no CI; does a POC-targeted dispatch actually complete and report; does
   `assertMainNotStale` block it. The registry answers none of those — it only makes the answers plural.
3. **C+ is a few small changes to existing seams, not a new pipeline.** Every expensive component — the
   serialized lander, the completion signal, the PR transport, the base-parametric lane fork — already exists
   and already works off `main`. Estimated: one frontmatter field, one brief placeholder, one
   `assertMainNotStale` fix, one base-keyed review-gate exemption.
4. **It has standalone value even if N never happens.** Six harness-wiring items delivered by the mechanism
   they are wiring is the strongest graduation evidence this epic can produce —
   `we:docs/agent/prototype-based-dev.md`'s own gate demands a live run go "the full distance end to end…
   through to a real, mergeable PR", and C+ is the only option that literally satisfies that sentence.

**The one generalization tax worth paying up front:** name the target as a *field* (`deliveryTarget:`) and read
it from one place, rather than adding `lane/mechanical-dispatcher` as a fourth hardcoded constant. A field with
one legal value generalizes for free. **And fix the duplicated drift constants**
(`we:scripts/conveyor/branch-drift.mjs:52` vs `we:scripts/readiness/dispatch-plan.mjs:229`) while in there —
that is a real latent bug regardless of this design.

**The counter-argument, stated so it is not buried.** If the operator genuinely wants multiple standing POC
branches as a durable mode, then **doctrine rule 10 is what needs revisiting first**, and this decision is
downstream of that. "A long-lived divergent branch is not the steady state" and "the conveyor natively supports
N of them" cannot both be true. Ruling this card should say which wins, explicitly, rather than letting a new
capability quietly overturn a rule set after a real, costly incident.

## The forks to rule

1. **Transport.** (A) agents push straight to the POC branch · (B) staging ref + fast-forward-only lander, no
   PR · (C+) PR retargeted `--base=<poc-branch>` with a base-keyed review-gate exemption. **Recommended: C+**
   — reversing the earlier review's B, on the specific finding that the completion signal and the serialized
   lander are both already base-agnostic. A stays rejected.
2. **Completion signal.** (i) reuse `classifyDispatchPr` as-is (works today for any base) · (ii) new
   git-ancestry axis, `startedAt`-guarded · (iii) manual `we:scripts/operations/wake.mjs` close-out.
   **Recommended: (i)** under C+; (ii) is required only if B is chosen.
3. **How the target is declared.** (i) `deliveryTarget:` frontmatter field · (ii) a new `kind:` value ·
   (iii) a tag. **Recommended: (i)** — orthogonal to `kind`, and explicitly NOT `#3634`'s axis (an item can be
   both prototype-shaped and POC-targeted).
4. **Scope now.** (i) bootstrap only, one branch, `deliveryTarget` as a field · (ii) bootstrap + registry
   together · (iii) design only, build nothing yet. **Recommended: (i)**.
5. **Does this amend doctrine rule 10?** Needs an explicit yes/no either way.

## Relationships

- **Parent** `#3383`; the 2026-09-12 delegation-audit section on that card is this item's origin.
- **`#3634`** (prototype-shaped items get their own brief + graduation gate) — adjacent, NOT a duplicate: that
  card is about how a dispatched agent WORKS on prototype infrastructure; this one is about WHERE its output
  lands. Found via `we:scripts/capability-search.mjs` before filing as the closest existing hit, and checked:
  genuinely a different axis.
- **`#3443`** (graduate the branch to `main`) — the wind-down this design must not fight, and which C+ helps.
- **`#3464`** (no reconciliation cadence for a diverged branch) — produced `we:scripts/conveyor/branch-drift.mjs`.
- **`#3629`** / **`#3627`** — the minimal-context/brief work next to the six un-harnessed kinds.
- **`#3467`** — the missing signal handler on the runner lease, a caution against adding a second daemon.

## Done when

1. **Executable** — `node we:scripts/backlog.mjs show <this item>` reports `status: resolved` with
   `codifiedIn:` set, and the ruling names, for each of the five forks above, the option taken and why —
   including an explicit yes/no on whether doctrine rule 10 is amended.
2. The ruling states whether the bootstrap is built now with the registry deferred, and if deferred, the
   concrete trigger that reopens the generalization (recommended: the filing of a second item whose
   `deliveryTarget` is not `main`).
