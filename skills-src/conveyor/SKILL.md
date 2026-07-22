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
| `node scripts/readiness/conveyor-state.mjs --json` | **The whole tick picture in one read** — `{ queue, lanes, freeSlots, prs, daemon, idle, health }`. Every tick STARTS here. |
| `node scripts/readiness/dispatch-plan.mjs --json` | **The dispatcher** — `{ launch: [{num, lane}], held: [{num, reason}] }`. Which cleared items launch into which free lanes, and why the rest hold. |
| `node scripts/conveyor/pr-watch.mjs <pr>` | **The merge watcher** — one background process per in-flight PR. Its process EXIT is the wake signal; the exit CODE is the outcome (merged 0 · error 1 · parked 2 · timeout 3 · closed 4). |

The delivery-agent template it instantiates: [`delivery-agent-brief.md`](delivery-agent-brief.md) (#2608).

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
> node scripts/backlog.mjs build-queue add <NNN>      # clear-for-build: the conveyor may now pull it
> node scripts/backlog.mjs build-queue remove <NNN>   # un-clear it (before it launches)
> ```
> The conveyor pulls **only** cleared (`buildQueued`) items, in the build queue's ranked order. Re-prioritising
> the backlog never arms a build — clearing does. (`build-queue add/remove` is frontmatter-only and runs fine
> from this main session; it is not one of the lane-gated mutation verbs.)

Then launch the first tick (§2).

## 2. The tick loop (chained-sleep heartbeat)

**The clock is a chained background `sleep`, NOT `ScheduleWakeup`.** `ScheduleWakeup` does not fire mid-run in
this VS Code extension; a backgrounded shell command's **exit** rides the task-notification wake path (the same
one that works for a completed background task), so it re-invokes this loop reliably. Each tick:

1. **Read the whole picture (one call):**
   ```bash
   node scripts/readiness/conveyor-state.mjs --json
   ```
   → `{ queue, lanes, freeSlots, prs, daemon, idle, health }`. Do not eyeball four commands; this is the one read.

2. **Plan the dispatch (one call):**
   ```bash
   node scripts/readiness/dispatch-plan.mjs --json
   ```
   → `{ launch: [{num, lane}], held: [{num, reason}] }`. This is THE dispatcher — the queue × active scope-leases
   × free lanes decision. Do not re-derive it; read it. (It shells the same build-queue, scope-lease, and pool
   pickers under the hood, so its inputs match the state read above.)

3. **Spawn ONE background delivery agent per `launch` entry.** For each `{num, lane}` in `plan.launch` that the
   *In-flight dispatch guard* (below) does not suppress — i.e. neither its `num` **nor** its assigned `lane` is
   held by a still-pending spawned agent:
   - Resolve the item's spec path by **globbing `backlog/<num>-*.md`** (the plan returns only `{num, lane}`, not
     the slug), then read that file and its `scope:` frontmatter.
   - Instantiate [`delivery-agent-brief.md`](delivery-agent-brief.md) by substituting its placeholders:
     `{{ITEM_NUM}}`=`num`, `{{ITEM_SPEC_PATH}}`=the globbed `backlog/<num>-<slug>.md`, `{{LANE}}`=`lane`,
     `{{SESSION_SLUG}}`=`conveyor-<num>`, `{{SCOPE}}`=the item's `scope:` entries, repo-qualified and
     comma-joined (e.g. `we:scripts/conveyor,we:skills-src/conveyor`). Those five `{{DOUBLE_BRACE}}` tokens are
     the whole fill — the brief already names the real learnings drop-box command (`learnings-drop.mjs`) and
     every other step verbatim; do not rewrite its prose.
   - Spawn it as **one background `Agent`** with the filled brief as the prompt (default `run_in_background`).
     One agent = one item = one lane = one PR. The agent acquires its lane, claims the item, builds it, opens a
     `ready-to-merge` PR, and **exits without merging**.
   - **Record a guard entry** for this spawn: `{ num, lane, spawnedTick: <this tick's count or timestamp> }`
     (see the guard below).

4. **Spawn a merge watcher per newly-opened PR — but ONLY for items THIS conveyor launched.** `state.prs` (each
   row `{ num, prNumber, state, ci, labels }`) is built from `gh pr list` **repo-wide**, so it also carries PRs
   from other sessions / humans. Filter it to rows whose `num` is one the conveyor dispatched this session
   (a spawned/claimed item — keep a small in-session set of the nums you launched). For each such open PR you are
   not already watching, spawn a background watcher whose **exit** wakes this loop:
   ```bash
   node scripts/conveyor/pr-watch.mjs <prNumber>   # run_in_background: true
   ```
   Track the small set of `prNumber`s you have a live watcher for (ephemeral process bookkeeping — see the note
   under *State*). The board (`state.prs`) is the source of truth for which PRs exist; the watcher just wakes you
   the instant one reaches a terminal state. Scoping to conveyor-launched nums keeps an unrelated PR's stray
   `review:*` label from waking the loop with a spurious "PR #N needs review".

5. **Post ONE terse status line, then start the next tick.** Per the operator's progress-tracking preference the
   checklist is the channel and prose stays quiet — one line per tick, e.g.:
   > `conveyor · N building · N queued · N parked · health ok` (add `⚠` + the flagged lanes when
   > `state.health.verdict === 'warn'`).
   Then arm the next tick — this is the heartbeat:
   ```
   Bash({ command: "sleep 120", run_in_background: true })
   ```
   Its exit (~120s, just under the 5-min prompt-cache window so ticks stay cheap) re-invokes this loop at step 1.

**In-flight dispatch guard (the one bit of ephemeral bookkeeping).** Between spawning a delivery agent and that
agent acquiring its lane + claiming the item, the item is still in the queue and its lane still reads free — so
a naive next tick could double-dispatch it. Keep an in-session list of guard entries, one per spawned agent:
`{ num, lane, spawnedTick }`. On each tick, **filter `plan.launch`** to drop any entry whose `num` **OR** whose
assigned `lane` matches a live guard entry — the contended resource is the LANE, not just the item, so both must
be excluded (else tick N launches `{num:100, lane:4}`, 100 is slow to acquire, and tick N+1 re-assigns lane 4 to
a different top-of-queue `num` while agent A is still starting — two agents targeting lane 4).

**Retire a guard entry three ways:**

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
- **`2` parked** — the PR carries `review:human` / `review:pending` / `review:changes`. Surface in chat:
  **"PR #N (#`<num>`) needs review — run `/review N`."** Do **NOT** auto-land it: a human review park is a
  hard human-only gate. The lane stays held until the review resolves.
- **`4` closed** — the PR was closed without merging (a human abandoned it). Surface as an **anomaly to
  investigate** — do NOT run `/review` (a label swap can't land a closed PR). Note the stranded lane.
- **`3` timeout** — the wall-clock budget elapsed with the PR still pending. Re-arm a watcher on it, or flag a
  possibly-stuck lane for the operator if it keeps timing out.
- **`1` error** — bad arguments / the watcher couldn't run. Report it; re-spawn with a correct PR number.

> **Red gate / red CI is NOT watcher-visible.** `pr-watch` reads only `state,mergedAt,labels`, so a gate-red or
> red-CI PR reads as `pending`. That escalation surfaces via the **delivery agent's one-line return** (the #2608
> brief), not the watcher — when a delivery `Agent` completes with `… gate-red` / `escalated <label>`, surface
> that in chat. Never assume the watcher caught a red build.

## 4. Landing is the drain daemon's job — the conveyor NEVER merges

Delivery agents stop at `ready-to-merge` (after their gate is green and `pr-land --label-on-green` confirms the
`test` check). The **resident drain daemon** (`plateau:tools/drain-daemon/`) is the single landing serializer:
it auto-lands green couples and parks escalations (statute-touching / gate-red / `review:changes`) `review:human`
for review in this main session. This skill **never runs `gh pr merge` and never runs a drain.** `state.daemon`
reports the daemon's residency; if it reads `"unavailable"`, tell the operator the resident drain is absent
(escalations still park, but nothing auto-lands until it — or a manual `/drain` — runs).

## 5. State is the board's channels only — no parallel store

Everything the conveyor and its agents do flows through the **normal verbs**: `acquire` a lane → claim → build
in the `lane/<num>` branch → `pr-land` → the daemon merges → resolve. Those are **exactly** the channels the
plateau lane board reads (`claimed.session`, `queued.lane`, `pr.state`+`ci`, the scope-lease collect). So the
board reflects conveyor state **for free**, and `conveyor-state.mjs` reads that same truth. **Never keep a
parallel state store of item / claim / PR / resolve state** — the only in-session bookkeeping allowed is
ephemeral *process* tracking: which delivery `Agent`s and which `pr-watch` processes you have spawned (the
in-flight dispatch guard and the watched-PR set). That is not item state; it is which background jobs are live.

## 6. Idle-stop (the conveyor's lifetime = the session's)

Stop on two signals only: the **queue is empty** (no `buildQueued` items in `state.queue`, no in-flight
lanes/PRs) **AND** there has been **no operator feedback for the configured idle window** (default 15 min —
measure from the last chat turn). When both hold, **announce it and STOP the tick loop** (do not arm another
`sleep`). The conveyor does not outlive its purpose; a fresh `/conveyor` restarts it.

> **Do NOT gate idle-stop on `state.idle.lastQueueAdd`.** That field is sourced from the **drain's**
> `queued.json` (the ready-to-merge token queue), **not** the build-queue the operator feeds with
> `build-queue add` — a fresh clear never updates it, so it is the wrong signal for "was work queued recently".
> The queue-empty test above already reads `buildQueued` correctly (via `state.queue`), which is the reliable
> half; rely on queue-empty + operator-feedback and ignore the `lastQueueAdd` grace clause until a build-queue
> clear timestamp exists.

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
  the merge-watcher verdict, the idle-clock inputs, the health/stall scan. Same inputs → same output, always.
- **Judgment (stays with the operator + the agents — this skill's real content):** the readiness discussion,
  clearing items for build, supervising a build, reviewing an escalation (`/review`), and investigating an
  anomaly. Never spend model context re-deriving a computable plan — read the script's answer and act on it.
