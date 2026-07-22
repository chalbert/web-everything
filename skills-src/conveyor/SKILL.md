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
| `node scripts/readiness/conveyor-state.mjs --json` | **The whole tick picture in one read** — `{ queue, clearedNotReady, unshaped, lanes, freeSlots, prs, daemon, idle, health }`. Every tick STARTS here. |
| `node scripts/readiness/dispatch-plan.mjs --json` | **The dispatcher** — `{ launch: [{num, lane}], held: [{num, reason}] }`. Which cleared items launch into which free lanes, and why the rest hold. |
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

The two agent templates it instantiates: [`delivery-agent-brief.md`](delivery-agent-brief.md) (build a scoped
item, #2608) and [`prepare-scope-agent-brief.md`](prepare-scope-agent-brief.md) (author an unscoped item's
`scope:`, #2613).

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
   → `{ queue, clearedNotReady, lanes, freeSlots, prs, daemon, idle, health }`. Do not eyeball four commands; this is the one read.

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
     One agent = one item = one lane = one PR. The agent acquires its lane, claims the item, builds it, gets the
     gate green, then **runs an adversarial code-review subagent on its own diff and addresses the findings to
     convergence BEFORE opening the PR** (a green gate is not a review — #deterministic-core-thin-judgment: the
     gate is the deterministic core, the review is the judgment). Only then does it open the PR —
     `ready-to-merge` for a clean, reviewed, non-statute change, or parked `review:human` **only for good
     reason** (below) — and **exits without merging**.
   - **Record a guard entry** for this spawn: `{ num, lane, spawnedTick: <this tick's count or timestamp> }`
     (see the guard below).

3b. **Auto-prepare every unscoped held item — spawn ONE background prepare-scope agent per `unshaped-no-scope`.**
   The dispatcher NEVER launches an unscoped item to build; it holds it `unshaped-no-scope` (in `plan.held`) and
   surfaces it in `state.unshaped`. For each such held item — **deciding to prepare vs to build is entirely the
   dispatch plan's classification: a scoped item appears in `plan.launch` (step 3, build); an unscoped one appears
   as `held: unshaped-no-scope` / `state.unshaped` (here, prepare)** — spawn ONE background prepare-scope agent,
   UNLESS a prepare is **already in flight for that `num`** (the in-flight guard, keyed by num — see below):
   - Resolve the item's spec path by **globbing `backlog/<num>-*.md`** (this is the ONLY file the prepare edits).
   - Pick a free lane for the prepare from `state.freeSlots` / the free-lane set (a prepare needs a lane clone
     too). A prepare's lane is its OWN — it is **parallel-safe** with every build and every other prepare, because
     each prepare's `--scope` is a single, distinct backlog file (`we:backlog/<num>-<slug>.md`), disjoint by
     construction from any builder's code scope and from every other prepare's file.
   - Instantiate [`prepare-scope-agent-brief.md`](prepare-scope-agent-brief.md) by substituting its four
     placeholders: `{{ITEM_NUM}}`=`num`, `{{ITEM_SPEC_PATH}}`=the globbed `backlog/<num>-<slug>.md`, `{{LANE}}`=the
     picked lane, `{{SESSION_SLUG}}`=`prepare-<num>`. Those four `{{DOUBLE_BRACE}}` tokens are the whole fill — do
     not rewrite the brief's prose.
   - Spawn it as **one background `Agent`** with the filled brief as the prompt. It acquires its lane, predicts the
     item's touch-set, writes `scope:` into the one backlog file, gets the gate green, and opens a one-file
     `ready-to-merge` PR (auto-lands — no review escalation unless the item is statute-touching), then **exits
     without merging**. When that PR lands the item is scoped and dispatches to **build** on a later tick.
   - **Record a prepare-guard entry** `{ num, kind: 'prepare', spawnedTick }` so the next tick does not spawn a
     second prepare for the same `num` while the first is in flight (guard keyed by num — a prepare's lane is
     incidental, the contended resource is the item's scope authorship).

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
   - **Prepare-scope PRs are watched the same way** (their `num` was dispatched this session too). When a prepare
     PR **merges** (watcher exit `0`), the item now carries committed `scope:`, so the very next tick's
     `dispatch-plan` sees it as scoped and launches it to **BUILD** — the auto-prepare → build handoff. Retire the
     prepare-guard entry for that `num` when its prepare Agent returns or its PR lands (same retirement rules as a
     delivery guard entry).

5. **Post ONE terse status line, then start the next tick.** Per the operator's progress-tracking preference the
   checklist is the channel and prose stays quiet — one line per tick, e.g.:
   > `conveyor · N building · N preparing · N queued · N parked · health ok` — where **`N preparing`** is the
   > count of prepare-scope agents in flight (auto-preparing unscoped items' scope). Add `⚠` + the flagged lanes
   > when `state.health.verdict === 'warn'`; add `⚠ N auto-preparing scope: #A #B` when `state.unshaped` is
   > non-empty, so the operator sees those cleared items are being scoped now (a prepare agent per item) and will
   > build once their scope lands — see the auto-prepare callout above.
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

**The prepare guard is the same bookkeeping, keyed by `num` only.** A prepare-scope agent (§3b) gets a
`{ num, kind: 'prepare', spawnedTick }` entry; on each tick, skip auto-preparing any `unshaped-no-scope` `num`
that already has a live prepare entry, so a slow-to-land prepare is never double-spawned. Key it by `num` (the
contended resource is the item's scope authorship, not the incidental lane) — and it retires the same three ways
below, treating "the item now shows committed `scope:` / has left the `unshaped` set" as its version of retirement
path (1).

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
A parked PR waking this loop (watcher exit `2`) is handled exactly as in §3 — surface it for `/review`, never
auto-land it.

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
  the merge-watcher verdict, the idle-clock inputs, the health/stall scan. Same inputs → same output, always.
- **Judgment (stays with the operator + the agents — this skill's real content):** the readiness discussion,
  clearing items for build, supervising a build, **each prepare-scope agent's touch-set prediction** and **each
  delivery agent's adversarial review of its own diff**, the **escalate-or-auto-land call**, reviewing an
  escalation (`/review`), and investigating an anomaly. Never spend model context re-deriving a computable plan —
  read the script's answer and act on it. **Prepare-vs-build is NOT a judgment call here — it is the dispatch
  plan's classification:** `plan.launch` → build (scoped); `held: unshaped-no-scope` / `state.unshaped` → prepare
  (unscoped). The skill just spawns the matching agent.
