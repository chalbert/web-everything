---
kind: epic
parent: "3029"
status: open
relatedTo: ["3383", "3643", "3277", "3562", "3671", "3638"]
dateOpened: "2026-09-15"
tags: [operations, dispatch, coverage, conveyor, planning]
scope:
  - we:scripts/operations/
  - we:skills-src/
---

# Close the declared-operation coverage gap surfaced by the 2026-09-15 dispatch audit

The 2026-09-15 session audit (Codex primary, Gemini cross-check, published as an Artifact) grouped 471 subagent dispatches into 247 distinct goals and matched each against the 90 declared operations under `we:scripts/operations/`. Only 11 goals have a matching operation, 72 partially match and 164 have none — 236 gap rows covering roughly 413 of the 471 dispatches. This epic clusters those 236 gaps into 18 themes, prioritises each by recurrence, blast radius and how mechanically scoped the resulting operation would be, and sequences a three-phase build. It deliberately rules a large share of the gap OUT of scope as operations: one-off harness bug fixes, one-off prior-art research, provider calibration trials and cross-PR arbitration are judgment work that should stay ad hoc rather than be forced into a declaration. Every planned operation ships with a companion `we:skills-src/` entry, because a declared operation nothing packages is an operation no agent reaches for — which is how 236 of these goals became ad hoc in the first place.

## How to read the audit numbers

The headline "236 gaps" is **not** 236 missing operations, and treating it that way would be the single
biggest mistake available here. The 247 rows are *goals a subagent pursued*, not *capabilities the system
lacks*. Sorting them by what they actually are:

| What the row really is | Gap rows | ~Dispatches | Operation candidate? |
|---|---|---|---|
| A **recurring mechanical read** the session kept re-deriving by hand | 52 | ~147 | **Yes — the core of this epic** |
| A **recurring mechanical write** with a bounded blast radius | 38 | ~81 | Yes, phase 2/3, gated |
| A **one-off build** of harness machinery (already an epic elsewhere) | 71 | ~96 | No — these are backlog items, and most are filed |
| **Judgment work** (arbitration, trials, design calls, prior-art research) | 75 | ~89 | **No — should stay ad hoc; see § What must NOT become an operation** |

So the real target is roughly **95 gap rows / ~235 dispatches**, and the 17 operations below cover them.
The other ~141 rows are correctly ad hoc or already tracked; padding the plan with them would manufacture
work and, worse, would push judgment into declarations that cannot hold it.

**The second, sharper finding:** the two heaviest clusters (runner activity at ~33 dispatches, PR-state
reconciliation at ~42) are *pure reads over state the repo already stores*. Nothing had to be invented —
`we:scripts/operations/restart-runner-io.mjs`, `we:scripts/operations/pr-status-io.mjs`,
`we:scripts/operations/clear-stuck-session-io.mjs` and `we:scripts/operations/dispatch-lane-io.mjs` already
hold the readers. The session burned ~75 dispatches re-deriving answers those modules could already
compute, because no operation *named* the question and no skill told an agent the name. That is a packaging
failure more than a capability failure, and it is why every entry below is an operation **plus** a skill.

## The 18 clusters

Row counts are exact against the 247-row audit; dispatch counts are the summed `count` column and are
approximate at the margins (±1 from rows spanning two themes).

| # | Cluster | Gap rows | ~Dispatches | Verdict |
|---|---|---|---|---|
| C1 | Runner & agent liveness reading | 9 | 33 | **Build — phase 1, highest value** |
| C3 | PR state reconciliation & disposition | 23 | 42 | **Split** — read half phase 1; arbitration stays ad hoc |
| C5 | Provider trials, calibration & graduation | 24 | 41 | **Mostly ad hoc** — only the read-side report |
| C6 | Durable rule / memory / policy persistence | 20 | 33 | **Split** — write half yes, routing judgment no |
| C7 | Backlog identity, metadata & queue admission | 12 | 28 | **Build — phase 2** |
| C13 | Dispatch harness wiring & provider integration | 20 | 30 | **Already an epic (#3643)** — only the coverage audit is new |
| C11 | Telemetry, usage & cost accounting | 17 | 26 | **Already filed (#3671)** — only the coverage report is new |
| C2 | Stale session / lane / lease hygiene | 14 | 24 | **Build — read phase 1, reap phase 3** |
| C18 | One-off research & scope questions | 15 | 22 | **No — route through `explore`** |
| C9 | Prototype / POC branch lifecycle | 14 | 20 | **Build — phase 3** (`poc-land` exists, unregistered) |
| C4 | Independent critique / adversarial draft screening | 3 | 20 | **Build — phase 2, cleanest candidate in the set** |
| C12 | Heavy-command admission & container execution | 14 | 18 | **Split** — audit half phase 1 (op 17); container/build half stays ad hoc |
| C17 | One-off harness bug fixes | 15 | 17 | **No — these are backlog items** |
| C8 | Dispatch eligibility & starvation diagnosis | 9 | 16 | **Build — phase 1** |
| C10 | Lane recovery & verification repair | 9 | 14 | **Split — phase 3** |
| C14 | Decision docket generation & publishing | 7 | 13 | **Already filed (#3277/#3562)** — do not re-file |
| C15 | Transcript inspection & run-quality scoring | 6 | 8 | **Build — phase 2** (skills exist, promote them) |
| C16 | Incident detection, alerting, watchdog | 5 | 8 | **No — build work, file separately** |
| | **Total** | **236** | **~413** | |

## Phase 1 — read-only observability (build first)

Six operations, all pure reads. No mutation, no gate-self exposure, no blast radius beyond a wrong answer
on stdout. Together they cover ~114 of the 413 gap dispatches — the largest return in the plan and the
safest. **Build all six before touching anything in phase 2**, because three of the phase-2/3 write
operations want these readers as their `-io` layer anyway.

### 1. `runner-activity` — *fresh build* (C1: 9 rows, ~33 dispatches)

**Purpose.** Answer "is the driver alive, advancing ticks, and dispatching real work?" from durable state,
in one call, without a shell archaeology session.

The single biggest gap in the audit. Row *Check ongoing agent progress* alone fired 13 times and
*Read live driver activity* 9 more, each one an ad hoc dig through processes, logs and git diffs. The
session even dispatched twice (row *Build runner-activity operation/skill*) asking for exactly this
operation to exist — it is self-evidently the right first build.

- **Extends vs fresh:** fresh operation, but it must **reuse the readers in
  `we:scripts/operations/restart-runner-io.mjs`** rather than re-deriving lifecycle facts. If a fact is
  already read there, import it; do not fork a second reader.
- **Done when:** `we:scripts/operations/run.mjs runner-activity --json` returns, for the live runner: pid +
  liveness evidence, last tick timestamp and tick number, the dispatches in flight with their launch kind
  and age, the last N completed dispatches with outcome, and an explicit `stalled: true|false` with the
  *reason* for the verdict. It distinguishes **alive-and-idle** from **alive-and-stalled** from **dead** —
  conflating those three is what cost 13 dispatches. It must answer correctly with no runner running
  (`state: "down"`, not a crash), and it must never block: a hard read timeout, no polling loop.
- **Companion skill:** `we:skills-src/runner-status/SKILL.md` — teaches that this replaces the `ps` +
  tail-the-log + `git log` triangulation tonight's sessions kept reinventing; says plainly that a quiet
  runner is not a stalled runner and points at the `stalled` reason field instead of guessing; and states
  the negative case — this is a **read**, it never restarts anything (that is `restart-runner`) and never
  clears records (that is `clear-stuck-session`).

### 2. `pr-reconcile` — *extends `we:scripts/operations/pr-status.mjs`* (C3 read half: ~20 of 42 dispatches)

**Purpose.** One truthful table of every PR the conveyor cares about: state, labels, why each is held, and
what would unblock it.

`we:scripts/operations/pr-status.mjs` today checks CI evidence on an *open* PR. Four separate audit rows
wanted lifecycle state across *all* states (merged, closed, superseded), three wanted the hold *reason*
read out of labels **and** comments, four wanted to know why an advisory never ran. That is one report,
asked four ways.

- **Extends vs fresh:** extend `we:scripts/operations/pr-status.mjs` /
  `we:scripts/operations/pr-status-io.mjs`. Add an all-state query and a hold-explanation reducer; do not
  start a second PR reader.
- **Done when:** `we:scripts/operations/run.mjs pr-reconcile --json` lists, per PR: state, mergeability,
  required-check status, every `review:*` label, and a **derived `heldBy`** — one of `human`,
  `advisory-pending`, `stand-down`, `conflict`, `dependency`, `none` — each with the label or comment it
  was derived from. It reads comment bodies, not just labels (the audit's *Explain actual PR holds* row
  failed specifically because labels alone were insufficient). A PR with no hold reports `heldBy: none`
  rather than being omitted. Output is stable enough to diff between runs.
- **Companion skill:** `we:skills-src/pr-reconcile/SKILL.md` — teaches reaching for this *before*
  dispatching a review or a human-approval pass, since roughly half of tonight's PR dispatches were
  re-establishing state that this answers; and draws the line hard: it **explains** holds, it never clears
  them, never labels, never merges. Cross-PR arbitration ("which of these two rival PRs wins") is
  explicitly **not** this operation — that stays ad hoc, see below.

### 3. `dispatch-eligibility` — *extends `we:scripts/operations/dispatch-lane.mjs`* (C8: 9 rows, ~16 dispatches)

**Purpose.** Explain, for one item or for the whole queue, exactly why it is or is not being dispatched.

Deterministic by construction — the admission predicate already exists inside
`we:scripts/operations/dispatch-lane.mjs`; it just never *reports* its reasoning. Three separate
*Diagnose dispatch starvation* dispatches and an *Explain build-queue eligibility* dispatch were all
reverse-engineering a decision the code already makes.

- **Extends vs fresh:** extend `we:scripts/operations/dispatch-lane.mjs` /
  `we:scripts/operations/dispatch-lane-io.mjs` — expose the existing admission evaluator as a reporting
  mode. **Do not reimplement the predicate**; a second copy that drifts from the real one is worse than no
  operation, because it would confidently lie.
- **Done when:** `we:scripts/operations/run.mjs dispatch-eligibility --item=NNN` prints every admission
  gate in order with pass/fail and the observed value (readiness, `status`, `blockedBy` closure, queue
  membership, `deliveryAgent` / `deliveryTarget` markers, existing-PR check, lane capacity, scope overlap).
  With no `--item` it does the same for the whole queue and names the **first blocking gate** per item. A
  regression test proves the report and the real dispatcher agree on a fixture queue — same predicate,
  same answer.
- **Companion skill:** `we:skills-src/why-not-dispatching/SKILL.md` — teaches that "the runner looks alive
  but nothing is moving" is this operation's question, not `runner-activity`'s; that the answer is usually
  one named gate, not a mystery; and that its output is the correct *input* to filing a starvation bug,
  replacing the ad hoc trace tonight's sessions ran three times.

### 4. `stale-state` — *extends `we:scripts/operations/clear-stuck-session-io.mjs`* (C2 read half: ~15 of 24 dispatches)

**Purpose.** Inventory every claim, lane lease, session record and watcher, with the liveness evidence for
each, and mark which are demonstrably dead.

Five *Audit lane occupancy* dispatches, three *Inspect abandoned lane state*, plus phantom-PID and
dead-owner-lease rows all wanted this one inventory. The **read is separated from the reap on purpose** —
the reap is destructive and lands in phase 3; the read is safe and is needed now.

- **Extends vs fresh:** extend `we:scripts/operations/clear-stuck-session-io.mjs`, which already assesses
  session liveness. Widen it from sessions to the full set: sessions, lane leases, backlog claims,
  orphaned watcher shells.
- **Done when:** `we:scripts/operations/run.mjs stale-state --json` lists every claim/lease/session/watcher
  with owner, recorded pid, **observed** pid liveness, age, and a `verdict` of `live` / `dead` / `unknown` —
  where `unknown` (a null or unreadable pid) is reported as `unknown` and **never silently as dead**. It
  reports leases whose owner is dead but whose work is unpushed *separately* from ones safe to release,
  because the audit shows those need different handling. It mutates nothing.
- **Companion skill:** `we:skills-src/stale-state/SKILL.md` — teaches running this before concluding the
  pool is full or a lane is abandoned; names the trap the audit caught twice (a null pid is not proof of
  death, it is absence of evidence); and directs the actual cleanup to `clear-stuck-session` (today) or
  `reap-stale-state` (phase 3), never to hand-editing lease files.

### 5. `harness-coverage` — *fresh build* (C13 read half: ~3 dispatches)

**Purpose.** Report which dispatch launch kinds are wired to a mechanical wrapper and which still hand the
agent a prose brief.

Low frequency (3 dispatches) but included in phase 1 on **risk**, not volume: it is the standing
conformance check for epic #3643, it is a handful of lines over
`we:scripts/operations/dispatch-provider-registry.mjs`, and without it "which kinds are wired?" gets
re-audited by hand every time a child of #3643 lands.

- **Extends vs fresh:** fresh, thin, reading `we:scripts/operations/dispatch-provider-registry.mjs` and the
  `we:scripts/operations/` wrapper set.
- **Done when:** `we:scripts/operations/run.mjs harness-coverage` lists all seven launch kinds with wrapper
  path (or `none`), wired yes/no, and whether the agent brief still carries lifecycle commands. It **fails
  non-zero when a kind regresses from wired to unwired**, so it can be folded into `check:standards` later.
- **Companion skill:** none. This is a gate-shaped check with one obvious invocation and no judgment to
  package — adding a skill here would be ceremony. *(Noting the absence deliberately: not every operation
  earns a skill, and pretending otherwise dilutes the ones that do.)*

### 6. `heavy-admission-audit` — *extends `we:scripts/readiness/heavy-admission.mjs`* (C12 read half: ~5 of 14 rows, ~7 of 18 dispatches)

**Purpose.** Report which commands are wired through the shared heavy-command capacity semaphore (#3461,
ratified by #3456), whether observed concurrency matches what the semaphore actually admitted, and surface
bypasses and slot-reentrancy leaks — without fixing any of them.

Three *Audit heavy-command admission* dispatches, plus *Wire instructions to heavy admission*,
*Record/probe container parallelism* and *Assess shared heavy-operation queue*, were all hand-tracing a
decision `we:scripts/readiness/heavy-admission.mjs` already makes and records — exactly the shape
`dispatch-eligibility` (#3) covers for `we:scripts/operations/dispatch-lane.mjs`'s predicate and
`harness-coverage` (#5) covers for the dispatch-provider registry, applied to the *other* declared capacity
gate. The module is real and already shipped (`resolveCap`, `tryAcquireSlot`, `releaseOwnedSlot`,
`heldSlots`, `admissionStatus`) but is not wired to any declared operation —
`we:scripts/operations/run.mjs --list` names nothing under "heavy" today.

- **Extends vs fresh:** extend `we:scripts/readiness/heavy-admission.mjs` — it already exports the slot
  ledger and lock-file layout; expose them as a reporting mode. **Do not fork a second slot reader**, the
  same discipline `dispatch-eligibility` states for the dispatch predicate.
- **Done when:** `we:scripts/operations/run.mjs heavy-admission-audit` lists every known heavy-command call
  site (the ones named in `we:AGENTS.md`'s Definition of Done plus the actual
  `we:scripts/readiness/heavy-admission.mjs` invocation sites) with wired yes/no — mirroring
  `harness-coverage`'s shape — the currently held/free slots with owner, pid and age, and flags two named
  defects the audit hit by hand tracing: a **bypass** (a heavy command observed running outside the
  semaphore) and a **reentrancy leak** (one lane holding more than one slot at once). It is **read-only**: it
  reports a bypass or a leak, it never closes one — closing one is a normal code fix, not this operation.
  Exits non-zero when a known call site is found unwired, so it can fold into `check:standards` the same way
  `harness-coverage` does.
- **Companion skill:** `we:skills-src/heavy-admission-audit/SKILL.md` — teaches reaching for this instead of
  hand-tracing "did concurrent lanes oversubscribe the host" (the audit's *Audit heavy-command admission*
  ×3); states the negative case plainly: it reports wiring and slot state, it never wires a new call site
  itself and never kills or reaps a process holding a stuck slot (that is incident response — an ordinary
  bug, same disposition as C16 below, not this operation's job).

## Phase 2 — mechanical writes, bounded blast radius

### 7. `critique-draft` — *extends `we:scripts/operations/review-prep.mjs`* (C4: 3 rows, ~20 dispatches)

**Purpose.** Run a read-only adversarial screen over an arbitrary draft (a decision fork, a proposal, a
scope amendment) and return structured findings.

**The cleanest candidate in the whole audit.** 20 dispatches, every one of them D2-nested (a subagent
spawning a critic) — *Adversarial decision-fork review* ×10 and *Fresh-context two-confusion screen* ×8.
The shape never varied: hand a draft to a fresh-context skeptic, get findings back, change nothing. Fully
mechanical to wire, zero blast radius (it writes nothing), and it removes 18 hand-built nested dispatches.

- **Extends vs fresh:** extend `we:scripts/operations/review-prep.mjs`, which already reviews
  *preparation*. Generalise its subject from "a prepared decision on disk" to "any draft passed in", and
  add named screens — the two-confusion screen (merit vs rollout cost; observable contract vs
  implementation detail) is a *named lens*, not a separate operation.
- **Done when:** `we:scripts/operations/run.mjs critique-draft --file=<path> --lens=<name>` returns
  structured findings (`severity`, `claim`, `evidence`) for a draft that is **not** a backlog decision
  card — a scratch file must work, since the audit shows most subjects were scratch drafts.
  `--lens=two-confusion` reproduces tonight's screen. It is **read-only**: it never edits the draft, never
  stamps `preparedDate`, never ratifies. Running it on a known-flawed fixture surfaces the planted flaw.
- **Companion skill:** `we:skills-src/critique-draft/SKILL.md` — teaches that this replaces hand-spawning a
  nested skeptic subagent (the exact pattern repeated 18 times tonight); that the lens name is the dial,
  not the model tier, per `we:agent-memory-src/right-size-the-panel-count-not-model-tier.md`; and that it
  is advisory only — it produces findings, never a verdict that gates anything.

### 8. `mark-delivery` — *extends `we:scripts/operations/delivery-agent-marker.mjs`* (C7 part: ~6 dispatches)

**Purpose.** Set or correct an item's `deliveryAgent` / `deliveryTarget` routing metadata.

Four *Mark backlog work for Codex* dispatches plus *Correct deliveryTarget metadata*. Tiny, entirely
mechanical, and it currently requires hand-editing frontmatter — which is how the audit's
*Fix routing-marker read order* bug got in.

- **Extends vs fresh:** extend the existing `we:scripts/operations/delivery-agent-marker.mjs`; route writes
  through the same guarded writer `scaffold` / `claim` use, so the lane-not-primary refusal and the #883
  locus scan still apply.
- **Done when:** `we:scripts/operations/run.mjs mark-delivery --item=NNN --agent=codex [--target=<branch>]`
  sets the fields, refuses with a **named** reason on an unknown agent or a nonexistent branch, and is
  idempotent. It refuses on a `resolved` item rather than silently marking it.
- **Companion skill:** folded into `queue-item` below — these two are one workflow in practice (mark, then
  enqueue) and two skills for one workflow is exactly the packaging noise that stops agents reaching for
  either.

### 9. `queue-item` — *extends `we:scripts/operations/file-item.mjs`* (C7 part: ~2 dispatches, high leverage)

**Purpose.** Admit an **already-filed** item to the queue.

Low count (2) but a genuine structural hole the audit named precisely:
`we:scripts/operations/file-item.mjs` queues items it *creates*, and there is no declared way to enqueue
one that already exists. Cheap to add, and it closes a sharp edge.

- **Extends vs fresh:** extend `we:scripts/operations/file-item.mjs` — reuse its `queuePlan` / `queueAdd`
  steps rather than writing a second queue writer.
- **Done when:** `we:scripts/operations/run.mjs queue-item --item=NNN` adds an existing item to the queue,
  refuses a nonexistent/resolved item by name, and is idempotent on an already-queued item.
- **Companion skill:** `we:skills-src/queue-item/SKILL.md` — covers both #7 and #8: teaches the
  mark-then-enqueue pair as one workflow, and states the rule the audit shows being missed — filing and
  queueing are separate acts, and an item filed with `queue=false` needs this operation, not a re-file.

### 10. `backlog-identity` — *extends `we:scripts/operations/scaffold.mjs`* (C7 part: ~5 dispatches)

**Purpose.** Detect and repair invalid, duplicated or hand-assigned backlog ids without breaking lineage.

Three *Repair backlog numbering/identity* dispatches plus two more that tripped over it mid-task. **Risk
note:** this touches the id invariant, which is statute-tier — `NNN` is immutable and on a collision the
*newer* item yields. That rule must be encoded in the operation, not left to the caller's memory, which is
exactly why it is worth declaring.

- **Extends vs fresh:** extend `we:scripts/operations/scaffold.mjs`'s numbering/collision logic; it already
  owns hash minting and the JIT-numbering contract (#2288).
- **Done when:** `we:scripts/operations/run.mjs backlog-identity --check` reports collisions, malformed
  prefixes, hash-vs-number mismatches and dangling `blockedBy` / `parent` edges, exiting non-zero on any.
  `--repair` fixes only the **newer** side of a collision and rewrites its inbound edges atomically; it
  **refuses to renumber an item that already has an `NNN`**, per the immutability rule, and says so by
  name. Repair is a no-op when `--check` is clean.
- **Companion skill:** `we:skills-src/backlog-identity/SKILL.md` — teaches running `--check` as a cheap
  pre-flight before a batch or a drain, and states the two statute rules in one line each (a landed `NNN`
  is permanent; the newer item yields) so an agent does not have to have read
  `we:docs/agent/backlog-workflow.md` to stay safe.

### 11. `epic-reconcile` — *fresh build* (C7 part: 7 dispatches)

**Purpose.** Compare an epic's tracker state against the real state of its children and the code, and
report the drift.

Seven dispatches of *Maintain epic progress and findings* — the third-highest single row in the audit.
Today this is pure hand-reconciliation and it silently rots between sessions.

- **Extends vs fresh:** fresh, reading `we:src/_data/backlog.js`; **read-first**, with writes behind an
  explicit flag.
- **Done when:** `we:scripts/operations/run.mjs epic-reconcile --item=NNN` lists every child with status,
  open/resolved, blocked-by closure, and flags the drift cases: resolved children whose work is not in
  `main`, open children superseded by landed work, and the `all slices done` condition. Default is
  **report-only**; `--apply` amends only the epic's own body, never a child's status — child resolution
  stays with `we:scripts/operations/resolve.mjs`, which has its own gate.
- **Companion skill:** `we:skills-src/epic-reconcile/SKILL.md` — teaches running it at the top of any
  session touching a standing epic (the audit shows the drift accumulating across seven separate
  reconstructions) and is explicit that it reports drift, it does not resolve anything.

### 12. `inspect-run` — *promote existing skills* (C15: 6 rows, ~8 dispatches)

**Purpose.** Read back what a dispatched run actually did — Claude subagent or Codex — from its transcript.

The `we:skills-src/inspect-agent-health/` and `we:skills-src/inspect-codex-transcript/` skills already
exist and work. The gap is that they are *skills only*, so nothing mechanical (a wrapper, the runner, a
scorecard writer) can call them.

- **Extends vs fresh:** wrap the existing skills' logic as a declared operation. **Do not rewrite the
  transcript readers** — the skills are the tested path; the operation is a calling surface over them.
- **Done when:** `we:scripts/operations/run.mjs inspect-run --session=<id>` returns a bounded transcript
  tail, the commands run, outcome and token spend, for both Claude and Codex runs, selecting the reader by
  run kind. It is bounded by construction — never reads a whole transcript — and reports a missing session
  as a named refusal rather than an empty success (the audit's *Repair transcript-inspection findings* row
  is exactly this bug).
- **Companion skill:** the two existing skills stay as the human front doors and gain a line each pointing
  at the operation as the programmatic surface. **No new skill** — a third skill over the same two readers
  would be the packaging bloat this epic is trying to fix.

## Phase 3 — mutating and judgment-adjacent (build last, verify hardest)

### 13. `reap-stale-state` — *extends `we:scripts/operations/clear-stuck-session.mjs`* (C2 write half: ~9 dispatches)

**Purpose.** Release leases and quarantine records that `stale-state` proved dead.

Destructive, and it can cause **real data loss** — releasing a lease whose lane holds unpushed work
discards it. Phase 3, hardest verification tier, and it must consume phase 1's `stale-state` rather than
re-deriving liveness.

- **Extends vs fresh:** extend `we:scripts/operations/clear-stuck-session.mjs`, which already has the
  liveness-check + human-confirm shape. Widen from sessions to leases and claims.
- **Done when:** it acts **only** on entries `stale-state` marks `dead`, refuses `unknown` outright,
  refuses any lease whose lane has uncommitted or unpushed work (reporting it for human handling instead),
  and keeps the existing human-confirmation gate. A dry-run mode prints exactly what would be released.
  The reaper integration (audit row *Integrate reaper with stale cleanup*) routes through this, not around
  it.
- **Companion skill:** `we:skills-src/reap-stale-state/SKILL.md` — teaches the two-step discipline
  (`stale-state` first, always; never reap on a hunch), names the unpushed-work refusal as a feature rather
  than an obstacle to work around, and states plainly that `unknown` is not `dead`.

### 14. `poc-land` (register) + `poc-sync` — *register existing + extend* (C9: ~10 of 20 dispatches)

**Purpose.** Land onto and keep current the registered prototype branches.

`we:scripts/operations/poc-land.mjs` **already exists and works** but is standalone, not registered — so
nothing declared can call it, and three separate dispatches hand-rolled prototype landing. `poc-sync`
covers the three *Synchronize prototype with main* dispatches. #3638 already tracks the POC branches
registry; this entry must **build on #3638, not duplicate it**.

- **Extends vs fresh:** register the existing `we:scripts/operations/poc-land.mjs` as a declared operation
  (near-zero build); `poc-sync` is a new sibling over the same registry and write lock.
- **Done when:** `we:scripts/operations/run.mjs poc-land` reaches the existing script unchanged;
  `we:scripts/operations/run.mjs poc-sync --branch=<b>` takes the same write lock, integrates `main`, and
  **refuses rather than resolves a conflict**, reporting the conflicted paths. Neither ever touches an
  unregistered branch.
- **Companion skill:** `we:skills-src/poc-branch/SKILL.md` — one skill for the pair: teaches that a
  `deliveryTarget` item lands through `poc-land` and never through the PR path, that sync refuses conflicts
  by design, and that no review tax applies on a POC landing (the #3637 ruling) — which is the single most
  misunderstood rule in tonight's prototype dispatches.

### 15. `rescue-lane` — *composes `stale-state` + `verify` + `open-pr`* (C10: ~6 of 14 dispatches)

**Purpose.** Inventory work stranded in an abandoned lane and, where it verifies clean, land it.

**Deliberately scoped down.** Full "recovery" is judgment — deciding whether stranded work is still wanted
is not mechanisable. What *is* mechanical is the inventory and the verify→PR chain once a human says keep.

- **Extends vs fresh:** composition, not new logic. `stale-state` finds the lane,
  `we:scripts/operations/verify.mjs` gates, `we:scripts/operations/open-pr.mjs` submits.
- **Done when:** `we:scripts/operations/run.mjs rescue-lane --lane=N` reports the lane's unpushed commits
  and dirty paths with a diffstat and makes **no** keep/discard decision. `--land` runs verify then
  `open-pr`, and **aborts on a failing gate without opening a PR** — never bypasses the gate, which is the
  specific failure mode the audit's *Fix lane-checkout verification failures* rows describe.
- **Companion skill:** `we:skills-src/rescue-lane/SKILL.md` — teaches that the inventory is free and the
  landing is gated; is explicit that deciding whether stranded work is still wanted is the operator's call,
  not the operation's; and points at `reap-stale-state` for the lane afterwards.

### 16. `graduation-report` — *fresh, read-only over existing stores* (C5 read half: ~6 of 41 dispatches)

**Purpose.** Report each provider/role's accumulated trial evidence against its graduation criteria.

**Only the read half.** Four *Audit graduation progress* dispatches wanted a report; the other ~35
dispatches in C5 are the *trials themselves*, which stay ad hoc (see below). The evidence stores already
exist (`we:scripts/operations/record-verdict.mjs`, `we:scripts/operations/delivery-report-store.mjs`,
`we:scripts/operations/fix-report-store.mjs`); nothing reads across them.

- **Extends vs fresh:** fresh reader over the existing stores. **Write nothing** — if a scorecard is
  missing, that is a bug in the writer (already filed), not something this operation should backfill.
- **Done when:** `we:scripts/operations/run.mjs graduation-report` shows, per provider/role: trials run,
  outcomes, the criteria, and the gap to graduation. Missing evidence is reported as **missing**, never
  inferred or interpolated. It renders a bare report with zero trials rather than erroring.
- **Companion skill:** `we:skills-src/graduation-report/SKILL.md` — teaches checking the evidence *before*
  proposing a provider be graduated or vetoed, and states the boundary: it reports evidence, it does not
  judge sufficiency, and it never grants or clears a veto.

### 17. `record-rule` — *extends `we:scripts/conveyor/learnings-drop.mjs`* (C6 write half: ~12 of 33 dispatches)

**Purpose.** Write a durable rule to an **explicitly named** home, correctly shaped for that home.

C6 is 33 dispatches of "persist this instruction", and it is genuinely split: the *write* is mechanical,
but **choosing the home** — a memory sub-index vs `we:docs/agent/` vs
`we:docs/agent/platform-decisions.md` — is judgment and stays with the agent. So the operation takes the
home as a required argument and refuses to guess.

- **Extends vs fresh:** extend `we:scripts/conveyor/learnings-drop.mjs` and the
  `we:skills-src/capture-learning/` path — the pool, the scrub and the schema already exist. **Do not
  build a second memory writer.**
- **Done when:** `we:scripts/operations/run.mjs record-rule --home=<target> --rule='…'` writes in the shape
  that home requires (memory sub-index entry vs doc section vs statute clause) and **refuses without an
  explicit `--home`**, naming the candidates rather than picking one. `check:standards` passes on the
  result. It never edits the always-loaded memory index directly — that is the tree-index invariant
  (memory rule 9).
- **Companion skill:** `we:skills-src/record-rule/SKILL.md` — teaches the split in one line (the write is
  mechanical, the home is your call), lists the homes and what each is for, and names the rule agents kept
  missing tonight: a ratified decision is codified in `we:docs/agent/platform-decisions.md`, not dropped in
  agent memory.

## What must NOT become an operation

Stated plainly, because the failure mode here is padding the plan to look thorough:

- **Cross-PR arbitration** (C3, ~14 dispatches) — "which of these two rival PRs wins", "is #2113
  superseded". Every instance needed the actual design tradeoff weighed. `pr-reconcile` gives an arbiter
  the facts; the call stays ad hoc. An operation that *decided* this would be confidently wrong.
- **Provider trials and calibration** (C5, ~35 dispatches) — the *largest* single ad-hoc cluster, and
  correctly so. "Run Codex on a real diff and assess whether it caught the bug" is an experiment. Build the
  scorecard store and `graduation-report`; leave the trials to judgment.
- **One-off harness bug fixes** (C17, 15 rows) — diff-buffer overflow, PR-number propagation,
  delivery-report path, Gemini worktree quoting. These are **backlog items**, several already filed (#3647,
  #3671). Filing them is `file-item`, which already exists and already matched.
- **One-off prior-art research** (C18, 15 rows) — Gerrit grouping conventions, stacked-PR tooling,
  pre-subagent hooks. `we:scripts/operations/explore.mjs` already covers this shape and the audit marked
  one such row a clean MATCH. The gap is that agents did not *reach* for it — a skill problem, not an
  operation problem.
- **Incident detection and watchdog design** (C16) — build work with a design call inside it. File as
  ordinary items.
- **Choosing where a rule lives** (the other half of C6) — see `record-rule` above. The operation writes;
  the routing is judgment and must stay so.
- **Decision docket publishing** (C14, 13 dispatches) — **already filed as #3277**, blocked-on by #3562.
  Listed here only so it is not re-filed as a duplicate. Do not open a new card.
- **Container execution & the semaphore's own build defects** (C12 build half, ~9 of 14 rows, ~11 of 18
  dispatches) — the container POC (*Build heavy-command container POC*), extending it to tests (*Extend
  container execution to tests*), the container credential/auth transport (*Research container subscription
  authentication*, *Correct container auth/billing record*), isolation verification (*Test Antigravity
  container isolation*), sequencing (*Record container sequencing*), the semaphore's own concurrency bug
  (*Fix heavy-slot reentrancy*), and the two runaway-process incidents that surfaced through it (*Diagnose
  runaway history search*, *Kill runaway diagnostic shells*) are new dispatch/execution infrastructure and
  one-off incident response — exactly what `we:docs/agent/prototype-based-dev.md` says to **park until
  genuinely exercised end to end**, never declare as a mechanical operation while the design (the container
  auth model, the isolation boundary, correct slot accounting under real concurrent lanes) is still being
  worked out. Each stays a backlog item under the container-execution effort or gets filed individually, the
  same disposition C16/C17 already get above. `heavy-admission-audit` (operation 6) covers only the read
  half — the wiring/state report — and was the one piece of C12 genuinely shaped like every other phase-1
  operation: a report over a predicate the code already computes.

## Build and verify pattern

Per tonight's established convention:

- **Delegate the build to Codex or Gemini.** Every operation above is well-scoped with explicit acceptance
  criteria — the condition `we:skills-src/use-codex/SKILL.md` names for delegation. Route through the
  normal delivery path (`deliveryAgent`, `dispatch-lane`) rather than hand-spawning, since proving that
  path is itself a goal of #3383.
- **Scale the Claude verification tier by risk, not uniformly** — per
  `we:agent-memory-src/right-size-the-panel-count-not-model-tier.md`, scale by seat **count**, never by
  dropping model tier, and name the rung before adding a seat:
  - *Phase 1 (read-only)* — one Claude verifier on the returned diff. A wrong read is embarrassing, not
    dangerous. No panel.
  - *Phase 2 (bounded writes)* — one verifier, plus `critique-draft` on the acceptance criteria before the
    build starts. `backlog-identity` is the exception in this phase: it touches the statute-tier id
    invariant and gets the phase-3 treatment.
  - *Phase 3 (destructive / statute-adjacent)* — two decorrelated verifiers on different angles (one on
    correctness, one red-teaming the refusal paths), both at full tier. `reap-stale-state` additionally
    needs a live-fire dry-run against real stale state before it is allowed to reap anything.
- **Every operation lands with its companion skill in the same PR.** An operation without a skill is an
  operation no agent finds — demonstrated 236 times tonight. Where an entry above declares *no* skill
  (`harness-coverage`, `inspect-run`), that is a deliberate call recorded in the entry, not an omission.
- **Seam-by-seam, not one batch.** Each operation is independently deliverable and independently testable.

## Done when

1. **Executable** — `we:scripts/operations/run.mjs --list` names all of `runner-activity`, `pr-reconcile`,
   `dispatch-eligibility`, `stale-state`, `harness-coverage` and `heavy-admission-audit` (phase 1), each
   exits 0 on a clean repo, and `harness-coverage`/`heavy-admission-audit` each exit non-zero when a known
   call site regresses to unwired. Fails today; passes when phase 1 lands.
2. **Children filed** — the 17 operations above exist as child items under this epic, each carrying its own
   acceptance criteria and its companion-skill line, in the phase order given.
3. **Coverage re-measured** — the dispatch audit is re-run against the enlarged operation set and the
   ~235-dispatch target band is demonstrably reduced. A second audit that shows no movement means the
   operations were built but not *packaged*, and the skills are the fix.
4. **No duplicate cards** — nothing here is re-filed against #3277, #3562, #3638, #3643 or #3671; those
   clusters are cross-referenced, not re-opened.
