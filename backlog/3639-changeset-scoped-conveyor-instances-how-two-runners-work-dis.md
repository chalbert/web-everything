---
bornAs: xoooj6a
kind: decision
parent: "3383"
status: open
scope: ["we:skills-src/conveyor/runner.mjs", "we:skills-src/conveyor/runner-lock.mjs", "we:scripts/conveyor/resolve-runner-checkout.mjs", "we:scripts/conveyor/queue-store.mjs", "we:scripts/conveyor/queue.mjs", "we:scripts/conveyor/queue-work.mjs", "we:scripts/readiness/dispatch-pause.mjs", "we:scripts/readiness/dispatch-plan.mjs", "we:scripts/lib/lane-concurrency.mjs", "we:skills-src/conveyor/SKILL.md"]
dateOpened: "2026-09-12"
relatedTo: ["3637", "3634", "3609", "3478", "2613", "2702"]
tags: []
---

# Changeset-scoped conveyor instances: how two runners work disjoint subsets of the queue concurrently, and how a group of work is held and resumed as a unit

The operator wants one conveyor to keep delivering while a SECOND instance dogfoods a new version of the conveyor's own code against a small controlled set of items, with no collision on story or PR, plus the ability to hold a named group of queued work temporarily and resume it later. A code survey found three of the four ingredients already exist: the queue sidecar and the pause marker both resolve by SCRIPT LOCATION and are env-overridable, and lane acquire is a per-lane atomic O_EXCL claim explicitly built for concurrent acquirers. The real blockers are narrow. we:skills-src/conveyor/runner-lock.mjs pins ONE fixed lease key at ONE fixed root and we:skills-src/conveyor/runner.mjs never reads the CONVEYOR_RUNNER_LOCK_ROOT override that we:scripts/conveyor/resolve-runner-checkout.mjs already honours, so a second runner stands down. resolveRunnerCheckout reports ambiguous on two live leases, which makes we:scripts/conveyor/queue-work.mjs refuse to queue. And WE_MAX_CONCURRENT_LANES is resolved per process, so two runners each admit 8. Decides whether a changeset is a new registry or simply an instance namespace over sidecars that are already partitionable, how a subset is held in place and resumed, and whether this composes with or stays orthogonal to the deliveryTarget POC-branch mode ruled in 3637.

## Done when

1. **Executable** — `node --test we:skills-src/conveyor/__tests__/runner.test.mjs` covers a NAMED instance lease
   (two distinct names both acquire; the same name still stands down), and
   `node --test we:scripts/conveyor/__tests__/resolve-runner-checkout.test.mjs` covers a named-lease lookup that
   resolves rather than returning `ambiguous`.
2. **Ruled** — each fork below has an operator ruling recorded, and the ruling is codified in
   `we:docs/agent/platform-decisions.md` (the statute layer) the way `#3637`'s POC-branch mode was.

---

# The survey — what the machinery actually does today (verified 2026-09-12 against live code)

Every row below was read, not assumed. This is the part that changes the answer, so it comes first.

| Ingredient | State today | Evidence |
|---|---|---|
| **Dispatch is already queue-scoped** | `dispatchPlan` is a PURE function over `{ queue, leases, freeLanes, driftBlockedScope, maxConcurrentLanes, dispatchPaused }`. An item NOT in `queue` is never dispatched — there is no other admission path. | `we:scripts/readiness/dispatch-plan.mjs:305` |
| **The queue sidecar is already partitionable** | `we:.conveyor/queue.json` resolves by SCRIPT LOCATION (never CWD), with a `CONVEYOR_QUEUE_FILE` env override. Two checkouts therefore already have two disjoint queues, for free. | `we:scripts/conveyor/queue-store.mjs:129-145` |
| **The pause marker is already partitionable** | `we:.conveyor/dispatch-pause.json`, same script-location + `WE_DISPATCH_PAUSE_FILE` override, same fail-open posture. | `we:scripts/readiness/dispatch-pause.mjs:105-118` |
| **Kind-scoped pause already set the "optional scope field" precedent** | `pausedKinds` — ONE optional field, read only when `paused` is true; absent/empty ⇒ blanket (so every old-format marker keeps behaving identically); non-empty ⇒ narrowed. | `origin/lane/mechanical-dispatcher` `we:scripts/readiness/dispatch-pause.mjs` (`PAUSABLE_KINDS`, `normalizePausedKinds`, `isKindPaused`) |
| **Lane acquire is already safe for concurrent acquirers** | Per-lane lease file created with `flag:'wx'` (atomic `O_EXCL`). Deterministic lowest-index candidate order so racers converge and exactly one wins; the loser just moves to the next lane. **There is no global/whole-pool lock anywhere.** | `we:scripts/lane-pool.mjs:909`, `:1166-1168`; `we:scripts/lib/lane-lease.mjs:87-110` |
| **Lane pools can be fully separated if wanted** | `LANE_POOL_ROOT` env (with `~` expansion), else a `.lanes` dir under the workspace; within a root, `--pool=`/`--name=` gives a distinct `poolDir`. | `we:scripts/lib/lane-pool-paths.mjs:65-68`; `we:scripts/lane-pool.mjs:202-213` |
| **PRs and leases match items by ITEM ID, not by branch or instance** | A conveyor PR's head ref is `lane/<num>-<slug>`; the reaper matches on that and on the `conveyor-<num>` session slug. Nothing keys off which runner dispatched it. | `we:scripts/conveyor/lease-reaper.mjs:136-167` |
| **Delivery target is already independent of all of this** | `deliveryTarget:` frontmatter validated against a small typed registry; absent/`main` is the normal path. | `we:scripts/lib/poc-branches.mjs:202-216` (`#3637`) |

### The three things that actually block a second instance

Everything above means the hard part is **already done**. Three narrow defects are what stop it:

- **B1 — the runner lease is one fixed key at one fixed root, and the runner ignores the env override.**
  `RUNNER_LEASE_PATH = '<conveyor:runner-singleton-lease>'` is a module constant, and `RUNNER_LOCK_ROOT` is a
  fixed HOME-level dir — deliberately machine-global so a lane clone and the primary contend on the SAME lease
  (`we:skills-src/conveyor/runner-lock.mjs:44-47`). `main()` calls `driveConveyor({ owner, buildEffects })`
  with no `lockRoot`, so it takes the constant default and **never reads `CONVEYOR_RUNNER_LOCK_ROOT`**
  (`we:skills-src/conveyor/runner.mjs:504`). A second runner therefore finds a live lease and stands down. This is
  an inconsistency as much as a gap: `we:scripts/conveyor/resolve-runner-checkout.mjs:203` already honours that
  exact env var, so one half of the pair is env-aware and the other is not.
- **B2 — two live leases read as `ambiguous`, and a downstream consumer refuses on it.**
  `classifyRunnerLocks` enumerates EVERY dir under the lock root and returns `ambiguous` for more than one live
  entry — correct as written (it was defending against a corrupted lock root), but it makes *deliberate*
  multi-instance indistinguishable from corruption. `we:scripts/conveyor/queue-work.mjs:34-35,67` then refuses with
  "more than one live runner lock was found — cannot tell which checkout is authoritative". So the naive
  "just use a second lease key" hack breaks queueing.
- **B3 — the concurrency ceiling stops being a ceiling.**
  `WE_MAX_CONCURRENT_LANES` (default 8) is resolved independently **per process** and applied against a lease count
  with no runner attribution (`we:scripts/lib/lane-concurrency.mjs:38-55`, consumed at
  `we:scripts/readiness/dispatch-plan.mjs:666-667` and `we:scripts/conveyor/tick-core.mjs:1239`). Two runners on one
  host each admit up to 8 — the cap that exists because of a 42-lane/load-34.95 incident silently doubles.

### What does NOT need building

Worth stating plainly, because it is most of the feature: no queue partitioning work, no PR-to-instance routing,
no lane-pool changes, no dispatcher changes. The queue file IS the partition; the item id IS the routing key; the
per-lane `O_EXCL` claim IS the mutual exclusion.

---

# Fork 1 — What IS a "changeset"?

- **(A) A new registry** — `we:scripts/lib/changesets.json`, name → explicit item-id list, following the
  `we:scripts/lib/poc-branches.mjs` / `we:scripts/lib/constellation-repos.mjs` small-typed-table precedent,
  consulted as a FILTER layered on top of the shared queue.
- **(B) An instance namespace over sidecars that are already partitionable** ← **RECOMMENDED**. A changeset is just
  a NAME that resolves a triple: a queue file, a pause marker, and a runner lease key. Membership is not declared
  anywhere new — **an item is in the changeset iff it is in that instance's queue**. The queue sidecar and the
  pause marker each move one directory level down, into a per-name subdirectory of `we:.conveyor/`, and the lease
  key gains a per-name suffix. The unnamed default instance keeps today's exact paths and today's exact key,
  byte for byte.
- **(C) A dynamic filter expression** — a query over frontmatter (`parent:3383`, a tag, a label) evaluated per tick.

**Recommendation: (B).** Three reasons, in order of weight.

1. **(A) creates a second source of truth about the same question.** "May this item dispatch?" is answered today by
   queue membership, and only by queue membership. A registry filter makes it answered by queue membership AND
   registry membership, which can disagree — and the failure mode is the silent one this repo has already been
   bitten by (`clearedNotReady` exists at `we:scripts/readiness/dispatch-plan.mjs:471` precisely because "I cleared
   it and nothing happened" was a real, hard-to-see bug). (B) adds no new gate at all.
2. **(B) costs nothing in the dispatcher.** `dispatchPlan` and `planTick` need ZERO changes — they already take the
   queue as an argument and read it through an env-overridable resolver. (A) and (C) both require threading a new
   filter through both.
3. **(C) is the one shape nobody can debug.** "Why didn't my item dispatch" becomes a query-evaluation question
   against mutable frontmatter. The repo's standing precedent for this class of thing is a static table that FAILS
   CLOSED, not an expression language.

**The honest cost of (B):** a changeset has no existence independent of a running instance's queue file. If you want
to ask "what is in changeset X" while nothing is running, you read a JSON file on disk — which is fine — but there
is no `changesets list` across all of them without walking the per-name sidecar dirs. That is a small
ops-ergonomics tax, and Fork 5 handles the one case where it would actually hurt (holding a group in place).

---

# Fork 2 — How does an instance BIND to its changeset?

- **(A) A `--changeset=<name>` flag on `we:skills-src/conveyor/runner.mjs` only.**
- **(B) Env only** — the operator exports the three vars by hand before launching.
- **(C) One flag that RESOLVES the triple and EXPORTS it to every child process** ← **RECOMMENDED**.

**Recommendation: (C).** This is forced by the architecture, not a preference. The runner does almost nothing
itself — it *shells* `we:scripts/conveyor/tick-core.mjs`, the reconcile pass, the lease-reaper, and
`we:scripts/operations/dispatch-lane.mjs`. Those children resolve the sidecars through their OWN
`resolveQueuePath()` / `resolvePauseStorePath()` calls, which read env. So a flag that only changed the parent's
in-memory state would scope the runner and leave every child reading the default sidecar — the worst possible
outcome, since it looks scoped and is not. (B) works mechanically but makes a multi-variable incantation the
operator must retype correctly every launch, and a single typo silently rejoins the default instance. (C) is (A)
implemented as (B): one flag, which the runner turns into env for its children.

**Shape:** `--changeset=<name>` → sets `CONVEYOR_QUEUE_FILE`, `WE_DISPATCH_PAUSE_FILE`, and the lease key in the
child env. An absent flag changes nothing whatsoever (the default instance's paths and key are the current
constants). The name is validated against a narrow charset at the boundary the way
`we:scripts/lib/poc-branches.mjs:59`'s `BRANCH_NAME_RE` is — it becomes a path segment and a lock-dir key.

---

# Fork 3 — What enforces disjointness between two instances?

- **(A) Validate at queue-add time** — `we:scripts/conveyor/queue.mjs add` scans every other instance's queue and
  refuses a double-listed item.
- **(B) Do not enforce; rely on the lane lease, and WARN advisorily** ← **RECOMMENDED**.
- **(C) Full enforcement via a registry + a cross-instance lock.**

**Recommendation: (B),** and this repo has already ruled on exactly this shape once. `we:scripts/lane-pool.mjs:1175+`
runs an **advisory, strictly non-blocking** scope-overlap check AFTER the atomic claim, with the reasoning stated in
the code: *"the whole-clone lease is the REAL lock: this only WARNS."* The same logic applies here and is even
stronger. If the same item were listed in two instances' queues, the second instance's dispatch would try to acquire
a lane under session slug `conveyor-<num>`, and the lease guard and the in-flight guard already prevent the double
dispatch. **Disjointness is a hygiene property, not a safety property** — the safety already holds.

(A) costs a cross-instance scan on every add and creates a new refusal path for something that is not actually
dangerous. (C) adds shared mutable state, which is the one thing the whole (B)-shaped design avoids.

**What to build instead:** `we:scripts/conveyor/queue.mjs add` emits a one-line stderr warning if the id is already
listed in another instance's queue sidecar. Never a refusal. Mirrors the lane-pool precedent exactly.

---

# Fork 4 — Concurrency capacity between instances

- **(A) Share the cap** — accept that two instances each admit 8.
- **(B) Per-instance cap via the existing env var, with a SMALL default for a named instance** ← **RECOMMENDED**.
- **(C) A shared reservation file that the instances decrement against.**

**Recommendation: (B).** `WE_MAX_CONCURRENT_LANES` is already resolved per process from env
(`we:scripts/lib/lane-concurrency.mjs:52-55`), so "each instance gets its own cap" needs **zero mechanism** — only a
default. Set a named (non-default) instance's default to something small (2 is the suggested number: enough to run a
build plus a fix, small enough that a dogfooding instance can never starve production work), and have
`--changeset=` set it in the child env unless the operator overrides. The unnamed default instance keeps 8.

(A) is the status quo and silently doubles the ceiling that exists because of a real overload incident — not
acceptable as a *deliberate* design. (C) is the only option that makes the sum a true global ceiling, and it is
also the only one that introduces cross-process shared mutable state and a new failure mode (a crashed instance
leaking reservations). The sum being the operator's responsibility is the right trade here, because the operator is
the one choosing to run two instances at all.

Note `--reserve` is NOT the tool for this: it reserves exactly one explicitly-named lane, permanently, and makes it
non-recyclable (`we:scripts/lane-pool.mjs:1026-1027`). It is the memory-lane primitive, not a partitioning one.

---

# Fork 5 — Holding a group of work in place, and resuming it later

This is the operator's third need and it is **genuinely distinct** from the other two: it is holding a SUBSET of
ONE instance's queue, not separating two instances. Today the only way is
`we:scripts/conveyor/queue.mjs remove <num>` — which loses the grouping, loses the `addedAt` ordering, and makes
resuming a manual re-add of a list you had to remember yourself.

- **(A) An optional `heldAs` field on the existing queue entry** ← **RECOMMENDED**.
  `{ num, addedAt, heldAs: "<label>" }`. `dispatchPlan` skips a held entry with a new held-reason. Un-holding is a
  field flip.
- **(B) A separate parking sidecar** that entries move between.
- **(C) A `pausedChangesets` array on the pause marker**, listing labels to hold.

**Recommendation: (A).** It is the same move `pausedKinds` already made, one level down: **one optional field, absent
⇒ today's exact behaviour**, so every existing sidecar and every existing reader is unaffected. It also gets the
resume semantics right for free — the entry never leaves the queue, so `addedAt` and therefore rank order survive
the hold, and "come back to it later" resumes where it left off rather than re-entering at the back. The parse path
is already tolerant of unknown entry fields (`we:scripts/conveyor/queue-store.mjs:63-81` reads `num`/`addedAt` and
ignores the rest), so an old reader degrades to "not held" — fail-open, matching the marker's own posture.

(B) makes the hold a MOVE between two files, so a crash mid-move can lose or duplicate an entry, and the ordering
must be reconstructed. (C) puts item-level state on a marker whose whole design is "ONE global advisory flag, not a
per-item store" (that phrasing is in `we:scripts/readiness/dispatch-pause.mjs`'s own header) — it would be the first
thing to break that contract.

**Cost:** one new string in the `HELD_REASONS` vocabulary at `we:scripts/readiness/dispatch-plan.mjs:143` (suggest
`group-held`), one filter line in `dispatchPlan`, and two CLI verbs on `we:scripts/conveyor/queue.mjs`
(`hold --as=<label> <nums...>` / `unhold <label>`).

**Note this ALSO gives the cheap within-one-checkout changeset.** A label that can hold a group can equally name a
group, which covers the "I want two named groups in one queue" case without the Fork-1 registry — at the cost that
only one of them is *running* at a time. That is the right split: Fork 1(B) separates two RUNNING instances, Fork
5(A) separates work WITHIN one instance.

---

# Fork 6 — Relationship to `deliveryTarget` / POC branches (`#3637`)

- **(A) Orthogonal concepts, and a separate checkout is the DEFAULT way to get a second instance** ← **RECOMMENDED**.
- **(B) Tightly coupled** — a changeset implicitly targets a POC branch; binding one implies the other.
- **(C) Fully independent with no operational relationship acknowledged.**

**Recommendation: (A)** — orthogonal as CONCEPTS, adjacent in PRACTICE, and the practical adjacency is what makes
the build small.

**Why orthogonal.** A changeset scopes WHICH items a runner may touch. `deliveryTarget` scopes WHERE an item's work
lands. Those are independent axes and both combinations are meaningful: an item in a test changeset that still lands
on `main` (you want to see the real landing path work), and an item on a POC branch that no changeset scopes.

**Why (B) is actively wrong for the operator's own use case.** The stated goal is "test changes on a new version".
If binding a changeset forced its items onto the POC branch, the test items would never exercise the real
`main` landing path — which is a large share of what a new conveyor version could break. Coupling would hide exactly
the bug the dogfooding exists to find.

**But the practical adjacency is the important finding.** To run a NEW version of the conveyor, instance B must
*execute* the new code, and every sidecar resolves by SCRIPT LOCATION. So instance B necessarily runs
`we:skills-src/conveyor/runner.mjs` from a **checkout of the POC branch** — and that checkout **already has its own
`we:.conveyor/queue.json` and its own `we:.conveyor/dispatch-pause.json`, with no new code at all.**

That collapses the operator's literal ask to B1 + B2 alone. The named-changeset machinery of Fork 1(B) is the
*generalization* (two instances inside ONE checkout), which the stated use case does not need.

---

# Fork 7 — Sequencing: build now, or defer?

- **(A) Build the whole design now** — named instances, registry-free namespacing, the hold labels, the advisory
  overlap warning.
- **(B) Build ONLY the minimal instance split (B1 + B2) now; defer Fork 1(B)'s named namespacing entirely; build
  Fork 5(A)'s hold labels as a separate small item when the need actually bites** ← **RECOMMENDED**.
- **(C) Defer everything.**

**Recommendation: (B),** the same posture `#3637` took on its own bootstrap-vs-N-branch question.

**The minimal slice, and why it is genuinely small:**

1. Make `we:skills-src/conveyor/runner.mjs` honour `CONVEYOR_RUNNER_LOCK_ROOT` — it is already the declared
   override, already read by `we:scripts/conveyor/resolve-runner-checkout.mjs`, and the runner is simply the one
   caller that forgot. This alone is arguably a **bug fix, not a feature**, and it alone unblocks the operator's
   case: instance B launches from the POC checkout with a distinct lock root and both runners drive.
2. Teach `classifyRunnerLocks` and `we:scripts/conveyor/queue-work.mjs` to distinguish *deliberate* multi-instance
   from a corrupt lock root, so B2 does not bite. Cheapest correct shape: when a lock entry carries an explicit
   instance name, a caller asking for that name resolves it; `ambiguous` is reserved for two live UNNAMED leases,
   which really is corruption.
3. Give a named instance a small default `WE_MAX_CONCURRENT_LANES` (B3).

**What to defer and why.** Fork 1(B)'s per-name sidecar namespacing only pays off for two instances in ONE
checkout, and the dogfooding case does not want that (it wants different CODE, hence different checkouts). Fork
5(A)'s hold labels are a real need but an independent one — they would be worth building on their own merits even
if multi-instance were never built, so they should not ride on this decision.

**Caveat worth ruling on explicitly:** step 1 makes it possible to run two runners by setting one env var. That
removes a guard rail that currently exists by accident. Whatever is built should make the second instance
*deliberate and visible* — it should announce the instance name on every status line, so an operator never
discovers a forgotten second runner by wondering why the lane pool is full.

---

# Can the `/conveyor` skill drive THIS work itself?

**No — for two independent reasons, either of which alone is sufficient.**

1. **Dispatch is paused.** `pausedKinds` was set earlier today (2026-09-12) to conserve usage, holding `build`,
   `prepare`, `prepare-decision` and `investigate`. Every kind that could plausibly carry this work is in that set,
   and `dispatchPlan` checks the pause before computing any launch list — so every cleared item is held
   `dispatch-paused` regardless of readiness.
2. **A design spike maps onto no existing launch kind, even unpaused.** `PAUSABLE_KINDS` is
   `build · prepare · prepare-decision · investigate · fix · ci-heal`. The closest fit is `prepare-decision`, and
   it is not this: that kind takes an ALREADY-FILED decision card and brings its forks to Definition-of-Ready
   (`/prepare`). It does not survey a codebase cold, discover that the feature is three defects rather than a
   feature, choose the forks, and file the card. Filing is `file-item`; the survey-and-frame step in front of it is
   not a dispatch kind at all.

Also note a structural point specific to this item: `dispatchPlan` HOLDS every cleared `kind:decision` with reason
`needs-decision` (`we:scripts/readiness/dispatch-plan.mjs:105-110`) — a decision card is never build work by
construction. So this card cannot be dispatched even after the pause lifts; it needs `/prepare` then a ruling.

**Conclusion:** this spike needed the same direct agent delegation this session has used all day, and the follow-up
BUILD (once ruled) is the first part of it the conveyor could actually carry — as an ordinary `build` item against
the scope listed above, once dispatch is unpaused.
