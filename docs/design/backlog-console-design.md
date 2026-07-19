# Backlog console — role × lifecycle design record

> **Durable design record** for the launch-review console program ([#2505] under the Plateau Loop
> [#2527]). Graduated to this tracked home by [#2556] — it was previously an uncommitted working doc in
> a plateau-app lane clone (one pool cleanup from being lost). This is now the **cite-able source** for
> the ratified grammar and decisions the build references ([#2553] taxonomy spec, [#2554] visual grammar,
> [#2555] the board). Per the constellation split, WE holds the **spec + design record**; the console
> **impl renders in plateau-app** (WE holds zero implementation — [#2505]).
>
> Structure: the design/discussion narrative (§1–§5), the **append-only decisions log** (§6 — the ratified
> rules, do not relitigate), the north-star (§6b), method notes (§6c), and open questions (§7). The open
> forks F1–F5 in §6 are carved to the live decisions [#2561]/[#2557]/[#2558]/[#2554].
>
> Origin: seeded from the #2522 functionality-to-build + a reusable "build new UI" skill (method captured
> in plateau-app `skill-learnings.md`).

## 1. Roles
*(hats one person may wear, not separate people — react/rename/cut freely)*

| Role | In one line |
|---|---|
| **Filer** | Creates + shapes items: scaffold, slice an epic, split a big story, set `blockedBy`/size/kind. |
| **Prioritizer / operator** | Orders the ready set: tier, rank, weights; and *clears* items for build (`buildQueued`). |
| **Decider / governor** | Prepares + ratifies decisions/forks; owns the `review:human` statute gate. |
| **Builder** | Does the work: claims + builds by hand, *or* supervises the autonomous builder (launch → steer → stop). |
| **Reviewer** | Verdict on a PR: accept, or request changes. |
| **Tester** | Exercises the shipped/built thing; raises bugs, reproduces, verifies fixes. By hand *or* supervising the autonomous explorer / stress-test (#1167/#1522), exercise apps, the conformance loop. |
| **Observer** | Reads state: ready / in-flight / blocked / resolved; runs program watches. |

## 2. Lifecycle steps (the spine — a LOOP, not a line)

1. **Capture** — a need becomes an item. *(Two feeders: the Filer files new work; the Tester files bugs.)*
2. **Shape** — make it ready (blockers, size, kind).
3. **Prioritize** — order it + clear it for build.
4. **Decide** — for a fork/decision: prepare → ratify.
5. **Build / launch** — hand-build or trigger the supervised builder.
6. **Review** — verdict on the PR.
7. **Land** — the drain merges.
8. **Test / raise** — exercise the shipped/built thing (by hand or the autonomous explorer); **raising a bug loops back to → step 1 Capture**. This edge is what makes the spine a loop.
9. **Resolve** — mark resolved, record where it graduated.
10. **Observe** — cross-cutting; watch progress the whole time.

**Per-item vs cross-item** *(shapes the screens — see §4):*
- *Per-item* (work on one thing): Capture, Shape, Decide, Review, Resolve.
- *Cross-item* (work on the set): Prioritize, Build/launch, Observe.
- *Either* (per-finding or a sweep): Test/raise.

## 2b. Granularity ladder — the refinement axis (orthogonal to the spine)

The spine repeats at every level of size. Companies name the levels differently; ours:

> **Program → (Feature) → Epic → Story → Task**

- **Program** — a standing initiative (e.g. the Plateau Loop #2527). Advanced by decomposition + a *program watch*, never "built" directly.
- **Epic** — sliced into stories (`/slice`). `parent` frontmatter links the tree.
- **Story** — the batchable unit an agent builds; a *big* story is split (`/split`) into smaller stories.
- **Task** — the leaf; built directly.

**Key unification: refinement = the *Build/launch* step for a NON-LEAF item.**
Advance a leaf (task/story) by *implementing* it; advance a non-leaf (epic/feature/program) by *decomposing* it into children (slice/split) — and a program also by *filing* newly-surfaced children (program watch). One lifecycle; "Build/launch" just means something different by level.

**Consequence for screens:** a program/epic surface is a *decomposition + roll-up* board; a story/task surface is an *item + its build*. The refinement interaction (take a big thing → propose children → accept) is its own thing, distinct from implementing a leaf.

## 2c. Item state machine — status × available actions (grounded in the CLI)

**5 status values** (the `status` field) + a transient. Transitions in **bold**:

| Status | Means | Leaves via |
|---|---|---|
| *(born-active)* | a `scaffold --session` draft, locked to its creating session | **settle → open** |
| **open** | filed, unclaimed, not started — *the workbench* | **claim → active**, **claim --as=preparing → preparing**, **retype --status=parked → parked** |
| **preparing** | a decision actively being prepared (a prep lock) | **release → open** (with `preparedDate` stamped) |
| **active** | claimed, in-flight (being built) | **resolve → resolved**, **release → open** |
| **resolved** | done, merged, graduated | *(terminal)* |
| **parked** | intentionally set aside / deferred | **retype → open** (un-park) |

**Actions available per status** *(→ these are the buttons a screen offers)*:

- **open** — the richest: `retype` (kind/size), edit `blockedBy` (shape), `prioritize` / `tier` / `rank` (order), `build-queue add|remove` (clear for build), `slice` (epic) / `split` (big story) (decompose), `claim` (start), `claim --as=preparing` → prep → `prepare-stamp` → `release`, ratify a prepared decision (`resolve --codified-to`), `reserve`/`queue` (coordinate), `retype --status=parked` (park).
- **preparing** — `prepare-stamp` (set `preparedDate`), `prepare-release`, `release`.
- **active** — build (hand or launch the runner), `resolve`, `release`, `cost`/`calibrate` (record).
- **resolved** — observe only.
- **parked** — un-park (`retype → open`), observe.
- **cross-cutting (not item-scoped):** `weights` (global scoring config), observe, program-watch.

## 2d. Connections — the edges between items (the graph)

No `relates`/`supersedes`/`duplicate` field exists; soft links are prose (body markdown links). The **structured** connections:

| Edge | Stored on | Derived inverse | It's really… |
|---|---|---|---|
| **`parent`** | child | `children` | the **hierarchy tree** = the granularity ladder (§2b), realized |
| **`blockedBy`** (array) | dependent | `blocks` / `unblocks` / `openBlockers` | the **dependency DAG** = readiness, realized |
| **`graduatedTo`** | resolved item | — | **lineage** — where the work landed (num \| path \| none) |
| **`codifiedIn`** | resolved decision | — | **lineage** — where the ruling was codified (doc#anchor) |
| **`bornAs`** | every item | — | **provenance** — the original hash id |
| item ↔ PR (#2509 overlay) | derived, cross-repo | — | **delivery** — `lane/<num>` branch → its PR → merge |

**Key insight: connections aren't a new axis — they're the WIRING that makes two named axes real.** The hierarchy graph *is* the granularity ladder (§2b); the dependency graph *is* the readiness that gates Prioritize/Build. Two different graphs over the same nodes, **orthogonal** (a story under epic X may be `blockedBy` a story under epic Y).

**Two rules fall out (both load-bearing for the UI):**
1. **Edit the forward edge, show both directions.** You edit `parent` and `blockedBy`; `children`/`blocks`/`unblocks`/`openBlockers` are derived — never edited directly. Screens render both ways, write one way.
2. **Readiness-editing ≠ prioritization (ratified #2526).** Setting `blockedBy` is *upstream* dependency work; `tier`/`rank`/`buildQueued`/`weights` order the *already-ready* set and NEVER touch `blockedBy`. Keep them as distinct actions or the footgun returns.

**Screen implications:** connections want a **tree view** (hierarchy roll-up) and a **dependency view** ("what blocks this / what this unblocks"), navigable from any item; edge-editing is a write (lane→PR seam), kept separate from ordering. *Gap noted:* if we ever want first-class "relates-to" links, that's a new field, not prose.

**The real gate is status + FLAGS, not status alone.** Within `open`, which actions are *offered* depends on derived flags: `ready` vs `blocked` (blockers resolved?), `preparedDate` (decision ready to ratify vs needs prep), `buildQueued` (cleared → Build-now is armed), `sliceable`/`splittable`/`batchable` (decomposition affordances). **A screen should show the action only when its (status + flags) precondition holds** — this is the core rule the UI encodes.

## 3. Matrix — role × step → what that role needs to *do* here

*(Fill each cell with the concrete action/functionality. `—` = not this role's job at this step.
 Keep cells terse; detail goes in §4/§5. This is the raw feature list.)*

| Step ↓ / Role → | Filer | Prioritizer | Decider | Builder | Reviewer | Tester | Observer |
|---|---|---|---|---|---|---|---|
| **1 Capture** | file work | — | — | — | — | file bug | sees new |
| **2 Shape** |  |  | — | — | — | — |  |
| **3 Prioritize** | — |  | — | — | — | — |  |
| **4 Decide** | — |  |  | — | — | — |  |
| **5 Build/launch** | — |  | — |  | — | — |  |
| **6 Review** | — | — | (statute) | — |  | — |  |
| **7 Land** | — |  | — | — |  | — |  |
| **8 Test/raise** | — | — | — | verify own | — |  |  |
| **9 Resolve** |  | — | — |  | — | — |  |
| **10 Observe** |  |  |  |  |  |  |  |

## 3b. Spec + Constitution — the AI-centric substrate

Frame every buildable item as an **agent contract: inputs → outputs.**

**Inputs (the SPEC):**
- **UI design** — what it looks like.
- **Hard functional requirements** — what it must do.
- **Tech requirements** — how / constraints.
- **Implicit project requirements** — inherited, not restated → *this is the Constitution (below).*

**Outputs (the DELIVERABLE):**
- **Code** — the implementation.
- **Proof it works** — verification (the Test/raise machinery: gates, explorer/stress-test, acceptance evidence).

**The Constitution — the permanent foundation.**
> *spec : constitution  ::  a specific law : the constitution.*
The **spec** says the specific ("this error shows *this* message"); the **constitution** says the invariant ("every user-facing error must retry in these cases and be displayed in these ways"). A spec **inherits** the constitution and may **not contradict** it; the constitution supplies defaults so specs stay small.

*Maps to existing layers — elevate, don't reinvent:* `platform-decisions.md` (statute), the WE standards, `AGENTS.md`. The move: make it **explicit + machine-injected** — every build reads the constitution as foundational context; the "implicit project requirements" input **is** the constitution. (Kiro-style spec-driven build, but with a constitution as the invariant floor.)

## 3c. Specialized view #1 — Prioritization / Launch-review (the human intervention point)

The human's question here: **"what is about to be built, and is it safe to build?"** This is the enriched successor to today's build-queue view.

**Per unit, at adjustable detail:**
- **confidence** (field `confidence`) — how sure the estimate is.
- **complexity** (field `size`) — how big.
- the **spec** (inputs, §3b) and the expected **output** (code + proof).

**Surfaces the CLUSTER, not just the item.** The interconnected parts that must ship together = the `blockedBy`/`parent` closure (§2d). The human reviews the whole co-delivered set as one thing.

**Cluster "ready-to-launch" gate (green ⇒ launchable):**
- all decisions in the cluster **ratified** (no pending decision);
- **confidence ≥ the configured threshold**;
- (existing) all blockers resolved.
Red ⇒ show exactly what's missing (which decision is pending, which item is under-confident).

**Action:** **Launch** (build now) *or* **move to Queue** (clear-for-build). *(Both exist as of #60/#61 — this view enriches the decision.)*

**Post-build gate (CONFIGURABLE) — the departure to mark:**
- **park** for manual test + review *(today's default — the "safety = human curation" thesis)*, **or**
- **auto-merge** if criteria pass (proof green). Configurable per policy. Depends on *trustworthy* "proof it works," and ties to the SaaS governance epic (#539: approval roles, circuit-breakers, model-tier policy). **This is the biggest shift from the current human-gated model — keep it OPEN.**

## 3d. Launch-review v2 — from mockup iteration (artifact, 2026-07-16)

Mockup: https://claude.ai/code/artifact/432a81c0-feaa-468f-a333-a24413f4854a (v4). Three structural moves beyond §3c:

1. **Branching + parallelism is the screen's true shape.** Dependency chain → **DAG** (forks/joins, `∥ disjoint — parallel-safe` marked). In-flight → a **lanes zone**: each lane a pipeline `⟳ build → PR → review → drain → main`, converging serially through the drain. WIP=1 becomes a *policy value* (`lanes ≤ N`), not an assumption. Parallel-safety = provable disjointness (the /workflow precedent).
2. **Gated work is a first-class zone.** Everything waiting on a HUMAN, each with its gate type + unlock action: ⏳ decision pending (prepared → "open decision"), 🔒 review:human PR, ⚠ confidence < threshold ("re-prepare"), ⛔ blocked-by chain. Derivable from status+flags+labels — no new fields.
3. **Semantic zoom is the navigation model.** L0 constellation (program tiles, counts only) → L1 program (work-map DAG + gated + lanes) → L2 cluster (spec rows, gate checklist, launch). Click-in / breadcrumb-out; detail density grows as scope shrinks. Zoom = the granularity ladder (§2b) made navigable.

## 3e. Build inspector (zoom L3) + requirement-level proof — from mockup v5

1. **Validation is requirement-level, not gate-level.** The human-facing proof is *"this spec point is proven done, and here is how"* — each requirement mapped to its evidence (a Playwright trace, a screenshot, a gate log), not "unit tests green." Gates are the *how*, never the headline.
2. **The spec is living — a build ADDS spec.** Requirements surfaced during a build (e.g. a refusal message's exact shape) appear as *new-spec candidates* with accept / reject; a candidate that generalizes gets **promoted to the constitution** instead of the item spec.
3. **The build inspector is a zoom level (L3):** spec in → the agent's own plan (todos ✓/⟳/○) → per-requirement proof → new-spec candidates → the out (commit, PR-on-gates, proof bundle attached to the PR).
4. **Lane ops is a SEPARATE screen/persona**, not part of feature-building: a technical operator optimizing team + AI usage (throughput, utilization), and the *triage* surface when a lane is stuck (stalled detection → recover = the /finish takeover, stop). The launch-review keeps only a thin lanes strip; the full fleet view is its own cell in the matrix (Observer/technical × cross-item).
5. **DAGs are vertical** — generations flow down (page scroll scales); siblings spread horizontally.

## 3f. Four-mandate review findings (2026-07-16, consolidated — 4 fresh-context reviewers: persona coverage, interaction design, AI-supervision trust, scale)

Clustered + deduped; full reports in the session transcripts. **Bold = the load-bearing few.**

- **A. Missing destinations.** "review PR", "open decision", "re-prepare", most DAG nodes/rows are dead ends. Rule: *every reference navigates somewhere* — needs a PR-review surface (diff + proof rows + verdict), a decision/ratify surface, and a generic item inspector.
- **B. Supervising a RUNNING agent.** No steer UI (backend supports it!), no live output tail, no failure forensics (stalled lane can't be drilled into — recover/stop offered blind). L3 needs: steer composer, output tail, and a post-mortem mode for stopped/failed/stalled.
- **C. Trust in the proof.** **The agent grades its own homework** — proof needs provenance tiers (harness-replayed vs agent-asserted) + harness re-run before PR. Spec frozen at launch; approved-vs-built drift shown — incl. **the visual diff: UI-design input LEFT, latest built screenshot RIGHT, differences highlighted** (Nicolas). Unproven requirements brand the PR ("2/3 proven"), each a named review blocker.
- **D. Governance ceremony.** "accept → constitution" is a one-click agent-drafted law change → must file a decision (prepare→ratify), never write directly. Policy edits (esp. park→auto-merge) logged + bannered.
- **E. Attention model.** Everything is pull-only. L1 top gets a needs-you strip ("4 waiting on you · 2 building · next: …"); a liveness chip ("live · updated 4s ago"); parked-PR/stall notifications.
- **F. State honesty.** L2 offered "Queue cluster" for already-queued items (breaks our own (status+flags) rule); "cleared/queue" two words for one flag → one verb; gated count = human ACTIONS (3), not consequences (4); numbering implies promotion semantics that don't exist.
- **G. Scale rules.** *Every list/graph has a declared fold threshold + explicit "+N more" — nothing silently omitted.* L1 DAG needs a stated frontier rule (in-flight + next cluster + gates + 1-hop; ✓-fold ancestry). Search-first ready list; gate-type grouping; wave-based launch for big clusters; unblocks popover; lane sort stalled-first; tile attention-sort; score bands not false 2-decimals.
- **H. Missing lifecycle surfaces.** No Capture anywhere (file item / file bug — the loop's feeders); no Tester surface ("shipped — awaiting exercise" strip + stress-test action); no Shape actions; no cleared reorder; no hand-claim path; resolved lineage + program watch unreachable.

**Decisions needed before build** (flagged by reviewers): the DAG frontier rule; cleared-set ordering semantics (FIFO vs score); wave-vs-whole-cluster launch (=F1); repo dimension on lanes/clusters.

**Short titles (Nicolas, 2026-07-16).** Backlog titles are agent-precise and too long to scan; every human review surface (queue rows, DAG nodes, gated rows, tiles) shows a **3–5 word short title**, full title on hover/detail. Source options: (a) a `shortTitle` frontmatter field, agent-authored at scaffold/shape time and human-editable — *recommended*: cheap, versioned, no runtime dependency; (b) derived at render (truncation/LLM) — no schema change but unstable + not reviewable. Lands as a small WE schema addition + backfill; the console falls back to truncation when absent.

## 3g. Round-2 review (v13, new-findings-only, 4 mandates) — consolidated

**T1. Tree-as-unit is under-designed** *(all four reviewers — the round's headline).* "+ clear tree" batches consent (one click arms N builds whose specs nobody read); no tree review surface (can't see members/order/per-member gates before clearing); binary tree state can't describe mixed trees; Σ-size sits in the score column (incomparable units); fixture even had a non-disjoint "tree" (#912). → **Design: a tree view (zoom target of a tree row): members, internal order, per-member gates, state breakdown (`12 ready · 3 gated · 25 held`); "clear tree" becomes "clear the ready frontier (k of n)", re-offered as gates clear; descendants surface a short confirm when they reach the front (consent stays per-item); Σ styled as its own token; disjointness enforced in derivation.**
**T2. Governance under unlock pressure.** "ratify now" inside the red gate ratifies in a biased frame (agent-prepared default + "this blocks your launch") — must OPEN the decision surface, never ratify in place; statute-touching decisions can't be ratified from a launch context. "lower floor…" = editing policy at the exact moment it blocks you → scoped, logged, auto-expiring per-launch waiver only; global floor only via the policy menu.
**T3. Attention honesty + scale.** Stalled ≠ building ("3 building · 1 stalled ⚠" everywhere — the strip currently conceals the most expensive problem). Needs-you counts only ACTIONS (the ⛔ held-downstream group re-inflated it). The needs-you inbox must live at L0, cross-program (attention aggregates UP the zoom; detail zooms down). New concept: an *un-inspected build* — policy option to hold at a pre-PR checkpoint until a human opened the inspector/diff.
**T4. Forest legibility + layout rule.** Trees need CONTAINERS (labeled bands, extra gap) — a tree boundary must not look like a generation gap; ∥ reserved for sibling disjointness. **Forest frontier rule:** only trees with an in-flight or next-cluster node render expanded; all others collapse to a summary band (root + counts + one building node). Layout spec: rank=depth-from-frontier, sibling wrap at viewport width with "+n" node, badges anchored to (tree, generation) never px.
**T5. Timeline honesty.** One canonical merged-count (tile=fold=past); past strictly reverse-chron with newest touching NOW; NOW band sticky + counts/chips (never prose enumeration); cleared folds at ~10; projection scope split — "cleared set (8) done ~tomorrow" (real) vs "if you cleared everything ≈10 wks" (explicitly hypothetical); never project unqueued work as if approved; minimum-sample rule (≥5 builds else "too little history").
**T6. Visual diff realism.** At real screenshot sizes side-by-side dies: the **region list is the primary structure** — numbered diffs (①②) on both panes + text rows with inline "steer at this"; click → synced zoomed crops. Diffs mapping to an unproven requirement render "expected — in progress", not drift. Captions honest ("annotated screenshot"). Provenance needs a THIRD tier: harness-owned probe > agent-authored/harness-replayed > agent-asserted (replay proves determinism, not correctness); check source one click away.
**T7. Gate-group triage.** Order members by unlock impact, never age ("open oldest" is the wrong pump); members clickable; group action = a triage stepper walking impact order; count only actionable members.
**T8. Degenerate zoom cases.** L2 is program-state-dependent: launchable → the cluster gate; all-gated (saas) → the blocking decision's prepare/ratify surface; neither → "+" disabled with the reason.
**T9. New jobs the timeline/trees create:** past row opens a read-only frozen L3 (proof + diff as-merged) with revert/file-regression; visual-diff differences need an "accept — built wins, update the design input" verdict (the diff feeds the living spec); tree progress roll-up ("tree · 1/3 · ETA") + completion moment; lanes get a program chip + per-program share ("plateau 4 · we 1 · free 1") so fleet contention is visible; projection paired with a review-debt counter (cleared-unread, merged-uninspected) so speed and skipped diligence always show together.

## 3h. Competitive research — backlog & agent-fleet UIs (2026-07-16, 6 fresh-context researchers)

*Full reports + verified screenshot URLs in scratchpad: `research-linear-height.md`, `research-jira-azdo.md`, `research-github-shortcut-trello.md`, `research-ai-agent-queues.md` (Devin · Cursor · Copilot agent · Codex · Kiro).*

**What the industry converges on (adopt):**
- **R1. One item set, N projections, one filter grammar** (GitHub Projects' invariant): list↔tree↔timeline are saved lenses over the SAME queue; switching layout never changes membership. Fix their leak: unscheduled items appear in the timeline as an "unscheduled" tray, never silently dropped.
- **R2. The gate is one named, dangerous-step verb with the risk hint beside it** (Copilot's "Approve and run workflows"; Kiro's "Move to design phase"). And steal Kiro's **"Analyze Requirements" pre-gate**: a machine check of the item BEFORE the human approves — our Definition-of-Ready as a button-adjacent report.
- **R3. Clear ≠ execute** (GitHub merge queue's "Merge when ready"): human expresses intent; entry happens when preconditions hold. Queue entries need per-entry state, "remove" that de-queues without deleting, and **auto-eject with a recorded reason** on failure so one failure never stalls the queue.
- **R4. Closed verdict vocabulary on single keys** (Linear Triage: 1 Accept / 2 Duplicate / 3 Decline / H Snooze): every review item exits with an explicit disposition; snooze returns on time OR new activity. Queue-with-peek (list+detail split) — never lose queue position to inspect.
- **R5. Evidence cited, not asserted** (Codex citations; Copilot commit→session back-links): every "proven" badge deep-links to the exact log/trace; provenance tiers already in T6.
- **R6. Confidence pre-scoring in bulk** (Devin's Linear integration): score the whole backlog cheaply WITHOUT launching builds; reviewer's default motion = sort ascending by confidence, review the bottom (Height's grid insight).
- **R7. Attention-state grouping, not workflow stages** (Devin Command Center / Copilot mission control): the fleet board's columns are "needs you / in flight / finished"; layered attention (unread dot → status label → favicon) and deliberate REMOVAL of false urgency. Devin's state granularity (working / waiting-for-user / waiting-for-approval / blocked / finished / **sleeping**) is the state machine to copy — and **stalled-agent triage is the industry's open sore** (Copilot: timeout+reassign; Cursor: nothing): our explicit stalled detector + recover verb is a differentiator, keep investing in it.
- **R8. Completion = hard seam with fixed disposition verbs** (Cursor: PR / checkout / apply + verification artifacts traveling WITH the result; Devin's "Test the app" annotated video): our proof bundle inline, disposition = accept→queue / bounce-with-feedback / take-over.
- **R9. Waves must be shown and editable** (Kiro derives execution waves but won't let you edit; its scheduler misjudges deps): show the derived parallel waves at tree-clear time, let the human edit — feeds directly into T1's tree view.
- **R10. Human judgment channel beside computed metrics** (Shortcut epic health On-Track/At-Risk + comment next to computed %): a human-settable readiness assertion can coexist with our computed confidence, both visible.

**Anti-patterns (avoid):**
- **A1. Hidden view-state that silently filters the queue** (Jira/AzDO's #1 support theme) — deadly here: a hidden item can be a hidden running build. Every filter = a visible dismissable chip; counts always "N of M".
- **A2. Aggregate health that hides item-level truth** (Jira capacity green while one person at 150%) — roll confidence up pessimistically (min / "3 below floor"), badge opens the offenders.
- **A3. Hierarchy elsewhere** (Jira: tree only in paid Plans; AzDO: three planes) — the tree expands IN PLACE in the queue (AzDO Parents-toggle + rollup rows is the good version).
- **A4. Views drift into separate reports** (Trello views, GitHub Insights tab) — aggregates live on the working surface (per-group totals), not a charts tab.
- **A5. Ceremony that doesn't scale down** (Kiro: small bug → 16 acceptance criteria) — spec weight must follow item size (our granularity ladder already implies this).
- **A6. No failed-triage lane** (Codex) / trust-by-vibes (Height had no confidence signal or dry-run tier between "suggest" and "do").

## 3i. Scope leases + the lane board (2026-07-16, with Nicolas — mocked in v15)

**The problem prioritization was missing:** rank alone stacks conflicting work — pick 10 big items touching the same files and they secretly serialize onto one lane. Real throughput = picking work that is *unrelated* to what's in flight. So scope becomes data, and the queue gets a second projection.

**Two relations, kept distinct:** `blockedBy` = logical (B needs A merged). **Scope overlap** = physical (same files → concurrent building costs drain-time conflicts). Overlap is many-to-many: one item can overlap several lanes and waits on all of them even while other lanes sit free.

**Scope lease:** an occupied lane holds a lease = the file scope of its work. Launch rule: work starts only where its scope doesn't intersect an active lease. The lease is **relinquished at merge** — a lease, never territory. The lease attaches to the *work stream*; physical lane-pool clones stay fungible underneath.

**Scope lifecycle:** *predicted* at prepare time (module-level, proposed by the prepare agent in the spec's Tech section, visible to the human) → *observed* live (file-level, the lane's `git diff --name-only` — free to compute, always true) → gone at merge. The **breach detector is just their difference**: work stretching outside its predicted scope into another lane's lease.

**Policies (Nicolas: "all is possible" — both knobs configurable per program):**
- **On overlap at launch:** wait (default) · ask · **force + resolve** — forcing schedules an agent conflict-resolution step at drain instead of blocking; parks for the human if resolution fails.
- **On scope breach mid-build:** pause until the owning lease frees · park for you · continue + resolve at drain.

**Tree ≈ lane-affine unit (absorbs T1's frame):** a tree's members are scope-overlapping by construction (same feature, same files), so a tree serializes into one lane naturally. The T1 tree view and the vertical lane are the same surface: clearing a tree ≈ pouring its ready frontier into a lane-shaped column.

**The lane board (v15 mock):** columns = lanes stretched from NOW to the next work; a NOW line crosses all columns; header carries the stream name + scope chip. Vocabulary shown: in-flight cell (⟳), next-in-lane cells, *spanning cell* across every column it overlaps (starts when ALL drain past), *forced* cell (⚠ overlap accepted, resolve step queued at drain), *breach-paused* cell (⏸ waiting for the owning lease), *free column* offering the best conflict-free fits (with "+ clear tree"), "lease relinquished → column frees" marker. The L1 dependency map stays the logical view; the board is the physical execution plan — same queue, two projections (research rule R1).

**New-trees rows gain a conflict chip:** `clean ∥` vs `overlaps lane-2 (src/backlog-view) — frees ~20m`, so the human sees which clears buy parallelism, not just which score highest.

**Board extensions (v16–v17, with Nicolas):**
- **Board is the page** — map / gated / timeline fold into collapsed "reference" rows (auto-open on programs without a board). Building cells click through to the inspector.
- **Upcoming per lane:** below the queued cells, each column suggests the ready work that FITS its scope. Placement rule: work overlapping a lease can only run in that column, so it stacks there ("+ queue"); scope-free trees pour into a free column ("+ clear tree"); gated work shows in place with its unlock verb (re-prepare / prepare) — the pipeline of a lane includes its gates.
- **Non-adjacent multi-lane blocker:** an item overlapping leases whose columns aren't neighbors can't be drawn as a span — it anchors full-width with a chip per lease it waits on ("waits on lane-1 · + lane-5"); starts when all free.
- **Scope rivals:** two items can exclude each other by scope alone, with NO dependency edge — whichever queues first blocks the other. Marked ⚔ on both; ordering them is an explicit human (or score) choice, never silent.
- **Review-parked lane (v18):** a finished build parked for human review still HOLDS its lease — the column is blocked by YOU, and the board says so ("review PR" / "bounce w/ feedback"). It counts in "waiting on you" (strip + gated panel + L0 tile). State counts stay honest everywhere: building / paused (breach) / review / stalled are never merged into one number.
- **Hover verbs (v19):** each cell offers its verbs on hover/focus, overlaid without reflow, per the (status+flags) rule — building → pause/steer/stop · breach-paused → steer/resolve-now/park · queued → hold/drop/spec (+ "⇧ next" for reorder) · forced → unforce/drop · spanning/wide blockers → force+resolve/hold/drop · parked PR → review/bounce. Verbs never trigger the cell's zoom.
- **v28 (with Nicolas) — the conveyor:** ONE dashed delivery-horizon line crosses ALL lanes. Cards **rise with real progress** (running card offset = plan progress; slow live creep; paused breach frozen at its bar). Above the line = the **past zone**: the newest merged card peeks partially through (visible but clipped — deliberately); "⌃ 3 days of history" on the line expands it into a per-lane scrollable history with day separators (scroll up = navigate back in time; newest always docks at the line). Finished-but-holding cards (auto-passed, review-parked, drain) dock AT the line — they exit upward only at merge. Running cards adopted the focused-card ideas (from another session's design): bottom **plan progress bar** with `plan 4/6` label + `›` current-step marker; the full spacious card layout is the L3/zoomed treatment. Fixture stretches 4 days of merged history across lanes.
- **v25–v27 (with Nicolas):** New-work composer docks LEFT. **Unblock leverage made first-class** (from the real #2249 fan + WE's graph-view semantics): always-visible ⚡ chips carry the two WE numbers — *frees now* (last-open-blocker count) vs *gates* (transitive chain); hovering a cell lights its whole downstream closure **green** across lanes with edges to directs (color grammar: purple = waits-on, green = frees). #2249 lane shows the real fan (+#2252–54 sibling cell) and #2255 as fan-in convergence. Real-implementation note: the numbers are the CLI's `unblocksToReady`/chain — deterministic, zero-cost. **▤ size-scaled mode (a setting):** cell heights follow the size estimate (≈9 min/pt from the live median) so column length reads as likely run time; per-cell "Σ n · ≈ Nm" chips; per-lane "queue ≈ X h" ETA; the NOW line becomes a dotted **delivery horizon** and the running card slowly creeps up through it (reduced-motion respected) — delivered work exits upward.
- **v22–v24 (with Nicolas):** board goes BARE on the page (page scroll; sticky lane headers form the NOW line at the viewport top; both docks sticky). **Never horizontal scroll:** lanes that don't fit collapse to thin strips (state icon + rotated name + count; click or ‹ › to swap into the window), recomputed on window resize. The three reference widgets (map / gated / timeline) moved to their **own page** (📊 chip → "Reference" zoom level; programs without a board still show them inline). Left features panel replaced by **optional grouping on the right panel**: ⊟ group toggles group-by-feature; ungrouped items carry a feature TAG; hovering a tag or group header traces that feature across the lanes. **Real WE chains fixtured in** (from the live backlog): brand #2249→#2250→#2251→#2255 (longest live chain, its own lane), contracts #907→#2128/#285→#2129, strategy #97→#184, site #1104→#143. **New-work composer** panel (story/epic/decision + title + feature + blockedBy) — simplified in the dock, ⇱ opens the full editor page; files via lane→PR, never writes main.
- **v20–v21 (with Nicolas) — the WORKBENCH:** style pivots to a rich-app shell (VS Code/Photoshop): docked panels with chrome (grip · collapse · menu), the execution plan as the center document. Left dock = **Features** (hover a feature → its cells highlight across all lanes, others dim; each row counts states + names not-ready descendants "down the chain"). Right dock = **Ready to queue** (draggable items with ⚡ unblock count + the actual chain incl. not-ready descendants dimmed; overlap-fit chips; gated items undraggable with their unlock verb). Board: 9 lanes with **sticky lane headers** (the primary border under headers forms the NOW line), natural cell heights, building cells carry a mini plan-todo (✓/⟳/○), a **tree poured into a lane** (#554: root + children + held tail), a **decision cell** on its own lane (#2545 blocks the column until ratified — opens the decision surface), a **drain lane**, cross-lane blockers anchored in a strip below with lane chips. **⛓ dependency links draw on hover** (AzDO's lines-on-demand): hovering a dependent cell draws a bezier to its blocker and highlights it — works cross-lane. **Drag & drop**: dragging a ready item highlights lanes (green = fits, amber = overlap-conflict) and drop explains the consequence. Review = a **modal over the board** (spec-proven rows, diff, auto-review findings, on-merge effects; verbs: merge / bounce / take over) — reviewing never leaves the board. Free lane carries a ⊕ that opens a conflict-free picker. Board is data-driven (BOARD/FEATURES/READY fixtures + renderer) so long multi-hour queues are cheap to fixture.

## 4. Screens (cluster the filled cells)

*(Once §3 is filled, group cells that a role does together in one sitting → a screen.
 A screen is a role-in-a-moment, not a data dump. TBD.)*

- _tbd_

## 5. Notes / detail per cell

*(Anything too big for a matrix cell lands here, keyed to the cell.)*

- _tbd_

## 6. Decisions log (what we've settled)

*(Append-only. Date + the call, so we don't relitigate.)*

- 2026-07-16 — Axes drafted: 6 roles × 9 lifecycle steps. Frame = one item's journey; open Q: also a first-class cross-item view (queue / program / drain)?
- 2026-07-16 — Added **Tester** role + **Test/raise** step; lifecycle is a LOOP (Test → Capture). Testing has autonomous machinery (explorer/stress-test #1167/#1522), paralleling the autonomous builder.
- 2026-07-16 — Added the **granularity axis** (Program→Feature→Epic→Story→Task). Unification: *refinement = the Build/launch step for a non-leaf item*.
- 2026-07-16 — Grounded the **item state machine** (§2c): 5 statuses + born-active transient. **Core UI rule: an action is offered only when its (status + flags) precondition holds.** "prepared/ready/cleared" are flags on `open`, not statuses.

- 2026-07-16 — Grounded **connections** (§2d): structured edges are `parent`/`children`, `blockedBy`/`blocks`, `graduatedTo`/`codifiedIn`, `bornAs`, item↔PR. Insight: connections are the *wiring* of granularity (hierarchy) + readiness (dependency), not a new axis. Rules: edit forward edge / show both; readiness-editing ≠ prioritization (#2526).

- 2026-07-16 — **Direction set:** build *specialized human-intervention views*, starting with **Prioritization / Launch-review** (§3c). Added the **Spec + Constitution** substrate (§3b): item = agent contract (inputs→outputs); constitution = invariant floor specs inherit (≈ elevate `platform-decisions.md` + standards + AGENTS.md). Confidence/complexity = existing `confidence`/`size` fields. Cluster = `blockedBy`/`parent` closure. **Open forks below.**

### Open forks from the Launch-review vision (push these)
- **F1 — Cluster = review unit or BUILD unit?** Do we launch the whole interconnected cluster in one go (multi-item build), or review the cluster but still launch leaves one-at-a-time in dependency order (keeps WIP=1)? Changes the runner + the view.
- **F2 — Where does `confidence` come from?** Agent-estimated at prep / human-set / derived? The "confidence ≥ configured" gate needs a trustworthy source.
- **F3 — Spec: structured fields or prose?** Add structured spec inputs (UI/functional/tech) + output(proof) fields, or keep acceptance prose and extract? Affects Capture/Shape *and* this view.
- **F4 — Constitution: new artifact or index into existing?** Author a curated `CONSTITUTION.md`, or a machine-readable index into the statute/standards already there? And how is it injected into a build.
- **F5 — Auto-merge (the big one).** Configurable auto-merge on green proof departs from the ratified "safety = human curation." Gate it behind #539 governance + trustworthy proof. Keep OPEN until proof-quality is earned.

### Four dimensions in play (the model so far)
1. **Role** (7) — who is acting.
2. **Lifecycle step** (10, a loop) — what stage.
3. **Granularity** (5 levels) — how big → the **hierarchy graph** (`parent`).
4. **Status + flags** — what's legal right now.
Plus the **connection graph** (§2d) that wires 3 (hierarchy) and readiness (dependency, `blockedBy`).
The functionality matrix is their intersection; the **(status + flags) precondition** is the rule that decides which cell's action is live.

- **Scope-lease model** (2026-07-16): occupied lanes hold a file-scope lease, relinquished at merge; predicted scope (module-level, from the prepared spec) plans, observed scope (lane diff, file-level) enforces; breach = their difference. Both conflict knobs are **policies**, not fixed rules: overlap-at-launch = wait/ask/force+resolve-at-drain; breach-mid-build = pause-for-lease/park/resolve-at-drain. (§3i, mocked v15)
- **Tree ≈ lane-affine unit** (2026-07-16): a tree serializes into one lane by construction; the T1 tree view is the lane column. (§3i)
- **Review the pixels, not the source** (2026-07-16, from Nicolas): every mockup/design iteration is screenshot-rendered (all screens × both themes) and reviewed as images — by me AND by review subagents. v14 pass caught 5 source-invisible defects. (skill-learnings)
- **RATIFIED — one symbol, one meaning (color grammar)** (2026-07-17, Nicolas): a color never carries multiple meanings. Green = DELIVERED only (merged ✓ + the delivery horizon); leverage/"would free" (⚡ chips + cascade hover/edges) moved to teal (`--color-accent-text`); purple = waits-on; amber = needs-a-human. The WE graph view should adopt the same teal so the grammar is constellation-wide. (mocked v35; decided via the green-triple-duty explainer artifact)
- **RATIFIED — icon grammar + SVG sprite** (2026-07-17, Nicolas — "fold into the main design so the work is not lost"): same one-symbol-one-meaning rule for glyphs. Rules: one glyph = one concept (⏳ split → scales = decision, hourglass = gated; ▲ = horizon only, tree = fork icon); collapsed-strip icon shows lane STATE (run/pause/review/decision/done/drain/idle/free), never an identity mascot; verbs always icon+label; icons inherit `currentColor` (state tokens color them) — emoji banned from UI chrome. Rendering = inline SVG stroke sprite (24-grid, Lucide-style; pull real Lucide icons at port time instead of hand-maintaining). Folded into the mock v36: sprite + `ic()` helper + `laneStateIc()` — this IS the portable asset. (decided via the icon-language explainer artifact)
- **Decision-explainer artifact is the ruling channel** (2026-07-17, Nicolas — "a keeper"): design rulings are presented as a small separate side-by-side visual artifact (token-true option panes, before/after grammar table, honest counter-argument, one recommendation), not prose. Saved as agent memory (WE PR #541) + skill-learnings.
- **RATIFIED — attention cards: one signal, one primary, calm secondaries** (2026-07-17, Nicolas): needs-you cards share ONE signal (amber left edge on hold/dec cells), carry ONE filled primary verb ("Review PR #63" / "Open decision"), everything else muted sentence case — no caps-for-urgency, no red text. AMENDED from my proposal: secondary verbs (bounce) stay BUTTONS — "I preferred the bounce as a button, but I agree it was too aggressive" — just neutral-outlined (.lb-quiet), never red. (mocked v38; decided via the attention-cards explainer artifact)
- **Card-status taxonomy — 26 cases in 3 families** (2026-07-17, expanded after Nicolas caught the missing cross-lane cases): the attention-cards explainer carries the full grammar — per case: who acts (you/agent/nobody), amber edge y/n, primary verb. **A · Lifecycle on one lane ×14**: queued · gated-in-queue (Re-prepare) · building · paused-breach · stalled (Triage) · taken-over (Release back) · bounced-rebuilding · built-parked-review (Review PR + calm bounce) · built-auto-passed · merge-held (Release merge) · merging-at-drain · decision-awaiting (Open decision) · not-ready-held · merged-past. **B · Cross-lane span ×8**: waits-on-multiple-leases (wide card below board, chip per lease) · overlaps-a-second-lane (starts when BOTH free) · forced-past-overlap (Unforce) · ∥ fan-out-may-fork · forked-running-across-sub-lanes · fan-in-converges · ⛓ cross-lane-dependency · ⚔ rival-pair (order swappable). **C · Off-lane pool ×4**: ready · ready-gated (Prepare) · parked (Revive) · draft. Tally: you-act ×9, agent-act ×11, inert ×6. **GAPS — verbs imply them, no card renders them**: stalled, taken-over, bounced-rebuilding, merge-held, forked-active, and parked has no home surface. These six feed webdocs + the future backlog cards.
- **Taxonomy round 3 — 37 cases + the FAILURE AXIS** (2026-07-17, red-team agent): the 31-case set had NO failure states. Added family E: failed—build-red · drain-halted—merge-conflict (cards behind show "held: drain halted at #N") · orphaned—lane-dead (≠ stalled: the lease is held by a corpse) · desynced—spec-changed-under-it (backlog is git-tracked; outside commits are normal) · fan-in—degraded (which sibling blocks + converge-partial) · merged—but-wrong (revert/CI-red AFTER merge — the ONE amber-above-the-line case; invariant weakens to "the past usually doesn't act"). Plus chips-not-states: bounced ×N w/ threshold, waiting-on-#X starvation + cycle warning, launching transient + "lease lost to #X" snap-back, held-Nh age on all human-holds (parked adds "drifted — rebase before revive"), built-under-ruling-#X provenance, one board-level feed-stale banner. Also: gap-found gated to ask-policy only; "landed — resolving" rename; non-adjacent span visual (dashed wire crosses untouched lanes; board may quietly reorder lanes to adjacency). Tally: you-act ×17 · agent ×13 · inert/pool ×7. Open usability items: Re-prepare vs 3 causes, Prepare/Re-prepare/Revive verb family, fan-out+forked merge, purple-outline vs amber-edge competition.
- **Progress = crossing = one mechanism; disclosure has 3 levels** (2026-07-17, Nicolas): the horizon slices the card at its spec-proven fraction — the checklist self-aligns (done rows above the line, grayed by the past-mask), plan is a claim marker below, bars survive only as summaries; height=Σ makes the cut also TIME. Every card × status has L1 condensed / L2 standard (board default) / L3 expanded, attention never compressing away. Multi-lane cards get span-only docking (⌃ tacks; dashed wire for non-adjacent), not the full-width banner. (mock v41+)
- **CONVERGENCE CAMPAIGN — 31 fresh-context review rounds → converged (2026-07-17)**: mock v36→v68 (+ the taxonomy explainer) hardened by 31 alternating-lens reviews (state-machine · visual · icon · consistency · task-walk · interaction · red-team). Caught real functional bugs, not just polish: review button wired to the wrong DOM node, cards/map-nodes/L4-rows opening the wrong build's inspector, drag-drop lying on collapsed strips, the taxonomy crossing-demo line invisible from a class-vs-ID typo, plus one unified dependency graph + monotone PR timeline + ledger-true totals across all views. Ended on 2 consecutive clean rounds (30, 31). Process rules banked: every fixture edit assert-verifies its replace; reviewers seeded with a settled-list to prevent refiling; the failure axis (family E, 6 states) was the one structural gap the 4 families each needed a slot for.
- **FOLLOW-UP (Nicolas, 2026-07-17): the status taxonomy feeds into webdocs** — this grammar becomes documentation content; **backlog cards to create later** (do not lose): (a) document the 11-status card grammar in webdocs, (b) add the missing `stalled` card kind to the console design, (c) drop the redundant header glyph chip ("lanes 2⟳·1‖·1⚠") pending ruling.
- **RATIFIED — legend takes no fixed real estate** (2026-07-17, Nicolas): a power-user view never dedicates a block to explanation. One TERMS map (term → definition) renders as (a) a "How this board works" glossary PANEL — on the left, visible by default, dismissible (✕ → floating ? chip restores); (b) dashed-underline hover hints on RARER terms only (lease, breach, policy, gated) — deliberately sparse, and themselves gated by a ✳ hints option for a fully quiet board. The prose legend wall is deleted. (mocked v37; decided via the legend-form explainer artifact)

## 6b. North-star (later — do NOT build now, but don't corner ourselves)

**Support multiple backlog systems, and bridge/combine between them** (GitHub Issues, Jira, Linear, … alongside the WE backlog).

- *Builds on what exists:* backlog access is already behind a provider seam — repo is one configurable input (`?repo=`, REPOS registry; #2507 / multi-repo #2472/#2475); reads shell the WE CLI, writes ride the lane→PR seam. Multiple systems = more adapters; bridging = a sync/mapping layer on top.
- *Why the modeling pays off:* the dimensions here — roles, lifecycle, **statuses**, **granularity ladder**, **connection types**, spec/constitution — become the **canonical interlingua** each foreign system maps into (Jira status → `open/active/resolved`; epic→story → our ladder; its links → `parent`/`blockedBy`).
- **Implication for NOW:** keep the domain model **provider-agnostic** and data access **behind the adapter seam** — no WE-CLI specifics leaking into the views. (Already on this path; just a constraint to hold.)

## 6c. Mock-before-build — method → skill → product feature

Working method (now): iterate UI in a self-contained HTML mockup (artifact), seeded with real data shapes, before touching the app. Becomes a **skill** (captured in skill-learnings).
**Productize later:** in the §3b contract, the mockup IS the spec's "UI design" input — so the console's *Shape* step hosts a mockup per UI item (generate → iterate → attach), and the builder consumes it as spec input. The method we're using on ourselves becomes a product capability.

## 6d. Refinements surfaced during the 2026-07-18 ruling session (apply at spec/port time)

These came out of ruling the substrate/scale/adapter/visual decisions ([#2561]/[#2557]/[#2558]/[#2554]).
**None is a new fork** — each is a refinement *within* an already-ratified rule, to **review against the
rendered board** (per "review the pixels" + the empirical "refine once visual" stance the rulings took). Owners
noted for where they land.

1. **Fan-out / "forked" is a logical overlay, not literal sub-lanes** (owner: [#2553] taxonomy · [#2554] F6).
   Disjoint (`∥`) siblings run **across different fungible lanes**, not nested sub-lanes of the blocker's lane —
   there is no containment. "Forked ×N" is a **grouping/leverage overlay** ("these N cards, in N lanes, were
   released by A and reconverge at the fan-in"), consistent with the design's own logical-map-vs-physical-board
   two-projections split (§3i). The two states (fan-out = *prediction*, forked = *in-flight*) still hold; only
   the **"sub-lanes" wording is wrong** — reword UC-B4/UC-B5 to "across lanes / a tracked fan."

2. **The "purgatory" lane-zone** (owner: [#2553] card-state · [#2555] board). A lane stacks four zones
   top→bottom: **running** (`status: active`) · **ready queue** (`buildQueued && openBlockers = 0`, waiting a
   free lane) · **purgatory** (`buildQueued && openBlockers > 0` — *approved by the human but a dependency
   isn't done*; auto-fires when it lands — the same mechanism as #2557 F3 `readyAfter` / "merge-when-ready") ·
   **next-sprint** (`!buildQueued`, needs a manual upgrade). Today "queued (waiting a lane)" and "queued but
   dependency-blocked" both fall under one state — **splitting purgatory out is a candidate distinct card-state**
   for the taxonomy.

3. **Overtake / work-conserving dispatch** (owner: [#2557] F1 render · [#2555] board). **One shared rank**
   (the #2557 F2 ruling — no separate cleared-only order), but **dispatch is work-conserving**: the launcher
   pulls the top *ready* approved item, so a blocked-but-higher-ranked item **keeps its rank slot yet does not
   stall the lane** — ready lower-ranked cards **overpass** it (already how `nextToBuild` behaves). Render the
   **"overtaken · waiting on #X · passed by N"** affordance so it's obvious why the top card isn't running.

4. **Leverage is the real prioritization signal — use the right field** (owner: [#2555] spans+leverage · [#2553]).
   Three distinct, deterministic, zero-cost CLI numbers (`we:src/_data/backlog.js`): `directUnblocks` (raw fan) ≠
   **`unblocksToReady`** (frees-now = items whose *last* open blocker is this one) ≠ **`transitiveUnblocks`**
   (the gated downstream weight). **Use `unblocksToReady` for "frees now"** — `directUnblocks` inflates leverage
   with dependents that stay blocked by others. The ⚡ chip carries frees-now + gates (teal, per the ratified
   color grammar). **Click → the downstream-closure graph** (§2d dependency view, teal cascade across lanes).
   **Semantic-zoom disclosure (Nicolas):** at coarse zoom show only a **teal color-corner**; reveal the
   **count/weight** numbers as you zoom in (progressive disclosure, matching L0→L3).

## 7. Open questions

- Is "one item's journey" the right primary frame, or is the **cross-item** view (queue, program, drain) equally first-class?
- Which roles are actually distinct *screens* vs. just filters/modes on a shared surface?
- What already exists today (build-queue view, list view, detail view) and which cells does it already cover?
