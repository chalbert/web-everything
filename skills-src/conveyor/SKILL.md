---
name: conveyor
description: Operate the conveyor from a live main session — a chained-sleep tick loop that dispatches scope-disjoint backlog items into the lane pool as background delivery agents, watches their PRs, and surfaces escalations, while the chat stays conversational. Use when the operator wants to "run the conveyor", "start the conveyor", "keep delivering backlog items in the background", or operate the interim swimlane-progression loop (#2612). NOT for landing PRs (the resident drain daemon does that) and NOT for one item (that is /batch or a solo lane).
---

# Conveyor — main-session lane operator (#2613, epic #2612)

The interim swimlane-progression loop, run from a live session: the main session operates a conveyor of
background delivery agents across the lane pool. It **dispatches** scope-disjoint backlog items, **watches**
their PRs, and **surfaces** escalations — while the chat stays a normal readiness conversation. It runs now
because the product conveyor (the #2527 console board) is not built yet and one-story-at-a-time delivery is
too slow.

> **THIN BY CONSTRUCTION — every decision with a right answer is a script call, per
> [we:docs/agent/platform-decisions.md#deterministic-core-thin-judgment](../../docs/agent/platform-decisions.md#deterministic-core-thin-judgment)
> (#2607).** This skill carries the **orchestration and the judgment only** — the readiness discussion,
> supervising a build, reviewing an escalation. It NEVER re-derives a dispatch plan, a state read, a watcher
> verdict, or an idle clock in prose: those are the tested scripts below, and this skill shells them. If a rule
> here reads as "compute X from the queue / leases / lanes", it is a bug — that computation belongs in a script.

The three scripts this skill shells (do not reimplement any of them):

| Script | What it decides (deterministically) |
|---|---|
| `node scripts/readiness/conveyor-state.mjs --json` | **The whole tick picture in one read** — `{ queue, clearedNotReady, unshaped, needsSlice, decisions, lanes, freeSlots, prs, daemon, idle, health, infraBlocked }`. Every tick STARTS here. |
| `node scripts/conveyor/infra-blocked.mjs retry` | **The infra-blocked recovery pass (#2659)** — one idempotent resume pass: for each item whose lane ref was PUSHED but whose PR-open failed on an outside dependency (a GitHub outage), it correlates GitHub status, resume-opens the PR once infra recovers (via `pr-land` — never a local merge), backs off on failure, and surfaces at the attempt cap. |
| `node scripts/readiness/dispatch-plan.mjs --json` | **The dispatcher** — `{ launch: [{num, lane}], held: [{num, reason}] }`. Which cleared items launch into which free lanes, and why the rest hold. |
| `node scripts/conveyor/tick-core.mjs` (stdin ⇽ bookkeeping) | **The MECHANIZED tick core (#2699)** — the whole per-tick state machine in one call: it shells `conveyor-state` + `dispatch-plan` + the free-lane picker, takes your in-session guard/watcher bookkeeping on STDIN, and returns `{ decisions, nextState }`. `decisions` = `{ spawnBuilds, spawnPrepareScope, spawnPrepareDecision, spawnFixes, armWatchers, retireGuards, idleStop, statusLine, notes }`; `nextState` = the next tick's bookkeeping. The three guards, their retirement (claim/return/TTL/PR-terminal), the union re-dispatch gate, watcher arming, and idle-stop are all DECIDED here — you EXECUTE the decisions and carry `nextState` forward, you never re-derive a guard rule in prose. |
| `node scripts/conveyor/pr-watch.mjs <pr>` | **The merge watcher** — one background process per in-flight PR. Its process EXIT is the wake signal; the exit CODE is the outcome (merged 0 · error 1 · parked 2 · timeout 3 · closed 4). |

> **Auto-prepare for unscoped items (#2613, corrected design — Nicolas, 2026-07-22).** Predicted `scope:` is
> authored UPSTREAM at readiness; the dispatcher only READS it — it never probes for scope at dispatch and
> **never launches an unscoped item to build.** An item that reaches dispatch with **no** `scope:` is held
> **`unshaped-no-scope`** ("no predicted scope — author it to parallelize") — **always**, even in a fully-idle
> pool with free lanes (building blind is exactly the hazard; there is **no** "serial floor" that runs it alone).
> Instead, the conveyor **auto-prepares** it: each tick, for every `unshaped-no-scope` held item (from the plan /
> `state.unshaped`), spawn ONE background **prepare-scope agent** (§3b) that predicts the item's touch-set and
> writes its `scope:` frontmatter as a one-file `ready-to-merge` PR. When that PR lands the item is scoped, and
> the dispatcher launches it to **BUILD** on a later tick. **So the flow is: unscoped cleared item → auto-prepare
> (add scope) → then build. The conveyor never builds without scope and never dispatches blind.** Scope is
> authored at readiness (here, just-in-time), not by the dispatcher
> ([we:docs/agent/platform-decisions.md#state-lives-where-its-nature-dictates](../../docs/agent/platform-decisions.md#state-lives-where-its-nature-dictates)
> — being codified in a sibling statute PR).

> **A cleared epic is a slice trigger, not a dead end (#2645).** An **epic** is a CONTAINER — its work lives in
> child stories/tasks, so it is **never directly buildable**. Before this rule a cleared epic fell into a silent
> hole: the dispatcher never launched it (an epic isn't agent-ready) and nothing routed it to slicing either. Now
> a cleared `kind:epic` is held **`needs-slice`** ("epic — /slice into buildable child stories") — a **first-class
> dispatch outcome**, checked BEFORE the scope gate so an (almost always scope-less) epic is **not** mislabeled
> `unshaped-no-scope` and auto-prepared (which would aim a build agent at a container). Each tick surfaces every
> such epic in `state.needsSlice` (each entry carries its `epicState`); handle them per §3d — **surface for
> `/slice`**, so a cleared epic always ends up either sliced-and-dispatched or explicitly awaiting slice, never
> silently stalled.

> **The conveyor drives DECISIONS too — prepare, then present (#2647).** A **decision** is NOT build work — its
> lifecycle is **prepare** (research + author its forks to "ready to ratify", the `/prepare` skill's autonomous
> half) then **present** (surface the prepared forks for a human to ratify). A decision carries no `scope:`, so —
> exactly like an epic — a cleared `kind:decision` is held **`needs-decision`** ("decision — prepare its forks,
> then present for ratify"), checked BEFORE the scope gate so it is **not** mislabeled `unshaped-no-scope` and
> aimed at a scope-prediction agent (which authors a build touch-set — meaningless for a decision). Each tick
> surfaces every cleared decision in `state.decisions` (each entry carries `prepared` + `preparedDate`); handle
> them per §3e — route by `prepared`: **UNPREPARED → spawn a prepare-decision agent** (autonomous research +
> fork authoring, lands a `preparedDate`); **PREPARED → present its forks** (a chat artefact + the #2565 ruling
> surface) for the human to ratify. Ratifying is human judgment — the conveyor prepares and presents, it never
> auto-ratifies. So a cleared decision always ends up either prepared-and-presented or explicitly awaiting
> ratification, never silently stalled — the conveyor drives the whole lifecycle: deliver + slice + decide.

The agent templates it instantiates: [`delivery-agent-brief.md`](delivery-agent-brief.md) (build a scoped
item, #2608), [`prepare-scope-agent-brief.md`](prepare-scope-agent-brief.md) (author an unscoped item's
`scope:`, #2613), [`prepare-decision-agent-brief.md`](prepare-decision-agent-brief.md) (prepare an unprepared
decision's forks to "ready to ratify", #2647), and [`fix-agent-brief.md`](fix-agent-brief.md) (repair a
`review:changes` bounce in its own lane and re-arm review, #2630).

---

## 1. Start / configure (a short conversation, then the loop)

Confirm three settings with the operator, then start ticking. Each has a default — a bare `/conveyor N` sets
the pool size to `N` and takes the defaults for the rest.

- **Pool size** — the max parallel lanes (the launch budget). Ensure the pool is provisioned to it:
  `node scripts/lane-pool.mjs provision --count=<N> --acquirable`. `freeSlots` in the state read is how many
  of those are currently free.
- **Per-program conflict policy** (§3i) — what to do when a newly-queued item overlaps a running lane's scope:
  **wait** (default — hold it behind the lane, the dispatch plan already does this), **ask** (surface it and
  let the operator decide), or **force** (launch anyway — rarely wanted; two lanes on one path is a merge
  hazard). This only changes how you present a `held: "overlaps lane-N"` entry; it never changes the plan.
- **Idle-stop window** — how long the queue stays empty with no operator feedback before the conveyor stops
  itself (default **15 min**).

State plainly to the operator, once, at start:

> **The chat stays conversational.** The conveyor runs in the background; ticks arrive on a timer and never
> block the chat. You steer it by talking here and by queuing work — to clear an item for the conveyor to
> pull, run:
> ```bash
> node scripts/conveyor/queue.mjs add <NNN>      # clear-for-build: the conveyor may now pull it
> node scripts/conveyor/queue.mjs remove <NNN>   # un-clear it (before it launches)
> node scripts/conveyor/queue.mjs list           # show what you've cleared this session
> ```
> The conveyor pulls **only** cleared items, in the build queue's ranked order. Re-prioritising the backlog
> never arms a build — clearing does. Type the id with or without a leading `#` (`add 2613` ≡ `add '#2613'`).
>
> **Clearing a not-yet-ready item is allowed but flagged.** If you clear an id that is not currently a ready
> build-queue row (blocked / resolved / typo), `add` still records it — a temporarily-blocked item auto-arms
> when its blocker lands — but it **warns** rather than silently doing nothing, and the tick's
> `state.clearedNotReady` (and a `held: 'cleared-but-not-ready'` in the dispatch plan) shows it so you always
> see "you cleared #X but it isn't ready". **JIT-numbering drift:** clear the id the tooling currently shows —
> a sidecar entry cleared as a `xHASH` won't match once the item lands as `#NNN` (and vice-versa); if a cleared
> id stops matching, `remove` it and re-`add` the current id.
>
> **The conveyor queue is SESSION-LOCAL** (#2613). `queue.mjs add/remove` writes a gitignored sidecar
> (`.conveyor/queue.json`) — it is NOT a card mutation (it never touches backlog frontmatter or
> `writeBacklogMd`), so it is **not** policed by the no-override lane guard and runs fine from THIS main
> session. That is deliberate: clearing an item for build is session-local operator intent, not committed repo
> state — so it must NOT go through `backlog.mjs build-queue add`, which writes `buildQueued:true` frontmatter
> and is BLOCKED from the primary checkout by the lane guard (#2302). Committed `buildQueued` frontmatter still
> exists (it feeds the `build-queue` view #2528/#2529 and the future product board), but it is a distinct,
> shared artifact from this session's conveyor queue — whether the two should reconcile is the open decision
> filed under #2612.

Then launch the first tick (§2).

## 2. The tick loop (chained-sleep heartbeat)

**The clock is a chained background `sleep`, NOT `ScheduleWakeup`.** `ScheduleWakeup` does not fire mid-run in
this VS Code extension; a backgrounded shell command's **exit** rides the task-notification wake path (the same
one that works for a completed background task), so it re-invokes this loop reliably. Each tick:

1. **Read the whole picture (one call):**
   ```bash
   node scripts/readiness/conveyor-state.mjs --json
   ```
   → `{ queue, clearedNotReady, unshaped, needsSlice, decisions, lanes, freeSlots, prs, daemon, idle, health, infraBlocked }`. Do not eyeball four commands; this is the one read.

2. **Plan the dispatch (one call):**
   ```bash
   node scripts/readiness/dispatch-plan.mjs --json
   ```
   → `{ launch: [{num, lane}], held: [{num, reason}] }`. This is THE dispatcher — the queue × active scope-leases
   × free lanes decision. Do not re-derive it; read it. (It shells the same build-queue, scope-lease, and pool
   pickers under the hood, so its inputs match the state read above.)

2b. **Plan the whole tick (one call) — the MECHANIZED core decides every guard (#2699).**
   ```bash
   echo "$BOOKKEEPING" | node scripts/conveyor/tick-core.mjs
   ```
   `tick-core.mjs` re-shells the state read + dispatch plan + free-lane picker under the hood and takes your
   in-session **bookkeeping** on STDIN (`{ bookkeeping: { tick, buildGuards, prepareGuards, fixGuards,
   fixAttempts, watched, launchedNums }, signals: { returnedBuildNums }, lastOperatorTurn }` — carried forward
   from the previous tick's `nextState`, `{}` on the first tick). It returns
   `{ decisions: { spawnBuilds, spawnPrepareScope, spawnPrepareDecision, spawnFixes, armWatchers, retireGuards,
   idleStop, statusLine, notes }, nextState }`. **Steps 3–5 below EXECUTE those decisions; you never re-derive a
   guard, a TTL, a re-dispatch gate, or the idle clock in prose — the core already applied all of them.** The
   guard sections further down DOCUMENT what the core encodes (so the semantics stay legible); they are not a
   second place to compute them. Carry `nextState` into the next tick's STDIN unchanged.

   > **The bookkeeping is SESSION-EPHEMERAL — it rides STDIN, never a repo file (SKILL §5, memory rule 105).**
   > It is which background jobs you launched, not item state; the board stays the single truth. `tick-core`
   > reads it in and returns the updated `nextState`, so the whole guard/watcher ledger lives in THIS session's
   > context and is threaded through each tick — no parallel on-disk store is ever created.

3. **Spawn ONE background delivery agent per `decisions.spawnBuilds` entry.** The core has ALREADY filtered
   `plan.launch` through the *In-flight dispatch guard* (dropping any launch whose `num` **or** assigned `lane`
   is held by a still-pending spawned agent) and recorded the new guard entries in `nextState.buildGuards` — so
   you just spawn each `{num, lane}` it returns, no guard math of your own:
   - Resolve the item's spec path by **globbing `backlog/<num>-*.md`** (the plan returns only `{num, lane}`, not
     the slug), then read that file and its `scope:` frontmatter.
   - Instantiate [`delivery-agent-brief.md`](delivery-agent-brief.md) by substituting its placeholders:
     `{{ITEM_NUM}}`=`num`, `{{ITEM_SPEC_PATH}}`=the globbed `backlog/<num>-<slug>.md`, `{{LANE}}`=`lane`,
     `{{SESSION_SLUG}}`=`conveyor-<num>`, `{{SCOPE}}`=the item's `scope:` entries, repo-qualified and
     comma-joined (e.g. `we:scripts/conveyor,we:skills-src/conveyor`). Those five `{{DOUBLE_BRACE}}` tokens are
     the whole fill — the brief already names the real learnings drop-box command (`learnings-drop.mjs`) and
     every other step verbatim; do not rewrite its prose.
   - Spawn it as **one background `Agent`** with the filled brief as the prompt (default `run_in_background`).
     One agent = one item = one lane = one PR. The agent acquires its lane, claims the item, builds it, gets the
     gate green, then **runs an adversarial code-review subagent on its own diff and addresses the findings to
     convergence BEFORE opening the PR** (a green gate is not a review — #deterministic-core-thin-judgment: the
     gate is the deterministic core, the review is the judgment). Only then does it open the PR —
     `ready-to-merge` for a clean, reviewed, non-statute change, or parked `review:human` **only for good
     reason** (below) — and **exits without merging**.
   - **The guard entry is already recorded** — `tick-core` put `{ num, lane, spawnedTick }` for each spawn in
     `nextState.buildGuards` (see the guard below for what it encodes). You do not maintain it by hand.

3b. **Auto-prepare every unscoped held item — spawn ONE background prepare-scope agent per
   `decisions.spawnPrepareScope` entry.** The dispatcher NEVER launches an unscoped item to build; it holds it
   `unshaped-no-scope` and surfaces it in `state.unshaped`. `tick-core` has ALREADY applied the *prepare in-flight
   test* — the **union** re-dispatch gate: it skips any `num` for which EITHER a live prepare-guard entry exists
   OR `state.prs` has an **OPEN PR for that `num`** (while the item is still `unshaped-no-scope` it has **no** build
   PR, so any open PR for its `num` can only be its in-flight prepare — the backstop if the guard entry were lost)
   — and it has already **picked each prepare's lane** from the free lanes MINUS this tick's builds MINUS every
   guard-held lane (the same lane exclusion the build guard uses), recording the `{ num, kind:'prepare', lane }`
   entry in `nextState.prepareGuards`. So you just spawn each `{num, lane}` the core returns. Deciding to prepare
   vs to build is entirely the dispatch plan's classification the core reads (scoped → `spawnBuilds`; unscoped →
   `spawnPrepareScope`). Each prepare is **parallel-safe** with every build and every other prepare — its
   `--scope` is a single, distinct backlog file (`we:backlog/<num>-<slug>.md`), disjoint by construction. For each
   `{num, lane}` in `decisions.spawnPrepareScope`:
   - Resolve the item's spec path by **globbing `backlog/<num>-*.md`** (this is the ONLY file the prepare edits).
   - Instantiate [`prepare-scope-agent-brief.md`](prepare-scope-agent-brief.md) by substituting its four
     placeholders: `{{ITEM_NUM}}`=`num`, `{{ITEM_SPEC_PATH}}`=the globbed `backlog/<num>-<slug>.md`, `{{LANE}}`=the
     picked lane, `{{SESSION_SLUG}}`=`prepare-<num>`. Those four `{{DOUBLE_BRACE}}` tokens are the whole fill — do
     not rewrite the brief's prose.
   - Spawn it as **one background `Agent`** with the filled brief as the prompt. It acquires its lane, predicts the
     item's touch-set, writes `scope:` into the one backlog file, gets the gate green, then **runs an adversarial
     review subagent on its own scope prediction and addresses the findings to convergence BEFORE opening the
     PR** (the operator invariant #2629: no PR reaches a human review gate without a prior AI convergence pass —
     a scope PR can still be human-routed when statute-touching or sampled). Only then does it open a one-file
     `ready-to-merge` PR (auto-lands — no review escalation unless the item is statute-touching), then **exits
     without merging**. When that PR lands the item is scoped and dispatches to **build** on a later tick.
   - **The prepare-guard entry is already recorded** — `tick-core` put `{ num, kind: 'prepare', lane, spawnedTick,
     sawPr:false }` in `nextState.prepareGuards`, keyed by `num` (the contended resource is the item's scope
     authorship; the lane is carried only for this tick's exclusion). Its retirement is DIFFERENT from a build
     guard's and the core enforces it — see the prepare guard below. **Critically: a prepare Agent RETURNING does
     NOT retire its guard** (it returns at PR-open, mid-flight — several ticks before the PR merges); the core has
     no return path for a prepare guard at all.

4. **Spawn a merge watcher per `decisions.armWatchers` entry — the core scoped it to items THIS conveyor
   launched.** `state.prs` is built from `gh pr list` **repo-wide**, so it also carries PRs from other sessions /
   humans. `tick-core` has ALREADY filtered it to OPEN PRs whose `num` this conveyor dispatched this session
   (`nextState.launchedNums` — builds AND prepares), dropped the ones you already watch, and pruned the watched
   set to the currently-open conveyor PRs (`nextState.watched`). So you just spawn a background watcher for each
   `prNumber` in `decisions.armWatchers`, whose **exit** wakes this loop:
   ```bash
   node scripts/conveyor/pr-watch.mjs <prNumber>   # run_in_background: true
   ```
   The board (`state.prs`) is the source of truth for which PRs exist; the watcher just wakes you the instant one
   reaches a terminal state. Scoping to conveyor-launched nums keeps an unrelated PR's stray `review:*` label from
   waking the loop with a spurious "PR #N needs review".
   - **Prepare-scope PRs are watched the same way** (their `num` was dispatched this session too). When a prepare
     PR **merges** (watcher exit `0`), the item now carries committed `scope:`, so the very next tick's
     `dispatch-plan` sees it as scoped and launches it to **BUILD** — the auto-prepare → build handoff. The prepare
     PR reaching a terminal state (merged / closed / failed) is a prepare-guard RETIREMENT trigger (see the prepare
     guard below) — but the prepare **Agent returning is NOT**, because it returns at PR-open, several ticks before
     the PR lands.

4b. **Run the infra-blocked recovery pass — auto-retry/resume any pushed-but-unopened work (#2659).** A delivery
   or prepare agent that BUILT successfully and PUSHED its `lane/*` ref, but whose PR-open then failed on an
   OUTSIDE dependency (a GitHub partial outage, a network fault), returns `blocked-on-infra` — its built work is
   pushed and RECORDED, but no PR exists yet to watch. Each tick, run ONE recovery pass:
   ```bash
   node scripts/conveyor/infra-blocked.mjs retry
   ```
   It is the deterministic core (the tick is the loop clock — the pass does ONE round, no internal busy-loop): for
   each recorded item it correlates GitHub status (a real outage vs a one-off), and, once the backoff has elapsed,
   **resume-opens the PR from the recorded ref via `pr-land` — never a local merge** (the drain stays the sole
   writer to `main`, memory rule 104). On failure it backs off (exponential, capped); at the attempt cap it stops
   auto-retrying and **surfaces** the item for the operator. `state.infraBlocked` (and the ⊘ marker / collapsed
   **OUTAGE** banner on the status board) shows what is blocked and why — see §3f. `pr-land` records the block
   automatically at the failed open, so a conveyor-launched delivery/prepare agent's `blocked-on-infra` return
   needs no extra bookkeeping from you; just note it in the tick line.

5. **Post `decisions.statusLine`, then start the next tick.** The core already built the terse one-line status
   from the tick read + the live bookkeeping (counts of building / preparing / fixing / queued / parked + the
   health verdict, with `· N infra-blocked` and a `⚠ lane-N` warn suffix appended when they apply) and gathered
   the per-tick surfaces in `decisions.notes` (a TTL re-dispatch warning, a `needs-slice` epic §3d, a prepared
   `decision-ready` §3e). Post that line (plus any notes) — do not recompute the counts. If `decisions.idleStop`
   is true, STOP the loop (§6) instead of arming the next tick. Per the operator's progress-tracking preference
   the checklist is the channel and prose stays quiet — one line per tick, e.g.:
   > `conveyor · N building · N preparing · N fixing · N queued · N parked · health ok` — add `· N infra-blocked`
   > when `state.infraBlocked` is non-empty (pushed-but-unopened work the §4b pass is auto-retrying; flag a
   > capped/exhausted one for the operator) — where **`N preparing`**
   > is the count of prepare-scope agents in flight (auto-preparing unscoped items' scope) and **`N fixing`** is
   > the count of fix agents in flight (repairing `review:changes` bounces, §3c). Add `⚠` + the flagged lanes
   > when `state.health.verdict === 'warn'`; add `⚠ N auto-preparing scope: #A #B` when `state.unshaped` is
   > non-empty, so the operator sees those cleared items are being scoped now (a prepare agent per item) and will
   > build once their scope lands — see the auto-prepare callout above.
   Then arm the next tick — this is the heartbeat:
   ```
   Bash({ command: "sleep 120", run_in_background: true })
   ```
   Its exit (~120s, just under the 5-min prompt-cache window so ticks stay cheap) re-invokes this loop at step 1.

> **On-demand board — the fuller status view.** The per-tick line above stays the routine channel. When the
> operator asks "status" (or you want a fuller look on a slower beat), print the compact text board instead:
> ```bash
> node scripts/conveyor/status-board.mjs
> ```
> It is a pure text mirror of the plateau lane board that renders THIS same tick read
> (`conveyor-state.mjs --json`, env-inherited so `CONVEYOR_QUEUE_FILE` still points at the session sidecar) —
> a header count line plus **RUNNING** (each active lane + its state marker), **QUEUE** (each cleared item and
> WHY it waits), and **NEEDS YOU** (parked PRs with their `/review N` action). It invents no state and makes no
> decision; it only formats the read. Keep the terse one-liner for the heartbeat and reach for the board on
> demand — do not replace one with the other.

> **The three guard blocks below DOCUMENT what `tick-core.mjs` (#2699) encodes — they are not a second place to
> compute a guard.** The mechanized core (step 2b) applies every rule here and returns the filtered spawns +
> `nextState`; these blocks stay so the semantics remain legible and reviewable. If you find yourself re-deriving
> a TTL, a re-dispatch gate, or a retirement rule in prose, that is the bug #2699 closes — read the core's answer
> (`decisions` / `nextState`) and execute it. The pure functions and their unit proofs live in
> `scripts/conveyor/tick-core.mjs` + `scripts/conveyor/__tests__/tick-core.test.mjs`.

**In-flight dispatch guard (the one bit of ephemeral bookkeeping).** Between spawning a delivery agent and that
agent acquiring its lane + claiming the item, the item is still in the queue and its lane still reads free — so
a naive next tick could double-dispatch it. The core keeps an in-session list of guard entries, one per spawned
agent: `{ num, lane, spawnedTick }`. On each tick it **filters `plan.launch`** (`filterLaunches`) to drop any
entry whose `num` **OR** whose assigned `lane` matches a live guard entry — the contended resource is the LANE,
not just the item, so both must be excluded (else tick N launches `{num:100, lane:4}`, 100 is slow to acquire,
and tick N+1 re-assigns lane 4 to a different top-of-queue `num` while agent A is still starting — two agents
targeting lane 4).

**The prepare guard is DIFFERENT bookkeeping — do not copy the build guard's retirement.** A prepare-scope agent
(§3b) gets a `{ num, kind: 'prepare', spawnedTick }` entry, keyed by `num` (the contended resource is the item's
scope authorship, not the incidental lane). But a prepare is fundamentally unlike a build: **a build claims and
leaves the queue within a tick or two; a prepare NEVER claims and leaves the queue only at MERGE** — its item
stays `unshaped-no-scope` / in `state.unshaped` for every tick from spawn until its scope PR lands (CI + drain
latency, several ticks). And its Agent returns at **PR-open**, well before merge. So the build guard's "retire on
Agent-return" rule is a **double-dispatch bug** for a prepare (it would clear the guard while the item is still
unscoped, and step 3b would spawn a second, third, … prepare each tick until merge — competing same-file PRs on
burned lanes). The prepare guard therefore has its OWN rules:

- **Re-dispatch gate (the union, restated).** Skip spawning a prepare for `num` when EITHER a live prepare-guard
  entry exists for it OR `state.prs` has an OPEN PR for that `num` (which, while the item is still unscoped, can
  only be its prepare — it has no build PR). The open-PR clause is the backstop if the guard is ever lost.
- **Retire a prepare-guard entry ONLY on one of these — NEVER on mere Agent-return:**
  1. **Scope committed** — the item has left `state.unshaped` (the dispatch plan no longer holds it
     `unshaped-no-scope`, i.e. it now carries committed `scope:`). This is the success path; the item will build.
  2. **Prepare PR terminal** — the prepare PR for that `num` reached a terminal state (merged / closed / failed),
     surfaced by its watcher exit or by leaving the OPEN set in `state.prs`.
- **TTL is spawn-to-FIRST-PR only, not spawn-to-merge.** Do NOT inherit the build guard's 3-tick TTL — a healthy
  prepare's spawn→merge span is longer than that, and re-dispatching a slow-but-live prepare is the very bug this
  fixes. The prepare TTL fires for ONE purpose: to catch a prepare Agent that **died before opening its PR**. So:
  if NO open PR for `num` has appeared in `state.prs` within **N ticks (default 5)** of the spawn, assume the
  agent died pre-PR → drop the guard and allow re-dispatch (surface a one-line note). **Once an open prepare PR
  exists for the `num`, the TTL is void** — retirement is PR-terminal (rule 2) and a second prepare is already
  blocked by the open-PR clause, so a slow-landing but healthy prepare is never re-dispatched.

**Retire a BUILD/delivery guard entry three ways** (these are the delivery-guard's rules — a prepare guard uses
its own, above, and in particular does NOT retire on Agent-return):

1. **Claimed → the agent got going.** When the item shows as claimed in `conveyor-state` — its lane appears in
   `state.lanes` (leased) or it has left `state.queue` — drop the entry. This is the normal path.
2. **Agent completed / errored** — when the delivery `Agent` returns (any result, including an escalation),
   drop its entry.
3. **TTL EXPIRY (the required backstop).** If an entry is still pending after **N ticks (default 3, ≈ 6 min)**
   without ever showing as claimed, **DROP it and let it re-dispatch**, and surface a one-line note the first
   time (`⚠ #<num> never claimed after <N> ticks — re-dispatching`). This covers an agent that **died after
   spawn but before claiming** (a crash during `acquire`/`npm`, a lost background task, a lost lane race): path
   (1) never fires and path (2)'s health backstop is currently inert (see below), so without the TTL the `num`
   would sit guarded **forever** and that one item would silently stop delivering for the whole session.

> **Do NOT rely on `state.health` as the guard backstop.** The stall scan is **dormant** today: it maps a lane
> to its item via `.claude/lane-ports.json`, which is `{}` (nothing in the acquire path populates it yet), so
> `conveyor-state`'s health scan never flags a stalled lane and `state.health` reads `ok` regardless. The **TTL
> (rule 3) is the real backstop** until that lane→num mapping exists (populating it is a separate follow-up — do
> not build it here). Still surface `state.health.verdict === 'warn'` when it does fire, but never make the guard
> depend on it.

This is process bookkeeping — which agents you launched — not a state store: the board stays the single truth
(see *State*).

## 3. On a watcher exit (the wake)

A `pr-watch.mjs` process exiting re-invokes you with its exit code. Branch on it (these are the script's
contract — do not re-derive the verdict; the watcher already classified the PR):

- **`0` merged** — the resident drain landed it; the lane is now free. Drop it from your watched set; the next
  tick's `dispatch-plan` fills the freed lane. Nothing else to do.
- **`2` parked** — the PR carries a review label. **Which label decides the branch** (`pr-watch` exits `2` for
  all three; re-read the PR's labels from a fresh `state.prs` row — or `gh pr view <N> --json labels` — to tell
  them apart, #2630):
  - **`review:changes`** — a human bounced this diff and asked for a fix. **Auto-re-dispatch a fix agent into
    the PR's lane** (§3c below) — do NOT just surface it. The repair is script-shaped (reuse the ref, apply the
    finding, re-push, re-arm review); the fix agent does it and hands the PR back `review:pending`.
  - **`review:human` / `review:pending`** — an independent human verdict is owed. Surface in chat: **"PR #N
    (#`<num>`) needs review — run `/review N`."** Do **NOT** auto-land it and do **NOT** auto-fix it: a human
    review park is a hard human-only gate. The lane stays held until the review resolves.

  Either way the PR stays OPEN, so the next tick's step-4 re-arms a watcher on it — a re-armed `review:pending`
  (after a fix) or a fresh human bounce wakes the loop again.
- **`4` closed** — the PR was closed without merging (a human abandoned it). Surface as an **anomaly to
  investigate** — do NOT run `/review` (a label swap can't land a closed PR). Note the stranded lane.
- **`3` timeout** — the wall-clock budget elapsed with the PR still pending. Re-arm a watcher on it, or flag a
  possibly-stuck lane for the operator if it keeps timing out.
- **`1` error** — bad arguments / the watcher couldn't run. Report it; re-spawn with a correct PR number.

### 3c. Auto-re-dispatch a `review:changes` bounce — spawn ONE fix agent into the PR's lane (#2630)

When exit `2` resolves to **`review:changes`** on a PR **this conveyor launched**, a human bounced the diff and
asked for a change. Before #2630 that only parked and a human had to `/finish` it; now the conveyor re-dispatches
a **fix agent** to repair it in the same lane — **UNLESS** the *fix in-flight test* or the *retry cap* suppresses
it (both below). When neither suppresses:

- **Resolve the PR's lane ref and item.** From `state.prs` you have `{ num, prNumber }`; read the head ref with
  `gh pr view <prNumber> --json headRefName` → `lane/<num>-<slug>`. Glob `backlog/<num>-*.md` for the spec path
  and read its `scope:`.
- **Pick a free lane** the same way step 3 does (a `freeSlots` lane minus this tick's builds/prepares/guards) —
  the fix runs in a FRESH clone reset to the pushed lane ref (`acquire --base=<headRef>`), not the original
  lease, so it needs its own free lane.
- **Instantiate [`fix-agent-brief.md`](fix-agent-brief.md)** by substituting its placeholders: `{{ITEM_NUM}}`=`num`,
  `{{PR_NUM}}`=`prNumber`, `{{LANE_REF}}`=the head ref, `{{LANE}}`=the picked lane, `{{SESSION_SLUG}}`=`fix-<num>`,
  `{{SCOPE}}`=the item's `scope:` entries repo-qualified and comma-joined. Those six `{{DOUBLE_BRACE}}` tokens are
  the whole fill — do not rewrite the brief's prose.
- **Spawn it as ONE background `Agent`.** It acquires a lane on the pushed ref, reads the reviewer's finding off
  the PR, applies ONLY that fix, gets the gate green, re-pushes HEAD to the same `lane/*` ref, then **re-arms the
  review** (`review:changes → review:pending` via `scripts/conveyor/rearm-review.mjs`) and exits. It **NEVER**
  self-clears the human review label — the human (or the drain's AI-review convergence pass) re-verdicts the
  re-armed PR.
- **Record a fix-guard entry** `{ pr: prNumber, num, spawnedTick }` AND **bump the per-PR attempt counter**
  (the within-session overlay — see the fix guard below; the entry and the counter are DISTINCT state, and the
  counter's durable source of truth is the PR's re-arm comments, not this overlay). The spawned fix agent posts
  the durable re-arm comment when it re-arms, which is what the count reads back after a restart. The PR stays
  OPEN, so step 4 keeps a watcher on it — when the fix re-arms it to `review:pending`, that exit `2` routes to
  the `review:human`/`review:pending` branch (surface for `/review`), not back into auto-fix.

**The fix guard — its own bookkeeping, and TWO separate pieces of state (do NOT copy the build/prepare guard's
retirement, and do NOT conflate the two).** A fix dispatch tracks:

1. **An in-flight guard entry** `{ pr, num, spawnedTick }` keyed by the **PR number** — "a fix agent for this PR
   is live right now." It is retired (see below) the moment the PR is no longer awaiting an in-flight repair.
2. **A per-PR attempt counter** — "how many auto-fixes this PR has cost in total." It is a SEPARATE longer-lived
   tally that **survives the guard-entry retirement**. Keeping it off the guard entry is the whole point: a human
   bounce → fix → re-arm → human bounces AGAIN is a NEW `review:changes` with NO live guard entry, so if the count
   lived on the entry it would reset to 1 each cycle and the cap below would never bind. The counter must persist
   across fix↔bounce cycles or the loop is unbounded.
   **The DURABLE count derives from the PR itself, not from in-session memory (#2643).** Each completed auto-fix
   posts exactly one re-arm comment (`rearm-review.mjs`, marker `🔧 conveyor fix — re-armed for re-review`), so
   the count is **`countRearmComments(pr.comments)`** — read back off the PR's own comment thread. This is the
   restart-surviving source of truth: a session-side `fixAttempts[pr]` map would start EMPTY on a fresh / restarted
   conveyor, and the next bounce would auto-fix from zero — the cap would never bind (the exact unbounded fix↔bounce
   loop it exists to prevent, and a parallel state store §5 forbids). The mechanized guard binds the cap on
   **`max(in-session tally, durable re-arm count)`**: the durable count is authoritative and restart-surviving; the
   in-session tally is a within-session overlay that ALSO catches a fix agent that **died before re-arming** (it
   posts no comment, so the durable floor can't see it — but the TTL-backstop case must still terminate at the
   human). The tally clears on PR-terminal, and the durable comments become moot once the PR leaves the open set.

Its rules — two suppressions and one cap:

- **Fix in-flight test (skip re-dispatch).** Skip spawning a fix for a PR when a live guard ENTRY (piece 1)
  already exists for it. This is essential: right after you spawn the fix agent, step 4 re-arms a watcher on the
  still-`review:changes` PR (the agent hasn't re-armed yet), so the watcher exits `2` again almost immediately —
  the entry is what stops that second exit-2 from spawning a duplicate fix on a second burned lane.
- **Retry cap (default 3 auto-fix attempts per PR).** BEFORE spawning, check the attempt count (piece 2) —
  `max(in-session tally, countRearmComments(pr.comments))`. Once it has reached **3**, **stop auto-fixing** this PR
  and surface it for `/review` instead (`⚠ PR #N (#<num>) bounced <k>× — auto-fix exhausted, run /review N`).
  Because the count persists across cycles AND survives a restart (it derives from the PR's durable re-arm
  comments), this binds even when each cycle is a fresh human bounce with no live entry, and even when a restart
  wiped the in-session tally — a finding the auto-fixer can't satisfy in a few passes needs a human; never loop a
  fix↔bounce cycle unboundedly.
- **Retire the in-flight guard ENTRY (piece 1) two ways — NOT the attempt counter:** (1) **Re-armed / resolved**
  — a fresh `state.prs` read shows the PR no longer carries `review:changes` (it re-armed to `review:pending`, or
  merged/closed). Drop the ENTRY; **leave `fixAttempts[pr]` intact** (it only clears on PR-terminal). (2) **TTL
  backstop** — if the PR is STILL `review:changes` after **N ticks (default 5)** of the spawn (the fix agent died
  before re-pushing/re-arming), drop the ENTRY and allow a re-dispatch — still gated by the retry cap (the
  counter did NOT reset), so a repeatedly-dying fix still terminates at the human. Clear `fixAttempts[pr]` only
  when the PR reaches a terminal state (merged / closed).

> **Red gate / red CI is NOT watcher-visible.** `pr-watch` reads only `state,mergedAt,labels`, so a gate-red or
> red-CI PR reads as `pending`. That escalation surfaces via the **delivery / fix agent's one-line return** (the
> #2608 / #2630 briefs), not the watcher — when a delivery or fix `Agent` completes with `… gate-red` /
> `fix escalated <reason>` / `escalated <label>`, surface that in chat. Never assume the watcher caught a red
> build. (A fix agent that hits a red gate or an ambiguous finding leaves the PR `review:changes` and does NOT
> re-arm — so it re-enters the fix path on a later tick unless the retry cap has been reached.)

### 3d. Surface every cleared epic for `/slice` — a cleared epic is a slice trigger, not a dead end (#2645)

An **epic** is a CONTAINER; its work lives in child stories/tasks, so the dispatcher **never** launches it to
build. A cleared `kind:epic` is held **`needs-slice`** (in `plan.held`) and surfaced in `state.needsSlice` (each
entry `{ num, epicState }`). Before this rule such an epic fell into a silent hole — never built, never sliced,
no signal. Now, each tick, for every item in `state.needsSlice`, **surface it to the operator** so it gets
decomposed into buildable children (which the conveyor then dispatches on later ticks):

- **Route by `epicState`** — the surfaced action depends on the epic's state (the same states the readiness view
  uses), so you never prompt a `/slice` on an already-sliced epic:
  - `unsliced` → **`/slice <num>`** — decompose it into buildable child stories. This is the core case.
  - `done` → **`/resolve <num>`** — every child is resolved; the epic just needs its explicit resolve, not a slice.
  - `tracking` → **no slice** — it already has open child slices; those children ARE the work (clear the children,
    not the container). Note it so the operator can `remove` the epic from the conveyor queue.
  - `program` / `parked` → **no slice** — a perpetual program, or a `childlessReason` gates decomposition; surface
    the state, never prompt a slice.
  - `null` (unknown — a loader-degraded read, or an epic armed while not open/unblocked, so `epicState` was never
    derived) → **surface, no auto-route** — show it as an epic awaiting attention; don't presume `/slice`.
- **Surface, do not auto-slice.** Slicing is human judgment (the `/slice` flow is gated on approval per the
  split-backlog-item skill), so the conveyor **surfaces** the epic rather than spawning an autonomous slice agent
  — the deliberately-chosen branch of the spec's "surface **or** auto-run" (auto-slicing an epic without a human
  in the loop is out of scope here). Add a line to the tick status, e.g.
  `⚠ N epic(s) need slicing: #A (/slice) #B (/resolve)`, so a cleared epic is **always** either
  sliced-and-dispatched (once the operator runs `/slice` and its children land + are cleared) or explicitly
  awaiting slice — never silently stalled.
- **No guard, no spawn.** Unlike §3b/§3c this dispatches **no** agent and consumes **no** lane, so it needs no
  in-flight guard — it is a pure per-tick SURFACE of `state.needsSlice`. The epic stays `needs-slice` every tick
  until the operator slices/resolves/removes it (idempotent — re-surfacing the same epic each tick is correct,
  it is a standing "awaiting slice" signal, not a repeated action).

### 3e. Drive every cleared decision — prepare then present (#2647)

A **decision** is NOT build work; its lifecycle is **prepare** then **present**. A cleared `kind:decision` is
held **`needs-decision`** (in `plan.held`) and surfaced in `state.decisions` (each entry `{ num, prepared,
preparedDate }`). Before this rule a cleared decision fell into the same silent hole an epic did — never built
(a decision isn't buildable), and worse, mislabeled `unshaped-no-scope` and aimed at a scope-prediction agent.
Now, each tick, for every item in `state.decisions`, route by its `prepared` flag:

- **UNPREPARED (`prepared === false`) → auto-prepare it: spawn ONE background prepare-decision agent.** This is
  the autonomous half of a decision (the `/prepare` skill is pure agent work — no human judgment yet). It
  mirrors §3b's auto-prepare-scope exactly, one kind over — **UNLESS a prepare for that `num` is already in
  flight** by the *prepare in-flight test* (the union rule below): **skip** re-dispatch when EITHER a live
  decision-prepare-guard entry exists for `num`, OR `state.prs` already has an **OPEN PR for that `num`** (while
  the decision is still un-prepared it has no build PR, so any open PR for its `num` can only be its in-flight
  prepare). Only when NEITHER holds do you spawn:
  - Resolve the item's spec path by **globbing `backlog/<num>-*.md`**.
  - **Pick a prepare lane that no build/prepare/guard already owns this tick** — the same lane-exclusion §3b
    uses (a `freeSlots` lane MINUS this tick's `plan.launch` builds MINUS every guard-held lane). A
    prepare-decision lane is parallel-safe with builds and other prepares: its scope is the one decision's item
    body plus a new `/research/` topic — disjoint from any builder's code scope.
  - Instantiate [`prepare-decision-agent-brief.md`](prepare-decision-agent-brief.md) by substituting its four
    placeholders: `{{ITEM_NUM}}`=`num`, `{{ITEM_SPEC_PATH}}`=the globbed `backlog/<num>-<slug>.md`,
    `{{LANE}}`=the picked lane, `{{SESSION_SLUG}}`=`prepare-decision-<num>`. Those four `{{DOUBLE_BRACE}}`
    tokens are the whole fill — do not rewrite the brief's prose.
  - Spawn it as **one background `Agent`**. It acquires its lane, prepare-holds the decision, runs the
    `/prepare` passes (prior-art research → per-fork classification → author the prepared-fork shape → skeptic
    pass → two-confusion screen → `prepare-stamp` the `preparedDate`), gets the gate green, **runs an
    adversarial review subagent on its prepared forks and addresses the findings to convergence BEFORE opening
    the PR**, then opens ONE `ready-to-merge` PR and `prepare-release`s the hold — **exits without merging**.
    When that PR lands the decision is prepared, so on a later tick `state.decisions` reads it `prepared:true`
    and this section presents it (below).
  - **Record a decision-prepare-guard entry** `{ num, kind: 'prepare-decision', spawnedTick }` — keyed by `num`
    (the contended resource is the decision's authorship). Its retirement is the SAME as §3b's prepare guard
    (retire only when the item leaves `state.decisions[].prepared === false`, i.e. its `preparedDate` landed, or
    the prepare PR closed) — a returning prepare-decision Agent does NOT retire its guard (it returns at PR-open,
    mid-flight).
- **PREPARED (`prepared === true`) → present its forks for ratification. Surface, do not auto-ratify.** A
  prepared decision is ready to *ratify*, and ratifying is human judgment (MEMORY #39 — *never take an unprepared
  decision*; and `/prepare` explicitly does **not** make the call). So — exactly like §3d surfaces an epic
  rather than auto-slicing — the conveyor **presents** the prepared forks and lets the human ratify:
  - **Publish a forks artefact in the chat conveyor** — the conversational surface. Read the prepared item body,
    and publish a self-contained artefact summarizing each `## Fork N` (its options, the bold default, the
    `Skeptic:`/`Screen:` verdicts) so the operator can see and ratify it inline. This is the main-session
    (chat) present channel.
  - **Feed the #2565 console decision-ratify (ruling) surface** — the product/UI conveyor's present channel. The
    console's ruling read/write ports (#2580 / #2581 / #2582) are already built; the autonomous feed that wires
    a prepared decision into them is a **cross-locus follow-up** (see the blocked follow-up item) — until it
    lands, note the prepared decision is available for the console ruling surface and rely on the chat artefact.
  - **Surface for `/next decision`** — add a line to the tick status, e.g.
    `⚖ N decision(s) ready to ratify: #A #B (/next decision)`, so a prepared cleared decision is **always** either
    ratified (once the operator makes the call) or explicitly awaiting ratification — never silently stalled.
  - **No agent, no guard for the present half** — like §3d it is a pure per-tick SURFACE of the prepared rows
    (idempotent; re-presenting each tick is correct — a standing "ready to ratify" signal). Only the *prepare*
    half (above) spawns an agent and carries a guard.

### 3f. Infra-blocked — a first-class state for a PRE-PR infra failure (#2659)

Between "the agent built + pushed its ref" and "the PR is open" there is a real failure window: `gh pr create`
can fail on an **outside dependency** (a GitHub partial outage — grounded in the 2026-07-24 incident that blocked
#2654's PR-open — or a network fault). That built + pushed work is **not** a review-park, a stall, or gate-red,
and the PR watcher can't see it (no PR exists). Before #2659 it was silently stranded. Now it is a **first-class
state** the conveyor owns end-to-end:

- **Recorded, never lost.** `pr-land` detects a KNOWN-transient PR-open failure (a GitHub 5xx / rate-limit /
  network fault — a genuine error like a bad body or "already exists" is NOT infra and still hard-fails, never a
  doomed retry) and records the **resumable handle** (the pushed `lane/*` ref + its tip + base + body) into the
  conveyor infra-blocked sidecar. It exits `blocked-on-infra` (exit 4), leaving `main` untouched.
- **Auto-retried + resume-opened.** The §4b recovery pass owns an idempotent exponential-backoff retry loop:
  once GitHub recovers it resume-opens the PR **from the recorded ref via `pr-land`** (which never merges — the
  drain lands it). At the attempt cap it stops and surfaces.
- **Reads DISTINCT from a stall or a review-park.** An infra-blocked lane shows the ⊘ marker with its failure
  class + retry attempt + countdown, and a widespread outage collapses into ONE **OUTAGE** banner (not N alarms).
  It is excluded from the stall/health scan, so it never mis-reads as a hung lane. When auto-retry is exhausted
  (the cap), the board reads "auto-retry exhausted — resume by hand" so the operator knows to intervene.
- **Nothing you do by hand.** `pr-land` records it, the §4b pass drives it, the board surfaces it. Surface a
  capped/exhausted item to the operator (like a park), and otherwise let the loop resume it.

## 4. Landing is the drain daemon's job — the conveyor NEVER merges

Delivery agents stop at `ready-to-merge` — but only **after** each has reviewed its own diff to convergence
(step above) and `pr-land --label-on-green` confirms the `test` check. The **resident drain daemon**
(`plateau:tools/drain-daemon/`) is the single landing serializer: it auto-lands green couples and parks
escalations `review:human` for review in this main session. This skill **never runs `gh pr merge` and never
runs a drain.** `state.daemon` reports the daemon's residency; if it reads `"unavailable"`, tell the operator
the resident drain is absent (escalations still park, but nothing auto-lands until it — or a manual `/drain` —
runs).

**Escalation discipline — `review:human` is a good-reason hold, not a default.** Because every delivery agent
runs the adversarial review before opening its PR, a **clean, reviewed, non-statute PR with a green `test`
auto-lands via the daemon with no human in the loop** — that is the norm. Agents escalate `review:human` ONLY
for good reason — a **statute-touching** change, a **gate-red** PR, a **review finding that needs human
judgment**, or **genuine uncertainty** — and **never blanket-park** a clean PR "so a human can see it"
(over-parking makes the human the bottleneck the conveyor exists to remove and dilutes the label). Whether to
escalate is **judgment**, kept with the agent rather than a script
([we:docs/agent/platform-decisions.md#deterministic-core-thin-judgment](../../docs/agent/platform-decisions.md#deterministic-core-thin-judgment)).
A parked PR waking this loop (watcher exit `2`) is handled as in §3 by its label: a `review:human` /
`review:pending` park is surfaced for `/review` (never auto-landed); a `review:changes` bounce is
auto-re-dispatched to a fix agent (§3c) that repairs and re-arms it — but the fix agent still **never
self-clears** the review, so the re-armed PR returns to `review:pending` for a human (or the AI-review pass) to
verdict, never straight to `review:accepted`.

## 5. State is the board's channels only — no parallel store

Everything the conveyor and its agents do flows through the **normal verbs**: `acquire` a lane → claim → build
in the `lane/<num>` branch → `pr-land` → the daemon merges → resolve. Those are **exactly** the channels the
plateau lane board reads (`claimed.session`, `queued.lane`, `pr.state`+`ci`, the scope-lease collect). So the
board reflects conveyor state **for free**, and `conveyor-state.mjs` reads that same truth. **Never keep a
parallel state store of item / claim / PR / resolve state** — the only in-session bookkeeping allowed is
ephemeral *process* tracking: which delivery / prepare-scope / prepare-decision / fix `Agent`s and which
`pr-watch` processes you have spawned (the in-flight dispatch guard, the prepare-scope guard, the
**decision-prepare guard** (§3e), the in-flight **fix-guard ENTRY** (§3c), and the watched-PR set). That
is not item state; it is which background jobs are live — the re-arm swap and every repair still flow through the
board's normal verbs (`git push … lane/*` → `rearm-review.mjs` → the PR's labels → the daemon / `/review`).

The **auto-fix retry count** is the case that proves the rule (#2643): "how many times this PR was auto-fixed" is
**PR state, not process state**, so it must NOT live in a session-side map (a restart would wipe it and the cap
would silently stop binding). It **derives from the PR itself** — `countRearmComments(pr.comments)`, one durable
re-arm comment per completed auto-fix — so it survives a restart with no parallel store. The in-session tally the
mechanized guard also keeps is a within-session *overlay* over that durable count (it only adds coverage for a fix
agent that died before posting its re-arm comment); the durable comment thread is the source of truth.

## 6. Idle-stop (the conveyor's lifetime = the session's)

Stop on two signals only: the **queue is empty** (no `buildQueued` items in `state.queue`, no in-flight
lanes/PRs) **AND** there has been **no operator feedback for the configured idle window** (default 15 min —
measure from the last chat turn). When both hold, **announce it and STOP the tick loop** (do not arm another
`sleep`). The conveyor does not outlive its purpose; a fresh `/conveyor` restarts it.

> `state.queue`'s `buildQueued` now reflects the SESSION-LOCAL conveyor queue (`.conveyor/queue.json`, #2613),
> so `state.queue.filter(buildQueued)` is exactly what the operator cleared this session — the reliable
> queue-empty half.
>
> **Do NOT gate idle-stop on `state.idle.lastQueueAdd`.** That field is sourced from the **drain's**
> `queued.json` (the ready-to-merge token queue), **not** the conveyor queue the operator feeds with
> `queue.mjs add` — a fresh clear never updates it, so it is the wrong signal for "was work queued recently".
> The queue-empty test above already reads the conveyor queue correctly (via `state.queue`), which is the
> reliable half; rely on queue-empty + operator-feedback and ignore the `lastQueueAdd` grace clause until a
> conveyor-queue clear timestamp is wired into the state read.

## 7. Final ledger (on stop)

When the loop stops — idle-stop, or the operator ends it — post one final ledger from the last state read:

> **delivered** (merged this session) · **parked** (PRs awaiting `/review`, with numbers) · **stranded** (lanes
> whose PR closed/timed-out and need a look).

Release nothing yourself — delivery agents and the drain own their lanes; a stranded lane is surfaced, not
force-released, so the operator decides.

---

## The split, restated (why this skill is safe to keep thin)

Per #deterministic-core-thin-judgment, the line is:

- **Scripts (deterministic, tested — this skill only shells them):** the tick state read, the dispatch plan,
  the **mechanized tick core** (#2699 — `scripts/conveyor/tick-core.mjs`: the three guards + their retirement,
  the union re-dispatch gate, watcher arming, and idle-stop, all decided in one pure call the skill executes,
  never re-derives), the merge-watcher verdict, the idle-clock inputs, the health/stall scan, the
  **infra-blocked classify + backoff + resume decision** (#2659 — what counts as a retryable outage, the retry
  schedule, and when to resume vs surface are all in `scripts/conveyor/infra-blocked.mjs`, never re-derived in
  prose). Same inputs → same output.
- **Judgment (stays with the operator + the agents — this skill's real content):** the readiness discussion,
  clearing items for build, supervising a build, **each prepare-scope agent's touch-set prediction**, **each
  delivery agent's adversarial review of its own diff**, **each fix agent's application of the reviewer's
  finding** (the repair itself — routed by the deterministic exit-2 label, but the fix is judgment), the
  **escalate-or-auto-land call**, reviewing an escalation (`/review`), and investigating an anomaly. The
  `review:changes → review:pending` re-arm, by contrast, is a script-decidable swap (`rearm-review.mjs`) — the
  fix agent shells it, never re-deriving the "never clear the human gate" rule in prose. Never spend model context re-deriving a computable plan —
  read the script's answer and act on it. **Build-vs-prepare-vs-slice-vs-decide is NOT a judgment call here — it
  is the dispatch plan's classification:** `plan.launch` → build (scoped, §3); `held: unshaped-no-scope` /
  `state.unshaped` → prepare scope (unscoped, §3b); `held: needs-slice` / `state.needsSlice` → surface for
  `/slice` (an epic container, §3d); `held: needs-decision` / `state.decisions` → prepare-or-present a decision
  (§3e — an UNPREPARED one spawns a prepare-decision agent; a PREPARED one is surfaced/presented for ratify, no
  agent). The skill just spawns the matching agent (or, for an epic or a prepared decision, surfaces it — no
  agent). The one judgment that stays human throughout: **ratifying** a presented decision (never autonomous).
