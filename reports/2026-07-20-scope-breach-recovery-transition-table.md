# Scope-breach card state (A4) — recovery transition table, grounded in prior art

**Point**: Prior-art survey grounding backlog [#2574](/backlog/2574-refine-the-scope-breach-card-state-a4-define-its-transition-/) —
the open forks around the console's **A4 "paused — scope breach"** card state (UC-A4 in the ratified
`plateau:src/backlog-view/card-taxonomy.webcases.ts`). Detection already exists (the write-time
`PreToolUse(Edit|Write)` gate denies out-of-scope writes; the design-doc §3i breach detector is the
difference between *predicted* module-scope and *observed* file-scope). The gap is the **transition table**:
once auto-paused, where does A4 go, and — the sibling questions the taxonomy lists but never defines —
how fine-grained is an item's scope, and who may place a hold. This survey brings established
concurrency-control and fault-recovery vocabulary to those forks so the answer reuses named prior art
instead of coining mechanics. It reuses the vetted citations from the #083 file-lock survey
([we:reports/2026-06-11-agent-file-lock-coordination.md](2026-06-11-agent-file-lock-coordination.md)) and
adds the recovery/quarantine and voluntary-vs-involuntary-disruption literature the transition table needs.

## Background — what A4 is, in the ratified taxonomy

A4 is one of the 37 ruled card states (`plateau:docs/backlog-console-design.md` §2c/§3i, webcased in
`plateau:src/backlog-view/card-taxonomy.webcases.ts`). Its grammar triple is
**`actor=agent · edge=none · primary=—`** — it is `cat:run` (auto/system handling), *not* an amber
needs-you card. The webcase description already pins the one exception: *"policy waits for the lease to free
(only policy = `ask` turns this into a you-card)."* The design record's §3i **breach-mid-build policy knob**
lists three configured routes — **pause until the owning lease frees · park for you · continue + resolve at
drain** — mirroring the overlap-at-launch knob (**wait · ask · force+resolve**). So A4's exits are not
greenfield: they are the *breach-mid-build* policy outcomes, and this survey grounds *which* exits are
principled and how they compose with the cross-lane family (B2 overlap / B3 forced-past / B8 rival) and the
sibling hold states (A6 park-by-policy, A12 merge-held).

## Fork (a) — scope granularity: whole-clone lease (today) vs finer per-file/per-path scope

**The reality gap.** The design's §3i scope-lease model is *conceptually* file-grained: predicted scope is
module-level (from the prepared spec), observed scope is file-level (`git diff --name-only`), and the breach
detector is their set difference. But the **implemented** primitive is coarser: `we:scripts/lane-pool.mjs`
hands out a **whole-clone exclusive lease** — `acquire` stamps an exclusive hold over an entire lane clone,
`release` frees it ([we:scripts/lane-pool.mjs](../scripts/lane-pool.mjs), lease lib
`we:scripts/lib/lane-lease.mjs`). There is no per-file lease today; a lane owns its whole tree. So "breach"
is defined against a *predicted file scope* that the *lease mechanism itself does not enforce at file
granularity* — enforcement is the write-time gate, not the lease.

**The classic granularity fork.** This is the oldest question in concurrency control:

- **Lock granularity + escalation.** Databases let a transaction lock at row / page / table granularity and
  **escalate** coarser under contention/memory pressure — SQL Server escalates row→page→table automatically
  ([SQL Server lock escalation](https://learn.microsoft.com/en-us/sql/relational-databases/sql-server-transaction-locking-and-row-versioning-guide)).
  Fine locks maximize concurrency but cost bookkeeping and deadlock surface; coarse locks are cheap but
  serialize more work. **Multi-granularity locking** with *intention locks* (Gray et al., *Granularity of
  Locks in a Shared Data Base*, 1975) is the canonical way to hold both — an intention lock on the coarse
  object flags fine-grained locks beneath it, so a coarse and a fine holder can coexist without scanning.
- **File-lock granularity.** `flock(2)` is whole-file; `fcntl()` adds byte-range locks precisely because
  databases need different processes on different pages of one file
  ([Baeldung, file locking](https://www.baeldung.com/linux/file-locking)). The lesson from hotspot research
  is the inverse of "always lock finer": for a contention hotspot, the win is to **not route it through the
  general lock at all** ([Releasing Locks As Early As You Can, arXiv:2103.09906](https://arxiv.org/pdf/2103.09906)).
- **The 2025–26 agent consensus is deliberately COARSE.** Parallel-AI-agent tooling converges on
  **whole-worktree isolation** — one clone per agent, no shared tree — precisely to convert *silent runtime
  file corruption into visible merge-time conflicts*
  ([Augment Code, git worktrees for parallel agents](https://www.augmentcode.com/guides/git-worktrees-parallel-ai-agent-execution),
  [MindStudio worktrees](https://www.mindstudio.ai/blog/git-worktrees-parallel-ai-coding-agents)). Claude
  Code's own documented pattern is *"status flags that lock work claims + git worktrees that isolate edits +
  dependency markers that sequence"* ([MindStudio shared task list](https://www.mindstudio.ai/blog/claude-code-agent-teams-shared-task-list))
  — item-level claims + whole-tree isolation, **not** a file lock. CodeCRDT quantifies why: lock-based
  coordination introduces **O(N×L) contention**, and observation-driven coordination (re-read shared state,
  let git detect conflicts) often beats locking ([arXiv:2510.18893](https://arxiv.org/pdf/2510.18893)).

**Implication for the fork.** Two coherent branches genuinely cannot both be the default: either the lease
*is* the whole clone (breach = "the lane wrote a file its prepared spec didn't predict," detected by the
gate, resolved by re-planning or widening), or the lease is subdivided into per-file/per-path holds (breach
= "wrote a file another live lease owns," a true cross-lease collision). The agent-systems prior art points
**coarse-lease-with-predicted-scope-as-advice**: keep the whole-clone lease as the enforcement unit, treat
predicted file scope as the *breach signal* (advisory overlap warning), and let git be the ground-truth
conflict detector at drain — do **not** build a per-file lease manager (the O(N×L) contention + deadlock
surface the consensus explicitly avoids). Finer scope stays a *later escalation* justified only if real
two-lane file collisions are observed, exactly as the #083 survey concluded for fencing tokens.

## Fork (b) — A4's exits after the auto-pause: the recovery/quarantine literature

Once paused, A4 needs a **transition table**. The fault-recovery and quarantine literature gives four named
exit archetypes, and they map cleanly onto the §3i breach-mid-build routes plus the cross-lane family:

- **Retry-in-place / re-plan within scope** ≈ supervisor **restart**. Erlang/OTP supervision trees restart a
  failed child in place under a restart strategy before escalating
  ([Erlang OTP supervisor principles](https://www.erlang.org/doc/design_principles/sup_princ.html)). The A4
  analogue: the lane **re-plans within its predicted scope** — drops the out-of-scope edit, finishes the
  work that stayed in-lease. This is the cheapest exit and the default when the breach was an over-reach the
  agent can retract.
- **Widen the scope / lease** ≈ **lock escalation** (above) / admission of more resource. When the work
  genuinely needs the extra files and no other live lease owns them, the lane **widens its lease** to absorb
  the observed scope (the predicted-scope prediction was simply too narrow). Bounded by the same rule as
  launch: only widenable into currently-*free* scope.
- **Hand off to the cross-lane family** ≈ **queue/reschedule to the owning resource**. When the wanted files
  belong to *another lane's* live lease, A4 is really a cross-lane collision and should **hand off to B2
  (overlaps a second lane — starts when both free) / B3 (forced past — takes next free lane, resolve step
  queued at drain) / B8 (rival pair — order swappable)**. Kubernetes models this exact move: a pod that
  can't be placed is **rescheduled/evicted**, and disruptions are classified so the scheduler knows whether
  to wait or preempt ([K8s disruptions](https://kubernetes.io/docs/concepts/workloads/pods/disruptions/)).
- **Bounce / drop if mis-scoped** ≈ **quarantine**. CI systems **quarantine** a unit that keeps breaching
  (flaky-test quarantine at Google TAP / Spotify: isolate the offender so it stops blocking the pipeline,
  flag it for human repair) ([Google, flaky tests](https://testing.googleblog.com/2016/05/flaky-tests-at-google-and-how-we.html)).
  The A4 analogue: if the slice was **mis-scoped** (its real footprint was never containable in one lease),
  bounce it back to prepare (re-slice) or drop it — a terminal exit, re-filed as a new item.

**Implication for the fork.** A4 stays `cat:run` (auto) and its **default exit is retry-in-place / re-plan
within scope** — the supervisor-restart analogue, cheapest and reversible. The other three are the §3i
policy routes: *widen* (escalation, into free scope only), *hand off to B2/B3/B8* (the wanted files are
another lease's — this is a cross-lane collision, not a solo fault), and *bounce/drop* (quarantine — only
when re-planning can't contain the slice). Only `policy = ask` promotes A4 to an amber you-card offering the
route menu (matching UC-A4's ruled exception); the three auto-policies land directly in their target state
tagged "via breach," exactly as UC-A13 "gap found" already does for its three auto routes.

## Fork (c) — A12 "merge held" hold-source: the voluntary/involuntary/policy trichotomy

A12 "merge held" (UC-A12: `actor=you · edge=amber · primary=Unhold merge`) is the **voluntary** merge-hold —
the deliberate counterpart to **A6 park-by-policy** and **A4 involuntary-fault**. The open question is *who*
may place the hold. The **disruption literature already names this exact trichotomy**:

- **Kubernetes voluntary vs involuntary disruptions.** K8s splits pod disruptions into *involuntary*
  (hardware failure, kernel panic, eviction — no one chose it) and *voluntary* (an operator or automation
  drains a node, a user deletes a pod) ([K8s disruptions](https://kubernetes.io/docs/concepts/workloads/pods/disruptions/)).
  A **PodDisruptionBudget** then lets a *policy* constrain voluntary disruptions independently of who
  triggered them — three distinct hold-sources (involuntary fault · human action · policy budget) over one
  mechanism.
- **The constellation's own analogues.** A4 is the *involuntary-fault* hold (the gate paused it, no one
  chose). A6 "built — parked for review" is the *policy* hold (a gate policy parks it; the design doc's C4
  parked state says *"policy (or you) parked the work"*). A12 is the *voluntary* hold. The clean design is
  the K8s one: **one hold mechanism, an explicit `holdSource ∈ {user, policy, sibling-lane}` field** — so a
  hold placed by a program policy (e.g. "hold all merges touching the shared data registry until the schema
  decision ratifies") and a hold placed by the user render the same card with a different source chip and
  unhold authority.

**Implication for the fork.** A12's hold-source should be **not user-only** — mirror A6/A4 and admit a
**policy** source (and, where a sibling lane's work must land first, a **sibling-lane** source), carrying an
explicit `holdSource` so the *Unhold merge* authority is legible (a user can unhold a user-hold; a
policy-hold clears when its policy condition clears). This keeps A4 (involuntary) · A6 (policy) · A12
(voluntary) as three sources over one hold mechanism, the K8s-PDB shape, rather than three bespoke states.

## Fork (d) — "Remove B8 Swap-order?" — a settled-spec governance question, not a merit fork

B8 "⚔ rival pair" (`primary=Swap order`) is **one of the 17 ruled you-act action-verbs** in the settled §6e
manifest (`Action-button glyphs (17 you-act verbs)` — `B8` Swap order=swap). §6e was **ratified 2026-07-20**
on the jury review surface; the "17" is a ratified count that #2578 just reconciled in the design record.
Dropping B8 → 16 is therefore **not a design-merit call available at prep** — it is a request to **re-open a
ratified spec**, which changes the verb count the webcase conformance test and the glyph columns (#2553/#2555)
cite. The two branches do not weigh design merit; they weigh *"honor the settled ruling"* vs *"re-open it,"*
and re-opening requires a fresh ruling with lineage (the platform-decisions reversibility rule), not a prep
default. **This survey records B8 as settled and out of scope for removal here.** If a genuine case to drop
B8 ever arises (e.g. the rival-pair state proves to never need an explicit swap verb in the built board), it
is a *new* decision item that supersedes the §6e verb-count ruling with lineage — not an edit folded into
A4's transition table.

## Recommendation summary

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **(a) scope granularity** | Keep the **whole-clone lease** as the enforcement unit; predicted file-scope is an advisory breach signal; git is ground-truth at drain | Per-file/per-path lease manager | **Med-High** — matches the parallel-agent consensus (whole-worktree isolation) + O(N×L) contention argument |
| **(b) A4 exits** | Default **retry-in-place / re-plan within scope** (supervisor-restart); widen / hand-off-to-B2·B3·B8 / bounce-drop are the §3i policy routes; only `ask` makes it amber | Make A4 always an amber you-card with the full route menu | **Med-High** — the four exits are named recovery archetypes + the ruled §3i knob |
| **(c) A12 hold-source** | **Not user-only** — admit `policy` (and `sibling-lane`) via an explicit `holdSource`, mirroring A6/A4 | User-only hold | **Med** — the K8s voluntary/involuntary/policy trichotomy is a clean fit, but the sibling-lane source is thinner |
| **(d) remove B8?** | **Keep the 17 verbs (§6e is settled)** — dropping B8 requires re-opening the ratified count, out of scope here | Drop B8 → 16 | **High** — governance, not merit; §6e ratified 2026-07-20 |

## Known occurrences (make the calls tangible)

- **Whole-resource vs fine-grained lock, with escalation:** SQL Server lock escalation (row→page→table);
  Gray et al. multi-granularity intention locks; `flock` whole-file vs `fcntl` byte-range.
- **Whole-worktree isolation for parallel agents:** Augment Code, MindStudio, Claude Code's documented
  status-flags-plus-worktrees pattern; CodeCRDT's O(N×L) contention result.
- **The four recovery exits:** Erlang/OTP supervisor restart-then-escalate; Kubernetes reschedule/evict;
  CI flaky-test quarantine (Google TAP, Spotify); Saga compensating-transaction rollback.
- **Voluntary/involuntary/policy holds over one mechanism:** Kubernetes voluntary-vs-involuntary disruptions
  + PodDisruptionBudget.

## Open questions → the backlog

The forks themselves live on [#2574](/backlog/2574-refine-the-scope-breach-card-state-a4-define-its-transition-/)
(a `kind: decision` in prepared-fork shape). This report is its grounding; the human ratifies the defaults
there.
